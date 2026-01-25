from typing import Optional
from decimal import Decimal
from app.adapters import AdapterRegistry, GenerationResult
from app.config import settings

class GenerationService:
    """Сервис для работы с AI-генерацией."""
    
    # Маппинг провайдеров по умолчанию для разных задач
    DEFAULT_PROVIDERS = {
        "chat": "openai",
        "chat_advanced": "anthropic",
        "image": "openai",  # DALL-E
        "audio": "openai",  # Whisper/TTS
    }
    
    # Наценка на провайдеров (наша маржа)
    MARKUP = Decimal("1.5")  # 50% наценка
    
    def __init__(self):
        self.api_keys = {
            "openai": settings.OPENAI_API_KEY,
            "anthropic": settings.ANTHROPIC_API_KEY,
        }
    
    async def chat(
        self,
        message: str,
        system_prompt: Optional[str] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        **kwargs
    ) -> GenerationResult:
        """Текстовая генерация."""
        provider_name = provider or self.DEFAULT_PROVIDERS["chat"]
        api_key = self.api_keys.get(provider_name)
        
        if not api_key:
            return GenerationResult(
                success=False,
                error_code="NO_API_KEY",
                error_message=f"API key for {provider_name} not configured",
            )
        
        adapter = AdapterRegistry.get_adapter(provider_name, api_key)
        if not adapter:
            return GenerationResult(
                success=False,
                error_code="UNKNOWN_PROVIDER",
                error_message=f"Provider {provider_name} not found",
            )
        
        params = {"system_prompt": system_prompt, **kwargs}
        if model:
            params["model"] = model
        
        return await adapter.generate(message, **params)
    
    def calculate_credits(self, result: GenerationResult) -> Decimal:
        """Расчёт кредитов к списанию."""
        if not result.success:
            return Decimal("0")
        return Decimal(str(result.provider_cost)) * self.MARKUP
    
    async def get_providers_status(self) -> dict:
        """Статус всех провайдеров."""
        return await AdapterRegistry.health_check_all(self.api_keys)
    
    def list_available_providers(self, provider_type: Optional[str] = None) -> list:
        """Список доступных провайдеров."""
        from app.adapters import ProviderType
        pt = ProviderType(provider_type) if provider_type else None
        return AdapterRegistry.list_adapters(pt)


# Singleton
generation_service = GenerationService()
