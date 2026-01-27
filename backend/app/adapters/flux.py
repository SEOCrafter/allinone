from typing import Optional, List
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus
from app.adapters.kie_base import KieBaseAdapter


class FluxAdapter(BaseAdapter, KieBaseAdapter):
    name = "flux"
    display_name = "Flux (Black Forest Labs)"
    provider_type = ProviderType.IMAGE

    PRICING = {
        "flux/kontext-pro": {
            "per_image": 0.04,
            "display_name": "Flux Kontext Pro",
        },
        "flux/kontext-max": {
            "per_image": 0.08,
            "display_name": "Flux Kontext Max",
        },
        "flux/1.1-pro": {
            "per_image": 0.04,
            "display_name": "Flux 1.1 Pro",
        },
        "flux/1.1-pro-ultra": {
            "per_image": 0.06,
            "display_name": "Flux 1.1 Pro Ultra",
        },
        "flux/dev": {
            "per_image": 0.025,
            "display_name": "Flux Dev",
        },
        "flux/schnell": {
            "per_image": 0.003,
            "display_name": "Flux Schnell",
        },
    }

    ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9", "9:21"]

    def __init__(self, api_key: str, default_model: str = "flux/kontext-pro", **kwargs):
        BaseAdapter.__init__(self, api_key, **kwargs)
        KieBaseAdapter.__init__(self, api_key, **kwargs)
        self.default_model = default_model
        self.max_poll_attempts = kwargs.get("max_poll_attempts", 60)
        self.poll_interval = kwargs.get("poll_interval", 5)

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        image_urls: Optional[List[str]] = None,
        aspect_ratio: str = "1:1",
        num_outputs: int = 1,
        guidance_scale: float = 3.5,
        num_inference_steps: int = 28,
        **params
    ) -> GenerationResult:
        model = model or self.default_model

        input_data = {
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
        }

        if "kontext" in model and image_urls:
            input_data["input_image"] = image_urls[0]

        if num_outputs > 1:
            input_data["num_outputs"] = num_outputs

        if guidance_scale != 3.5:
            input_data["guidance_scale"] = guidance_scale

        if num_inference_steps != 28:
            input_data["num_inference_steps"] = num_inference_steps

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
            result_urls=result.result_urls,
            provider_cost=self.calculate_cost(model=model, num_outputs=num_outputs),
            raw_response=result.raw_response,
        )

    async def health_check(self) -> ProviderHealth:
        import time
        start = time.time()
        try:
            result = await self.create_task(
                "flux/schnell",
                {"prompt": "A simple test image", "aspect_ratio": "1:1"},
            )
            latency = int((time.time() - start) * 1000)
            if result.success and result.task_id:
                return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
            return ProviderHealth(status=ProviderStatus.DEGRADED, error=result.error_message)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, model: Optional[str] = None, num_outputs: int = 1, **params) -> float:
        model = model or self.default_model
        pricing = self.PRICING.get(model, self.PRICING["flux/kontext-pro"])
        return pricing.get("per_image", 0.04) * num_outputs

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "aspect_ratios": self.ASPECT_RATIOS,
            "supports_text_to_image": True,
            "supports_image_editing": True,
            "supports_kontext": True,
        }
