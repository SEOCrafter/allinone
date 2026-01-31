from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.model_provider_price import ModelProviderPrice
from app.adapters import AdapterRegistry
from app.adapters.base import BaseAdapter
from app.config import settings


MODEL_NAME_ALIASES = {
    "kling-2.6/text-to-video": "kling-2.6-t2v",
    "kling-2.6/image-to-video": "kling-2.6-i2v",
    "kling-2.6/motion-control": "kling-2.6-motion",
    "veo-3/text-to-video": "veo-3",
    "veo-3.1/text-to-video": "veo-3.1",
    "veo-3-fast/text-to-video": "veo-3-fast",
    "veo-2/text-to-video": "veo-2",
    "hailuo-02/text-to-video": "hailuo-02",
    "hailuo-02-fast/text-to-video": "hailuo-02-fast",
    "hailuo-2.3/text-to-video": "hailuo-2.3",
    "sora-2/text-to-video": "sora-2",
    "sora-2-pro/text-to-video": "sora-2-pro",
    "seedance-1-pro/text-to-video": "seedance-pro",
    "seedance-1-pro-fast/text-to-video": "seedance-pro-fast",
    "seedance-1-lite/text-to-video": "seedance-lite",
    "luma-ray/text-to-video": "luma-ray",
    "luma-ray-flash-2-540p/text-to-video": "luma-ray-flash",
    "runway-gen4/text-to-video": "runway-gen4-turbo",
    "minimax-video-01/text-to-video": "minimax-video",
    "flux-2/pro-text-to-image": "flux-2-pro",
    "flux-2/pro-image-to-image": "flux-2-pro",
    "flux-2/flex-text-to-image": "flux-2-flex",
    "flux-2/flex-image-to-image": "flux-2-flex",
    "flux-kontext/pro-text-to-image": "flux-kontext-pro",
    "flux-kontext/pro-image-to-image": "flux-kontext-pro",
}

MODEL_TO_KIE_MODEL = {
    "flux-2-pro": "flux-2/pro-text-to-image",
    "flux-2-flex": "flux-2/flex-text-to-image",
    "flux-kontext-pro": "flux-kontext/pro-text-to-image",
    "kling-2.6-t2v": "kling-2.6/text-to-video",
    "kling-2.6-i2v": "kling-2.6/image-to-video",
    "kling-2.6-motion": "kling-2.6/motion-control",
    "seedance-pro": "bytedance/seedance-1.5-pro",
    "sora-2": "sora-2-pro-text-to-video",
    "sora-2-pro": "sora-2-pro-text-to-video",
}


def normalize_model_name(model: str) -> str:
    if model in MODEL_NAME_ALIASES:
        return MODEL_NAME_ALIASES[model]
    
    normalized = model.lower().replace("/", "-").replace("_", "-")
    
    suffixes_to_remove = ["-text-to-video", "-image-to-video", "-t2v", "-i2v"]
    for suffix in suffixes_to_remove:
        if normalized.endswith(suffix) and normalized not in MODEL_NAME_ALIASES.values():
            pass
    
    return model


def get_api_key_for_provider(provider: str) -> Optional[str]:
    key_map = {
        "kie": settings.KIE_API_KEY,
        "replicate": settings.REPLICATE_API_KEY,
        "openai": settings.OPENAI_API_KEY,
        "anthropic": settings.ANTHROPIC_API_KEY,
        "gemini": settings.GEMINI_API_KEY,
        "deepseek": settings.DEEPSEEK_API_KEY,
    }
    return key_map.get(provider)


async def get_active_provider_for_model(
    db: AsyncSession,
    model_name: str,
) -> Optional[ModelProviderPrice]:
    normalized = normalize_model_name(model_name)
    
    result = await db.execute(
        select(ModelProviderPrice).where(
            ModelProviderPrice.model_name == normalized,
            ModelProviderPrice.is_active == True,
        )
    )
    active = result.scalar_one_or_none()
    
    if active:
        return active
    
    result = await db.execute(
        select(ModelProviderPrice).where(
            ModelProviderPrice.model_name == model_name,
            ModelProviderPrice.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def get_adapter_for_model(
    db: AsyncSession,
    model_name: str,
    fallback_provider: str = "kie",
) -> Tuple[BaseAdapter, str, str, float, str, Optional[dict]]:
    provider_price = await get_active_provider_for_model(db, model_name)
    normalized = normalize_model_name(model_name)
    
    if provider_price:
        provider = provider_price.provider
        if provider == "replicate" and provider_price.replicate_model_id:
            actual_model = provider_price.replicate_model_id
        elif provider == "kie" and normalized in MODEL_TO_KIE_MODEL:
            actual_model = MODEL_TO_KIE_MODEL[normalized]
        else:
            actual_model = model_name
        price_usd = float(provider_price.price_usd)
        price_type = provider_price.price_type
        price_variants = provider_price.price_variants
    else:
        provider = fallback_provider
        if normalized in MODEL_TO_KIE_MODEL:
            actual_model = MODEL_TO_KIE_MODEL[normalized]
        else:
            actual_model = model_name
        price_usd = 0.0
        price_type = "per_second"
        price_variants = None
    
    api_key = get_api_key_for_provider(provider)
    if not api_key:
        raise ValueError(f"No API key configured for provider: {provider}")
    
    if provider == "kie":
        adapter_name = _get_kie_adapter_name(model_name)
        adapter = AdapterRegistry.get_adapter(adapter_name, api_key)
    elif provider == "replicate":
        adapter = AdapterRegistry.get_adapter("replicate", api_key)
    else:
        adapter = AdapterRegistry.get_adapter(provider, api_key)
    
    if not adapter:
        raise ValueError(f"Adapter not found for provider: {provider}")
    
    return adapter, actual_model, provider, price_usd, price_type, price_variants


def _get_kie_adapter_name(model_name: str) -> str:
    model_lower = model_name.lower()
    
    if "kling" in model_lower:
        return "kling"
    elif "veo" in model_lower:
        return "veo"
    elif "hailuo" in model_lower or "minimax-video" in model_lower:
        return "hailuo"
    elif "sora" in model_lower:
        return "sora"
    elif "seedance" in model_lower:
        return "seedance"
    elif "runway" in model_lower:
        return "runway"
    elif "luma-ray" in model_lower:
        return "luma"
    elif "nano-banana" in model_lower:
        return "nano_banana"
    elif "midjourney" in model_lower:
        return "midjourney"
    elif "flux" in model_lower:
        return "flux"
    elif "imagen" in model_lower:
        return "imagen"
    elif "sd-" in model_lower or "stable-diffusion" in model_lower:
        return "stable_diffusion"
    elif "luma-photon" in model_lower:
        return "luma"
    elif "face-swap" in model_lower:
        return "face_swap"
    elif "minimax-image" in model_lower:
        return "minimax"
    elif "minimax-speech" in model_lower:
        return "minimax_speech"
    
    return "kie"