from typing import Optional, List
import httpx
import asyncio
import json
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus
from app.adapters.kie_base import KieBaseAdapter, KieTaskResult


class VeoAdapter(BaseAdapter, KieBaseAdapter):
    name = "veo"
    display_name = "Google Veo"
    provider_type = ProviderType.VIDEO

    PRICING = {
        "veo3.1-fast-t2v": {"per_video": 0.30, "display_name": "Veo 3.1 Fast T2V"},
        "veo3.1-fast-i2v": {"per_video": 0.30, "display_name": "Veo 3.1 Fast I2V"},
        "veo3.1-fast-ref": {"per_video": 0.30, "display_name": "Veo 3.1 Fast Ref"},
        "veo3.1-quality-t2v": {"per_video": 1.25, "display_name": "Veo 3.1 Quality T2V"},
        "veo3.1-quality-i2v": {"per_video": 1.25, "display_name": "Veo 3.1 Quality I2V"},
        "veo3.1-extend": {"per_video": 0.30, "display_name": "Veo 3.1 Extend"},
        "veo3.1-1080p": {"per_video": 0.025, "display_name": "Veo 3.1 1080P Upscale"},
        "veo3.1-4k": {"per_video": 0.60, "display_name": "Veo 3.1 4K Upscale"},
        "veo3_fast": {"per_video": 0.30, "display_name": "Veo 3 Fast"},
        "veo3": {"per_video": 1.25, "display_name": "Veo 3"},
    }

    def __init__(self, api_key: str, default_model: str = "veo3.1-fast-t2v", **kwargs):
        BaseAdapter.__init__(self, api_key, **kwargs)
        KieBaseAdapter.__init__(self, api_key, **kwargs)
        self.default_model = default_model
        self.max_poll_attempts = kwargs.get("max_poll_attempts", 180)
        self.poll_interval = kwargs.get("poll_interval", 10)

    async def create_veo_task(self, model: str, input_data: dict) -> KieTaskResult:
        payload = {
            "prompt": input_data.get("prompt"),
            "model": model,
            "aspect_ratio": input_data.get("aspect_ratio", "16:9"),
        }

        if input_data.get("imageUrls"):
            payload["imageUrls"] = input_data["imageUrls"]

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}/veo/generate",
                    headers=self._get_headers(),
                    json=payload,
                )

                if response.status_code != 200:
                    return KieTaskResult(
                        success=False,
                        error_code=f"HTTP_{response.status_code}",
                        error_message=response.text,
                    )

                data = response.json()
                if data.get("code") != 200:
                    return KieTaskResult(
                        success=False,
                        error_code=str(data.get("code")),
                        error_message=data.get("msg", "Unknown error"),
                    )

                task_id = data.get("data", {}).get("taskId")
                return KieTaskResult(
                    success=True,
                    task_id=task_id,
                    status="pending",
                    raw_response=data,
                )

        except Exception as e:
            return KieTaskResult(
                success=False,
                error_code="EXCEPTION",
                error_message=str(e),
            )

    async def get_veo_task_status(self, task_id: str) -> KieTaskResult:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/veo/record-info",
                    headers=self._get_headers(),
                    params={"taskId": task_id},
                )

                if response.status_code != 200:
                    return KieTaskResult(
                        success=False,
                        task_id=task_id,
                        error_code=f"HTTP_{response.status_code}",
                        error_message=response.text,
                    )

                data = response.json()
                if data.get("code") != 200:
                    return KieTaskResult(
                        success=False,
                        task_id=task_id,
                        error_code=str(data.get("code")),
                        error_message=data.get("msg", "Unknown error"),
                    )

                task_data = data.get("data", {})
                state = task_data.get("state", "").lower()

                if state == "success":
                    video_url = task_data.get("videoUrl") or task_data.get("video_url")
                    return KieTaskResult(
                        success=True,
                        task_id=task_id,
                        status="completed",
                        result_url=video_url,
                        raw_response=data,
                    )
                elif state == "fail":
                    return KieTaskResult(
                        success=False,
                        task_id=task_id,
                        status="failed",
                        error_code=task_data.get("failCode", "TASK_FAILED"),
                        error_message=task_data.get("failMsg", "Task failed"),
                        raw_response=data,
                    )
                else:
                    return KieTaskResult(
                        success=True,
                        task_id=task_id,
                        status=state or "processing",
                        raw_response=data,
                    )

        except Exception as e:
            return KieTaskResult(
                success=False,
                task_id=task_id,
                error_code="EXCEPTION",
                error_message=str(e),
            )

    async def wait_for_veo_completion(self, task_id: str) -> KieTaskResult:
        for _ in range(self.max_poll_attempts):
            result = await self.get_veo_task_status(task_id)

            if not result.success and result.error_code != "TASK_FAILED":
                return result

            if result.status == "completed":
                return result

            if result.status == "failed":
                return result

            await asyncio.sleep(self.poll_interval)

        return KieTaskResult(
            success=False,
            task_id=task_id,
            error_code="TIMEOUT",
            error_message=f"Task did not complete within {self.max_poll_attempts * self.poll_interval} seconds",
        )

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        image_urls: Optional[List[str]] = None,
        aspect_ratio: str = "16:9",
        **params
    ) -> GenerationResult:
        model = model or self.default_model

        input_data = {
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
        }

        if image_urls:
            input_data["imageUrls"] = image_urls

        create_result = await self.create_veo_task(model, input_data)

        if not create_result.success:
            return GenerationResult(
                success=False,
                error_code=create_result.error_code,
                error_message=create_result.error_message,
                raw_response=create_result.raw_response,
            )

        result = await self.wait_for_veo_completion(create_result.task_id)

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
            result = await self.create_veo_task(
                "veo3.1-fast-t2v",
                {"prompt": "test", "aspect_ratio": "16:9"},
            )
            latency = int((time.time() - start) * 1000)
            if result.success and result.task_id:
                return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
            return ProviderHealth(status=ProviderStatus.DEGRADED, error=result.error_message)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, model: Optional[str] = None, **params) -> float:
        model = model or self.default_model
        pricing = self.PRICING.get(model, self.PRICING["veo3.1-fast-t2v"])
        return pricing.get("per_video", 0.30)

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "aspect_ratios": ["16:9", "9:16", "1:1"],
            "supports_text_to_video": True,
            "supports_image_to_video": True,
            "supports_extend": True,
            "supports_upscale": True,
        }
