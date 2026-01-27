from typing import Optional, List
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus
from app.adapters.kie_base import KieBaseAdapter, KieTaskResult


class SoraAdapter(BaseAdapter, KieBaseAdapter):
    name = "sora"
    display_name = "OpenAI Sora"
    provider_type = ProviderType.VIDEO

    PRICING = {
        "openai/sora-2": {
            "per_video": 0.50,
            "display_name": "Sora 2",
        },
        "openai/sora-2-480p": {
            "per_video": 0.30,
            "display_name": "Sora 2 480p",
        },
        "openai/sora-2-720p": {
            "per_video": 0.50,
            "display_name": "Sora 2 720p",
        },
        "openai/sora-2-pro": {
            "per_video": 1.00,
            "display_name": "Sora 2 Pro",
        },
        "openai/sora-2-pro-720p": {
            "per_video": 1.00,
            "display_name": "Sora 2 Pro 720p",
        },
    }

    ASPECT_RATIOS = ["16:9", "9:16", "1:1"]
    DURATIONS = ["5", "10", "15"]

    def __init__(self, api_key: str, default_model: str = "openai/sora-2", **kwargs):
        BaseAdapter.__init__(self, api_key, **kwargs)
        KieBaseAdapter.__init__(self, api_key, **kwargs)
        self.default_model = default_model
        self.max_poll_attempts = kwargs.get("max_poll_attempts", 180)
        self.poll_interval = kwargs.get("poll_interval", 10)

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        image_urls: Optional[List[str]] = None,
        duration: str = "10",
        aspect_ratio: str = "16:9",
        **params
    ) -> GenerationResult:
        model = model or self.default_model

        input_data = {
            "prompt": prompt,
            "duration": str(duration),
            "aspect_ratio": aspect_ratio,
        }

        if image_urls:
            input_data["image_url"] = image_urls[0]

        result = await self.generate_and_wait(model, input_data)

        if not result.success:
            return GenerationResult(
                success=False,
                error_code=result.error_code,
                error_message=result.error_message,
                raw_response=result.raw_response,
            )

        return GenerationResult(
            success=True,
            content=result.result_url,
            provider_cost=self.calculate_cost(model=model),
            raw_response=result.raw_response,
        )

    async def health_check(self) -> ProviderHealth:
        import time
        start = time.time()
        try:
            result = await self.create_task(
                "openai/sora-2-480p",
                {"prompt": "A simple test animation", "duration": "5", "aspect_ratio": "16:9"},
            )
            latency = int((time.time() - start) * 1000)
            if result.success and result.task_id:
                return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
            return ProviderHealth(status=ProviderStatus.DEGRADED, error=result.error_message)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, model: Optional[str] = None, **params) -> float:
        model = model or self.default_model
        pricing = self.PRICING.get(model, self.PRICING["openai/sora-2"])
        return pricing.get("per_video", 0.50)

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "aspect_ratios": self.ASPECT_RATIOS,
            "durations": self.DURATIONS,
            "supports_text_to_video": True,
            "supports_image_to_video": True,
        }
