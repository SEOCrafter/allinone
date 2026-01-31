from typing import Optional, List
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus
from app.adapters.kie_base import KieBaseAdapter


class SeedanceAdapter(BaseAdapter, KieBaseAdapter):
    name = "seedance"
    display_name = "ByteDance Seedance"
    provider_type = ProviderType.VIDEO

    PRICING = {
        "bytedance/seedance-1.5-pro": {"per_video": 0.40, "display_name": "Seedance 1.5 Pro"},
        "bytedance/seedance-1.5-standard": {"per_video": 0.25, "display_name": "Seedance 1.5 Standard"},
        "bytedance/v1-lite-image-to-video": {"per_video": 0.20, "display_name": "Seedance Lite I2V"},
    }

    def __init__(self, api_key: str, default_model: str = "bytedance/seedance-1.5-pro", **kwargs):
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
        aspect_ratio: str = "16:9",
        duration: str = "4",
        **params
    ) -> GenerationResult:
        model = model or self.default_model

        input_data = {
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "duration": str(duration),
        }
        
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
                "bytedance/seedance-1.5-standard",
                {"prompt": "test", "aspect_ratio": "16:9", "duration": "4"},
            )
            latency = int((time.time() - start) * 1000)
            if result.success and result.task_id:
                return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
            return ProviderHealth(status=ProviderStatus.DEGRADED, error=result.error_message)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, model: Optional[str] = None, **params) -> float:
        model = model or self.default_model
        pricing = self.PRICING.get(model, self.PRICING["bytedance/seedance-1.5-pro"])
        return pricing.get("per_video", 0.40)

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "aspect_ratios": ["16:9", "9:16", "1:1"],
            "durations": ["4", "8"],
            "supports_text_to_video": True,
            "supports_image_to_video": True,
        }
