from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum
import httpx
import asyncio
import json

from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus


class ReplicateStatus(str, Enum):
    STARTING = "starting"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"


@dataclass
class ReplicatePrediction:
    success: bool
    prediction_id: Optional[str] = None
    status: Optional[str] = None
    output: Optional[Any] = None
    error: Optional[str] = None
    metrics: Optional[dict] = None
    raw_response: Optional[dict] = None


class ReplicateAdapter(BaseAdapter):
    name = "replicate"
    display_name = "Replicate"
    provider_type = ProviderType.VIDEO

    BASE_URL = "https://api.replicate.com/v1"

    MODELS = {
        "google/nano-banana-pro": {"type": "image", "price_type": "per_image", "price": 0.05},
        "google/nano-banana": {"type": "image", "price_type": "per_image", "price": 0.04},
        "kwaivgi/kling-v2.6": {"type": "video", "price_type": "per_second", "price": 0.07},
        "kwaivgi/kling-v2.6-motion-control": {"type": "video", "price_type": "per_second", "price": 0.07},
        "google/veo-3": {"type": "video", "price_type": "per_second", "price": 0.75},
        "google/veo-3.1": {"type": "video", "price_type": "per_second", "price": 0.75},
        "google/veo-3-fast": {"type": "video", "price_type": "per_second", "price": 0.15},
        "google/veo-2": {"type": "video", "price_type": "per_second", "price": 0.40},
        "minimax/hailuo-02": {"type": "video", "price_type": "per_request", "price": 0.34},
        "minimax/hailuo-02-fast": {"type": "video", "price_type": "per_request", "price": 0.25},
        "minimax/hailuo-2.3": {"type": "video", "price_type": "per_request", "price": 0.59},
        "openai/sora-2": {"type": "video", "price_type": "per_second", "price": 0.10},
        "openai/sora-2-pro": {"type": "video", "price_type": "per_second", "price": 0.50},
        "bytedance/seedance-1-pro": {"type": "video", "price_type": "per_second", "price": 0.15},
        "bytedance/seedance-1-pro-fast": {"type": "video", "price_type": "per_second", "price": 0.10},
        "bytedance/seedance-1-lite": {"type": "video", "price_type": "per_second", "price": 0.05},
        "black-forest-labs/flux-pro": {"type": "image", "price_type": "per_image", "price": 0.04},
        "black-forest-labs/flux-schnell": {"type": "image", "price_type": "per_image", "price": 0.003},
        "black-forest-labs/flux-dev": {"type": "image", "price_type": "per_image", "price": 0.025},
        "stability-ai/stable-diffusion-3.5-large": {"type": "image", "price_type": "per_image", "price": 0.065},
        "stability-ai/stable-diffusion-3.5-large-turbo": {"type": "image", "price_type": "per_image", "price": 0.04},
        "google/imagen-4": {"type": "image", "price_type": "per_image", "price": 0.03},
        "google/imagen-4-fast": {"type": "image", "price_type": "per_image", "price": 0.02},
        "google/imagen-4-ultra": {"type": "image", "price_type": "per_image", "price": 0.05},
        "omniedgeio/face-swap": {"type": "image", "price_type": "per_image", "price": 0.01},
        "minimax/speech-02-turbo": {"type": "audio", "price_type": "per_request", "price": 0.02},
        "minimax/speech-02-hd": {"type": "audio", "price_type": "per_request", "price": 0.04},
        "minimax/image-01": {"type": "image", "price_type": "per_image", "price": 0.04},
        "minimax/video-01": {"type": "video", "price_type": "per_request", "price": 0.30},
        "runwayml/gen4-image": {"type": "image", "price_type": "per_image", "price": 0.05},
        "runwayml/gen4-image-turbo": {"type": "image", "price_type": "per_image", "price": 0.03},
        "runwayml/gen4-turbo": {"type": "video", "price_type": "per_second", "price": 0.05},
        "luma/ray": {"type": "video", "price_type": "per_second", "price": 0.05},
        "luma/ray-flash-2-540p": {"type": "video", "price_type": "per_second", "price": 0.02},
        "luma/photon-flash": {"type": "image", "price_type": "per_image", "price": 0.02},
    }

    PRICING = {
        model_id: {
            "display_name": model_id.split("/")[-1].replace("-", " ").title(),
            "per_" + info["price_type"].split("_")[1]: info["price"],
        }
        for model_id, info in MODELS.items()
    }

    def __init__(self, api_key: str, default_model: str = "black-forest-labs/flux-schnell", **kwargs):
        super().__init__(api_key, **kwargs)
        self.default_model = default_model
        self.max_poll_attempts = kwargs.get("max_poll_attempts", 180)
        self.poll_interval = kwargs.get("poll_interval", 5)

    def _get_headers(self, wait: bool = True) -> dict:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if wait:
            headers["Prefer"] = "wait=60"
        return headers

    async def create_prediction(
        self,
        model: str,
        input_data: dict,
        webhook: Optional[str] = None,
        wait: bool = True,
    ) -> ReplicatePrediction:
        payload = {
            "input": input_data,
        }
        if webhook:
            payload["webhook"] = webhook
            payload["webhook_events_filter"] = ["completed"]

        print(f"Replicate API Request: model={model}, input={json.dumps(input_data)[:500]}, wait={wait}")

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                url = f"{self.BASE_URL}/models/{model}/predictions"
                response = await client.post(
                    url,
                    headers=self._get_headers(wait=wait),
                    json=payload,
                )

                print(f"Replicate API Response: status={response.status_code}, body={response.text[:1000]}")

                if response.status_code not in (200, 201, 202):
                    error_data = response.json() if response.text else {}
                    return ReplicatePrediction(
                        success=False,
                        error=error_data.get("detail", response.text),
                        raw_response={"request": payload, "response": error_data},
                    )

                data = response.json()
                status = data.get("status")

                if status == ReplicateStatus.SUCCEEDED:
                    return ReplicatePrediction(
                        success=True,
                        prediction_id=data.get("id"),
                        status=status,
                        output=data.get("output"),
                        metrics=data.get("metrics"),
                        raw_response=data,
                    )
                elif status == ReplicateStatus.FAILED:
                    return ReplicatePrediction(
                        success=False,
                        prediction_id=data.get("id"),
                        status=status,
                        error=data.get("error"),
                        raw_response=data,
                    )
                else:
                    return ReplicatePrediction(
                        success=True,
                        prediction_id=data.get("id"),
                        status=status,
                        raw_response=data,
                    )

        except httpx.TimeoutException:
            return ReplicatePrediction(
                success=False,
                error="Request timed out",
                raw_response={"request": payload},
            )
        except Exception as e:
            return ReplicatePrediction(
                success=False,
                error=str(e),
                raw_response={"request": payload},
            )

    async def get_prediction(self, prediction_id: str) -> ReplicatePrediction:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/predictions/{prediction_id}",
                    headers=self._get_headers(wait=False),
                )

                if response.status_code != 200:
                    return ReplicatePrediction(
                        success=False,
                        prediction_id=prediction_id,
                        error=response.text,
                    )

                data = response.json()
                status = data.get("status")

                if status == ReplicateStatus.SUCCEEDED:
                    return ReplicatePrediction(
                        success=True,
                        prediction_id=prediction_id,
                        status=status,
                        output=data.get("output"),
                        metrics=data.get("metrics"),
                        raw_response=data,
                    )
                elif status == ReplicateStatus.FAILED:
                    return ReplicatePrediction(
                        success=False,
                        prediction_id=prediction_id,
                        status=status,
                        error=data.get("error"),
                        raw_response=data,
                    )
                else:
                    return ReplicatePrediction(
                        success=True,
                        prediction_id=prediction_id,
                        status=status,
                        raw_response=data,
                    )

        except Exception as e:
            return ReplicatePrediction(
                success=False,
                prediction_id=prediction_id,
                error=str(e),
            )

    async def wait_for_completion(self, prediction_id: str) -> ReplicatePrediction:
        for attempt in range(self.max_poll_attempts):
            result = await self.get_prediction(prediction_id)

            if result.status == ReplicateStatus.SUCCEEDED:
                return result
            
            if result.status == ReplicateStatus.FAILED:
                return result

            if result.status == ReplicateStatus.CANCELED:
                return ReplicatePrediction(
                    success=False,
                    prediction_id=prediction_id,
                    status="canceled",
                    error="Prediction was canceled",
                )

            await asyncio.sleep(self.poll_interval)

        return ReplicatePrediction(
            success=False,
            prediction_id=prediction_id,
            error=f"Prediction did not complete within {self.max_poll_attempts * self.poll_interval} seconds",
        )

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        image_urls: Optional[List[str]] = None,
        video_urls: Optional[List[str]] = None,
        duration: int = 5,
        aspect_ratio: str = "16:9",
        wait_for_result: bool = True,
        **params
    ) -> GenerationResult:
        model = model or self.default_model
        model_info = self.MODELS.get(model, {})
        model_type = model_info.get("type", "image")

        input_data = self._build_input(
            model=model,
            model_type=model_type,
            prompt=prompt,
            image_urls=image_urls,
            video_urls=video_urls,
            duration=duration,
            aspect_ratio=aspect_ratio,
            **params
        )

        result = await self.create_prediction(model, input_data, wait=wait_for_result)

        if not result.success and not result.prediction_id:
            return GenerationResult(
                success=False,
                error_code="REPLICATE_ERROR",
                error_message=result.error,
                raw_response=result.raw_response,
            )

        if not wait_for_result and result.prediction_id:
            cost = self.calculate_cost(model=model, duration=duration)
            return GenerationResult(
                success=False,
                error_code="ASYNC_TASK",
                error_message="Task submitted for async processing",
                provider_cost=cost,
                raw_response=result.raw_response,
            )

        if result.status not in (ReplicateStatus.SUCCEEDED,):
            result = await self.wait_for_completion(result.prediction_id)

        if not result.success:
            return GenerationResult(
                success=False,
                error_code="REPLICATE_FAILED",
                error_message=result.error,
                raw_response=result.raw_response,
            )

        output = result.output
        if isinstance(output, list):
            content = output[0] if output else None
            result_urls = output
        else:
            content = output
            result_urls = [output] if output else None

        predict_time = result.metrics.get("predict_time", 0) if result.metrics else 0
        cost = self.calculate_cost(model=model, duration=duration, predict_time=predict_time)

        return GenerationResult(
            success=True,
            content=content,
            result_urls=result_urls,
            provider_cost=cost,
            raw_response=result.raw_response,
        )

    def _build_input(
        self,
        model: str,
        model_type: str,
        prompt: str,
        image_urls: Optional[List[str]] = None,
        video_urls: Optional[List[str]] = None,
        duration: int = 5,
        aspect_ratio: str = "16:9",
        **params
    ) -> dict:
        input_data = {"prompt": prompt}

        if "flux" in model.lower():
            input_data["aspect_ratio"] = aspect_ratio
            if params.get("num_outputs"):
                input_data["num_outputs"] = params["num_outputs"]

        elif "stable-diffusion" in model.lower():
            input_data["aspect_ratio"] = aspect_ratio

        elif "imagen" in model.lower():
            input_data["aspect_ratio"] = aspect_ratio

        elif "kling" in model.lower():
            input_data["duration"] = duration
            input_data["aspect_ratio"] = aspect_ratio
            if image_urls:
                input_data["image"] = image_urls[0]
            if "motion-control" in model.lower() and video_urls:
                input_data["video"] = video_urls[0]

        elif "veo" in model.lower():
            input_data["duration"] = duration
            input_data["aspect_ratio"] = aspect_ratio
            if image_urls:
                input_data["image"] = image_urls[0]

        elif "hailuo" in model.lower() or "minimax/video" in model.lower():
            input_data["duration"] = duration
            if "fast" in model.lower():
                input_data["resolution"] = params.get("resolution", "512p").upper()
            else:
                input_data["resolution"] = params.get("resolution", "768p").lower()
            if image_urls:
                input_data["first_frame_image"] = image_urls[0]

        elif "sora" in model.lower():
            input_data["seconds"] = duration
            if aspect_ratio in ("9:16", "10:16", "3:4"):
                input_data["aspect_ratio"] = "portrait"
            else:
                input_data["aspect_ratio"] = "landscape"
            if image_urls:
                input_data["input_reference"] = image_urls[0]

        elif "seedance" in model.lower():
            input_data["duration"] = duration
            input_data["resolution"] = params.get("resolution", "720p")
            input_data["aspect_ratio"] = aspect_ratio
            if image_urls:
                input_data["image"] = image_urls[0]
                if len(image_urls) >= 2:
                    input_data["last_frame_image"] = image_urls[1]
                if len(image_urls) >= 3:
                    input_data["reference_images"] = image_urls[2:6]

        elif "face-swap" in model.lower():
            if image_urls and len(image_urls) >= 2:
                input_data["source_image"] = image_urls[0]
                input_data["target_image"] = image_urls[1]
            input_data.pop("prompt", None)

        elif "luma" in model.lower():
            if "photon" in model.lower():
                pass
            else:
                input_data["duration"] = duration
                input_data["aspect_ratio"] = aspect_ratio
                if image_urls:
                    input_data["start_image"] = image_urls[0]

        elif "runway" in model.lower():
            if "aleph" in model.lower():
                input_data["aspect_ratio"] = aspect_ratio
                if video_urls:
                    input_data["video"] = video_urls[0]
                if image_urls:
                    input_data["reference_image"] = image_urls[0]
            else:
                if image_urls:
                    input_data["image"] = image_urls[0]

        elif "speech" in model.lower():
            input_data["text"] = prompt
            input_data.pop("prompt", None)

        for key, value in params.items():
            if key not in input_data and value is not None and key not in ("wait_for_result",):
                input_data[key] = value

        return input_data

    async def health_check(self) -> ProviderHealth:
        import time
        start = time.time()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/account",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                latency = int((time.time() - start) * 1000)
                
                if response.status_code == 200:
                    return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
                elif response.status_code == 401:
                    return ProviderHealth(status=ProviderStatus.DOWN, error="Invalid API key")
                else:
                    return ProviderHealth(status=ProviderStatus.DEGRADED, error=f"HTTP {response.status_code}")
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(
        self,
        model: Optional[str] = None,
        duration: int = 5,
        predict_time: float = 0,
        tokens_input: int = 0,
        tokens_output: int = 0,
        **params
    ) -> float:
        model = model or self.default_model
        model_info = self.MODELS.get(model, {})
        price_type = model_info.get("price_type", "per_image")
        price = model_info.get("price", 0.01)

        if price_type == "per_second":
            return price * duration
        elif price_type == "per_request":
            return price
        elif price_type == "per_image":
            return price
        return price

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.MODELS.keys()),
            "supports_image_generation": True,
            "supports_video_generation": True,
            "supports_audio_generation": True,
            "supports_face_swap": True,
            "supports_webhook": True,
        }

    @classmethod
    def get_model_info(cls, model_id: str) -> Optional[dict]:
        return cls.MODELS.get(model_id)

    @classmethod
    def list_models_by_type(cls, model_type: str) -> List[str]:
        return [
            model_id
            for model_id, info in cls.MODELS.items()
            if info.get("type") == model_type
        ]