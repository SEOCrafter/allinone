from typing import AsyncIterator, Optional
import httpx
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType


class GeminiAdapter(BaseAdapter):
    name = "gemini"
    display_name = "Google Gemini"
    provider_type = ProviderType.TEXT

    BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

    PRICING = {
        "gemini-3-pro-preview": {"input": 0.002, "output": 0.012},
        "gemini-3-flash-preview": {"input": 0.0005, "output": 0.003},
        "gemini-2.5-pro": {"input": 0.00125, "output": 0.01},
        "gemini-2.5-flash": {"input": 0.00015, "output": 0.0006},
        "gemini-2.5-flash-lite": {"input": 0.0001, "output": 0.0004},
        "gemini-2.0-flash": {"input": 0.0001, "output": 0.0004},
    }

    def __init__(self, api_key: str, default_model: str = "gemini-2.5-flash", **kwargs):
        super().__init__(api_key, **kwargs)
        self.default_model = default_model

    async def generate(self, prompt: str, **params) -> GenerationResult:
        model = params.get("model", self.default_model)
        system_prompt = params.get("system_prompt")
        max_tokens = params.get("max_tokens", 2048)
        temperature = params.get("temperature", 0.7)

        contents = [{"role": "user", "parts": [{"text": prompt}]}]

        generation_config = {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        }

        request_body = {
            "contents": contents,
            "generationConfig": generation_config,
        }

        if system_prompt:
            request_body["systemInstruction"] = {"parts": [{"text": system_prompt}]}

        url = f"{self.BASE_URL}/models/{model}:generateContent?key={self.api_key}"

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(url, json=request_body)

                if response.status_code != 200:
                    error_data = response.json()
                    error_msg = error_data.get("error", {}).get("message", "Unknown error")
                    return GenerationResult(
                        success=False,
                        error_code=f"HTTP_{response.status_code}",
                        error_message=error_msg,
                        raw_response={"request": request_body, "response": error_data},
                    )

                data = response.json()

                candidates = data.get("candidates", [])
                if not candidates:
                    prompt_feedback = data.get("promptFeedback", {})
                    block_reason = prompt_feedback.get("blockReason", "UNKNOWN")
                    return GenerationResult(
                        success=False,
                        error_code="BLOCKED",
                        error_message=f"Content blocked: {block_reason}",
                        raw_response={"request": request_body, "response": data},
                    )

                content = candidates[0].get("content", {})
                parts = content.get("parts", [])
                text = "".join(p.get("text", "") for p in parts if "text" in p)

                usage = data.get("usageMetadata", {})
                tokens_in = usage.get("promptTokenCount", 0)
                tokens_out = usage.get("candidatesTokenCount", 0)

                return GenerationResult(
                    success=True,
                    content=text,
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
        system_prompt = params.get("system_prompt")

        request_body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": params.get("temperature", 0.7),
                "maxOutputTokens": params.get("max_tokens", 2048),
            },
        }

        if system_prompt:
            request_body["systemInstruction"] = {"parts": [{"text": system_prompt}]}

        url = f"{self.BASE_URL}/models/{model}:streamGenerateContent?key={self.api_key}&alt=sse"

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, json=request_body) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        import json
                        try:
                            chunk = json.loads(line[6:])
                            candidates = chunk.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                for part in parts:
                                    if "text" in part:
                                        yield part["text"]
                        except json.JSONDecodeError:
                            continue

    def calculate_cost(self, tokens_input: int, tokens_output: int, **params) -> float:
        model = params.get("model", self.default_model)
        pricing = self.PRICING.get(model, self.PRICING["gemini-2.5-flash"])
        return (tokens_input / 1000 * pricing["input"]) + (tokens_output / 1000 * pricing["output"])

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "max_tokens": 1048576,
            "streaming": True,
            "vision": True,
            "function_calling": True,
        }