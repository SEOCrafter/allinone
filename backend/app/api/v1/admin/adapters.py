from typing import Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.api.deps import get_admin_user
from app.models.user import User
from app.models.provider_balance import ProviderBalance
from app.adapters import AdapterRegistry
from app.config import settings
import httpx

router = APIRouter()


class TestChatRequest(BaseModel):
    message: str
    model: Optional[str] = None
    system_prompt: Optional[str] = None


class SetBalanceRequest(BaseModel):
    balance_usd: float


class DepositRequest(BaseModel):
    amount_usd: float


@router.get("")
async def list_adapters(
    admin: User = Depends(get_admin_user),
):
    """Список всех адаптеров с моделями."""
    adapters = AdapterRegistry.list_adapters(include_models=True)
    return {"ok": True, "adapters": adapters}


@router.get("/status")
async def adapters_status(
    admin: User = Depends(get_admin_user),
):
    """Health check всех адаптеров."""
    results = []
    
    # OpenAI health check
    if settings.OPENAI_API_KEY:
        try:
            import time
            start = time.time()
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [{"role": "user", "content": "Hi"}],
                        "max_tokens": 5,
                    },
                )
                latency = int((time.time() - start) * 1000)
                if response.status_code == 200:
                    results.append({"name": "openai", "status": "healthy", "latency_ms": latency, "error": None})
                else:
                    results.append({"name": "openai", "status": "degraded", "latency_ms": latency, "error": response.text})
        except Exception as e:
            results.append({"name": "openai", "status": "unhealthy", "latency_ms": None, "error": str(e)})
    
    # Anthropic health check
    if settings.ANTHROPIC_API_KEY:
        try:
            import time
            start = time.time()
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": settings.ANTHROPIC_API_KEY,
                        "Content-Type": "application/json",
                        "anthropic-version": "2023-06-01",
                    },
                    json={
                        "model": "claude-haiku-4-5-20251001",
                        "messages": [{"role": "user", "content": "Hi"}],
                        "max_tokens": 5,
                    },
                )
                latency = int((time.time() - start) * 1000)
                if response.status_code == 200:
                    results.append({"name": "anthropic", "status": "healthy", "latency_ms": latency, "error": None})
                else:
                    results.append({"name": "anthropic", "status": "degraded", "latency_ms": latency, "error": response.text})
        except Exception as e:
            results.append({"name": "anthropic", "status": "unhealthy", "latency_ms": None, "error": str(e)})
    
    return {"ok": True, "adapters": results}


@router.get("/balances")
async def adapters_balances(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Балансы аккаунтов провайдеров из БД."""
    result = await db.execute(select(ProviderBalance))
    balances = result.scalars().all()
    
    return {
        "ok": True,
        "balances": [
            {
                "provider": b.provider,
                "status": "active" if float(b.balance_usd) > 0 else "low",
                "balance_usd": float(b.balance_usd),
                "total_deposited_usd": float(b.total_deposited_usd),
                "total_spent_usd": float(b.total_spent_usd),
                "updated_at": (b.updated_at.isoformat() + "Z") if b.updated_at else None,
            }
            for b in balances
        ]
    }


@router.post("/balances/{provider}/set")
async def set_balance(
    provider: str,
    data: SetBalanceRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Установить баланс провайдера (перезаписывает)."""
    result = await db.execute(
        select(ProviderBalance).where(ProviderBalance.provider == provider)
    )
    balance = result.scalar_one_or_none()
    
    if not balance:
        raise HTTPException(status_code=404, detail=f"Провайдер {provider} не найден")
    
    balance.balance_usd = Decimal(str(data.balance_usd))
    balance.total_deposited_usd = Decimal(str(data.balance_usd))
    balance.total_spent_usd = Decimal("0")
    
    await db.commit()
    await db.refresh(balance)
    
    return {
        "ok": True,
        "provider": provider,
        "balance_usd": float(balance.balance_usd),
        "total_deposited_usd": float(balance.total_deposited_usd),
        "total_spent_usd": float(balance.total_spent_usd),
    }


@router.post("/balances/{provider}/deposit")
async def deposit_balance(
    provider: str,
    data: DepositRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Пополнить баланс провайдера."""
    result = await db.execute(
        select(ProviderBalance).where(ProviderBalance.provider == provider)
    )
    balance = result.scalar_one_or_none()
    
    if not balance:
        raise HTTPException(status_code=404, detail=f"Провайдер {provider} не найден")
    
    balance.balance_usd = balance.balance_usd + Decimal(str(data.amount_usd))
    balance.total_deposited_usd = balance.total_deposited_usd + Decimal(str(data.amount_usd))
    
    await db.commit()
    await db.refresh(balance)
    
    return {
        "ok": True,
        "provider": provider,
        "deposited": data.amount_usd,
        "balance_usd": float(balance.balance_usd),
        "total_deposited_usd": float(balance.total_deposited_usd),
    }


@router.post("/{adapter_name}/health")
async def adapter_health(
    adapter_name: str,
    admin: User = Depends(get_admin_user),
):
    """Health check конкретного адаптера."""
    health_models = {
        "openai": "gpt-4o-mini",
        "anthropic": "claude-haiku-4-5-20251001",
    }
    
    api_keys = {
        "openai": settings.OPENAI_API_KEY,
        "anthropic": settings.ANTHROPIC_API_KEY,
    }
    
    api_key = api_keys.get(adapter_name)
    if not api_key:
        raise HTTPException(status_code=400, detail=f"Нет API ключа для {adapter_name}")
    
    adapter = AdapterRegistry.get_adapter(adapter_name, api_key)
    if not adapter:
        raise HTTPException(status_code=404, detail=f"Адаптер {adapter_name} не найден")
    
    import time
    start = time.time()
    result = await adapter.generate("Hi", model=health_models.get(adapter_name), max_tokens=5)
    latency = int((time.time() - start) * 1000)
    
    if result.success:
        return {
            "ok": True,
            "adapter": adapter_name,
            "status": "healthy",
            "latency_ms": latency,
            "error": None,
        }
    else:
        return {
            "ok": False,
            "adapter": adapter_name,
            "status": "degraded",
            "latency_ms": latency,
            "error": result.error_message,
        }

@router.post("/{adapter_name}/test")
async def test_adapter(
    adapter_name: str,
    data: TestChatRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Тестовый запрос к адаптеру с полным логом и списанием баланса."""
    from app.models.request import Request, Result
    from app.models.provider import Provider
    from datetime import datetime
    import uuid
    
    api_keys = {
        "openai": settings.OPENAI_API_KEY,
        "anthropic": settings.ANTHROPIC_API_KEY,
    }
    
    api_key = api_keys.get(adapter_name)
    if not api_key:
        raise HTTPException(status_code=400, detail=f"Нет API ключа для {adapter_name}")
    
    adapter = AdapterRegistry.get_adapter(adapter_name, api_key)
    if not adapter:
        raise HTTPException(status_code=404, detail=f"Адаптер {adapter_name} не найден")
    
    # Получаем provider из БД
    provider_result = await db.execute(
        select(Provider).where(Provider.name == adapter_name)
    )
    provider = provider_result.scalar_one_or_none()
    
    if not provider:
        # Создаём провайдера если нет
        provider = Provider(
            id=uuid.uuid4(),
            name=adapter_name,
            display_name=adapter.display_name,
            type=adapter.provider_type.value,
            is_active=True,
        )
        db.add(provider)
        await db.flush()
    
    # Frontend request
    frontend_request = {
        "endpoint": "/api/v1/chat",
        "method": "POST",
        "body": {
            "message": data.message,
            "provider": adapter_name,
            "model": data.model or adapter.default_model,
            "system_prompt": data.system_prompt,
        }
    }
    
    params = {}
    if data.model:
        params["model"] = data.model
    if data.system_prompt:
        params["system_prompt"] = data.system_prompt
    
    # Создаём запись запроса
    request_record = Request(
        id=uuid.uuid4(),
        user_id=admin.id,
        provider_id=provider.id,
        type="chat",
        endpoint="/api/v1/admin/adapters/test",
        model=data.model or adapter.default_model,
        prompt=data.message,
        params=params,
        status="processing",
        started_at=datetime.utcnow(),
    )
    db.add(request_record)
    await db.flush()
    
    # Выполняем запрос
    result = await adapter.generate(data.message, **params)
    
    # Обновляем запись
    request_record.completed_at = datetime.utcnow()
    if result.success:
        request_record.status = "completed"
        request_record.tokens_input = result.tokens_input or 0
        request_record.tokens_output = result.tokens_output or 0
        request_record.provider_cost = result.provider_cost
        
        # Сохраняем результат
        result_record = Result(
            id=uuid.uuid4(),
            request_id=request_record.id,
            type="text",
            content=result.content,
        )
        db.add(result_record)
    else:
        request_record.status = "failed"
        request_record.error_code = result.error_code
        request_record.error_message = result.error_message
    
    # Списываем баланс при успехе
    if result.success and result.provider_cost > 0:
        balance_result = await db.execute(
            select(ProviderBalance).where(ProviderBalance.provider == adapter_name)
        )
        balance = balance_result.scalar_one_or_none()
        if balance:
            balance.balance_usd = balance.balance_usd - Decimal(str(result.provider_cost))
            balance.total_spent_usd = balance.total_spent_usd + Decimal(str(result.provider_cost))
    
    await db.commit()
    
    provider_request = None
    provider_response_raw = None
    
    if result.raw_response:
        provider_request = result.raw_response.get("request")
        provider_response_raw = result.raw_response.get("response")
    
    if result.success:
        return {
            "ok": True,
            "frontend_request": frontend_request,
            "provider_request": provider_request,
            "provider_response_raw": provider_response_raw,
            "parsed": {
                "content": result.content,
                "tokens_input": result.tokens_input,
                "tokens_output": result.tokens_output,
                "provider_cost_usd": result.provider_cost,
            }
        }
    else:
        return {
            "ok": False,
            "frontend_request": frontend_request,
            "provider_request": provider_request,
            "provider_response_raw": provider_response_raw,
            "error": {
                "code": result.error_code,
                "message": result.error_message,
            }
        }