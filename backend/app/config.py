from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)
    
    # App
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_SECRET_KEY: str = "change-me-in-production"
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://ai_user:devpassword@localhost:5432/ai_aggregator"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Storage (S3/MinIO)
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_BUCKET: str = "ai-aggregator"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    
    # CORS
    CORS_ORIGINS: List[str] = ["*"]
    
    # JWT
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # AI Providers
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""
    KIE_API_KEY: str = ""
    REPLICATE_API_KEY: str = ""

    # FreeKassa
    FREEKASSA_MERCHANT_ID: int = 0
    FREEKASSA_SECRET1: str = ""
    FREEKASSA_SECRET2: str = ""
    FREEKASSA_API_KEY: str = ""

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()