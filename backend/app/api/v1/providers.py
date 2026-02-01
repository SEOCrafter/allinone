from fastapi import APIRouter, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.services.generation import generation_service
from app.adapters import AdapterRegistry
from app.database import get_db
from app.models.model_setting import ModelSetting

router = APIRouter()

MODEL_SETTINGS_ALIASES = {
    ("flux", "flux-2/pro-text-to-image"): ("kie", "flux-2-pro"),
    ("flux", "flux-2/pro-image-to-image"): ("kie", "flux-2-pro"),
    ("flux", "flux-2/flex-text-to-image"): ("kie", "flux-2-flex"),
    ("flux", "flux-2/flex-image-to-image"): ("kie", "flux-2-flex"),
    ("flux", "flux-kontext/pro-text-to-image"): ("kie", "flux-kontext-pro"),
    ("flux", "flux-kontext/pro-image-to-image"): ("kie", "flux-kontext-pro"),
    ("kling", "kling-2.6/text-to-video"): ("kie", "kling-2.6-t2v"),
    ("kling", "kling-2.6/image-to-video"): ("kie", "kling-2.6-i2v"),
    ("kling", "kling-2.6/motion-control"): ("kie", "kling-2.6-motion"),
    ("midjourney", "mj_txt2img"): ("kie", "midjourney"),
    ("midjourney", "mj_img2img"): ("kie", "midjourney"),
    ("midjourney", "mj_video"): ("kie", "midjourney"),
    ("veo", "veo3.1_fast"): ("kie", "veo-3.1"),
    ("veo", "veo3.1_quality"): ("kie", "veo-3.1"),
    ("sora", "sora-2-pro-text-to-video"): ("kie", "sora-2"),
    ("sora", "sora-2-pro-image-to-video"): ("kie", "sora-2"),
    ("sora", "sora-2-text-to-video"): ("kie", "sora-2"),
    ("sora", "sora-2-image-to-video"): ("kie", "sora-2"),
    ("hailuo", "hailuo/02-text-to-video-standard"): ("kie", "hailuo-02"),
    ("hailuo", "hailuo/02-text-to-video-pro"): ("kie", "hailuo-02"),
    ("hailuo", "hailuo/02-image-to-video-standard"): ("kie", "hailuo-02"),
    ("hailuo", "hailuo/02-image-to-video-pro"): ("kie", "hailuo-02"),
    ("hailuo", "hailuo/2-3-image-to-video-standard"): ("kie", "hailuo-2.3"),
    ("hailuo", "hailuo/2-3-image-to-video-pro"): ("kie", "hailuo-2.3"),
    ("runway", "gen4"): ("replicate", "runway-gen4-video"),
    ("runway", "gen4-turbo"): ("replicate", "runway-gen4-turbo"),
    ("seedance", "bytedance/seedance-1.5-pro"): ("kie", "seedance-pro"),
    ("nano_banana", "google/nano-banana"): ("kie", "nano-banana"),
    ("nano_banana", "google/nano-banana-edit"): ("kie", "nano-banana-edit"),
    ("replicate", "kwaivgi/kling-v2.6"): ("replicate", "kling-2.6-t2v"),
    ("replicate", "kwaivgi/kling-v2.6-motion-control"): ("replicate", "kling-2.6-motion"),
    ("replicate", "stability-ai/stable-diffusion-3.5-large"): ("replicate", "sd-3.5-large"),
    ("replicate", "stability-ai/stable-diffusion-3.5-large-turbo"): ("replicate", "sd-3.5-large-turbo"),
    ("replicate", "minimax/speech-02-turbo"): ("replicate", "minimax-speech-turbo"),
    ("replicate", "minimax/speech-02-hd"): ("replicate", "minimax-speech-hd"),
    ("replicate", "minimax/image-01"): ("replicate", "minimax-image"),
    ("replicate", "minimax/video-01"): ("replicate", "minimax-video"),
    ("replicate", "runwayml/gen4-image"): ("replicate", "runway-gen4-image"),
    ("replicate", "runwayml/gen4-image-turbo"): ("replicate", "runway-gen4-image"),
    ("replicate", "runwayml/gen4-turbo"): ("replicate", "runway-gen4-turbo"),
    ("replicate", "luma/ray"): ("replicate", "luma-ray"),
    ("replicate", "luma/ray-flash-2-540p"): ("replicate", "luma-ray-flash-2-720p"),
    ("replicate", "luma/photon-flash"): ("replicate", "luma-photon-flash"),
    ("replicate", "bytedance/seedance-1-pro"): ("replicate", "seedance-pro"),
    ("replicate", "bytedance/seedance-1-pro-fast"): ("replicate", "seedance-pro-fast"),
    ("replicate", "bytedance/seedance-1-lite"): ("replicate", "seedance-lite"),
}


def _find_setting(settings_map, provider_name, model_id):
    key = f"{provider_name}:{model_id}"
    if key in settings_map:
        return settings_map[key]

    alias = MODEL_SETTINGS_ALIASES.get((provider_name, model_id))
    if alias:
        key = f"{alias[0]}:{alias[1]}"
        if key in settings_map:
            return settings_map[key]

    if "/" in model_id:
        short_name = model_id.split("/", 1)[1]
        for prefix in (provider_name, "kie", "replicate"):
            key = f"{prefix}:{short_name}"
            if key in settings_map:
                return settings_map[key]

    for prefix in ("kie", "replicate"):
        key = f"{prefix}:{model_id}"
        if key in settings_map:
            return settings_map[key]

    return None


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
                setting = _find_setting(settings_map, provider["name"], model["id"])

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
            setting = _find_setting(settings_map, provider["name"], model["id"])

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
            "status": health.status if hasattr(health, "status") else health.get("status", "unknown"),
            "latency_ms": getattr(health, "latency_ms", None),
            "error": getattr(health, "error", None),
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