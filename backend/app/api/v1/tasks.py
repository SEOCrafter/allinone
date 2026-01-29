from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import uuid

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.request import Request
from app.models.task_event import TaskEvent
from app.models.provider_balance import ProviderBalance
from app.services.provider_routing import get_api_key_for_provider
from app.services.task_events import get_task_events, log_poll, log_completed, log_failed, EventType
from app.adapters import AdapterRegistry
from app.config import settings

router = APIRouter()


class TaskEventResponse(BaseModel):
    id: str
    event_type: str
    external_status: Optional[str] = None
    response_data: Optional[dict] = None
    error_message: Optional[str] = None
    created_at: datetime


class TaskStatusResponse(BaseModel):
    request_id: str
    status: str
    type: str
    model: str
    prompt: Optional[str] = None
    provider: Optional[str] = None
    external_task_id: Optional[str] = None
    result_url: Optional[str] = None
    result_urls: Optional[List[str]] = None
    credits_spent: Optional[float] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


class TaskDetailResponse(TaskStatusResponse):
    events: List[TaskEventResponse] = []


class TaskListResponse(BaseModel):
    tasks: List[TaskStatusResponse]
    total: int
    page: int
    per_page: int


async def check_replicate_status(task_id: str, api_key: str) -> dict:
    import httpx
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"https://api.replicate.com/v1/predictions/{task_id}",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        print(f"Replicate status check error: {e}")
    return {}


async def check_kie_status(task_id: str, api_key: str) -> dict:
    import httpx
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                "https://api.kie.ai/api/v1/jobs/getTaskStatus",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                params={"taskId": task_id},
            )
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        print(f"KIE status check error: {e}")
    return {}


@router.get("/{request_id}", response_model=TaskDetailResponse)
async def get_task_status(
    request_id: str,
    refresh: bool = Query(False, description="Force refresh status from provider"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Request).where(
            Request.id == request_id,
            Request.user_id == user.id,
        )
    )
    request_record = result.scalar_one_or_none()
    
    if not request_record:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if refresh and request_record.status == "processing" and request_record.external_task_id:
        updated = await refresh_task_status(request_record, db)
        if updated:
            await db.commit()
            await db.refresh(request_record)
    
    events = await get_task_events(db, request_id)
    
    return TaskDetailResponse(
        request_id=str(request_record.id),
        status=request_record.status,
        type=request_record.type,
        model=request_record.model,
        prompt=request_record.prompt,
        provider=request_record.external_provider,
        external_task_id=request_record.external_task_id,
        result_url=request_record.result_url,
        result_urls=request_record.result_urls,
        credits_spent=float(request_record.credits_spent) if request_record.credits_spent else None,
        error_code=request_record.error_code,
        error_message=request_record.error_message,
        created_at=request_record.created_at,
        completed_at=request_record.completed_at,
        events=[
            TaskEventResponse(
                id=str(e.id),
                event_type=e.event_type,
                external_status=e.external_status,
                response_data=e.response_data,
                error_message=e.error_message,
                created_at=e.created_at,
            )
            for e in events
        ],
    )


@router.get("/{request_id}/events", response_model=List[TaskEventResponse])
async def get_task_events_endpoint(
    request_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Request).where(
            Request.id == request_id,
            Request.user_id == user.id,
        )
    )
    request_record = result.scalar_one_or_none()
    
    if not request_record:
        raise HTTPException(status_code=404, detail="Task not found")
    
    events = await get_task_events(db, request_id)
    
    return [
        TaskEventResponse(
            id=str(e.id),
            event_type=e.event_type,
            external_status=e.external_status,
            response_data=e.response_data,
            error_message=e.error_message,
            created_at=e.created_at,
        )
        for e in events
    ]


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    status: Optional[str] = Query(None, description="Filter by status"),
    type: Optional[str] = Query(None, description="Filter by type (image/video)"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Request).where(Request.user_id == user.id)
    
    if status:
        query = query.where(Request.status == status)
    if type:
        query = query.where(Request.type == type)
    
    query = query.order_by(desc(Request.created_at))
    
    count_result = await db.execute(
        select(Request.id).where(Request.user_id == user.id)
    )
    total = len(count_result.all())
    
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    requests = result.scalars().all()
    
    tasks = [
        TaskStatusResponse(
            request_id=str(r.id),
            status=r.status,
            type=r.type,
            model=r.model,
            prompt=r.prompt,
            provider=r.external_provider,
            external_task_id=r.external_task_id,
            result_url=r.result_url,
            result_urls=r.result_urls,
            credits_spent=float(r.credits_spent) if r.credits_spent else None,
            error_code=r.error_code,
            error_message=r.error_message,
            created_at=r.created_at,
            completed_at=r.completed_at,
        )
        for r in requests
    ]
    
    return TaskListResponse(
        tasks=tasks,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("/{request_id}/refresh", response_model=TaskDetailResponse)
async def refresh_task(
    request_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Request).where(
            Request.id == request_id,
            Request.user_id == user.id,
        )
    )
    request_record = result.scalar_one_or_none()
    
    if not request_record:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if not request_record.external_task_id:
        raise HTTPException(status_code=400, detail="No external task ID")
    
    updated = await refresh_task_status(request_record, db)
    if updated:
        await db.commit()
        await db.refresh(request_record)
    
    events = await get_task_events(db, request_id)
    
    return TaskDetailResponse(
        request_id=str(request_record.id),
        status=request_record.status,
        type=request_record.type,
        model=request_record.model,
        prompt=request_record.prompt,
        provider=request_record.external_provider,
        external_task_id=request_record.external_task_id,
        result_url=request_record.result_url,
        result_urls=request_record.result_urls,
        credits_spent=float(request_record.credits_spent) if request_record.credits_spent else None,
        error_code=request_record.error_code,
        error_message=request_record.error_message,
        created_at=request_record.created_at,
        completed_at=request_record.completed_at,
        events=[
            TaskEventResponse(
                id=str(e.id),
                event_type=e.event_type,
                external_status=e.external_status,
                response_data=e.response_data,
                error_message=e.error_message,
                created_at=e.created_at,
            )
            for e in events
        ],
    )


@router.delete("/{request_id}")
async def cancel_task(
    request_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raise HTTPException(status_code=501, detail="Cancel not implemented yet")


async def refresh_task_status(request_record: Request, db: AsyncSession) -> bool:
    if not request_record.external_task_id or not request_record.external_provider:
        return False
    
    provider = request_record.external_provider
    task_id = request_record.external_task_id
    request_id = str(request_record.id)
    
    if provider == "replicate":
        api_key = settings.REPLICATE_API_KEY
        data = await check_replicate_status(task_id, api_key)
        
        if not data:
            return False
        
        status = data.get("status")
        
        await log_poll(db, request_id, 0, status, data)
        
        if status == "succeeded":
            output = data.get("output")
            if isinstance(output, list):
                request_record.result_url = output[0] if output else None
                request_record.result_urls = output
            else:
                request_record.result_url = output
                request_record.result_urls = [output] if output else None
            
            request_record.status = "completed"
            request_record.completed_at = datetime.utcnow()
            
            await log_completed(db, request_id, request_record.result_url, request_record.result_urls, data)
            return True
        
        elif status == "failed":
            request_record.status = "failed"
            request_record.error_code = "REPLICATE_FAILED"
            request_record.error_message = data.get("error")
            request_record.completed_at = datetime.utcnow()
            
            await log_failed(db, request_id, "REPLICATE_FAILED", data.get("error", "Unknown error"), data)
            return True
        
        elif status == "canceled":
            request_record.status = "failed"
            request_record.error_code = "CANCELED"
            request_record.error_message = "Task was canceled"
            request_record.completed_at = datetime.utcnow()
            
            await log_failed(db, request_id, "CANCELED", "Task was canceled", data)
            return True
    
    elif provider == "kie":
        api_key = settings.KIE_API_KEY
        data = await check_kie_status(task_id, api_key)
        
        if not data or data.get("code") != 200:
            return False
        
        task_data = data.get("data", {})
        state = task_data.get("state", "").lower()
        
        await log_poll(db, request_id, 0, state, data)
        
        if state == "success":
            import json
            result_json_str = task_data.get("resultJson", "{}")
            try:
                result_json = json.loads(result_json_str) if isinstance(result_json_str, str) else result_json_str
                result_url = result_json.get("resultUrl") or result_json.get("url")
                result_urls = result_json.get("resultUrls") or ([result_url] if result_url else None)
            except:
                result_url = None
                result_urls = None
            
            request_record.result_url = result_url
            request_record.result_urls = result_urls
            request_record.status = "completed"
            request_record.completed_at = datetime.utcnow()
            
            await log_completed(db, request_id, result_url, result_urls, data)
            return True
        
        elif state in ("failed", "fail"):
            request_record.status = "failed"
            request_record.error_code = task_data.get("failCode") or "KIE_FAILED"
            request_record.error_message = task_data.get("failMsg") or "Task failed"
            request_record.completed_at = datetime.utcnow()
            
            await log_failed(db, request_id, request_record.error_code, request_record.error_message, data)
            return True
    
    return False