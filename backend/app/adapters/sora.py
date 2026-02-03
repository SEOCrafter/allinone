from typing import Optional, List
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus
from app.adapters.kie_base import KieBaseAdapter


class SoraAdapter(BaseAdapter, KieBaseAdapter):
    name = "sora"
    display_name = "OpenAI Sora"
    provider_type = ProviderType.VIDEO

    PRICING = {
        "sora-2-pro-text-to-video": {"per_video": 0.75, "display_name": "Sora 2 Pro T2V"},
        "sora-2-pro-image-to-video": {"per_video": 0.75, "display_name": "Sora 2 Pro I2V"},
        "sora-2-text-to-video": {"per_video": 0.50, "display_name": "Sora 2 T2V"},
        "sora-2-image-to-video": {"per_video": 0.50, "display_name": "Sora 2 I2V"},
    }

    MODEL_MAP = {
        "openai/sora-2": {"t2v": "sora-2-text-to-video", "i2v": "sora-2-image-to-video"},
        "openai/sora-2-pro": {"t2v": "sora-2-pro-text-to-video", "i2v": "sora-2-pro-image-to-video"},
        "sora-2": {"t2v": "sora-2-text-to-video", "i2v": "sora-2-image-to-video"},
        "sora-2-pro": {"t2v": "sora-2-pro-text-to-video", "i2v": "sora-2-pro-image-to-video"},
    }

    def __init__(self, api_key: str, default_model: str = "sora-2-pro-text-to-video", **kwargs):
        BaseAdapter.__init__(self, api_key, **kwargs)
        KieBaseAdapter.__init__(self, api_key, **kwargs)
        self.default_model = default_model
        self.max_poll_attempts = kwargs.get("max_poll_attempts", 180)
        self.poll_interval = kwargs.get("poll_interval", 10)

    def _resolve_model(self, model: str, has_image: bool) -> str:
        if model in self.MODEL_MAP:
            return self.MODEL_MAP[model]["i2v" if has_image else "t2v"]
        return model

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        image_urls: Optional[List[str]] = None,
        aspect_ratio: str = "landscape",
        duration: int = 10,
        mode: str = "std",
        wait_for_result: bool = True,
        **params
    ) -> GenerationResult:
        model = model or self.default_model
        has_image = bool(image_urls)
        kie_model = self._resolve_model(model, has_image)

        n_frames = "10" if duration <= 10 else "15"
        size = "high" if mode == "pro" else "standard"

        sora_aspect = aspect_ratio
        if aspect_ratio in ("16:9", "16:10", "4:3"):
            sora_aspect = "landscape"
        elif aspect_ratio in ("9:16", "10:16", "3:4"):
            sora_aspect = "portrait"

        input_data = {
            "prompt": prompt,
            "aspect_ratio": sora_aspect,
            "n_frames": n_frames,
            "size": size,
        }

        if image_urls:
            input_data["image_urls"] = [image_urls[0]]

        if wait_for_result:
            result = await self.generate_and_wait(kie_model, input_data)

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
                provider_cost=self.calculate_cost(model=model, duration=duration, mode=mode),
                raw_response=result.raw_response,
            )
        else:
            result = await self.create_task(kie_model, input_data)

            if not result.success:
                return GenerationResult(
                    success=False,
                    error_code=result.error_code,
                    error_message=result.error_message,
                    raw_response=result.raw_response,
                )

            return GenerationResult(
                success=False,
                error_code="PROCESSING",
                error_message="Task created, polling required",
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

    def calculate_cost(self, model: Optional[str] = None, duration: int = 10, mode: str = "std", **params) -> float:
        is_pro_model = model and "pro" in model.lower()
        is_high = mode == "pro"
        
        if is_pro_model:
            if is_high:
                return 1.65 if duration <= 10 else 3.15
            else:
                return 0.75 if duration <= 10 else 1.35
        else:
            return 0.50 if duration <= 10 else 0.90

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "aspect_ratios": ["landscape", "portrait"],
            "durations": [10, 15],
            "sizes": ["standard", "high"],
            "supports_text_to_video": True,
            "supports_image_to_video": True,
        }