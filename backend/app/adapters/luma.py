from typing import Optional, List
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus
from app.adapters.kie_base import KieBaseAdapter


class LumaAdapter(BaseAdapter, KieBaseAdapter):
    name = "luma"
    display_name = "Luma AI"
    provider_type = ProviderType.VIDEO

    PRICING = {
        "luma/ray-2": {
            "per_video": 0.40,
            "display_name": "Ray 2",
        },
        "luma/ray-2-flash": {
            "per_video": 0.25,
            "display_name": "Ray 2 Flash",
        },
        "luma/ray-flash-2-720p": {
            "per_video": 0.30,
            "display_name": "Ray Flash 2 720p",
        },
        "luma/ray-flash-2-540p": {
            "per_video": 0.20,
            "display_name": "Ray Flash 2 540p",
        },
        "luma/dream-machine": {
            "per_video": 0.35,
            "display_name": "Dream Machine",
        },
    }

    ASPECT_RATIOS = ["16:9", "9:16", "1:1"]
    DURATIONS = ["5", "9"]

    def __init__(self, api_key: str, default_model: str = "luma/ray-2", **kwargs):
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
        keyframes: Optional[dict] = None,
        **params
    ) -> GenerationResult:
        model = model or self.default_model

        input_data = {
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
        }

        if image_urls:
            input_data["image_url"] = image_urls[0]
            if len(image_urls) > 1:
                input_data["end_image_url"] = image_urls[1]

        if keyframes:
            input_data["keyframes"] = keyframes

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
                "luma/ray-flash-2-540p",
                {"prompt": "A simple test scene", "aspect_ratio": "16:9"},
            )
            latency = int((time.time() - start) * 1000)
            if result.success and result.task_id:
                return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
            return ProviderHealth(status=ProviderStatus.DEGRADED, error=result.error_message)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, model: Optional[str] = None, **params) -> float:
        model = model or self.default_model
        pricing = self.PRICING.get(model, self.PRICING["luma/ray-2"])
        return pricing.get("per_video", 0.40)

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "aspect_ratios": self.ASPECT_RATIOS,
            "durations": self.DURATIONS,
            "supports_text_to_video": True,
            "supports_image_to_video": True,
            "supports_keyframes": True,
        }
