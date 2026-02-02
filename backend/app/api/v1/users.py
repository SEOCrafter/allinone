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
from app.models.tariff import Tariff

router = APIRouter()


class UserResponse(BaseModel):
    ok: bool = True
    user: dict


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class HistoryItem(BaseModel):
    id: str
    type: str
    provider: str
    model: str
    prompt: str | None
    response: str | None
    result_url: str | None
    result_urls: list | None
    public_url: str | None
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
            "name": current_user.name if hasattr(current_user, 'name') else None,
            "phone": current_user.phone,
            "telegram_id": current_user.telegram_id,
            "credits_balance": float(current_user.credits_balance),
            "role": current_user.role,
            "language": current_user.language,
            "created_at": current_user.created_at.isoformat(),
            "avatar_url": getattr(current_user, 'avatar_url', None),
        }
    )


@router.patch("/me")
async def update_profile(
    data: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.name is not None:
        current_user.name = data.name
    if data.phone is not None:
        current_user.phone = data.phone
    if data.email is not None:
        existing = await db.execute(
            select(User).where(User.email == data.email, User.id != current_user.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = data.email

    await db.commit()
    await db.refresh(current_user)

    return {
        "ok": True,
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "name": current_user.name if hasattr(current_user, 'name') else None,
            "phone": current_user.phone,
            "telegram_id": current_user.telegram_id,
            "credits_balance": float(current_user.credits_balance),
            "role": current_user.role,
            "language": current_user.language,
            "created_at": current_user.created_at.isoformat(),
            "avatar_url": getattr(current_user, 'avatar_url', None),
        }
    }


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
    type: Optional[str] = Query(None),
    provider: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Request).where(Request.user_id == current_user.id)
    count_query = select(func.count(Request.id)).where(Request.user_id == current_user.id)

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

    provider_ids = list(set(r.provider_id for r in requests if r.provider_id))
    if provider_ids:
        providers_result = await db.execute(select(Provider).where(Provider.id.in_(provider_ids)))
        providers_map = {p.id: p.name for p in providers_result.scalars().all()}
    else:
        providers_map = {}

    request_ids = [r.id for r in requests]
    results_content_map = {}
    results_url_map = {}
    if request_ids:
        results_query = await db.execute(select(Result).where(Result.request_id.in_(request_ids)))
        for r in results_query.scalars().all():
            results_content_map[r.request_id] = r.content
            if r.public_url:
                results_url_map[r.request_id] = r.public_url

    items = []
    for req in requests:
        items.append(HistoryItem(
            id=str(req.id),
            type=req.type or "chat",
            provider=providers_map.get(req.provider_id, "unknown"),
            model=req.model or "",
            prompt=req.prompt,
            response=results_content_map.get(req.id),
            result_url=getattr(req, 'result_url', None),
            result_urls=getattr(req, 'result_urls', None),
            public_url=results_url_map.get(req.id),
            status=req.status or "unknown",
            tokens_input=req.tokens_input,
            tokens_output=req.tokens_output,
            credits_spent=float(req.credits_spent) if req.credits_spent else 0,
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

@router.get("/subscription-status")
async def get_subscription_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.request import Request
    from datetime import datetime, timedelta

    tariff = None
    if current_user.active_tariff_id:
        from sqlalchemy import select as sel
        result = await db.execute(
            select(func.count(Request.id)).where(
                Request.user_id == current_user.id,
                Request.created_at >= datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0),
                Request.status == "completed",
            )
        )
        today_requests = result.scalar() or 0

        tariff_result = await db.execute(
            sel(Tariff).where(Tariff.id == current_user.active_tariff_id)
        )
        tariff_obj = tariff_result.scalar_one_or_none()
        if tariff_obj:
            tariff = {
                "id": str(tariff_obj.id),
                "name": tariff_obj.name,
                "description": tariff_obj.description,
                "price": float(tariff_obj.price),
                "credits": float(tariff_obj.credits),
            }
    else:
        today_requests = 0

    return {
        "ok": True,
        "has_tariff": current_user.active_tariff_id is not None,
        "tariff": tariff,
        "is_free": tariff is not None and tariff["price"] == 0,
        "today_requests": today_requests,
        "daily_limit": 15 if (tariff and tariff["price"] == 0) else None,
        "telegram_connected": current_user.telegram_id is not None,
    }


@router.post("/check-channel")
async def check_channel_subscription(
    current_user: User = Depends(get_current_user),
):
    import httpx
    from app.config import settings

    if not current_user.telegram_id:
        return {"ok": False, "subscribed": False, "error": "Telegram не привязан"}

    if not settings.TELEGRAM_BOT_TOKEN:
        return {"ok": False, "subscribed": False, "error": "Бот не настроен"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getChatMember",
                params={"chat_id": "@umnik_ai", "user_id": current_user.telegram_id},
            )
            data = resp.json()

        if data.get("ok"):
            status = data["result"]["status"]
            subscribed = status in ("member", "creator", "administrator", "restricted")
            return {"ok": True, "subscribed": subscribed, "status": status}
        else:
            return {"ok": True, "subscribed": False, "status": "not_found"}
    except Exception as e:
        return {"ok": False, "subscribed": False, "error": str(e)}


@router.post("/activate-free")
async def activate_free_tariff(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import httpx
    from app.config import settings
    from datetime import datetime

    if not current_user.telegram_id:
        raise HTTPException(status_code=400, detail="Сначала привяжите Telegram")

    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=500, detail="Бот не настроен")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getChatMember",
                params={"chat_id": "@umnik_ai", "user_id": current_user.telegram_id},
            )
            data = resp.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Не удалось проверить подписку")

    if not data.get("ok"):
        raise HTTPException(status_code=400, detail="Не удалось проверить подписку")

    status = data["result"]["status"]
    if status not in ("member", "creator", "administrator", "restricted"):
        raise HTTPException(status_code=400, detail="Вы не подписаны на канал @umnik_ai")

    free_tariff = await db.execute(
        select(Tariff).where(Tariff.price == 0)
    )
    free_tariff = free_tariff.scalar_one_or_none()
    if not free_tariff:
        raise HTTPException(status_code=500, detail="Бесплатный тариф не найден")

    current_user.active_tariff_id = free_tariff.id
    current_user.tariff_activated_at = datetime.utcnow()
    await db.commit()

    return {
        "ok": True,
        "tariff": {
            "id": str(free_tariff.id),
            "name": free_tariff.name,
            "description": free_tariff.description,
            "price": 0,
            "credits": 0,
        }
    }