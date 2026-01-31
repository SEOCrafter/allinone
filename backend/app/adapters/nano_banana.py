from typing import Optional, List
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus
from app.adapters.kie_base import KieBaseAdapter, KieTaskResult


class NanoBananaAdapter(BaseAdapter, KieBaseAdapter):
    name = "nano_banana"
    display_name = "Nano Banana"
    provider_type = ProviderType.IMAGE

    MODEL_MAPPING = {
        "nano-banana-pro": "nano-banana-pro",
        "nano-banana": "google/nano-banana",
        "google/nano-banana": "google/nano-banana",
        "nano-banana-edit": "google/nano-banana-edit",
        "google/nano-banana-edit": "google/nano-banana-edit",
    }

    PRICING = {
        "nano-banana-pro": {
            "per_image": 0.04,
            "display_name": "Nano Banana Pro (Gemini 3)",
        },
        "google/nano-banana": {
            "per_image": 0.03,
            "display_name": "Nano Banana (Standard)",
        },
        "google/nano-banana-edit": {
            "per_image": 0.03,
            "display_name": "Nano Banana Edit",
        },
    }

    ASPECT_RATIOS = ["1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "5:4", "4:5", "21:9", "auto"]
    RESOLUTIONS = ["1K", "2K", "4K"]
    OUTPUT_FORMATS = ["png", "jpeg", "jpg", "webp"]

    def __init__(self, api_key: str, default_model: str = "nano-banana-pro", **kwargs):
        BaseAdapter.__init__(self, api_key, **kwargs)
        KieBaseAdapter.__init__(self, api_key, **kwargs)
        self.default_model = default_model

    def _get_kie_model(self, model: str) -> str:
        return self.MODEL_MAPPING.get(model, model)

    def _build_input_data(
        self,
        model: str,
        prompt: str,
        aspect_ratio: str = "1:1",
        resolution: str = "1K",
        output_format: str = "png",
        image_input: Optional[List[str]] = None,
        image_urls: Optional[List[str]] = None,
        **params
    ) -> dict:
        kie_model = self._get_kie_model(model)
        
        if output_format.lower() == "jpg":
            output_format = "jpeg"
        
        if kie_model == "nano-banana-pro":
            input_data = {
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
                "resolution": resolution,
                "output_format": output_format.lower(),
            }
            if image_input:
                input_data["image_input"] = image_input
        
        elif kie_model == "google/nano-banana-edit":
            images = image_urls or image_input or []
            input_data = {
                "prompt": prompt,
                "image_urls": images,
                "output_format": output_format.upper(),
                "image_size": aspect_ratio,
            }
        
        else:
            input_data = {
                "prompt": prompt,
                "output_format": output_format.upper(),
                "image_size": aspect_ratio,
            }
        
        return input_data

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        aspect_ratio: str = "1:1",
        resolution: str = "1K",
        output_format: str = "png",
        image_input: Optional[List[str]] = None,
        image_urls: Optional[List[str]] = None,
        wait_for_result: bool = True,
        **params
    ) -> GenerationResult:
        model = model or self.default_model
        kie_model = self._get_kie_model(model)

        input_data = self._build_input_data(
            model=model,
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
            output_format=output_format,
            image_input=image_input,
            image_urls=image_urls,
            **params
        )

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
                result_urls=result.result_urls,
                provider_cost=self.calculate_cost(model=model, resolution=resolution),
                raw_response=result.raw_response,
            )
        else:
            result = await self.create_task(kie_model, input_data)
            
            return GenerationResult(
                success=result.success,
                content=None,
                error_code=result.error_code,
                error_message=result.error_message,
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
        image_urls: Optional[List[str]] = None,
        callback_url: Optional[str] = None,
        **params
    ) -> KieTaskResult:
        model = model or self.default_model
        kie_model = self._get_kie_model(model)

        input_data = self._build_input_data(
            model=model,
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
            output_format=output_format,
            image_input=image_input,
            image_urls=image_urls,
            **params
        )

        return await self.create_task(kie_model, input_data, callback_url)

    async def health_check(self) -> ProviderHealth:
        import time
        start = time.time()
        try:
            result = await self.create_task(
                "google/nano-banana",
                {"prompt": "test", "output_format": "PNG", "image_size": "1:1"},
            )
            latency = int((time.time() - start) * 1000)
            if result.success and result.task_id:
                return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
            return ProviderHealth(status=ProviderStatus.DEGRADED, error=result.error_message)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, model: Optional[str] = None, resolution: str = "1K", **params) -> float:
        model = model or self.default_model
        kie_model = self._get_kie_model(model)
        pricing = self.PRICING.get(kie_model, self.PRICING.get(model, self.PRICING["nano-banana-pro"]))
        
        base_price = pricing.get("per_image", 0.04)
        
        if kie_model == "nano-banana-pro":
            if resolution == "2K":
                base_price = 0.06
            elif resolution == "4K":
                base_price = 0.12
        
        return base_price

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.MODEL_MAPPING.keys()),
            "aspect_ratios": self.ASPECT_RATIOS,
            "resolutions": self.RESOLUTIONS,
            "output_formats": self.OUTPUT_FORMATS,
            "supports_image_input": True,
            "supports_callback": True,
            "max_images_input": 10,
        }