from typing import AsyncIterator, Optional
import httpx
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType


class OpenAIAdapter(BaseAdapter):
    name = "openai"
    display_name = "OpenAI"
    provider_type = ProviderType.TEXT
    
    BASE_URL = "https://api.openai.com/v1"
    
    # Актуальные модели на январь 2026 (цены за 1K токенов USD)
    PRICING = {
        # GPT-5.x series
        "gpt-5.2": {"input": 0.00175, "output": 0.014},
        "gpt-5.2-chat-latest": {"input": 0.00175, "output": 0.014},
        "gpt-5.2-pro": {"input": 0.015, "output": 0.06},
        "gpt-5.1": {"input": 0.002, "output": 0.008},
        "gpt-5": {"input": 0.003, "output": 0.012},
        "gpt-5-mini": {"input": 0.0003, "output": 0.0012},
        "gpt-5-nano": {"input": 0.0001, "output": 0.0004},
        # GPT-4.1 series
        "gpt-4.1": {"input": 0.002, "output": 0.008},
        "gpt-4.1-mini": {"input": 0.0004, "output": 0.0016},
        "gpt-4.1-nano": {"input": 0.0001, "output": 0.0004},
        # GPT-4o series
        "gpt-4o": {"input": 0.0025, "output": 0.01},
        "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
        # Reasoning (o-series)
        "o3": {"input": 0.01, "output": 0.04},
        "o3-mini": {"input": 0.001, "output": 0.004},
        "o4-mini": {"input": 0.001, "output": 0.004},
        # Legacy
        "gpt-4-turbo": {"input": 0.01, "output": 0.03},
        "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
    }
    
    # Модели, которые используют max_completion_tokens вместо max_tokens
    NEW_API_MODELS = {"gpt-5.2", "gpt-5.2-chat-latest", "gpt-5.2-pro", "gpt-5.1", "gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "o3", "o3-mini", "o4-mini"}
    
    def __init__(self, api_key: str, default_model: str = "gpt-4o-mini", **kwargs):
        super().__init__(api_key, **kwargs)
        self.default_model = default_model
    
    async def generate(self, prompt: str, **params) -> GenerationResult:
        model = params.get("model", self.default_model)
        messages = params.get("messages") or [{"role": "user", "content": prompt}]
        
        if params.get("system_prompt"):
            messages.insert(0, {"role": "system", "content": params["system_prompt"]})
        
        # Формируем тело запроса
        request_body = {
            "model": model,
            "messages": messages,
        }
        
        # Новые модели используют max_completion_tokens
        max_tokens = params.get("max_tokens", 2048)
        if model in self.NEW_API_MODELS:
            request_body["max_completion_tokens"] = max_tokens
        else:
            request_body["max_tokens"] = max_tokens
            request_body["temperature"] = params.get("temperature", 0.7)
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
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
                
                return GenerationResult(
                    success=True,
                    content=data["choices"][0]["message"]["content"],
                    tokens_input=tokens_in,
                    tokens_output=tokens_out,
                    provider_cost=self.calculate_cost(tokens_in, tokens_out, model=model),
                    raw_response={"request": request_body, "response": data},
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
        
        request_body = {
            "model": model,
            "messages": messages,
            "stream": True,
        }
        
        max_tokens = params.get("max_tokens", 2048)
        if model in self.NEW_API_MODELS:
            request_body["max_completion_tokens"] = max_tokens
        else:
            request_body["max_tokens"] = max_tokens
            request_body["temperature"] = params.get("temperature", 0.7)
        
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
                        chunk = json.loads(line[6:])
                        delta = chunk["choices"][0].get("delta", {})
                        if "content" in delta:
                            yield delta["content"]
    
    def calculate_cost(self, tokens_input: int, tokens_output: int, **params) -> float:
        model = params.get("model", self.default_model)
        pricing = self.PRICING.get(model, self.PRICING["gpt-4o-mini"])
        return (tokens_input / 1000 * pricing["input"]) + (tokens_output / 1000 * pricing["output"])
    
    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "max_tokens": 128000,
            "streaming": True,
            "vision": True,
            "function_calling": True,
        }