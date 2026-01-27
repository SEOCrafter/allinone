from typing import Optional, List
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus
from app.adapters.kie_base import KieBaseAdapter, KieTaskResult


def clean_url(url: str) -> str:
    return url.split('?')[0] if url else url


class KlingAdapter(BaseAdapter, KieBaseAdapter):
    name = "kling"
    display_name = "Kling AI"
    provider_type = ProviderType.VIDEO

    PRICING = {
        "kling-2.6/text-to-video": {
            "5s": 0.275,
            "10s": 0.55,
            "5s_audio": 0.55,
            "10s_audio": 1.10,
            "display_name": "Kling 2.6 Text to Video",
        },
        "kling-2.6/image-to-video": {
            "5s": 0.275,
            "10s": 0.55,
            "5s_audio": 0.55,
            "10s_audio": 1.10,
            "display_name": "Kling 2.6 Image to Video",
        },
        "kling-2.6/motion-control": {
            "720p_per_sec": 0.03,
            "1080p_per_sec": 0.045,
            "display_name": "Kling 2.6 Motion Control",
        },
        "kling/v2-5-turbo": {
            "5s": 0.21,
            "10s": 0.42,
            "display_name": "Kling 2.5 Turbo",
        },
        "kling/v2-1-standard": {
            "5s": 0.125,
            "10s": 0.25,
            "display_name": "Kling 2.1 Standard",
        },
        "kling/v2-1-pro": {
            "5s": 0.25,
            "10s": 0.50,
            "display_name": "Kling 2.1 Pro",
        },
        "kling/v2-1-master-text-to-video": {
            "5s": 0.80,
            "10s": 1.60,
            "display_name": "Kling 2.1 Master T2V",
        },
        "kling/v2-1-master-image-to-video": {
            "5s": 0.80,
            "10s": 1.60,
            "display_name": "Kling 2.1 Master I2V",
        },
        "kling/ai-avatar-standard": {
            "per_second": 0.04,
            "display_name": "Kling AI Avatar Standard",
        },
        "kling/ai-avatar-pro": {
            "per_second": 0.08,
            "display_name": "Kling AI Avatar Pro",
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
        audio_url: Optional[str] = None,
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
            if not audio_url:
                return GenerationResult(
                    success=False,
                    error_code="MISSING_PARAMS",
                    error_message="Avatar requires audio_url",
                )
            input_data = {
                "image_url": clean_url(image_urls[0]),
                "audio_url": clean_url(audio_url),
                "prompt": prompt,
            }
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
                input_data = {
                    "prompt": prompt,
                    "input_urls": [clean_url(u) for u in image_urls],
                    "video_urls": [clean_url(u) for u in video_urls],
                    "mode": "720p",
                    "character_orientation": params.get("character_orientation", "image"),
                }

            elif "image-to-video" in model:
                if not image_urls:
                    return GenerationResult(
                        success=False,
                        error_code="MISSING_PARAMS",
                        error_message="Image to Video requires image_urls",
                    )
                input_data["image_urls"] = [clean_url(u) for u in image_urls]

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
            provider_cost=self.calculate_cost(model=model, duration=duration_int, sound=sound, **params),
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
            "image_urls": [clean_url(u) for u in image_urls],
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
            "input_urls": [clean_url(u) for u in image_urls],
            "video_urls": [clean_url(u) for u in video_urls],
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

    def calculate_cost(self, model: Optional[str] = None, duration: int = 5, sound: bool = False, mode: str = "720p", **params) -> float:
        model = model or self.default_model
        pricing = self.PRICING.get(model)
        
        if not pricing:
            return 0.275

        if "ai-avatar" in model:
            return pricing.get("per_second", 0.04) * duration

        if "motion-control" in model:
            if mode == "1080p":
                return pricing.get("1080p_per_sec", 0.045) * duration
            return pricing.get("720p_per_sec", 0.03) * duration

        duration_key = f"{duration}s"
        if sound:
            duration_key = f"{duration}s_audio"
        
        if duration_key in pricing:
            return pricing[duration_key]
        
        if f"{duration}s" in pricing:
            return pricing[f"{duration}s"]
        
        return pricing.get("5s", 0.275)

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
