from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, Optional
from dataclasses import dataclass
from enum import Enum

class ProviderType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"

class ProviderStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DOWN = "down"

@dataclass
class GenerationResult:
    success: bool
    content: Optional[str] = None  # Текст или URL
    tokens_input: Optional[int] = None
    tokens_output: Optional[int] = None
    provider_cost: float = 0.0
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    raw_response: Optional[dict] = None

@dataclass
class ProviderHealth:
    status: ProviderStatus
    latency_ms: Optional[int] = None
    error: Optional[str] = None

class BaseAdapter(ABC):
    """Базовый класс для всех AI-провайдеров."""
    
    name: str  # openai, anthropic, suno
    display_name: str  # OpenAI, Anthropic, Suno
    provider_type: ProviderType
    
    def __init__(self, api_key: str, **kwargs):
        self.api_key = api_key
        self.config = kwargs
    
    @abstractmethod
    async def generate(self, prompt: str, **params) -> GenerationResult:
        """Основной метод генерации."""
        pass
    
    async def generate_stream(self, prompt: str, **params) -> AsyncIterator[str]:
        """Стриминг ответа (для текста)."""
        raise NotImplementedError("Streaming not supported")
    
    async def health_check(self) -> ProviderHealth:
        """Проверка доступности провайдера."""
        import time
        start = time.time()
        try:
            # Минимальный запрос для проверки
            result = await self.generate("Hi", max_tokens=5)
            latency = int((time.time() - start) * 1000)
            if result.success:
                return ProviderHealth(status=ProviderStatus.HEALTHY, latency_ms=latency)
            return ProviderHealth(status=ProviderStatus.DEGRADED, error=result.error_message)
        except Exception as e:
            return ProviderHealth(status=ProviderStatus.DOWN, error=str(e))
    
    @abstractmethod
    def calculate_cost(self, tokens_input: int, tokens_output: int, **params) -> float:
        """Расчёт стоимости запроса."""
        pass
    
    def get_capabilities(self) -> dict:
        """Возможности провайдера."""
        return {}
