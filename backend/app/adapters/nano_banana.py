from typing import Optional, List
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus
from app.adapters.kie_base import KieBaseAdapter, KieTaskResult


class NanoBananaAdapter(BaseAdapter, KieBaseAdapter):
    name = "nano_banana"
    display_name = "Google Imagen"
    provider_type = ProviderType.IMAGE

    PRICING = {
        "google/imagen-standard": {
            "per_image": 0.02,
            "display_name": "Imagen Standard",
        },
        "google/imagen-edit": {
            "per_image": 0.02,
            "display_name": "Imagen Edit",
        },
        "google/imagen-pro": {
            "1K": 0.09,
            "2K": 0.09,
            "4K": 0.12,
            "display_name": "Imagen Pro",
        },
        "nano-banana-pro": {
            "1K": 0.09,
            "2K": 0.09,
            "4K": 0.12,
            "display_name": "Nano Banana Pro (Imagen Pro)",
        },
        "google/nano-banana": {
            "per_image": 0.02,
            "display_name": "Nano Banana (Imagen Standard)",
        },
        "google/nano-banana-edit": {
            "per_image": 0.02,
            "display_name": "Nano Banana Edit",
        },
    }

    ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"]
    RESOLUTIONS = ["1K", "2K", "4K"]
    OUTPUT_FORMATS = ["png", "jpeg", "webp"]

    def __init__(self, api_key: str, default_model: str = "nano-banana-pro", **kwargs):
        BaseAdapter.__init__(self, api_key, **kwargs)
        KieBaseAdapter.__init__(self, api_key, **kwargs)
        self.default_model = default_model

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        aspect_ratio: str = "1:1",
        resolution: str = "1K",
        output_format: str = "png",
        image_input: Optional[List[str]] = None,
        **params
    ) -> GenerationResult:
        model = model or self.default_model

        input_data = {
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "resolution": resolution,
            "output_format": output_format,
            "image_input": image_input or [],
        }

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
            provider_cost=self.calculate_cost(model=model, resolution=resolution),
            raw_response=result.raw_response,
        )

    async def generate_async(
        self,
        prompt: str,
        model: Optional[str] = None,
        aspect_ratio: str = "1:1",
        resolution: str = "1K",
        output_format: str = "png",
        image_input: Optional[List[str]] = None,
        callback_url: Optional[str] = None,
        **params
    ) -> KieTaskResult:
        model = model or self.default_model

        input_data = {
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "resolution": resolution,
            "output_format": output_format,
            "image_input": image_input or [],
        }

        return await self.create_task(model, input_data, callback_url)

    async def health_check(self) -> ProviderHealth:
        import time
        start = time.time()
        try:
            result = await self.generate(
                prompt="A simple red circle on white background",
                resolution="1K",
            )
            latency = int((time.time() - start) * 1000)
            if result.success:
                return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
            return ProviderHealth(status=ProviderStatus.DEGRADED, error=result.error_message)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, model: Optional[str] = None, resolution: str = "1K", **params) -> float:
        model = model or self.default_model
        pricing = self.PRICING.get(model, self.PRICING["nano-banana-pro"])
        
        if "per_image" in pricing:
            return pricing["per_image"]
        
        return pricing.get(resolution, pricing.get("1K", 0.09))

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "aspect_ratios": self.ASPECT_RATIOS,
            "resolutions": self.RESOLUTIONS,
            "output_formats": self.OUTPUT_FORMATS,
            "supports_image_input": True,
            "supports_callback": True,
            "max_images_input": 8,
        }
