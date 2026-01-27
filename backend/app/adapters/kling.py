from typing import Optional, List
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus
from app.adapters.kie_base import KieBaseAdapter, KieTaskResult


class KlingAdapter(BaseAdapter, KieBaseAdapter):
    name = "kling"
    display_name = "Kling AI"
    provider_type = ProviderType.VIDEO

    PRICING = {
        "kling-2.6/motion-control": {
            "per_second": 0.07,
            "display_name": "Kling 2.6 Motion Control",
        },
        "kling-2.6/text-to-video": {
            "per_second": 0.056,
            "display_name": "Kling 2.6 Text to Video",
        },
        "kling-2.6/image-to-video": {
            "per_second": 0.056,
            "display_name": "Kling 2.6 Image to Video",
        },
        "kling/ai-avatar-standard": {
            "per_video": 0.50,
            "display_name": "Kling AI Avatar Standard",
        },
        "kling/ai-avatar-pro": {
            "per_video": 1.00,
            "display_name": "Kling AI Avatar Pro",
        },
        "kling/v2-1-master-image-to-video": {
            "per_second": 0.16,
            "display_name": "Kling v2.1 Master I2V",
        },
        "kling/v2-1-master-text-to-video": {
            "per_second": 0.16,
            "display_name": "Kling v2.1 Master T2V",
        },
        "kling/v2-1-pro": {
            "per_second": 0.05,
            "display_name": "Kling v2.1 Pro",
        },
        "kling/v2-1-standard": {
            "per_second": 0.025,
            "display_name": "Kling v2.1 Standard",
        },
    }

    ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4"]
    DURATIONS = ["5", "10"]

    def __init__(self, api_key: str, default_model: str = "kling-2.6/text-to-video", **kwargs):
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
        video_urls: Optional[List[str]] = None,
        duration: str = "5",
        sound: bool = False,
        aspect_ratio: str = "16:9",
        **params
    ) -> GenerationResult:
        model = model or self.default_model
        duration_str = str(duration)

        if "ai-avatar" in model:
            if not image_urls:
                return GenerationResult(
                    success=False,
                    error_code="MISSING_PARAMS",
                    error_message="Avatar requires image_url",
                )
            input_data = {
                "image_url": image_urls[0],
                "prompt": prompt,
            }
            if sound:
                input_data["sound"] = sound
        else:
            input_data = {
                "prompt": prompt,
                "duration": duration_str,
                "sound": sound,
                "aspect_ratio": aspect_ratio,
            }

            if model == "kling-2.6/motion-control":
                if not image_urls or not video_urls:
                    return GenerationResult(
                        success=False,
                        error_code="MISSING_PARAMS",
                        error_message="Motion Control requires image_urls and video_urls",
                    )
                input_data["image_urls"] = image_urls
                input_data["video_urls"] = video_urls
                input_data["character_orientation"] = params.get("character_orientation", "image")

            elif "image-to-video" in model:
                if not image_urls:
                    return GenerationResult(
                        success=False,
                        error_code="MISSING_PARAMS",
                        error_message="Image to Video requires image_urls",
                    )
                input_data["image_urls"] = image_urls

        result = await self.generate_and_wait(model, input_data)

        if not result.success:
            return GenerationResult(
                success=False,
                error_code=result.error_code,
                error_message=result.error_message,
                raw_response=result.raw_response,
            )

        duration_int = int(duration_str)
        return GenerationResult(
            success=True,
            content=result.result_url,
            provider_cost=self.calculate_cost(model=model, duration=duration_int),
            raw_response=result.raw_response,
        )

    async def generate_text_to_video(
        self,
        prompt: str,
        duration: str = "5",
        sound: bool = False,
        aspect_ratio: str = "16:9",
        callback_url: Optional[str] = None,
    ) -> KieTaskResult:
        input_data = {
            "prompt": prompt,
            "duration": str(duration),
            "sound": sound,
            "aspect_ratio": aspect_ratio,
        }

        return await self.create_task("kling-2.6/text-to-video", input_data, callback_url)

    async def generate_image_to_video(
        self,
        prompt: str,
        image_urls: List[str],
        duration: str = "5",
        sound: bool = False,
        callback_url: Optional[str] = None,
    ) -> KieTaskResult:
        input_data = {
            "prompt": prompt,
            "image_urls": image_urls,
            "duration": str(duration),
            "sound": sound,
        }

        return await self.create_task("kling-2.6/image-to-video", input_data, callback_url)

    async def generate_motion_control(
        self,
        prompt: str,
        image_urls: List[str],
        video_urls: List[str],
        character_orientation: str = "image",
        duration: str = "5",
        callback_url: Optional[str] = None,
    ) -> KieTaskResult:
        input_data = {
            "prompt": prompt,
            "image_urls": image_urls,
            "video_urls": video_urls,
            "character_orientation": character_orientation,
            "duration": str(duration),
        }

        return await self.create_task("kling-2.6/motion-control", input_data, callback_url)

    async def health_check(self) -> ProviderHealth:
        import time
        start = time.time()
        try:
            result = await self.create_task(
                "kling-2.6/text-to-video",
                {"prompt": "A simple animation test", "duration": "5", "sound": False, "aspect_ratio": "16:9"},
            )
            latency = int((time.time() - start) * 1000)
            if result.success and result.task_id:
                return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
            return ProviderHealth(status=ProviderStatus.DEGRADED, error=result.error_message)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, model: Optional[str] = None, duration: int = 5, **params) -> float:
        model = model or self.default_model
        pricing = self.PRICING.get(model, self.PRICING["kling-2.6/text-to-video"])

        if "per_video" in pricing:
            return pricing["per_video"]
        return pricing.get("per_second", 0.056) * duration

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "aspect_ratios": self.ASPECT_RATIOS,
            "durations": self.DURATIONS,
            "supports_sound": True,
            "supports_motion_control": True,
            "supports_text_to_video": True,
            "supports_image_to_video": True,
            "supports_callback": True,
        }