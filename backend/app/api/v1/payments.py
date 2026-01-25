from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db

router = APIRouter()

class PaymentRequest(BaseModel):
    amount: float
    currency: str = "RUB"
    method: str = "card"
    promo_code: Optional[str] = None

@router.post("/create")
async def create_payment(data: PaymentRequest, db: AsyncSession = Depends(get_db)):
    raise HTTPException(status_code=501, detail="Not implemented")

@router.get("/history")
async def payment_history(db: AsyncSession = Depends(get_db)):
    raise HTTPException(status_code=501, detail="Not implemented")

@router.post("/webhook/yookassa")
async def yookassa_webhook():
    raise HTTPException(status_code=501, detail="Not implemented")
