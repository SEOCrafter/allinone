from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.provider_balance import ProviderBalance
from app.adapters import AdapterRegistry
from app.config import settings
from app.services.request_service import RequestService

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    provider: str = "openai"
    model: Optional[str] = None
    system_prompt: Optional[str] = None


class ChatResponse(BaseModel):
    ok: bool
    content: Optional[str] = None
    tokens_input: Optional[int] = None
    tokens_output: Optional[int] = None
    credits_spent: Optional[float] = None
    error: Optional[str] = None


@router.post("", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Отправить сообщение в AI."""
    
    # Получаем API ключ
    api_keys = {
        "openai": settings.OPENAI_API_KEY,
        "anthropic": settings.ANTHROPIC_API_KEY,
    }
    
    api_key = api_keys.get(data.provider)
    if not api_key:
        raise HTTPException(status_code=400, detail=f"Provider {data.provider} not configured")
    
    # Получаем адаптер
    adapter = AdapterRegistry.get_adapter(data.provider, api_key)
    if not adapter:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {data.provider}")
    
    # Получаем provider из БД
    from sqlalchemy import select as sa_select
    from app.models.provider import Provider
    
    provider_result = await db.execute(
        sa_select(Provider).where(Provider.name == data.provider)
    )
    provider_record = provider_result.scalar_one_or_none()
    
    if not provider_record:
        raise HTTPException(status_code=400, detail=f"Provider {data.provider} not found in database")
    
    # Создаём запись request
    request_service = RequestService(db)
    request_record = await request_service.create_request(
        user_id=user.id,
        provider_id=provider_record.id,
        model=data.model or adapter.default_model,
        prompt=data.message,
        params={"system_prompt": data.system_prompt} if data.system_prompt else None,
    )
    
    # Формируем параметры
    params = {}
    if data.model:
        params["model"] = data.model
    if data.system_prompt:
        params["system_prompt"] = data.system_prompt
    
    # Выполняем запрос
    result = await adapter.generate(data.message, **params)
    
    if result.success:
        # Рассчитываем кредиты (например, 1 кредит = $0.001)
        credits_spent = result.provider_cost * 1000  # конвертация
        
        # Списываем баланс провайдера
        balance_result = await db.execute(
            select(ProviderBalance).where(ProviderBalance.provider == data.provider)
        )
        provider_balance = balance_result.scalar_one_or_none()
        if provider_balance:
            provider_balance.balance_usd = provider_balance.balance_usd - Decimal(str(result.provider_cost))
            provider_balance.total_spent_usd = provider_balance.total_spent_usd + Decimal(str(result.provider_cost))
        
        # Списываем кредиты пользователя
        user.credits_balance = user.credits_balance - Decimal(str(credits_spent))
        
        # Завершаем request
        await request_service.complete_request(
            request_id=request_record.id,
            response_content=result.content,
            tokens_input=result.tokens_input,
            tokens_output=result.tokens_output,
            credits_spent=credits_spent,
            provider_cost=result.provider_cost,
        )
        
        await db.commit()
        
        return ChatResponse(
            ok=True,
            content=result.content,
            tokens_input=result.tokens_input,
            tokens_output=result.tokens_output,
            credits_spent=credits_spent,
        )
    else:
        # Записываем ошибку
        await request_service.fail_request(
            request_id=request_record.id,
            error_code=result.error_code,
            error_message=result.error_message,
        )
        
        await db.commit()
        
        return ChatResponse(
            ok=False,
            error=result.error_message,
        )