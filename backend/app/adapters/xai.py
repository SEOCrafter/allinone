from typing import Optional, AsyncIterator, List
import httpx
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus


class XaiAdapter(BaseAdapter):
    name = "xai"
    display_name = "xAI (Grok)"
    provider_type = ProviderType.TEXT

    BASE_URL = "https://api.x.ai/v1"

    PRICING = {
        "grok-3": {"input": 0.003, "output": 0.015, "display_name": "Grok 3"},
        "grok-3-mini": {"input": 0.0003, "output": 0.0005, "display_name": "Grok 3 Mini"},
        "grok-4-0709": {"input": 0.003, "output": 0.015, "display_name": "Grok 4"},
        "grok-4-fast-reasoning": {"input": 0.005, "output": 0.025, "display_name": "Grok 4 Fast Reasoning"},
        "grok-4-fast-non-reasoning": {"input": 0.002, "output": 0.010, "display_name": "Grok 4 Fast"},
        "grok-4-1-fast-reasoning": {"input": 0.005, "output": 0.025, "display_name": "Grok 4.1 Fast Reasoning"},
        "grok-4-1-fast-non-reasoning": {"input": 0.002, "output": 0.010, "display_name": "Grok 4.1 Fast"},
        "grok-code-fast-1": {"input": 0.002, "output": 0.010, "display_name": "Grok Code Fast"},
        "grok-2-vision-1212": {"input": 0.002, "output": 0.010, "display_name": "Grok 2 Vision"},
    }

    def __init__(self, api_key: str, default_model: str = "grok-3-mini", **kwargs):
        super().__init__(api_key, **kwargs)
        self.default_model = default_model

    def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def generate(self, prompt: str, **params) -> GenerationResult:
        model = params.get("model", self.default_model)
        messages = params.get("messages") or [{"role": "user", "content": prompt}]
        system_prompt = params.get("system_prompt")

        if system_prompt:
            messages = [{"role": "system", "content": system_prompt}] + messages

        request_body = {
            "model": model,
            "messages": messages,
            "temperature": params.get("temperature", 0.7),
            "max_tokens": params.get("max_tokens", 2048),
            "stream": False,
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}/chat/completions",
                    headers=self._get_headers(),
                    json=request_body,
                )

                if response.status_code != 200:
                    error_data = response.json() if response.text else {}
                    return GenerationResult(
                        success=False,
                        error_code=f"HTTP_{response.status_code}",
                        error_message=error_data.get("error", {}).get("message", response.text),
                        raw_response={"request": request_body, "response": error_data},
                    )

                data = response.json()
                content = data["choices"][0]["message"]["content"]
                usage = data.get("usage", {})
                tokens_input = usage.get("prompt_tokens", 0)
                tokens_output = usage.get("completion_tokens", 0)

                return GenerationResult(
                    success=True,
                    content=content,
                    tokens_input=tokens_input,
                    tokens_output=tokens_output,
                    provider_cost=self.calculate_cost(tokens_input, tokens_output, model=model),
                    raw_response=data,
                )

        except httpx.TimeoutException:
            return GenerationResult(
                success=False,
                error_code="TIMEOUT",
                error_message="Request timed out after 120 seconds",
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
        system_prompt = params.get("system_prompt")

        if system_prompt:
            messages = [{"role": "system", "content": system_prompt}] + messages

        request_body = {
            "model": model,
            "messages": messages,
            "temperature": params.get("temperature", 0.7),
            "max_tokens": params.get("max_tokens", 2048),
            "stream": True,
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.BASE_URL}/chat/completions",
                    headers=self._get_headers(),
                    json=request_body,
                ) as response:
                    if response.status_code != 200:
                        yield f"Error: HTTP {response.status_code}"
                        return

                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str == "[DONE]":
                                break
                            try:
                                import json
                                data = json.loads(data_str)
                                delta = data["choices"][0].get("delta", {})
                                if "content" in delta:
                                    yield delta["content"]
                            except:
                                continue

        except Exception as e:
            yield f"Error: {str(e)}"

    async def health_check(self) -> ProviderHealth:
        import time
        start = time.time()
        try:
            result = await self.generate(
                prompt="Say 'OK' and nothing else.",
                model="grok-3-mini",
                max_tokens=10,
            )
            latency = int((time.time() - start) * 1000)
            if result.success:
                return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
            return ProviderHealth(
                status=ProviderStatus.DEGRADED,
                latency_ms=latency,
                error=result.error_message,
            )
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, tokens_input: int, tokens_output: int, **params) -> float:
        model = params.get("model", self.default_model)
        pricing = self.PRICING.get(model, self.PRICING["grok-3-mini"])
        return (tokens_input / 1000 * pricing["input"]) + (tokens_output / 1000 * pricing["output"])

    def get_models(self) -> List[dict]:
        return [
            {"id": model_id, **info}
            for model_id, info in self.PRICING.items()
        ]