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
    api_keys = {
        "openai": settings.OPENAI_API_KEY,
        "anthropic": settings.ANTHROPIC_API_KEY,
    }
    
    status = await AdapterRegistry.health_check_all(api_keys)
    
    result = []
    for name, health in status.items():
        result.append({
            "name": name,
            "status": health.status if hasattr(health, 'status') else "unknown",
            "latency_ms": getattr(health, 'latency_ms', None),
            "error": getattr(health, 'error', None),
        })
    
    return {"ok": True, "adapters": result}


@router.get("/balances")
async def adapters_balances(
    admin: User = Depends(get_admin_user),
):
    """Балансы аккаунтов провайдеров."""
    balances = []
    
    # OpenAI balance
    if settings.OPENAI_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
                )
                balances.append({
                    "provider": "openai",
                    "status": "active" if response.status_code == 200 else "error",
                    "balance": None,
                    "note": "Balance check via dashboard: platform.openai.com"
                })
        except Exception as e:
            balances.append({
                "provider": "openai",
                "status": "error",
                "error": str(e)
            })
    
    # Anthropic balance
    if settings.ANTHROPIC_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": settings.ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01"
                    }
                )
                balances.append({
                    "provider": "anthropic",
                    "status": "active" if response.status_code in (200, 405) else "error",
                    "balance": None,
                    "note": "Balance check via dashboard: console.anthropic.com"
                })
        except Exception as e:
            balances.append({
                "provider": "anthropic",
                "status": "error",
                "error": str(e)
            })
    
    return {"ok": True, "balances": balances}


@router.post("/{adapter_name}/health")
async def adapter_health(
    adapter_name: str,
    admin: User = Depends(get_admin_user),
):
    """Health check конкретного адаптера."""
    api_keys = {
        "openai": settings.OPENAI_API_KEY,
        "anthropic": settings.ANTHROPIC_API_KEY,
    }
    
    api_key = api_keys.get(adapter_name)
    if not api_key:
        raise HTTPException(status_code=400, detail=f"No API key for {adapter_name}")
    
    adapter = AdapterRegistry.get_adapter(adapter_name, api_key)
    if not adapter:
        raise HTTPException(status_code=404, detail=f"Adapter {adapter_name} not found")
    
    health = await adapter.health_check()
    
    return {
        "ok": True,
        "adapter": adapter_name,
        "status": health.status,
        "latency_ms": health.latency_ms,
        "error": health.error,
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
        raise HTTPException(status_code=400, detail=f"No API key for {adapter_name}")
    
    adapter = AdapterRegistry.get_adapter(adapter_name, api_key)
    if not adapter:
        raise HTTPException(status_code=404, detail=f"Adapter {adapter_name} not found")
    
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