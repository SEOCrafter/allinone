import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.provider import Provider
from app.services.generation import generation_service
from app.services.billing import billing_service
from app.services.requests import request_service

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


async def get_provider_by_name(db: AsyncSession, name: str) -> Optional[Provider]:
    result = await db.execute(select(Provider).where(Provider.name == name))
    return result.scalar_one_or_none()


@router.post("", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Текстовый чат с AI. Требует авторизации.
    """
    provider_name = data.provider or "openai"
    model_name = data.model or "gpt-4o-mini"
    
    # Получаем provider из БД
    provider = await get_provider_by_name(db, provider_name)
    if not provider:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider_name}")
    
    # Проверяем баланс (минимум 0.01 кредита)
    min_required = Decimal("0.01")
    if not await billing_service.check_balance(db, current_user.id, min_required):
        raise HTTPException(status_code=402, detail="Insufficient credits")

    # Создаём запись запроса
    req = await request_service.create_request(
        db=db,
        user_id=current_user.id,
        request_type="chat",
        endpoint="/api/v1/chat",
        provider_id=provider.id,
        model=model_name,
        prompt=data.message,
        params={"system_prompt": data.system_prompt} if data.system_prompt else None,
    )
    req.started_at = datetime.utcnow()

    # Генерация
    result = await generation_service.chat(
        message=data.message,
        system_prompt=data.system_prompt,
        provider=provider_name,
        model=model_name,
    )

    if not result.success:
        # Сохраняем ошибку
        await request_service.fail_request(
            db=db,
            request=req,
            error_code=result.error_code,
            error_message=result.error_message,
        )
        await db.commit()
        raise HTTPException(
            status_code=502,
            detail={"code": result.error_code, "message": result.error_message}
        )

    # Списываем кредиты
    credits_spent = generation_service.calculate_credits(result)
    new_balance = await billing_service.deduct_credits(db, current_user.id, credits_spent)
    
    # Сохраняем успешный результат
    req.completed_at = datetime.utcnow()
    await request_service.complete_request(
        db=db,
        request=req,
        content=result.content,
        tokens_input=result.tokens_input,
        tokens_output=result.tokens_output,
        credits_spent=credits_spent,
        provider_cost=Decimal(str(result.provider_cost)),
    )
    
    await db.commit()

    return ChatResponse(
        request_id=str(req.id),
        message=result.content,
        conversation_id=data.conversation_id or str(uuid.uuid4()),
        provider=provider_name,
        model=model_name,
        tokens={
            "input": result.tokens_input,
            "output": result.tokens_output,
        },
        credits=CreditsInfo(
            spent=float(credits_spent),
            remaining=float(new_balance),
        ),
    )