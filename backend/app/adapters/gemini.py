from typing import AsyncIterator, Optional
import httpx
import json
import os
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType


class GeminiAdapter(BaseAdapter):
    name = "gemini"
    display_name = "Google Gemini"
    provider_type = ProviderType.TEXT

    PROJECT_ID = "proven-mind-444420-d6"
    
    # Модели и их регионы
    GLOBAL_MODELS = {
        "gemini-3-pro-preview", "gemini-3-flash-preview",
        "gemini-2.5-pro-preview-05-06", "gemini-2.5-flash-preview-05-20",
        "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"
    }
    
    PRICING = {
        "gemini-3-pro-preview": {"input": 0.002, "output": 0.012, "display_name": "Gemini 3 Pro"},
        "gemini-3-flash-preview": {"input": 0.0005, "output": 0.003, "display_name": "Gemini 3 Flash"},
        "gemini-2.5-pro-preview-05-06": {"input": 0.00125, "output": 0.01, "display_name": "Gemini 2.5 Pro"},
        "gemini-2.5-flash-preview-05-20": {"input": 0.00015, "output": 0.0006, "display_name": "Gemini 2.5 Flash"},
        "gemini-2.5-pro": {"input": 0.00125, "output": 0.01, "display_name": "Gemini 2.5 Pro"},
        "gemini-2.5-flash": {"input": 0.00015, "output": 0.0006, "display_name": "Gemini 2.5 Flash"},
        "gemini-2.5-flash-lite": {"input": 0.0001, "output": 0.0004, "display_name": "Gemini 2.5 Flash Lite"},
        "gemini-2.0-flash": {"input": 0.0001, "output": 0.0004, "display_name": "Gemini 2.0 Flash"},
        "gemini-2.0-flash-001": {"input": 0.0001, "output": 0.0004, "display_name": "Gemini 2.0 Flash"},
        "gemini-2.0-flash-lite-001": {"input": 0.000075, "output": 0.0003, "display_name": "Gemini 2.0 Flash Lite"},
    }

    def __init__(self, api_key: str = "", default_model: str = "gemini-2.5-flash", **kwargs):
        super().__init__(api_key, **kwargs)
        self.default_model = default_model
        self._access_token = None
        self._token_expiry = 0
        self.credentials_path = kwargs.get(
            "credentials_path", 
            os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "/app/google-credentials.json")
        )

    async def _get_access_token(self) -> str:
        import time
        
        if self._access_token and time.time() < self._token_expiry - 60:
            return self._access_token
        
        try:
            from google.oauth2 import service_account
            from google.auth.transport.requests import Request
            
            credentials = service_account.Credentials.from_service_account_file(
                self.credentials_path,
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            credentials.refresh(Request())
            self._access_token = credentials.token
            self._token_expiry = time.time() + 3600
            return self._access_token
        except Exception as e:
            raise Exception(f"Failed to get access token: {e}")

    def _get_location(self, model: str) -> str:
        """Возвращает регион для модели"""
        if model in self.GLOBAL_MODELS:
            return "global"
        return "us-central1"

    def _get_endpoint(self, model: str) -> str:
        location = self._get_location(model)
        if location == "global":
            return (
                f"https://aiplatform.googleapis.com/v1/"
                f"projects/{self.PROJECT_ID}/locations/{location}/"
                f"publishers/google/models/{model}:generateContent"
            )
        return (
            f"https://{location}-aiplatform.googleapis.com/v1/"
            f"projects/{self.PROJECT_ID}/locations/{location}/"
            f"publishers/google/models/{model}:generateContent"
        )

    def _get_stream_endpoint(self, model: str) -> str:
        location = self._get_location(model)
        if location == "global":
            return (
                f"https://aiplatform.googleapis.com/v1/"
                f"projects/{self.PROJECT_ID}/locations/{location}/"
                f"publishers/google/models/{model}:streamGenerateContent"
            )
        return (
            f"https://{location}-aiplatform.googleapis.com/v1/"
            f"projects/{self.PROJECT_ID}/locations/{location}/"
            f"publishers/google/models/{model}:streamGenerateContent"
        )

    async def generate(self, prompt: str, **params) -> GenerationResult:
        model = params.get("model", self.default_model)
        system_prompt = params.get("system_prompt") or "Отвечай на русском языке."
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
            "systemInstruction": {"parts": [{"text": system_prompt}]},
        }

        try:
            access_token = await self._get_access_token()
            url = self._get_endpoint(model)

            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                    },
                    json=request_body,
                )

                if response.status_code != 200:
                    error_data = response.json()
                    error_msg = error_data.get("error", {}).get("message", response.text)
                    return GenerationResult(
                        success=False,
                        error_code=f"HTTP_{response.status_code}",
                        error_message=error_msg,
                        raw_response={"request": request_body, "response": error_data},
                    )

                data = response.json()

                candidates = data.get("candidates", [])
                if not candidates:
                    return GenerationResult(
                        success=False,
                        error_code="NO_CANDIDATES",
                        error_message="No response candidates",
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

        except Exception as e:
            return GenerationResult(
                success=False,
                error_code="EXCEPTION",
                error_message=str(e),
                raw_response={"request": request_body},
            )

    async def generate_stream(self, prompt: str, **params) -> AsyncIterator[str]:
        model = params.get("model", self.default_model)
        system_prompt = params.get("system_prompt") or "Отвечай на русском языке."

        request_body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": params.get("temperature", 0.7),
                "maxOutputTokens": params.get("max_tokens", 2048),
            },
            "systemInstruction": {"parts": [{"text": system_prompt}]},
        }

        access_token = await self._get_access_token()
        url = self._get_stream_endpoint(model) + "?alt=sse"

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json=request_body,
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
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