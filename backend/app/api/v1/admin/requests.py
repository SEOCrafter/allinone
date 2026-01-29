from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_admin_user
from app.models.user import User
from app.models.request import Request, Result
from app.models.provider import Provider
from app.models.task_event import TaskEvent

router = APIRouter()


@router.get("")
async def list_requests(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None, description="Filter: completed, failed, pending"),
    provider: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None, description="Filter: chat, image, video"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    query = select(Request)
    count_query = select(func.count(Request.id))

    if status:
        query = query.where(Request.status == status)
        count_query = count_query.where(Request.status == status)

    if user_id:
        query = query.where(Request.user_id == user_id)
        count_query = count_query.where(Request.user_id == user_id)

    if type:
        query = query.where(Request.type == type)
        count_query = count_query.where(Request.type == type)

    if provider:
        provider_obj = await db.execute(select(Provider).where(Provider.name == provider))
        provider_obj = provider_obj.scalar_one_or_none()
        if provider_obj:
            query = query.where(Request.provider_id == provider_obj.id)
            count_query = count_query.where(Request.provider_id == provider_obj.id)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    offset = (page - 1) * limit
    query = query.order_by(desc(Request.created_at)).offset(offset).limit(limit)

    result = await db.execute(query)
    requests = result.scalars().all()

    provider_ids = list(set(r.provider_id for r in requests))
    providers_map = {}
    if provider_ids:
        providers_result = await db.execute(select(Provider).where(Provider.id.in_(provider_ids)))
        providers_map = {p.id: p.name for p in providers_result.scalars().all()}

    user_ids = list(set(r.user_id for r in requests))
    users_map = {}
    if user_ids:
        users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_map = {u.id: u.email for u in users_result.scalars().all()}

    request_ids = [r.id for r in requests]
    results_map = {}
    if request_ids:
        results_result = await db.execute(select(Result).where(Result.request_id.in_(request_ids)))
        results_map = {r.request_id: r.content for r in results_result.scalars().all()}

    items = []
    for req in requests:
        if req.status == "completed":
            status_label = "OK"
        elif req.status == "failed":
            status_label = "ERR"
        else:
            status_label = "WARN"

        items.append({
            "id": str(req.id),
            "user_email": users_map.get(req.user_id, "unknown"),
            "user_id": str(req.user_id),
            "type": req.type,
            "provider": providers_map.get(req.provider_id, "unknown"),
            "external_provider": req.external_provider,
            "model": req.model,
            "status": req.status,
            "status_label": status_label,
            "prompt": req.prompt[:100] + "..." if req.prompt and len(req.prompt) > 100 else req.prompt,
            "response": results_map.get(req.id, "")[:100] + "..." if results_map.get(req.id) and len(results_map.get(req.id, "")) > 100 else results_map.get(req.id),
            "tokens_input": req.tokens_input,
            "tokens_output": req.tokens_output,
            "credits_spent": float(req.credits_spent) if req.credits_spent else 0,
            "provider_cost": float(req.provider_cost) if req.provider_cost else 0,
            "error_code": req.error_code,
            "error_message": req.error_message,
            "external_task_id": req.external_task_id,
            "result_url": req.result_url,
            "created_at": req.created_at.isoformat(),
        })

    return {
        "ok": True,
        "data": items,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if total else 0,
        }
    }


@router.get("/{request_id}")
async def get_request_detail(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    req = await db.execute(select(Request).where(Request.id == request_id))
    req = req.scalar_one_or_none()

    if not req:
        return {"ok": False, "error": "Request not found"}

    provider = await db.execute(select(Provider).where(Provider.id == req.provider_id))
    provider = provider.scalar_one_or_none()

    user = await db.execute(select(User).where(User.id == req.user_id))
    user = user.scalar_one_or_none()

    result = await db.execute(select(Result).where(Result.request_id == req.id))
    result = result.scalar_one_or_none()

    events_result = await db.execute(
        select(TaskEvent)
        .where(TaskEvent.request_id == req.id)
        .order_by(TaskEvent.created_at.asc())
    )
    events = events_result.scalars().all()

    events_data = [
        {
            "id": str(e.id),
            "event_type": e.event_type,
            "external_status": e.external_status,
            "response_data": e.response_data,
            "error_message": e.error_message,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]

    return {
        "ok": True,
        "request": {
            "id": str(req.id),
            "user_email": user.email if user else "unknown",
            "user_id": str(req.user_id),
            "type": req.type,
            "endpoint": req.endpoint,
            "provider": provider.name if provider else "unknown",
            "external_provider": req.external_provider,
            "model": req.model,
            "status": req.status,
            "external_task_id": req.external_task_id,
            "result_url": req.result_url,
            "result_urls": req.result_urls,
            "input": {
                "prompt": req.prompt,
                "params": req.params,
            },
            "output": {
                "content": result.content if result else None,
                "tokens_input": req.tokens_input,
                "tokens_output": req.tokens_output,
            },
            "costs": {
                "credits_spent": float(req.credits_spent) if req.credits_spent else 0,
                "provider_cost_usd": float(req.provider_cost) if req.provider_cost else 0,
            },
            "error": {
                "code": req.error_code,
                "message": req.error_message,
            } if req.error_code else None,
            "timing": {
                "created_at": req.created_at.isoformat(),
                "started_at": req.started_at.isoformat() if req.started_at else None,
                "completed_at": req.completed_at.isoformat() if req.completed_at else None,
            },
            "events": events_data,
        }
    }


@router.get("/{request_id}/events")
async def get_request_events(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    req = await db.execute(select(Request).where(Request.id == request_id))
    req = req.scalar_one_or_none()

    if not req:
        return {"ok": False, "error": "Request not found"}

    events_result = await db.execute(
        select(TaskEvent)
        .where(TaskEvent.request_id == req.id)
        .order_by(TaskEvent.created_at.asc())
    )
    events = events_result.scalars().all()

    return {
        "ok": True,
        "events": [
            {
                "id": str(e.id),
                "event_type": e.event_type,
                "external_status": e.external_status,
                "response_data": e.response_data,
                "error_message": e.error_message,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ]
    }