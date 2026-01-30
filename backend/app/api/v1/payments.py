import hashlib
import hmac
import uuid
import time
from decimal import Decimal
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.transaction import Transaction
from app.api.deps import get_current_user

router = APIRouter()

FREEKASSA_IPS = ['168.119.157.136', '168.119.60.227', '178.154.197.79', '51.250.54.238']


class CreatePaymentRequest(BaseModel):
    amount: int
    credits: int
    currency: str = "RUB"
    email: str
    telegram_id: Optional[int] = None


class PaymentResponse(BaseModel):
    payment_url: str
    order_id: str
    amount: int
    credits: int


def generate_api_sign(data: dict, api_key: str) -> str:
    """Генерация подписи для API FreeKassa (HMAC SHA256)"""
    sorted_values = [str(data[k]) for k in sorted(data.keys())]
    sign_string = '|'.join(sorted_values)
    return hmac.new(api_key.encode(), sign_string.encode(), hashlib.sha256).hexdigest()


def verify_notification_sign(merchant_id: str, amount: str, secret2: str, order_id: str, received_sign: str) -> bool:
    """Проверка подписи уведомления от FreeKassa"""
    sign_string = f"{merchant_id}:{amount}:{secret2}:{order_id}"
    expected_sign = hashlib.md5(sign_string.encode()).hexdigest()
    return expected_sign.lower() == received_sign.lower()


def get_client_ip(request: Request) -> str:
    """Получение реального IP клиента"""
    x_real_ip = request.headers.get("X-Real-IP")
    if x_real_ip:
        return x_real_ip
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else ""


@router.post("/create", response_model=PaymentResponse)
async def create_payment(
    request: Request,
    data: CreatePaymentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Создание платежа через FreeKassa API"""
    
    user_id = current_user.id if current_user else None
    
    transaction = Transaction(
        user_id=user_id,
        type="topup",
        amount_currency=Decimal(str(data.amount)),
        currency=data.currency,
        credits_added=Decimal(str(data.credits)),
        payment_method="freekassa",
        payment_provider="freekassa",
        status="pending",
        extra_data={
            "email": data.email,
            "telegram_id": data.telegram_id
        }
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    
    order_id = str(transaction.id)
    client_ip = get_client_ip(request)
    
    api_data = {
        "shopId": settings.FREEKASSA_MERCHANT_ID,
        "nonce": int(time.time() * 1000),
        "paymentId": order_id,
        "i": 44,
        "email": data.email,
        "ip": client_ip,
        "amount": data.amount,
        "currency": data.currency,
    }
    
    api_data["signature"] = generate_api_sign(api_data, settings.FREEKASSA_API_KEY)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.fk.life/v1/orders/create",
            json=api_data,
            headers={"Content-Type": "application/json"}
        )
        
        result = response.json()
        
        if result.get("type") != "success":
            transaction.status = "failed"
            transaction.extra_data = {**transaction.extra_data, "error": result}
            await db.commit()
            raise HTTPException(status_code=400, detail=result.get("message", "Payment creation failed"))
        
        payment_url = result.get("location")
        fk_order_id = result.get("orderId")
        
        transaction.external_id = str(fk_order_id)
        transaction.extra_data = {**transaction.extra_data, "fk_response": result}
        await db.commit()
    
    return PaymentResponse(
        payment_url=payment_url,
        order_id=order_id,
        amount=data.amount,
        credits=data.credits
    )


@router.post("/freekassa/notify")
@router.get("/freekassa/notify")
async def freekassa_notify(request: Request, db: AsyncSession = Depends(get_db)):
    """Обработка уведомления от FreeKassa о платеже"""
    
    client_ip = get_client_ip(request)
    # if client_ip not in FREEKASSA_IPS:
    #     return PlainTextResponse(f"IP not allowed: {client_ip}", status_code=403)
    
    if request.method == "POST":
        form_data = await request.form()
        data = dict(form_data)
    else:
        data = dict(request.query_params)
    
    merchant_id = data.get("MERCHANT_ID", "")
    amount = data.get("AMOUNT", "")
    order_id = data.get("MERCHANT_ORDER_ID", "")
    received_sign = data.get("SIGN", "")
    fk_order_id = data.get("intid", "")
    telegram_id = data.get("us_telegram_id")
    
    if not verify_notification_sign(merchant_id, amount, settings.FREEKASSA_SECRET2, order_id, received_sign):
        return PlainTextResponse("Wrong sign", status_code=400)
    
    try:
        transaction_uuid = uuid.UUID(order_id)
    except ValueError:
        return PlainTextResponse("Invalid order_id", status_code=400)
    
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_uuid)
    )
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        return PlainTextResponse("Order not found", status_code=404)
    
    if transaction.status == "completed":
        return PlainTextResponse("YES")
    
    if Decimal(amount) != transaction.amount_currency:
        return PlainTextResponse("Wrong amount", status_code=400)
    
    transaction.status = "completed"
    transaction.external_id = fk_order_id
    transaction.completed_at = datetime.utcnow()
    
    extra = transaction.extra_data or {}
    extra["freekassa_response"] = data
    transaction.extra_data = extra
    
    if transaction.user_id:
        result = await db.execute(
            select(User).where(User.id == transaction.user_id)
        )
        user = result.scalar_one_or_none()
        
        if user:
            user.credits_balance += transaction.credits_added
    
    await db.commit()
    
    return PlainTextResponse("YES")


@router.get("/freekassa/success")
async def freekassa_success():
    """Редирект после успешной оплаты"""
    return RedirectResponse(url="https://umnik.ai/payment/success", status_code=302)


@router.get("/freekassa/fail")
async def freekassa_fail():
    """Редирект после неудачной оплаты"""
    return RedirectResponse(url="https://umnik.ai/payment/fail", status_code=302)


@router.get("/history")
async def payment_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """История платежей пользователя"""
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .where(Transaction.type == "topup")
        .order_by(Transaction.created_at.desc())
        .limit(50)
    )
    transactions = result.scalars().all()
    
    return {
        "transactions": [
            {
                "id": str(t.id),
                "amount": float(t.amount_currency),
                "currency": t.currency,
                "credits": float(t.credits_added),
                "status": t.status,
                "created_at": t.created_at.isoformat(),
                "completed_at": t.completed_at.isoformat() if t.completed_at else None
            }
            for t in transactions
        ]
    }