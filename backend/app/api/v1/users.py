from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db

router = APIRouter()

class UserResponse(BaseModel):
    ok: bool = True
    user: dict

class HistoryResponse(BaseModel):
    ok: bool = True
    data: list
    pagination: dict

@router.get("/me", response_model=UserResponse)
async def get_current_user(db: AsyncSession = Depends(get_db)):
    # TODO: Implement
    raise HTTPException(status_code=501, detail="Not implemented")

@router.get("/history", response_model=HistoryResponse)
async def get_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    # TODO: Implement
    raise HTTPException(status_code=501, detail="Not implemented")

@router.patch("/history/{request_id}/favorite")
async def toggle_favorite(request_id: str, is_favorite: bool, db: AsyncSession = Depends(get_db)):
    # TODO: Implement
    raise HTTPException(status_code=501, detail="Not implemented")
