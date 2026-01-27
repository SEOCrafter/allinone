from typing import Optional, List
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus
from app.adapters.kie_base import KieBaseAdapter


class SeedanceAdapter(BaseAdapter, KieBaseAdapter):
    name = "seedance"
    display_name = "Seedance (ByteDance)"
    provider_type = ProviderType.VIDEO

    PRICING = {
        "bytedance/seedance-1.0": {
            "per_video": 0.35,
            "display_name": "Seedance 1.0",
        },
        "bytedance/seedance-1.0-lite": {
            "per_video": 0.20,
            "display_name": "Seedance 1.0 Lite",
        },
        "bytedance/seedream-3.0": {
            "per_image": 0.02,
            "display_name": "Seedream 3.0 (Image)",
        },
        "bytedance/seedream-4.0": {
            "per_image": 0.03,
            "display_name": "Seedream 4.0 (Image)",
        },
    }

    ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4"]
    DURATIONS = ["5", "10"]

    def __init__(self, api_key: str, default_model: str = "bytedance/seedance-1.0", **kwargs):
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
        duration: str = "5",
        aspect_ratio: str = "16:9",
        resolution: str = "720p",
        **params
    ) -> GenerationResult:
        model = model or self.default_model

        input_data = {
            "prompt": prompt,
        }

        if "seedream" in model:
            input_data["aspect_ratio"] = aspect_ratio
            if image_urls:
                input_data["image_url"] = image_urls[0]
        else:
            input_data["duration"] = str(duration)
            input_data["aspect_ratio"] = aspect_ratio
            input_data["resolution"] = resolution
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
                "bytedance/seedream-3.0",
                {"prompt": "A simple test image", "aspect_ratio": "1:1"},
            )
            latency = int((time.time() - start) * 1000)
            if result.success and result.task_id:
                return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
            return ProviderHealth(status=ProviderStatus.DEGRADED, error=result.error_message)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, model: Optional[str] = None, **params) -> float:
        model = model or self.default_model
        pricing = self.PRICING.get(model, self.PRICING["bytedance/seedance-1.0"])
        return pricing.get("per_video", pricing.get("per_image", 0.35))

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "aspect_ratios": self.ASPECT_RATIOS,
            "durations": self.DURATIONS,
            "supports_text_to_video": True,
            "supports_image_to_video": True,
            "supports_text_to_image": True,
        }
