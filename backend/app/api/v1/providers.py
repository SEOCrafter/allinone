from fastapi import APIRouter
from app.services.generation import generation_service
from app.adapters import AdapterRegistry

router = APIRouter()

@router.get("")
async def list_providers(type: str = None):
    """Список всех провайдеров."""
    providers = generation_service.list_available_providers(type)
    return {"ok": True, "providers": providers}

@router.get("/status")
async def providers_status():
    """Статус всех провайдеров (для дашборда)."""
    status = await generation_service.get_providers_status()
    
    result = []
    for name, health in status.items():
        result.append({
            "name": name,
            "status": health.status if hasattr(health, 'status') else health.get('status', 'unknown'),
            "latency_ms": getattr(health, 'latency_ms', None),
            "error": getattr(health, 'error', None),
        })
    
    return {"ok": True, "providers": result}

@router.get("/{provider_name}/capabilities")
async def provider_capabilities(provider_name: str):
    """Возможности конкретного провайдера."""
    from app.config import settings
    
    api_keys = {
        "openai": settings.OPENAI_API_KEY,
        "anthropic": settings.ANTHROPIC_API_KEY,
    }
    
    api_key = api_keys.get(provider_name)
    if not api_key:
        return {"ok": False, "error": "Provider not configured"}
    
    adapter = AdapterRegistry.get_adapter(provider_name, api_key)
    if not adapter:
        return {"ok": False, "error": "Provider not found"}
    
    return {
        "ok": True,
        "provider": provider_name,
        "capabilities": adapter.get_capabilities(),
    }
