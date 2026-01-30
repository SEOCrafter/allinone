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

    def _resolve_model(self, model: str, mode: str = "std", has_image: bool = False) -> str:
        model_lower = model.lower()
        
        mode_suffix = "pro" if mode == "pro" else "standard"
        
        if "2.3" in model or "2-3" in model:
            if has_image:
                return f"hailuo/2-3-image-to-video-{mode_suffix}"
            return f"hailuo/2-3-image-to-video-{mode_suffix}"
        elif "02" in model or "hailuo-02" in model_lower:
            if has_image:
                return f"hailuo/02-image-to-video-{mode_suffix}"
            return f"hailuo/02-text-to-video-{mode_suffix}"
        
        return model

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        image_urls: Optional[List[str]] = None,
        image_url: Optional[str] = None,
        duration: int = 6,
        resolution: str = "768p",
        mode: str = "std",
        wait_for_result: bool = True,
        **params
    ) -> GenerationResult:
        actual_image_url = image_url
        if not actual_image_url and image_urls:
            actual_image_url = image_urls[0]
        
        has_image = actual_image_url is not None
        
        actual_model = self._resolve_model(model or self.default_model, mode, has_image)

        input_data = {
            "prompt": prompt,
            "duration": str(duration),
            "resolution": resolution.upper(),
        }

        if actual_image_url:
            input_data["image_url"] = actual_image_url

        if wait_for_result:
            result = await self.generate_and_wait(actual_model, input_data)

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
                result_urls=result.result_urls,
                provider_cost=self.calculate_cost(model=actual_model),
                raw_response=result.raw_response,
            )
        else:
            result = await self.create_task(actual_model, input_data)
            
            return GenerationResult(
                success=result.success,
                error_code=result.error_code if not result.success else "ASYNC_TASK",
                error_message=result.error_message if not result.success else "Task submitted",
                provider_cost=self.calculate_cost(model=actual_model),
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
            "supports_duration": [6, 10],
            "supports_resolution": ["768P", "1080P"],
        }