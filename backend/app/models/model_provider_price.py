import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DECIMAL, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class ModelProviderPrice(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "model_provider_prices"

    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    replicate_model_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    price_type: Mapped[str] = mapped_column(String(20), nullable=False)
    price_usd: Mapped[Decimal] = mapped_column(DECIMAL(10, 6), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    @property
    def is_replicate(self) -> bool:
        return self.provider == "replicate"

    @property
    def is_per_second(self) -> bool:
        return self.price_type == "per_second"

    @property
    def is_per_request(self) -> bool:
        return self.price_type == "per_request"

    @property
    def is_per_image(self) -> bool:
        return self.price_type == "per_image"

    def calculate_cost(self, duration: int = 0, count: int = 1) -> Decimal:
        if self.price_type == "per_second":
            return self.price_usd * Decimal(duration)
        elif self.price_type == "per_request":
            return self.price_usd * Decimal(count)
        elif self.price_type == "per_image":
            return self.price_usd * Decimal(count)
        return Decimal("0")

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "model_name": self.model_name,
            "provider": self.provider,
            "replicate_model_id": self.replicate_model_id,
            "price_type": self.price_type,
            "price_usd": float(self.price_usd),
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
