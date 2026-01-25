import uuid
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Boolean, Integer, DECIMAL, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class Provider(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "providers"
    
    name: Mapped[str] = mapped_column(String(50), unique=True)  # openai, anthropic
    display_name: Mapped[str] = mapped_column(String(100))  # OpenAI, Anthropic
    type: Mapped[str] = mapped_column(String(20))  # text, image, audio, video
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    health_status: Mapped[str] = mapped_column(String(20), default="healthy")
    
    fallback_provider_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("providers.id"), nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Relationships
    pricing: Mapped[list["ProviderPricing"]] = relationship(back_populates="provider")

class ProviderPricing(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "provider_pricing"
    
    provider_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("providers.id"))
    model: Mapped[str] = mapped_column(String(100))  # gpt-4o, claude-3-opus
    display_name: Mapped[str] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(20))
    
    # Provider costs
    price_input_per_1k: Mapped[Decimal] = mapped_column(DECIMAL(10, 6), default=0)
    price_output_per_1k: Mapped[Decimal] = mapped_column(DECIMAL(10, 6), default=0)
    price_per_request: Mapped[Decimal] = mapped_column(DECIMAL(10, 4), default=0)
    
    # Our pricing (credits)
    credits_input_per_1k: Mapped[Decimal] = mapped_column(DECIMAL(10, 4), default=0)
    credits_output_per_1k: Mapped[Decimal] = mapped_column(DECIMAL(10, 4), default=0)
    credits_per_request: Mapped[Decimal] = mapped_column(DECIMAL(10, 4), default=0)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    capabilities: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Relationships
    provider: Mapped["Provider"] = relationship(back_populates="pricing")
