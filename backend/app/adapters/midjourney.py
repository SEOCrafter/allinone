from typing import Optional, List
import httpx
import asyncio
from app.adapters.base import BaseAdapter, GenerationResult, ProviderType, ProviderHealth, ProviderStatus
from app.adapters.kie_base import KieTaskResult


class MidjourneyAdapter(BaseAdapter):
    name = "midjourney"
    display_name = "Midjourney"
    provider_type = ProviderType.IMAGE

    BASE_URL = "https://api.kie.ai/api/v1/mj"

    PRICING = {
        "mj_txt2img": {
            "per_image": 0.08,
            "display_name": "Text to Image",
        },
        "mj_img2img": {
            "per_image": 0.10,
            "display_name": "Image to Image",
        },
        "mj_video": {
            "per_video": 0.20,
            "display_name": "Image to Video",
        },
    }

    VERSIONS = ["7", "6.1", "6", "5.2", "5.1", "niji6", "niji7"]
    ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "1:2", "2:1", "5:6", "6:5"]
    SPEEDS = ["relaxed", "fast", "turbo"]

    def __init__(self, api_key: str, default_version: str = "7", **kwargs):
        super().__init__(api_key, **kwargs)
        self.default_version = default_version
        self.max_poll_attempts = kwargs.get("max_poll_attempts", 120)
        self.poll_interval = kwargs.get("poll_interval", 5)

    def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _build_payload(
        self,
        prompt: str,
        task_type: str,
        file_url: Optional[str],
        file_urls: Optional[List[str]],
        aspect_ratio: str,
        version: str,
        speed: str,
        stylization: int,
        weirdness: int,
        variety: int,
        ow: Optional[int],
        callback_url: Optional[str] = None,
    ) -> dict:
        payload = {
            "taskType": task_type,
            "prompt": prompt,
            "aspectRatio": aspect_ratio,
            "version": version,
            "stylization": stylization,
            "weirdness": weirdness,
            "variety": variety,
        }

        if task_type not in ("mj_video", "mj_omni_reference"):
            payload["speed"] = speed

        if file_urls:
            payload["fileUrls"] = file_urls
        elif file_url:
            payload["fileUrl"] = file_url

        if task_type == "mj_omni_reference" and ow is not None:
            payload["ow"] = ow

        if callback_url:
            payload["callBackUrl"] = callback_url

        return payload

    async def generate(
        self,
        prompt: str,
        task_type: str = "mj_txt2img",
        file_url: Optional[str] = None,
        file_urls: Optional[List[str]] = None,
        aspect_ratio: str = "1:1",
        version: Optional[str] = None,
        speed: str = "fast",
        stylization: int = 100,
        weirdness: int = 0,
        variety: int = 0,
        ow: Optional[int] = None,
        **params
    ) -> GenerationResult:
        version = version or self.default_version

        payload = self._build_payload(
            prompt=prompt,
            task_type=task_type,
            file_url=file_url,
            file_urls=file_urls,
            aspect_ratio=aspect_ratio,
            version=version,
            speed=speed,
            stylization=stylization,
            weirdness=weirdness,
            variety=variety,
            ow=ow,
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}/generate",
                    headers=self._get_headers(),
                    json=payload,
                )

                if response.status_code != 200:
                    error_data = response.json() if response.text else {}
                    return GenerationResult(
                        success=False,
                        error_code=f"HTTP_{response.status_code}",
                        error_message=error_data.get("msg", response.text),
                        raw_response={"request": payload, "response": error_data},
                    )

                data = response.json()

                if data.get("code") != 200:
                    return GenerationResult(
                        success=False,
                        error_code=str(data.get("code")),
                        error_message=data.get("msg", "Unknown error"),
                        raw_response={"request": payload, "response": data},
                    )

                task_id = data.get("data", {}).get("taskId")

        except httpx.TimeoutException:
            return GenerationResult(
                success=False,
                error_code="TIMEOUT",
                error_message="Request timed out",
                raw_response={"request": payload},
            )
        except Exception as e:
            return GenerationResult(
                success=False,
                error_code="EXCEPTION",
                error_message=str(e),
                raw_response={"request": payload},
            )

        result = await self._wait_for_completion(task_id)

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
            provider_cost=self.calculate_cost(task_type=task_type),
            raw_response=result.raw_response,
        )

    async def generate_async(
        self,
        prompt: str,
        task_type: str = "mj_txt2img",
        file_url: Optional[str] = None,
        file_urls: Optional[List[str]] = None,
        aspect_ratio: str = "1:1",
        version: Optional[str] = None,
        speed: str = "fast",
        stylization: int = 100,
        weirdness: int = 0,
        variety: int = 0,
        ow: Optional[int] = None,
        callback_url: Optional[str] = None,
        **params
    ) -> KieTaskResult:
        version = version or self.default_version

        payload = self._build_payload(
            prompt=prompt,
            task_type=task_type,
            file_url=file_url,
            file_urls=file_urls,
            aspect_ratio=aspect_ratio,
            version=version,
            speed=speed,
            stylization=stylization,
            weirdness=weirdness,
            variety=variety,
            ow=ow,
            callback_url=callback_url,
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}/generate",
                    headers=self._get_headers(),
                    json=payload,
                )

                if response.status_code != 200:
                    error_data = response.json() if response.text else {}
                    return KieTaskResult(
                        success=False,
                        error_code=f"HTTP_{response.status_code}",
                        error_message=error_data.get("msg", response.text),
                        raw_response={"request": payload, "response": error_data},
                    )

                data = response.json()

                if data.get("code") != 200:
                    return KieTaskResult(
                        success=False,
                        error_code=str(data.get("code")),
                        error_message=data.get("msg", "Unknown error"),
                        raw_response={"request": payload, "response": data},
                    )

                task_id = data.get("data", {}).get("taskId")
                return KieTaskResult(
                    success=True,
                    task_id=task_id,
                    status="pending",
                    raw_response={"request": payload, "response": data},
                )

        except httpx.TimeoutException:
            return KieTaskResult(
                success=False,
                error_code="TIMEOUT",
                error_message="Request timed out",
                raw_response={"request": payload},
            )
        except Exception as e:
            return KieTaskResult(
                success=False,
                error_code="EXCEPTION",
                error_message=str(e),
                raw_response={"request": payload},
            )

    async def get_task_status(self, task_id: str) -> KieTaskResult:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/record-info",
                    headers=self._get_headers(),
                    params={"taskId": task_id},
                )

                if response.status_code != 200:
                    error_data = response.json() if response.text else {}
                    return KieTaskResult(
                        success=False,
                        task_id=task_id,
                        error_code=f"HTTP_{response.status_code}",
                        error_message=error_data.get("msg", response.text),
                        raw_response=error_data,
                    )

                data = response.json()

                if data.get("code") != 200:
                    return KieTaskResult(
                        success=False,
                        task_id=task_id,
                        error_code=str(data.get("code")),
                        error_message=data.get("msg", "Unknown error"),
                        raw_response=data,
                    )

                task_data = data.get("data", {})
                success_flag = task_data.get("successFlag")

                if success_flag == 1:
                    result_info = task_data.get("resultInfoJson", {})
                    if isinstance(result_info, str):
                        import json
                        try:
                            result_info = json.loads(result_info)
                        except:
                            result_info = {}
                    result_urls = result_info.get("resultUrls", [])
                    urls = [r.get("resultUrl") if isinstance(r, dict) else r for r in result_urls]
                    urls = [u for u in urls if u]

                    return KieTaskResult(
                        success=True,
                        task_id=task_id,
                        status="completed",
                        result_url=urls[0] if urls else None,
                        result_urls=urls,
                        raw_response=data,
                    )
                elif success_flag in (2, 3):
                    return KieTaskResult(
                        success=False,
                        task_id=task_id,
                        status="failed",
                        error_code="TASK_FAILED",
                        error_message=task_data.get("errorCode") or "Task failed",
                        raw_response=data,
                    )
                else:
                    return KieTaskResult(
                        success=True,
                        task_id=task_id,
                        status="processing",
                        raw_response=data,
                    )

        except Exception as e:
            return KieTaskResult(
                success=False,
                task_id=task_id,
                error_code="EXCEPTION",
                error_message=str(e),
            )

    async def _wait_for_completion(self, task_id: str) -> KieTaskResult:
        for attempt in range(self.max_poll_attempts):
            result = await self.get_task_status(task_id)

            if not result.success and result.error_code not in ("TASK_FAILED",):
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

    async def health_check(self) -> ProviderHealth:
        import time
        start = time.time()
        try:
            result = await self.generate_async(
                prompt="A simple red circle",
                task_type="mj_txt2img",
                speed="relaxed",
            )
            latency = int((time.time() - start) * 1000)
            if result.success and result.task_id:
                return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
            return ProviderHealth(status=ProviderStatus.DEGRADED, error=result.error_message)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))

    def calculate_cost(self, task_type: str = "mj_txt2img", num_images: int = 4, **params) -> float:
        pricing = self.PRICING.get(task_type, self.PRICING["mj_txt2img"])
        if "per_video" in pricing:
            return pricing["per_video"]
        return pricing["per_image"] * num_images

    def get_capabilities(self) -> dict:
        return {
            "task_types": list(self.PRICING.keys()),
            "versions": self.VERSIONS,
            "aspect_ratios": self.ASPECT_RATIOS,
            "speeds": self.SPEEDS,
            "supports_text_to_image": True,
            "supports_image_to_image": True,
            "supports_image_to_video": True,
            "supports_callback": True,
            "images_per_request": 4,
            "stylization_range": [0, 1000],
            "weirdness_range": [0, 3000],
            "variety_range": [0, 100],
            "ow_range": [1, 1000],
        }