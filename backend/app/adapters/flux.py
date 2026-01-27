from typing import Optional
import httpx
import asyncio
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus


class FluxAdapter(BaseAdapter):
    name = "flux"
    display_name = "Flux (Black Forest Labs)"
    provider_type = ProviderType.IMAGE

    BASE_URL = "https://api.kie.ai/api/v1"

    PRICING = {
        "flux-2/pro-text-to-image": {"per_image": 0.05, "display_name": "Flux 2 Pro"},
        "flux-2/pro-image-to-image": {"per_image": 0.05, "display_name": "Flux 2 Pro I2I"},
        "flux-1.1/pro-text-to-image": {"per_image": 0.04, "display_name": "Flux 1.1 Pro"},
        "flux-kontext/pro-text-to-image": {"per_image": 0.04, "display_name": "Flux Kontext Pro"},
        "flux-kontext/pro-image-to-image": {"per_image": 0.04, "display_name": "Flux Kontext Pro I2I"},
    }

    def __init__(self, api_key: str, default_model: str = "flux-2/pro-text-to-image", **kwargs):
        super().__init__(api_key, **kwargs)
        self.default_model = default_model
        self.max_poll_attempts = kwargs.get("max_poll_attempts", 60)
        self.poll_interval = kwargs.get("poll_interval", 5)

    def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        aspect_ratio: str = "1:1",
        resolution: str = "1K",
        image_url: Optional[str] = None,
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

        payload = {
            "model": model,
            "input": input_data,
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}/jobs/createTask",
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

                result = await self._wait_for_completion(task_id)
                if result.success:
                    result.provider_cost = self.calculate_cost(model=model)
                return result

        except Exception as e:
            return GenerationResult(
                success=False,
                error_code="EXCEPTION",
                error_message=str(e),
            )

    async def _wait_for_completion(self, task_id: str) -> GenerationResult:
        for _ in range(self.max_poll_attempts):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(
                        f"{self.BASE_URL}/jobs/taskInfo",
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
                    status = task_data.get("status", "").lower()

                    if status in ["success", "completed"]:
                        output = task_data.get("output", {})
                        image_url = output.get("image_url") or output.get("url")
                        return GenerationResult(success=True, content=image_url)
                    elif status in ["fail", "failed", "error"]:
                        return GenerationResult(
                            success=False,
                            error_code="TASK_FAILED",
                            error_message=task_data.get("error", "Task failed"),
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
                    f"{self.BASE_URL}/jobs/taskInfo",
                    headers=self._get_headers(),
                    params={"taskId": "health_check"},
                )
                latency = int((time.time() - start) * 1000)
                if response.status_code in [200, 400]:
                    return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
                return ProviderHealth(status=ProviderStatus.DEGRADED, error=response.text)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, model: Optional[str] = None, **params) -> float:
        model = model or self.default_model
        pricing = self.PRICING.get(model, self.PRICING["flux-2/pro-text-to-image"])
        return pricing.get("per_image", 0.05)

    def get_capabilities(self) -> dict:
        return {
            "models": list(self.PRICING.keys()),
            "aspect_ratios": ["1:1", "16:9", "9:16", "4:3", "3:4"],
            "resolutions": ["1K", "2K"],
            "supports_text_to_image": True,
            "supports_image_to_image": True,
        }
