from typing import AsyncIterator, Optional
import httpx
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType


class DeepSeekAdapter(BaseAdapter):
    name = "deepseek"
    display_name = "DeepSeek"
    provider_type = ProviderType.TEXT

    BASE_URL = "https://api.deepseek.com"

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

        system_prompt = params.get("system_prompt") or "Отвечай на русском языке."
        messages.insert(0, {"role": "system", "content": system_prompt})

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

                tokens_in = usage.get("prompt_tokens", 0)
                tokens_out = usage.get("completion_tokens", 0)
                cache_hit = usage.get("prompt_cache_hit_tokens", 0)
                cache_miss = usage.get("prompt_cache_miss_tokens", 0)

                cost = self.calculate_cost(
                    tokens_in, tokens_out,
                    model=model,
                    cache_hit_tokens=cache_hit,
                    cache_miss_tokens=cache_miss
                )

                content = data["choices"][0]["message"]["content"]

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

        system_prompt = params.get("system_prompt") or "Отвечай на русском языке."
        messages.insert(0, {"role": "system", "content": system_prompt})

        request_body = {
            "model": model,
            "messages": messages,
            "max_tokens": params.get("max_tokens", 2048),
            "temperature": params.get("temperature", 0.7),
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

        cache_hit = params.get("cache_hit_tokens", 0)
        cache_miss = params.get("cache_miss_tokens", 0)

        if cache_hit or cache_miss:
            cost_hit = (cache_hit / 1000) * pricing["cache_hit"]
            cost_miss = (cache_miss / 1000) * pricing["input"]
            cost_output = (tokens_output / 1000) * pricing["output"]
            return cost_hit + cost_miss + cost_output
        else:
            return (tokens_input / 1000 * pricing["input"]) + (tokens_output / 1000 * pricing["output"])

    async def get_balance(self) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.BASE_URL}/user/balance",
                headers={"Authorization": f"Bearer {self.api_key}"},
            )

            if response.status_code != 200:
                raise Exception(f"Failed to get balance: {response.text}")

            data = response.json()
            info = data.get("balance_infos", [{}])[0]

            return {
                "balance": float(info.get("total_balance", 0)),
                "currency": info.get("currency", "USD"),
                "granted_balance": float(info.get("granted_balance", 0)),
                "topped_up_balance": float(info.get("topped_up_balance", 0)),
            }

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "max_tokens": 128000,
            "streaming": True,
            "vision": False,
            "function_calling": True,
            "balance_api": True,
        }