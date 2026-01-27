from typing import Optional, List
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus
from app.adapters.kie_base import KieBaseAdapter, KieTaskResult


class HailuoAdapter(BaseAdapter, KieBaseAdapter):
    name = "hailuo"
    display_name = "Hailuo (MiniMax)"
    provider_type = ProviderType.VIDEO

    PRICING = {
        "minimax/video-01": {
            "per_video": 0.45,
            "display_name": "Hailuo Video-01",
        },
        "minimax/video-01-director": {
            "per_video": 0.50,
            "display_name": "Hailuo Director",
        },
        "minimax/video-01-live": {
            "per_video": 0.40,
            "display_name": "Hailuo Live (Animation)",
        },
        "minimax/hailuo-02": {
            "per_video": 0.55,
            "display_name": "Hailuo 02 Standard",
        },
        "minimax/hailuo-02-pro": {
            "per_video": 0.80,
            "display_name": "Hailuo 02 Pro (1080p)",
        },
        "minimax/hailuo-2.3": {
            "per_video": 0.65,
            "display_name": "Hailuo 2.3",
        },
        "minimax/hailuo-2.3-flash": {
            "per_video": 0.45,
            "display_name": "Hailuo 2.3 Flash",
        },
    }

    ASPECT_RATIOS = ["16:9", "9:16", "1:1"]
    DURATIONS = ["6", "10"]

    def __init__(self, api_key: str, default_model: str = "minimax/video-01", **kwargs):
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
        subject_reference: Optional[str] = None,
        duration: str = "6",
        aspect_ratio: str = "16:9",
        camera_movement: Optional[str] = None,
        **params
    ) -> GenerationResult:
        model = model or self.default_model

        input_data = {
            "prompt": prompt,
        }

        if image_urls:
            input_data["image_url"] = image_urls[0]

        if subject_reference:
            input_data["subject_reference"] = subject_reference

        if camera_movement and "director" in model:
            input_data["camera_movement"] = camera_movement

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
                "minimax/video-01",
                {"prompt": "A simple test scene"},
            )
            latency = int((time.time() - start) * 1000)
            if result.success and result.task_id:
                return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
            return ProviderHealth(status=ProviderStatus.DEGRADED, error=result.error_message)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, model: Optional[str] = None, **params) -> float:
        model = model or self.default_model
        pricing = self.PRICING.get(model, self.PRICING["minimax/video-01"])
        return pricing.get("per_video", 0.45)

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "aspect_ratios": self.ASPECT_RATIOS,
            "durations": self.DURATIONS,
            "supports_text_to_video": True,
            "supports_image_to_video": True,
            "supports_subject_reference": True,
            "supports_camera_movement": True,
        }
