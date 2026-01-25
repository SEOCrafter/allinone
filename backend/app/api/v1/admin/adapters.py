from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_admin_user
from app.models.user import User
from app.adapters import AdapterRegistry
from app.config import settings
import httpx

router = APIRouter()


class TestChatRequest(BaseModel):
    message: str
    model: Optional[str] = None
    system_prompt: Optional[str] = None


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
):
    """Балансы аккаунтов провайдеров."""
    balances = []
    
    # OpenAI balance (неофициальный эндпоинт)
    if settings.OPENAI_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://api.openai.com/v1/dashboard/billing/credit_grants",
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
                )
                if response.status_code == 200:
                    data = response.json()
                    total_granted = data.get("total_granted", 0)
                    total_used = data.get("total_used", 0)
                    balance = total_granted - total_used
                    balances.append({
                        "provider": "openai",
                        "status": "active",
                        "balance_usd": round(balance, 2),
                        "total_granted_usd": round(total_granted, 2),
                        "total_used_usd": round(total_used, 2),
                    })
                else:
                    # Пробуем subscription endpoint
                    resp2 = await client.get(
                        "https://api.openai.com/v1/dashboard/billing/subscription",
                        headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
                    )
                    if resp2.status_code == 200:
                        sub_data = resp2.json()
                        balances.append({
                            "provider": "openai",
                            "status": "active",
                            "balance_usd": None,
                            "plan": sub_data.get("plan", {}).get("title", "Unknown"),
                            "note": "Баланс: platform.openai.com/settings/organization/billing"
                        })
                    else:
                        balances.append({
                            "provider": "openai",
                            "status": "active",
                            "balance_usd": None,
                            "note": "Баланс: platform.openai.com/settings/organization/billing"
                        })
        except Exception as e:
            balances.append({
                "provider": "openai",
                "status": "error",
                "error": str(e)
            })
    
    # Anthropic balance (API не предоставляет)
    if settings.ANTHROPIC_API_KEY:
        balances.append({
            "provider": "anthropic",
            "status": "active",
            "balance_usd": None,
            "note": "API не предоставляет баланс. Проверьте: console.anthropic.com/settings/billing"
        })
    
    return {"ok": True, "balances": balances}


@router.post("/{adapter_name}/health")
async def adapter_health(
    adapter_name: str,
    admin: User = Depends(get_admin_user),
):
    """Health check конкретного адаптера."""
    # Используем фиксированные модели для health check
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
    
    # Используем стабильную модель для health check
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
):
    """Тестовый запрос к адаптеру с полным логом (4 окна)."""
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
    
    # 1. Frontend request (как фронтенд обращается к нашему API)
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
    
    # Формируем params для генерации
    params = {}
    if data.model:
        params["model"] = data.model
    if data.system_prompt:
        params["system_prompt"] = data.system_prompt
    
    # Выполняем запрос
    result = await adapter.generate(data.message, **params)
    
    # 2. Provider request (запрос к провайдеру)
    provider_request = None
    # 3. Provider response raw
    provider_response_raw = None
    
    if result.raw_response:
        provider_request = result.raw_response.get("request")
        provider_response_raw = result.raw_response.get("response")
    
    # 4. Parsed response
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