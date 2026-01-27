from typing import Optional
import httpx
import asyncio
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus


class RunwayAdapter(BaseAdapter):
    name = "runway"
    display_name = "Runway"
    provider_type = ProviderType.VIDEO

    BASE_URL = "https://api.kie.ai/api/v1"

    PRICING = {
        "gen4": {"per_second": 0.05, "display_name": "Gen-4"},
        "gen4-turbo": {"per_second": 0.025, "display_name": "Gen-4 Turbo"},
        "gen3-alpha": {"per_second": 0.04, "display_name": "Gen-3 Alpha"},
        "gen3-alpha-turbo": {"per_second": 0.02, "display_name": "Gen-3 Alpha Turbo"},
    }

    def __init__(self, api_key: str, default_model: str = "gen4-turbo", **kwargs):
        super().__init__(api_key, **kwargs)
        self.default_model = default_model
        self.max_poll_attempts = kwargs.get("max_poll_attempts", 180)
        self.poll_interval = kwargs.get("poll_interval", 10)

    def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        duration: int = 5,
        quality: str = "720p",
        image_url: Optional[str] = None,
        **params
    ) -> GenerationResult:
        model = model or self.default_model

        payload = {
            "prompt": prompt,
            "duration": duration,
            "quality": quality,
        }

        if image_url:
            payload["image_url"] = image_url

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}/runway/generate",
                    headers=self._get_headers(),
                    json=payload,
                )

                if response.status_code != 200:
                    return GenerationResult(
                        success=False,
                        error_code=f"HTTP_{response.status_code}",
                        error_message=response.text,
                    )

                data = response.json()
                if data.get("code") != 200:
                    return GenerationResult(
                        success=False,
                        error_code=str(data.get("code")),
                        error_message=data.get("msg", "Unknown error"),
                    )

                task_id = data.get("data", {}).get("taskId")
                if not task_id:
                    return GenerationResult(
                        success=False,
                        error_code="NO_TASK_ID",
                        error_message="No task ID returned",
                    )

                result = await self._wait_for_completion(task_id, duration)
                if result.success:
                    result.provider_cost = self.calculate_cost(model=model, duration=duration)
                return result

        except Exception as e:
            return GenerationResult(
                success=False,
                error_code="EXCEPTION",
                error_message=str(e),
            )

    async def _wait_for_completion(self, task_id: str, duration: int = 5) -> GenerationResult:
        for _ in range(self.max_poll_attempts):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(
                        f"{self.BASE_URL}/runway/record-info",
                        headers=self._get_headers(),
                        params={"taskId": task_id},
                    )

                    if response.status_code != 200:
                        await asyncio.sleep(self.poll_interval)
                        continue

                    data = response.json()
                    if data.get("code") != 200:
                        await asyncio.sleep(self.poll_interval)
                        continue

                    task_data = data.get("data", {})
                    state = task_data.get("state", "").lower()

                    if state == "success":
                        video_url = task_data.get("videoUrl") or task_data.get("video_url")
                        return GenerationResult(success=True, content=video_url)
                    elif state == "fail":
                        return GenerationResult(
                            success=False,
                            error_code=task_data.get("failCode", "TASK_FAILED"),
                            error_message=task_data.get("failMsg", "Task failed"),
                        )

                    await asyncio.sleep(self.poll_interval)

            except Exception:
                await asyncio.sleep(self.poll_interval)

        return GenerationResult(
            success=False,
            error_code="TIMEOUT",
            error_message=f"Task did not complete within {self.max_poll_attempts * self.poll_interval} seconds",
        )

    async def health_check(self) -> ProviderHealth:
        import time
        start = time.time()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/runway/record-info",
                    headers=self._get_headers(),
                    params={"taskId": "health_check"},
                )
                latency = int((time.time() - start) * 1000)
                if response.status_code in [200, 400]:
                    return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
                return ProviderHealth(status=ProviderStatus.DEGRADED, error=response.text)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, model: Optional[str] = None, duration: int = 5, **params) -> float:
        model = model or self.default_model
        pricing = self.PRICING.get(model, self.PRICING["gen4-turbo"])
        return pricing.get("per_second", 0.025) * duration

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "durations": [5, 10],
            "qualities": ["720p", "1080p"],
            "supports_text_to_video": True,
            "supports_image_to_video": True,
        }
