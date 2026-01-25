from typing import AsyncIterator
import httpx
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType

class AnthropicAdapter(BaseAdapter):
    name = "anthropic"
    display_name = "Anthropic Claude"
    provider_type = ProviderType.TEXT
    
    BASE_URL = "https://api.anthropic.com/v1"
    
    PRICING = {
        "claude-3-5-sonnet-20241022": {"input": 0.003, "output": 0.015},
        "claude-3-5-haiku-20241022": {"input": 0.0008, "output": 0.004},
        "claude-3-opus-20240229": {"input": 0.015, "output": 0.075},
    }
    
    def __init__(self, api_key: str, default_model: str = "claude-3-5-sonnet-20241022", **kwargs):
        super().__init__(api_key, **kwargs)
        self.default_model = default_model
    
    async def generate(self, prompt: str, **params) -> GenerationResult:
        model = params.get("model", self.default_model)
        
        messages = [{"role": "user", "content": prompt}]
        system = params.get("system_prompt", "")
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}/messages",
                    headers={
                        "x-api-key": self.api_key,
                        "Content-Type": "application/json",
                        "anthropic-version": "2023-06-01",
                    },
                    json={
                        "model": model,
                        "messages": messages,
                        "system": system,
                        "max_tokens": params.get("max_tokens", 2048),
                    },
                )
                
                if response.status_code != 200:
                    error_data = response.json()
                    return GenerationResult(
                        success=False,
                        error_code=f"HTTP_{response.status_code}",
                        error_message=error_data.get("error", {}).get("message", "Unknown error"),
                    )
                
                data = response.json()
                tokens_in = data.get("usage", {}).get("input_tokens", 0)
                tokens_out = data.get("usage", {}).get("output_tokens", 0)
                
                return GenerationResult(
                    success=True,
                    content=data["content"][0]["text"],
                    tokens_input=tokens_in,
                    tokens_output=tokens_out,
                    provider_cost=self.calculate_cost(tokens_in, tokens_out, model=model),
                    raw_response=data,
                )
        except httpx.TimeoutException:
            return GenerationResult(success=False, error_code="TIMEOUT", error_message="Request timed out")
        except Exception as e:
            return GenerationResult(success=False, error_code="EXCEPTION", error_message=str(e))
    
    def calculate_cost(self, tokens_input: int, tokens_output: int, **params) -> float:
        model = params.get("model", self.default_model)
        pricing = self.PRICING.get(model, self.PRICING["claude-3-5-sonnet-20241022"])
        return (tokens_input / 1000 * pricing["input"]) + (tokens_output / 1000 * pricing["output"])
    
    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "max_tokens": 200000,
            "streaming": True,
            "vision": True,
        }
