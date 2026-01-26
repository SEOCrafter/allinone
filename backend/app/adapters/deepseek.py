from typing import AsyncIterator, Optional
from dataclasses import dataclass
import httpx
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType


@dataclass
class DeepSeekBalance:
    """Информация о балансе DeepSeek."""
    balance: float
    currency: str
    granted_balance: float  # Бесплатные кредиты
    topped_up_balance: float  # Пополненные


class DeepSeekAdapter(BaseAdapter):
    name = "deepseek"
    display_name = "DeepSeek"
    provider_type = ProviderType.TEXT

    BASE_URL = "https://api.deepseek.com"

    # Цены за 1K токенов USD (cache miss pricing)
    # Cache hit = 10x дешевле
    PRICING = {
        "deepseek-chat": {"input": 0.00028, "output": 0.00042, "cache_hit": 0.000028},
        "deepseek-reasoner": {"input": 0.00028, "output": 0.00042, "cache_hit": 0.000028},
    }

    def __init__(self, api_key: str, default_model: str = "deepseek-chat", **kwargs):
        super().__init__(api_key, **kwargs)
        self.default_model = default_model

    async def generate(self, prompt: str, **params) -> GenerationResult:
        model = params.get("model", self.default_model)
        messages = params.get("messages") or [{"role": "user", "content": prompt}]
        max_tokens = params.get("max_tokens", 2048)
        temperature = params.get("temperature", 0.7)

        if params.get("system_prompt"):
            messages.insert(0, {"role": "system", "content": params["system_prompt"]})

        # OpenAI-compatible API
        request_body = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=request_body,
                )

                if response.status_code != 200:
                    error_data = response.json()
                    return GenerationResult(
                        success=False,
                        error_code=f"HTTP_{response.status_code}",
                        error_message=error_data.get("error", {}).get("message", "Unknown error"),
                        raw_response={"request": request_body, "response": error_data},
                    )

                data = response.json()
                usage = data.get("usage", {})
                
                # DeepSeek возвращает кэш статистику
                tokens_in = usage.get("prompt_tokens", 0)
                tokens_out = usage.get("completion_tokens", 0)
                cache_hit = usage.get("prompt_cache_hit_tokens", 0)
                cache_miss = usage.get("prompt_cache_miss_tokens", 0)
                
                # Reasoning tokens (для deepseek-reasoner)
                reasoning_tokens = usage.get("completion_tokens_details", {}).get("reasoning_tokens", 0)

                # Расчёт стоимости с учётом кэша
                cost = self.calculate_cost(
                    tokens_in, tokens_out,
                    model=model,
                    cache_hit_tokens=cache_hit,
                    cache_miss_tokens=cache_miss
                )

                # Контент
                content = data["choices"][0]["message"]["content"]
                
                # Для reasoner - reasoning_content отдельно
                reasoning_content = data["choices"][0]["message"].get("reasoning_content")

                return GenerationResult(
                    success=True,
                    content=content,
                    tokens_input=tokens_in,
                    tokens_output=tokens_out,
                    provider_cost=cost,
                    raw_response={
                        "request": request_body,
                        "response": data,
                        "cache_hit_tokens": cache_hit,
                        "cache_miss_tokens": cache_miss,
                        "reasoning_tokens": reasoning_tokens,
                        "reasoning_content": reasoning_content,
                    },
                )

        except httpx.TimeoutException:
            return GenerationResult(
                success=False,
                error_code="TIMEOUT",
                error_message="Request timed out",
                raw_response={"request": request_body},
            )
        except Exception as e:
            return GenerationResult(
                success=False,
                error_code="EXCEPTION",
                error_message=str(e),
                raw_response={"request": request_body},
            )

    async def generate_stream(self, prompt: str, **params) -> AsyncIterator[str]:
        model = params.get("model", self.default_model)
        messages = params.get("messages") or [{"role": "user", "content": prompt}]
        max_tokens = params.get("max_tokens", 2048)
        temperature = params.get("temperature", 0.7)

        request_body = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=request_body,
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: ") and line != "data: [DONE]":
                        import json
                        try:
                            chunk = json.loads(line[6:])
                            delta = chunk["choices"][0].get("delta", {})
                            if "content" in delta:
                                yield delta["content"]
                        except json.JSONDecodeError:
                            continue

    def calculate_cost(self, tokens_input: int, tokens_output: int, **params) -> float:
        model = params.get("model", self.default_model)
        pricing = self.PRICING.get(model, self.PRICING["deepseek-chat"])
        
        # Учёт кэша
        cache_hit = params.get("cache_hit_tokens", 0)
        cache_miss = params.get("cache_miss_tokens", 0)
        
        if cache_hit or cache_miss:
            # Точный расчёт с кэшем
            cost_hit = (cache_hit / 1000) * pricing["cache_hit"]
            cost_miss = (cache_miss / 1000) * pricing["input"]
            cost_output = (tokens_output / 1000) * pricing["output"]
            return cost_hit + cost_miss + cost_output
        else:
            # Без кэша - стандартный расчёт
            return (tokens_input / 1000 * pricing["input"]) + (tokens_output / 1000 * pricing["output"])

    async def get_balance(self) -> DeepSeekBalance:
        """Получить баланс аккаунта (уникальная фича DeepSeek)."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.BASE_URL}/user/balance",
                headers={"Authorization": f"Bearer {self.api_key}"},
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to get balance: {response.text}")
            
            data = response.json()
            info = data.get("balance_infos", [{}])[0]
            
            return DeepSeekBalance(
                balance=float(info.get("total_balance", 0)),
                currency=info.get("currency", "USD"),
                granted_balance=float(info.get("granted_balance", 0)),
                topped_up_balance=float(info.get("topped_up_balance", 0)),
            )

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "max_tokens": 128_000,  # 128K context
            "streaming": True,
            "vision": False,
            "function_calling": True,
            "balance_api": True,  # Уникальная фича
            "context_caching": True,  # Автоматический кэш
            "reasoning": True,  # deepseek-reasoner
        }