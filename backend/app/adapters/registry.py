from typing import Dict, Type, Optional
from app.adapters.base import BaseAdapter, ProviderType, ProviderHealth
from app.adapters.openai import OpenAIAdapter
from app.adapters.anthropic import AnthropicAdapter
from app.adapters.gemini import GeminiAdapter
from app.adapters.deepseek import DeepSeekAdapter
from app.adapters.nano_banana import NanoBananaAdapter
from app.adapters.kling import KlingAdapter
from app.adapters.midjourney import MidjourneyAdapter
from app.adapters.veo import VeoAdapter
from app.adapters.sora import SoraAdapter
from app.adapters.hailuo import HailuoAdapter
from app.adapters.runway import RunwayAdapter
from app.adapters.luma import LumaAdapter
from app.adapters.seedance import SeedanceAdapter
from app.adapters.flux import FluxAdapter


class AdapterRegistry:
    """Реестр всех доступных адаптеров."""

    _adapters: Dict[str, Type[BaseAdapter]] = {}
    _instances: Dict[str, BaseAdapter] = {}

    @classmethod
    def register(cls, adapter_class: Type[BaseAdapter]):
        """Регистрация адаптера."""
        cls._adapters[adapter_class.name] = adapter_class
        return adapter_class

    @classmethod
    def get_adapter(cls, name: str, api_key: str, **kwargs) -> Optional[BaseAdapter]:
        """Получение инстанса адаптера."""
        if name not in cls._adapters:
            return None

        cache_key = f"{name}:{api_key[:8]}"
        if cache_key not in cls._instances:
            cls._instances[cache_key] = cls._adapters[name](api_key, **kwargs)

        return cls._instances[cache_key]

    @classmethod
    def list_adapters(cls, provider_type: Optional[ProviderType] = None, include_models: bool = False) -> list:
        """Список всех адаптеров."""
        adapters = []
        for name, adapter_class in cls._adapters.items():
            if provider_type and adapter_class.provider_type != provider_type:
                continue

            adapter_info = {
                "name": adapter_class.name,
                "display_name": adapter_class.display_name,
                "type": adapter_class.provider_type.value,
            }

            if include_models and hasattr(adapter_class, 'PRICING'):
                adapter_info["models"] = [
                    {
                        "id": model_id,
                        "display_name": pricing.get("display_name", model_id),
                        "type": adapter_class.provider_type.value,
                        "pricing": {
                            "input_per_1k": pricing.get("input", 0),
                            "output_per_1k": pricing.get("output", 0),
                        }
                    }
                    for model_id, pricing in adapter_class.PRICING.items()
                ]

            adapters.append(adapter_info)

        return adapters

    @classmethod
    async def health_check_all(cls, api_keys: dict) -> Dict[str, ProviderHealth]:
        """Проверка всех провайдеров."""
        results = {}
        for name in cls._adapters:
            if name in api_keys and api_keys[name]:
                adapter = cls.get_adapter(name, api_keys[name])
                results[name] = await adapter.health_check()
            else:
                results[name] = ProviderHealth(status="no_key", error="API key not configured")
        return results


AdapterRegistry.register(OpenAIAdapter)
AdapterRegistry.register(AnthropicAdapter)
AdapterRegistry.register(GeminiAdapter)
AdapterRegistry.register(DeepSeekAdapter)
AdapterRegistry.register(NanoBananaAdapter)
AdapterRegistry.register(KlingAdapter)
AdapterRegistry.register(MidjourneyAdapter)
AdapterRegistry.register(VeoAdapter)
AdapterRegistry.register(SoraAdapter)
AdapterRegistry.register(HailuoAdapter)
AdapterRegistry.register(RunwayAdapter)
AdapterRegistry.register(LumaAdapter)
AdapterRegistry.register(SeedanceAdapter)
AdapterRegistry.register(FluxAdapter)