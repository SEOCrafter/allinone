from typing import Optional, List
import httpx
import asyncio
import json
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus
from app.adapters.kie_base import KieBaseAdapter, KieTaskResult


class RunwayAdapter(BaseAdapter, KieBaseAdapter):
    name = "runway"
    display_name = "Runway"
    provider_type = ProviderType.VIDEO

    PRICING = {
        "runway-t2v-5s-720p": {"per_video": 0.06, "display_name": "Runway T2V 5s 720p"},
        "runway-t2v-10s-720p": {"per_video": 0.15, "display_name": "Runway T2V 10s 720p"},
        "runway-t2v-5s-1080p": {"per_video": 0.15, "display_name": "Runway T2V 5s 1080p"},
        "runway-i2v-5s-720p": {"per_video": 0.06, "display_name": "Runway I2V 5s 720p"},
        "runway-i2v-10s-720p": {"per_video": 0.15, "display_name": "Runway I2V 10s 720p"},
        "runway-i2v-5s-1080p": {"per_video": 0.15, "display_name": "Runway I2V 5s 1080p"},
        "runway-aleph": {"per_video": 0.55, "display_name": "Runway Aleph"},
        "gen4": {
            "5s_720p": 0.06,
            "10s_720p": 0.15,
            "5s_1080p": 0.15,
            "display_name": "Gen-4",
        },
        "gen4-turbo": {
            "5s_720p": 0.06,
            "10s_720p": 0.15,
            "5s_1080p": 0.15,
            "display_name": "Gen-4 Turbo",
        },
        "gen3-alpha": {
            "5s_720p": 0.06,
            "10s_720p": 0.15,
            "5s_1080p": 0.15,
            "display_name": "Gen-3 Alpha",
        },
        "gen3-alpha-turbo": {
            "5s_720p": 0.06,
            "10s_720p": 0.15,
            "5s_1080p": 0.15,
            "display_name": "Gen-3 Alpha Turbo",
        },
    }

    def __init__(self, api_key: str, default_model: str = "gen4-turbo", **kwargs):
        BaseAdapter.__init__(self, api_key, **kwargs)
        KieBaseAdapter.__init__(self, api_key, **kwargs)
        self.default_model = default_model
        self.max_poll_attempts = kwargs.get("max_poll_attempts", 180)
        self.poll_interval = kwargs.get("poll_interval", 10)

    async def create_runway_task(self, input_data: dict) -> KieTaskResult:
        payload = {
            "prompt": input_data.get("prompt"),
            "duration": input_data.get("duration", 5),
            "quality": input_data.get("quality", "720p"),
        }

        if input_data.get("image_url"):
            payload["image_url"] = input_data["image_url"]

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}/runway/generate",
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

    async def get_runway_task_status(self, task_id: str) -> KieTaskResult:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/runway/record-info",
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

    async def wait_for_runway_completion(self, task_id: str) -> KieTaskResult:
        for _ in range(self.max_poll_attempts):
            result = await self.get_runway_task_status(task_id)

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
        image_url: Optional[str] = None,
        duration: int = 5,
        quality: str = "720p",
        **params
    ) -> GenerationResult:
        model = model or self.default_model

        input_data = {
            "prompt": prompt,
            "duration": duration,
            "quality": quality,
        }

        if image_url:
            input_data["image_url"] = image_url

        create_result = await self.create_runway_task(input_data)

        if not create_result.success:
            return GenerationResult(
                success=False,
                error_code=create_result.error_code,
                error_message=create_result.error_message,
                raw_response=create_result.raw_response,
            )

        result = await self.wait_for_runway_completion(create_result.task_id)

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
            provider_cost=self.calculate_cost(model=model, duration=duration, quality=quality),
            raw_response=result.raw_response,
        )

    async def health_check(self) -> ProviderHealth:
        import time
        start = time.time()
        try:
            result = await self.create_runway_task(
                {"prompt": "test", "duration": 5, "quality": "720p"},
            )
            latency = int((time.time() - start) * 1000)
            if result.success and result.task_id:
                return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
            return ProviderHealth(status=ProviderStatus.DEGRADED, error=result.error_message)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, model: Optional[str] = None, duration: int = 5, quality: str = "720p", **params) -> float:
        model = model or self.default_model
        
        if model == "runway-aleph":
            return 0.55
        
        pricing = self.PRICING.get(model)
        
        if pricing and "per_video" in pricing:
            return pricing["per_video"]
        
        if pricing:
            key = f"{duration}s_{quality}"
            if key in pricing:
                return pricing[key]
        
        if duration == 5 and quality == "720p":
            return 0.06
        elif duration == 10 and quality == "720p":
            return 0.15
        elif duration == 5 and quality == "1080p":
            return 0.15
        
        return 0.15

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "durations": [5, 10],
            "qualities": ["720p", "1080p"],
            "supports_text_to_video": True,
            "supports_image_to_video": True,
        }
