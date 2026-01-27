from typing import Optional, List
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus
from app.adapters.kie_base import KieBaseAdapter


class FluxAdapter(BaseAdapter, KieBaseAdapter):
    name = "flux"
    display_name = "Flux (Black Forest Labs)"
    provider_type = ProviderType.IMAGE

    PRICING = {
        "flux-2/pro-text-to-image": {
            "1K": 0.025,
            "2K": 0.035,
            "display_name": "Flux 2 Pro T2I",
        },
        "flux-2/pro-image-to-image": {
            "1K": 0.025,
            "2K": 0.035,
            "display_name": "Flux 2 Pro I2I",
        },
        "flux-kontext/pro": {
            "per_image": 0.025,
            "display_name": "Flux Kontext Pro",
        },
        "flux-kontext/max": {
            "per_image": 0.05,
            "display_name": "Flux Kontext Max",
        },
        "flux-kontext/pro-text-to-image": {
            "per_image": 0.025,
            "display_name": "Flux Kontext Pro T2I",
        },
        "flux-kontext/pro-image-to-image": {
            "per_image": 0.025,
            "display_name": "Flux Kontext Pro I2I",
        },
        "flux-2/flex-text-to-image": {
            "1K": 0.025,
            "2K": 0.035,
            "display_name": "Flux 2 Flex T2I",
        },
        "flux-2/flex-image-to-image": {
            "1K": 0.025,
            "2K": 0.035,
            "display_name": "Flux 2 Flex I2I",
        },
    }

    def __init__(self, api_key: str, default_model: str = "flux-2/pro-text-to-image", **kwargs):
        BaseAdapter.__init__(self, api_key, **kwargs)
        KieBaseAdapter.__init__(self, api_key, **kwargs)
        self.default_model = default_model
        self.max_poll_attempts = kwargs.get("max_poll_attempts", 60)
        self.poll_interval = kwargs.get("poll_interval", 5)

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        image_url: Optional[str] = None,
        aspect_ratio: str = "1:1",
        resolution: str = "1K",
        **params
    ) -> GenerationResult:
        model = model or self.default_model

        input_data = {
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "resolution": resolution,
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
            provider_cost=self.calculate_cost(model=model, resolution=resolution),
            raw_response=result.raw_response,
        )

    async def health_check(self) -> ProviderHealth:
        import time
        start = time.time()
        try:
            result = await self.create_task(
                "flux-2/pro-text-to-image",
                {"prompt": "test", "aspect_ratio": "1:1", "resolution": "1K"},
            )
            latency = int((time.time() - start) * 1000)
            if result.success and result.task_id:
                return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
            return ProviderHealth(status=ProviderStatus.DEGRADED, error=result.error_message)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, model: Optional[str] = None, resolution: str = "1K", **params) -> float:
        model = model or self.default_model
        pricing = self.PRICING.get(model, self.PRICING["flux-2/pro-text-to-image"])
        
        if "per_image" in pricing:
            return pricing["per_image"]
        
        return pricing.get(resolution, pricing.get("1K", 0.025))

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "aspect_ratios": ["1:1", "16:9", "9:16", "4:3", "3:4"],
            "resolutions": ["1K", "2K"],
            "supports_text_to_image": True,
            "supports_image_to_image": True,
        }
