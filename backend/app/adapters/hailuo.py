from typing import Optional, List
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus
from app.adapters.kie_base import KieBaseAdapter


class HailuoAdapter(BaseAdapter, KieBaseAdapter):
    name = "hailuo"
    display_name = "Hailuo (MiniMax)"
    provider_type = ProviderType.VIDEO

    PRICING = {
        "hailuo/02-text-to-video-standard": {"per_video": 0.35, "display_name": "Hailuo 02 Standard"},
        "hailuo/02-text-to-video-pro": {"per_video": 0.50, "display_name": "Hailuo 02 Pro"},
        "hailuo/02-image-to-video-standard": {"per_video": 0.35, "display_name": "Hailuo 02 I2V Standard"},
        "hailuo/02-image-to-video-pro": {"per_video": 0.50, "display_name": "Hailuo 02 I2V Pro"},
        "hailuo/2-3-image-to-video-standard": {"per_video": 0.40, "display_name": "Hailuo 2.3 I2V Standard"},
        "hailuo/2-3-image-to-video-pro": {"per_video": 0.60, "display_name": "Hailuo 2.3 I2V Pro"},
    }

    def __init__(self, api_key: str, default_model: str = "hailuo/02-text-to-video-standard", **kwargs):
        BaseAdapter.__init__(self, api_key, **kwargs)
        KieBaseAdapter.__init__(self, api_key, **kwargs)
        self.default_model = default_model
        self.max_poll_attempts = kwargs.get("max_poll_attempts", 180)
        self.poll_interval = kwargs.get("poll_interval", 10)

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        image_url: Optional[str] = None,
        **params
    ) -> GenerationResult:
        model = model or self.default_model

        input_data = {"prompt": prompt}

        if image_url:
            input_data["image_url"] = image_url

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
                "hailuo/02-text-to-video-standard",
                {"prompt": "test"},
            )
            latency = int((time.time() - start) * 1000)
            if result.success and result.task_id:
                return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
            return ProviderHealth(status=ProviderStatus.DEGRADED, error=result.error_message)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, model: Optional[str] = None, **params) -> float:
        model = model or self.default_model
        pricing = self.PRICING.get(model, self.PRICING["hailuo/02-text-to-video-standard"])
        return pricing.get("per_video", 0.35)

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "supports_text_to_video": True,
            "supports_image_to_video": True,
        }
