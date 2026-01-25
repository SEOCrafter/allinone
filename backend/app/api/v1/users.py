from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.request import Request, Result
from app.models.provider import Provider
from app.services.billing import billing_service

router = APIRouter()


class UserResponse(BaseModel):
    ok: bool = True
    user: dict


class HistoryItem(BaseModel):
    id: str
    type: str
    provider: str
    model: str
    prompt: str | None
    response: str | None
    status: str
    tokens_input: int | None
    tokens_output: int | None
    credits_spent: float
    created_at: str


class HistoryResponse(BaseModel):
    ok: bool = True
    data: list[HistoryItem]
    pagination: dict


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    return UserResponse(
        user={
            "id": str(current_user.id),
            "email": current_user.email,
            "credits_balance": float(current_user.credits_balance),
            "language": current_user.language,
            "created_at": current_user.created_at.isoformat(),
        }
    )


@router.get("/balance")
async def get_balance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    balance = await billing_service.get_balance(db, current_user.id)
    return {"ok": True, "credits_balance": float(balance)}


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: Optional[str] = Query(None, description="Filter by type: chat, image, audio, video"),
    provider: Optional[str] = Query(None, description="Filter by provider: openai, anthropic"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Base query
    query = select(Request).where(Request.user_id == current_user.id)
    count_query = select(func.count(Request.id)).where(Request.user_id == current_user.id)
    
    # Filters
    if type:
        query = query.where(Request.type == type)
        count_query = count_query.where(Request.type == type)
    
    if provider:
        provider_obj = await db.execute(select(Provider).where(Provider.name == provider))
        provider_obj = provider_obj.scalar_one_or_none()
        if provider_obj:
            query = query.where(Request.provider_id == provider_obj.id)
            count_query = count_query.where(Request.provider_id == provider_obj.id)
    
    # Total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Pagination
    offset = (page - 1) * limit
    query = query.order_by(desc(Request.created_at)).offset(offset).limit(limit)
    
    # Execute
    result = await db.execute(query)
    requests = result.scalars().all()
    
    # Get providers map
    provider_ids = list(set(r.provider_id for r in requests))
    if provider_ids:
        providers_result = await db.execute(select(Provider).where(Provider.id.in_(provider_ids)))
        providers_map = {p.id: p.name for p in providers_result.scalars().all()}
    else:
        providers_map = {}
    
    # Get results (responses)
    request_ids = [r.id for r in requests]
    if request_ids:
        results_query = await db.execute(select(Result).where(Result.request_id.in_(request_ids)))
        results_map = {r.request_id: r.content for r in results_query.scalars().all()}
    else:
        results_map = {}
    
    # Build response
    items = []
    for req in requests:
        items.append(HistoryItem(
            id=str(req.id),
            type=req.type,
            provider=providers_map.get(req.provider_id, "unknown"),
            model=req.model,
            prompt=req.prompt,
            response=results_map.get(req.id),
            status=req.status,
            tokens_input=req.tokens_input,
            tokens_output=req.tokens_output,
            credits_spent=float(req.credits_spent),
            created_at=req.created_at.isoformat(),
        ))
    
    return HistoryResponse(
        data=items,
        pagination={
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if total else 0,
        }
    )