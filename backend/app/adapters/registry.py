from typing import Dict, Type, Optional
from app.adapters.base import BaseAdapter, ProviderType, ProviderHealth
from app.adapters.openai import OpenAIAdapter
from app.adapters.anthropic import AnthropicAdapter

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
        
        # Кэшируем инстансы
        cache_key = f"{name}:{api_key[:8]}"
        if cache_key not in cls._instances:
            cls._instances[cache_key] = cls._adapters[name](api_key, **kwargs)
        return cls._instances[cache_key]
    
    @classmethod
    def list_adapters(cls, provider_type: Optional[ProviderType] = None) -> list:
        """Список всех адаптеров."""
        adapters = []
        for name, adapter_class in cls._adapters.items():
            if provider_type and adapter_class.provider_type != provider_type:
                continue
            adapters.append({
                "name": adapter_class.name,
                "display_name": adapter_class.display_name,
                "type": adapter_class.provider_type.value,
            })
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

# Регистрируем адаптеры
AdapterRegistry.register(OpenAIAdapter)
AdapterRegistry.register(AnthropicAdapter)
