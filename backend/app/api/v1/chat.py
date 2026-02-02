from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.request import Request
from app.models.provider import Provider
from app.models.provider_balance import ProviderBalance
from app.models.model_setting import ModelSetting
from app.adapters import AdapterRegistry
from app.config import settings
import uuid

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
    api_keys = {
        "openai": settings.OPENAI_API_KEY,
        "anthropic": settings.ANTHROPIC_API_KEY,
        "gemini": settings.GEMINI_API_KEY,
        "deepseek": settings.DEEPSEEK_API_KEY,
        "xai": settings.XAI_API_KEY,
    }

    api_key = api_keys.get(data.provider)
    if not api_key:
        raise HTTPException(status_code=400, detail=f"Provider {data.provider} not configured")

    adapter = AdapterRegistry.get_adapter(data.provider, api_key)
    if not adapter:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {data.provider}")

    provider_result = await db.execute(
        select(Provider).where(Provider.name == data.provider)
    )
    provider_record = provider_result.scalar_one_or_none()

    if not provider_record:
        raise HTTPException(status_code=400, detail=f"Provider {data.provider} not found in database")

    model = data.model or adapter.default_model

    setting_result = await db.execute(
        select(ModelSetting).where(
            ModelSetting.provider == data.provider,
            ModelSetting.model_id == model,
        )
    )
    model_setting = setting_result.scalar_one_or_none()

    credits_price = None
    if model_setting and model_setting.credits_price is not None and model_setting.credits_price > 0:
        credits_price = float(model_setting.credits_price)

    if credits_price is not None and user.credits_balance < Decimal(str(credits_price)):
        return ChatResponse(
            ok=False,
            error=f"Недостаточно токенов. Нужно {int(credits_price)}, у вас {int(user.credits_balance)}",
        )

    request_record = Request(
        id=str(uuid.uuid4()),
        user_id=user.id,
        provider_id=provider_record.id,
        type="chat",
        endpoint="/api/v1/chat",
        model=model,
        prompt=data.message,
        status="processing",
    )
    db.add(request_record)
    await db.flush()

    params = {}
    if data.model:
        params["model"] = data.model
    if data.system_prompt:
        params["system_prompt"] = data.system_prompt

    result = await adapter.generate(data.message, **params)

    if result.success:
        if credits_price is not None:
            credits_spent = credits_price
        else:
            credits_spent = result.provider_cost * 1000

        balance_result = await db.execute(
            select(ProviderBalance).where(ProviderBalance.provider == data.provider)
        )
        provider_balance = balance_result.scalar_one_or_none()
        if provider_balance:
            provider_balance.balance_usd = provider_balance.balance_usd - Decimal(str(result.provider_cost))
            provider_balance.total_spent_usd = provider_balance.total_spent_usd + Decimal(str(result.provider_cost))

        user.credits_balance = user.credits_balance - Decimal(str(credits_spent))

        request_record.status = "completed"
        request_record.tokens_input = result.tokens_input
        request_record.tokens_output = result.tokens_output
        request_record.credits_spent = Decimal(str(credits_spent))
        request_record.provider_cost = Decimal(str(result.provider_cost))

        await db.commit()

        return ChatResponse(
            ok=True,
            content=result.content,
            tokens_input=result.tokens_input,
            tokens_output=result.tokens_output,
            credits_spent=credits_spent,
        )
    else:
        request_record.status = "failed"
        request_record.error_code = result.error_code
        request_record.error_message = result.error_message

        await db.commit()

        return ChatResponse(
            ok=False,
            error=result.error_message,
        )