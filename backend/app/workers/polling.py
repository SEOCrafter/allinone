import dramatiq
import httpx
import asyncio
import json
from datetime import datetime
from typing import Optional
import os

DATABASE_URL = os.getenv("DATABASE_URL", "")
KIE_API_KEY = os.getenv("KIE_API_KEY", "")
REPLICATE_API_KEY = os.getenv("REPLICATE_API_KEY", "")


def run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def check_replicate_status(task_id: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"https://api.replicate.com/v1/predictions/{task_id}",
                headers={"Authorization": f"Bearer {REPLICATE_API_KEY}"},
            )
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        print(f"[Polling] Replicate error: {e}")
    return {}


async def check_kie_status(task_id: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                "https://api.kie.ai/api/v1/jobs/getTaskStatus",
                headers={
                    "Authorization": f"Bearer {KIE_API_KEY}",
                    "Content-Type": "application/json",
                },
                params={"taskId": task_id},
            )
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        print(f"[Polling] KIE error: {e}")
    return {}


async def update_task_in_db(
    request_id: str,
    status: str,
    result_url: Optional[str] = None,
    result_urls: Optional[list] = None,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
    poll_number: int = 0,
    external_status: str = "",
    raw_response: dict = None,
):
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import text
    import uuid as uuid_module
    
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        try:
            event_id = str(uuid_module.uuid4())
            event_type = "poll" if status == "processing" else ("completed" if status == "completed" else "failed")
            response_json = json.dumps({"poll_number": poll_number, "raw": raw_response}) if raw_response else "{}"
            
            await db.execute(text("""
                INSERT INTO task_events (id, request_id, event_type, external_status, response_data, error_message, created_at)
                VALUES (:id, :request_id, :event_type, :external_status, :response_data::json, :error_message, NOW())
            """), {
                "id": event_id,
                "request_id": request_id,
                "event_type": event_type,
                "external_status": external_status,
                "response_data": response_json,
                "error_message": error_message,
            })
            
            if status in ("completed", "failed"):
                result_urls_json = json.dumps(result_urls) if result_urls else None
                
                await db.execute(text("""
                    UPDATE requests 
                    SET status = :status,
                        completed_at = NOW(),
                        result_url = :result_url,
                        result_urls = :result_urls::json,
                        error_code = :error_code,
                        error_message = :error_message
                    WHERE id = :request_id
                """), {
                    "status": status,
                    "result_url": result_url,
                    "result_urls": result_urls_json,
                    "error_code": error_code,
                    "error_message": error_message,
                    "request_id": request_id,
                })
            
            await db.commit()
            print(f"[Polling] Request {request_id} updated: {status}")
            
        except Exception as e:
            print(f"[Polling] DB error: {e}")
            await db.rollback()
    
    await engine.dispose()


async def poll_task_async(
    request_id: str,
    external_task_id: str,
    provider: str,
    poll_number: int = 1,
    max_polls: int = 120,
):
    print(f"[Polling] Poll #{poll_number} for {provider}:{external_task_id}")
    
    if poll_number > max_polls:
        await update_task_in_db(
            request_id=request_id,
            status="failed",
            error_code="TIMEOUT",
            error_message=f"Task did not complete after {max_polls} polls",
            poll_number=poll_number,
            external_status="timeout",
        )
        return
    
    if provider == "replicate":
        data = await check_replicate_status(external_task_id)
        
        if not data:
            poll_task.send_with_options(
                args=(request_id, external_task_id, provider, poll_number + 1, max_polls),
                delay=5000,
            )
            return
        
        status = data.get("status", "")
        
        if status == "succeeded":
            output = data.get("output")
            if isinstance(output, list):
                result_url = output[0] if output else None
                result_urls = output
            else:
                result_url = output
                result_urls = [output] if output else None
            
            await update_task_in_db(
                request_id=request_id,
                status="completed",
                result_url=result_url,
                result_urls=result_urls,
                poll_number=poll_number,
                external_status="succeeded",
                raw_response=data,
            )
        
        elif status == "failed":
            await update_task_in_db(
                request_id=request_id,
                status="failed",
                error_code="REPLICATE_FAILED",
                error_message=data.get("error") or "Task failed",
                poll_number=poll_number,
                external_status="failed",
                raw_response=data,
            )
        
        elif status == "canceled":
            await update_task_in_db(
                request_id=request_id,
                status="failed",
                error_code="CANCELED",
                error_message="Task was canceled",
                poll_number=poll_number,
                external_status="canceled",
                raw_response=data,
            )
        
        else:
            await update_task_in_db(
                request_id=request_id,
                status="processing",
                poll_number=poll_number,
                external_status=status,
                raw_response=data,
            )
            poll_task.send_with_options(
                args=(request_id, external_task_id, provider, poll_number + 1, max_polls),
                delay=5000,
            )
    
    elif provider == "kie":
        data = await check_kie_status(external_task_id)
        
        if not data or data.get("code") != 200:
            poll_task.send_with_options(
                args=(request_id, external_task_id, provider, poll_number + 1, max_polls),
                delay=5000,
            )
            return
        
        task_data = data.get("data", {})
        state = task_data.get("state", "").lower()
        
        if state == "success":
            result_json_str = task_data.get("resultJson", "{}")
            try:
                result_json = json.loads(result_json_str) if isinstance(result_json_str, str) else result_json_str
                result_url = result_json.get("resultUrl") or result_json.get("url")
                result_urls = result_json.get("resultUrls") or ([result_url] if result_url else None)
            except:
                result_url = None
                result_urls = None
            
            await update_task_in_db(
                request_id=request_id,
                status="completed",
                result_url=result_url,
                result_urls=result_urls,
                poll_number=poll_number,
                external_status="success",
                raw_response=data,
            )
        
        elif state in ("failed", "fail"):
            await update_task_in_db(
                request_id=request_id,
                status="failed",
                error_code=task_data.get("failCode") or "KIE_FAILED",
                error_message=task_data.get("failMsg") or "Task failed",
                poll_number=poll_number,
                external_status=state,
                raw_response=data,
            )
        
        else:
            await update_task_in_db(
                request_id=request_id,
                status="processing",
                poll_number=poll_number,
                external_status=state,
                raw_response=data,
            )
            poll_task.send_with_options(
                args=(request_id, external_task_id, provider, poll_number + 1, max_polls),
                delay=5000,
            )


@dramatiq.actor(max_retries=3, min_backoff=1000, max_backoff=10000)
def poll_task(
    request_id: str,
    external_task_id: str,
    provider: str,
    poll_number: int = 1,
    max_polls: int = 120,
):
    run_async(poll_task_async(request_id, external_task_id, provider, poll_number, max_polls))