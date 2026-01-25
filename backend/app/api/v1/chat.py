import uuid
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.generation import generation_service
from app.services.billing import billing_service

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    system_prompt: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None

class CreditsInfo(BaseModel):
    spent: float
    remaining: float

class ChatResponse(BaseModel):
    ok: bool = True
    request_id: str
    message: str
    conversation_id: str
    provider: str
    model: str
    tokens: dict
    credits: CreditsInfo

@router.post("", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Текстовый чат с AI. Требует авторизации.
    """
    # Проверяем баланс (минимум 0.01 кредита)
    min_required = Decimal("0.01")
    if not await billing_service.check_balance(db, current_user.id, min_required):
        raise HTTPException(status_code=402, detail="Insufficient credits")
    
    # Генерация
    result = await generation_service.chat(
        message=data.message,
        system_prompt=data.system_prompt,
        provider=data.provider,
        model=data.model,
    )
    
    if not result.success:
        raise HTTPException(
            status_code=502,
            detail={"code": result.error_code, "message": result.error_message}
        )
    
    # Списываем кредиты
    credits_spent = generation_service.calculate_credits(result)
    new_balance = await billing_service.deduct_credits(db, current_user.id, credits_spent)
    await db.commit()
    
    return ChatResponse(
        request_id=str(uuid.uuid4()),
        message=result.content,
        conversation_id=data.conversation_id or str(uuid.uuid4()),
        provider=data.provider or "openai",
        model=data.model or "gpt-4o-mini",
        tokens={
            "input": result.tokens_input,
            "output": result.tokens_output,
        },
        credits=CreditsInfo(
            spent=float(credits_spent),
            remaining=float(new_balance),
        ),
    )
