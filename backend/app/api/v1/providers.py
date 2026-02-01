from fastapi import APIRouter, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.services.generation import generation_service
from app.adapters import AdapterRegistry
from app.database import get_db
from app.models.model_setting import ModelSetting

router = APIRouter()


@router.get("")
async def list_providers(
    type: str = Query(None, description="Filter by type: text, image, audio, video"),
    include_models: bool = Query(True, description="Include available models"),
    enabled_only: bool = Query(True, description="Only return enabled models"),
    db: AsyncSession = Depends(get_db),
):
    from app.adapters.base import ProviderType

    pt = ProviderType(type) if type else None
    providers = AdapterRegistry.list_adapters(pt, include_models=include_models)

    if include_models:
        result = await db.execute(select(ModelSetting))
        all_settings = result.scalars().all()
        settings_map = {}
        for s in all_settings:
            key = f"{s.provider}:{s.model_id}"
            settings_map[key] = s

        for provider in providers:
            if "models" not in provider:
                continue
            enriched = []
            for model in provider["models"]:
                key = f"{provider['name']}:{model['id']}"
                setting = settings_map.get(key)

                is_enabled = setting.is_enabled if setting else True
                credits_price = float(setting.credits_price) if setting and setting.credits_price else None

                model["credits_price"] = credits_price
                model["is_enabled"] = is_enabled

                if enabled_only and not is_enabled:
                    continue
                enriched.append(model)

            provider["models"] = enriched

        if enabled_only:
            providers = [p for p in providers if p.get("models")]

    return {"ok": True, "providers": providers}


@router.get("/models")
async def list_all_models(
    enabled_only: bool = Query(True, description="Only return enabled models"),
    db: AsyncSession = Depends(get_db),
):
    providers = AdapterRegistry.list_adapters(include_models=True)

    result = await db.execute(select(ModelSetting))
    all_settings = result.scalars().all()
    settings_map = {}
    for s in all_settings:
        key = f"{s.provider}:{s.model_id}"
        settings_map[key] = s

    models = []
    for provider in providers:
        for model in provider.get("models", []):
            key = f"{provider['name']}:{model['id']}"
            setting = settings_map.get(key)

            is_enabled = setting.is_enabled if setting else True
            credits_price = float(setting.credits_price) if setting and setting.credits_price else None

            if enabled_only and not is_enabled:
                continue

            models.append({
                "id": model["id"],
                "provider": provider["name"],
                "provider_display_name": provider["display_name"],
                "type": model["type"],
                "pricing": model["pricing"],
                "credits_price": credits_price,
                "is_enabled": is_enabled,
            })

    return {"ok": True, "models": models}


@router.get("/status")
async def providers_status():
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