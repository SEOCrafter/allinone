from fastapi import APIRouter, Query
from app.services.generation import generation_service
from app.adapters import AdapterRegistry

router = APIRouter()


@router.get("")
async def list_providers(
    type: str = Query(None, description="Filter by type: text, image, audio, video"),
    include_models: bool = Query(True, description="Include available models"),
):
    """Список всех провайдеров с моделями."""
    from app.adapters.base import ProviderType
    
    pt = ProviderType(type) if type else None
    providers = AdapterRegistry.list_adapters(pt, include_models=include_models)
    
    return {"ok": True, "providers": providers}


@router.get("/models")
async def list_all_models():
    """Плоский список всех доступных моделей."""
    providers = AdapterRegistry.list_adapters(include_models=True)
    
    models = []
    for provider in providers:
        for model in provider.get("models", []):
            models.append({
                "id": model["id"],
                "provider": provider["name"],
                "provider_display_name": provider["display_name"],
                "type": model["type"],
                "pricing": model["pricing"],
            })
    
    return {"ok": True, "models": models}


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