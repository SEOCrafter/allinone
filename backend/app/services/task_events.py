import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.task_event import TaskEvent


class EventType:
    CREATED = "created"
    SENT_TO_PROVIDER = "sent_to_provider"
    POLL = "poll"
    STATUS_CHANGE = "status_change"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


async def log_task_event(
    db: AsyncSession,
    request_id: str,
    event_type: str,
    external_status: Optional[str] = None,
    response_data: Optional[dict] = None,
    error_message: Optional[str] = None,
    commit: bool = False,
) -> TaskEvent:
    event = TaskEvent(
        id=uuid.uuid4(),
        request_id=uuid.UUID(request_id) if isinstance(request_id, str) else request_id,
        event_type=event_type,
        external_status=external_status,
        response_data=response_data,
        error_message=error_message,
    )
    db.add(event)
    
    if commit:
        await db.commit()
    else:
        await db.flush()
    
    return event


async def get_task_events(
    db: AsyncSession,
    request_id: str,
) -> list[TaskEvent]:
    result = await db.execute(
        select(TaskEvent)
        .where(TaskEvent.request_id == request_id)
        .order_by(TaskEvent.created_at.asc())
    )
    return list(result.scalars().all())


async def log_created(db: AsyncSession, request_id: str, provider: str, model: str) -> TaskEvent:
    return await log_task_event(
        db=db,
        request_id=request_id,
        event_type=EventType.CREATED,
        response_data={"provider": provider, "model": model},
    )


async def log_sent_to_provider(db: AsyncSession, request_id: str, external_task_id: str, provider: str, raw_response: dict = None) -> TaskEvent:
    return await log_task_event(
        db=db,
        request_id=request_id,
        event_type=EventType.SENT_TO_PROVIDER,
        external_status="starting",
        response_data={
            "external_task_id": external_task_id,
            "provider": provider,
            "raw": raw_response,
        },
    )


async def log_poll(db: AsyncSession, request_id: str, poll_number: int, external_status: str, raw_response: dict = None) -> TaskEvent:
    return await log_task_event(
        db=db,
        request_id=request_id,
        event_type=EventType.POLL,
        external_status=external_status,
        response_data={
            "poll_number": poll_number,
            "raw": raw_response,
        },
    )


async def log_completed(db: AsyncSession, request_id: str, result_url: str, result_urls: list = None, raw_response: dict = None) -> TaskEvent:
    return await log_task_event(
        db=db,
        request_id=request_id,
        event_type=EventType.COMPLETED,
        external_status="succeeded",
        response_data={
            "result_url": result_url,
            "result_urls": result_urls,
            "raw": raw_response,
        },
    )


async def log_failed(db: AsyncSession, request_id: str, error_code: str, error_message: str, raw_response: dict = None) -> TaskEvent:
    return await log_task_event(
        db=db,
        request_id=request_id,
        event_type=EventType.FAILED,
        external_status="failed",
        error_message=error_message,
        response_data={
            "error_code": error_code,
            "raw": raw_response,
        },
    )