from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.billing import billing_service

router = APIRouter()

class UserResponse(BaseModel):
    ok: bool = True
    user: dict

class HistoryResponse(BaseModel):
    ok: bool = True
    data: list
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
    type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # TODO: реализовать выборку из requests
    return HistoryResponse(
        data=[],
        pagination={"page": page, "limit": limit, "total": 0}
    )
