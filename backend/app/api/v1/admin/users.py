from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_superadmin_user
from app.models.user import User
from app.services.auth import auth_service

router = APIRouter()


class SetPasswordRequest(BaseModel):
    password: str


class UpdateRoleRequest(BaseModel):
    role: str  # user, developer, superadmin


@router.get("")
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    role: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search by email"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_superadmin_user),
):
    """Список всех пользователей."""
    query = select(User)
    count_query = select(func.count(User.id))

    if role:
        query = query.where(User.role == role)
        count_query = count_query.where(User.role == role)

    if search:
        query = query.where(User.email.ilike(f"%{search}%"))
        count_query = count_query.where(User.email.ilike(f"%{search}%"))

    # Total
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Pagination
    offset = (page - 1) * limit
    query = query.order_by(desc(User.created_at)).offset(offset).limit(limit)

    result = await db.execute(query)
    users = result.scalars().all()

    items = []
    for user in users:
        items.append({
            "id": str(user.id),
            "email": user.email,
            "role": user.role,
            "credits_balance": float(user.credits_balance),
            "is_active": user.is_active,
            "is_blocked": user.is_blocked,
            "language": user.language,
            "created_at": user.created_at.isoformat(),
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


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_superadmin_user),
):
    """Детали пользователя."""
    user = await db.execute(select(User).where(User.id == user_id))
    user = user.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "ok": True,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "role": user.role,
            "credits_balance": float(user.credits_balance),
            "is_active": user.is_active,
            "is_blocked": user.is_blocked,
            "blocked_reason": user.blocked_reason,
            "language": user.language,
            "timezone": user.timezone,
            "created_at": user.created_at.isoformat(),
        }
    }


@router.post("/{user_id}/set-password")
async def set_user_password(
    user_id: str,
    data: SetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_superadmin_user),
):
    """Установить пароль пользователю."""
    user = await db.execute(select(User).where(User.id == user_id))
    user = user.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = auth_service.hash_password(data.password)
    await db.commit()

    return {"ok": True, "message": "Password updated"}


@router.post("/{user_id}/set-role")
async def set_user_role(
    user_id: str,
    data: UpdateRoleRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_superadmin_user),
):
    """Изменить роль пользователя."""
    if data.role not in ("user", "developer", "superadmin"):
        raise HTTPException(status_code=400, detail="Invalid role")

    user = await db.execute(select(User).where(User.id == user_id))
    user = user.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = data.role
    await db.commit()

    return {"ok": True, "message": f"Role updated to {data.role}"}


@router.post("/{user_id}/block")
async def block_user(
    user_id: str,
    reason: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_superadmin_user),
):
    """Заблокировать пользователя."""
    user = await db.execute(select(User).where(User.id == user_id))
    user = user.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_blocked = True
    user.blocked_reason = reason
    await db.commit()

    return {"ok": True, "message": "User blocked"}


@router.post("/{user_id}/unblock")
async def unblock_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_superadmin_user),
):
    """Разблокировать пользователя."""
    user = await db.execute(select(User).where(User.id == user_id))
    user = user.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_blocked = False
    user.blocked_reason = None
    await db.commit()

    return {"ok": True, "message": "User unblocked"}