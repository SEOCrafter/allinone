from typing import Optional, List
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus
from app.adapters.kie_base import KieBaseAdapter


class SoraAdapter(BaseAdapter, KieBaseAdapter):
    name = "sora"
    display_name = "OpenAI Sora"
    provider_type = ProviderType.VIDEO

    PRICING = {
        "sora-2-pro-text-to-video": {"per_video": 0.80, "display_name": "Sora 2 Pro T2V"},
        "sora-2-pro-image-to-video": {"per_video": 0.80, "display_name": "Sora 2 Pro I2V"},
        "sora-2-text-to-video": {"per_video": 0.50, "display_name": "Sora 2 T2V"},
        "sora-2-image-to-video": {"per_video": 0.50, "display_name": "Sora 2 I2V"},
    }

    def __init__(self, api_key: str, default_model: str = "sora-2-pro-text-to-video", **kwargs):
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
        aspect_ratio: str = "landscape",
        n_frames: str = "10",
        size: str = "standard",
        **params
    ) -> GenerationResult:
        model = model or self.default_model

        input_data = {
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "n_frames": n_frames,
            "size": size,
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
                "sora-2-text-to-video",
                {"prompt": "test", "aspect_ratio": "landscape", "n_frames": "10", "size": "standard"},
            )
            latency = int((time.time() - start) * 1000)
            if result.success and result.task_id:
                return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
            return ProviderHealth(status=ProviderStatus.DEGRADED, error=result.error_message)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, model: Optional[str] = None, **params) -> float:
        model = model or self.default_model
        pricing = self.PRICING.get(model, self.PRICING["sora-2-pro-text-to-video"])
        return pricing.get("per_video", 0.80)

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "aspect_ratios": ["landscape", "portrait", "square"],
            "sizes": ["standard", "720p", "1080p"],
            "supports_text_to_video": True,
            "supports_image_to_video": True,
        }
