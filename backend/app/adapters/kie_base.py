from typing import Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum
import httpx
import asyncio
import json


class KieTaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class KieTaskResult:
    success: bool
    task_id: Optional[str] = None
    status: Optional[str] = None
    result_url: Optional[str] = None
    result_urls: Optional[list] = None
    credits_used: Optional[float] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    raw_response: Optional[dict] = None


class KieBaseAdapter:
    BASE_URL = "https://api.kie.ai/api/v1"

    def __init__(self, api_key: str, **kwargs):
        self.api_key = api_key
        self.config = kwargs
        self.max_poll_attempts = kwargs.get("max_poll_attempts", 120)
        self.poll_interval = kwargs.get("poll_interval", 5)

    def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def create_task(self, model: str, input_data: dict, callback_url: Optional[str] = None) -> KieTaskResult:
        payload = {
            "model": model,
            "input": input_data,
        }
        if callback_url:
            payload["callBackUrl"] = callback_url

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}/jobs/createTask",
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

                task_id = data.get("data", {}).get("taskId") or data.get("data", {}).get("task_id")
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
                    f"{self.BASE_URL}/jobs/recordInfo",
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
                        error_message=data.get("msg") or data.get("message") or "Unknown error",
                        raw_response=data,
                    )

                task_data = data.get("data", {})
                state = task_data.get("state", "").lower()

                if state == "success":
                    result_json_str = task_data.get("resultJson", "{}")
                    try:
                        result_json = json.loads(result_json_str) if isinstance(result_json_str, str) else result_json_str
                    except json.JSONDecodeError:
                        result_json = {}

                    result_urls = result_json.get("resultUrls", [])
                    if isinstance(result_urls, list) and result_urls:
                        if isinstance(result_urls[0], dict):
                            result_urls = [r.get("resultUrl") or r.get("url") for r in result_urls if r]
                    
                    result_url = result_urls[0] if result_urls else None

                    return KieTaskResult(
                        success=True,
                        task_id=task_id,
                        status="completed",
                        result_url=result_url,
                        result_urls=result_urls,
                        credits_used=task_data.get("credits_used"),
                        raw_response=data,
                    )
                elif state == "fail":
                    return KieTaskResult(
                        success=False,
                        task_id=task_id,
                        status="failed",
                        error_code=task_data.get("failCode") or "TASK_FAILED",
                        error_message=task_data.get("failMsg") or "Task failed",
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

    async def wait_for_completion(self, task_id: str) -> KieTaskResult:
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

    async def generate_and_wait(self, model: str, input_data: dict) -> KieTaskResult:
        create_result = await self.create_task(model, input_data)

        if not create_result.success:
            return create_result

        return await self.wait_for_completion(create_result.task_id)