import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, String, Boolean, DECIMAL, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class ModelSetting(Base):
    __tablename__ = "model_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider = Column(String(50), nullable=False)
    model_id = Column(String(100), nullable=False)
    credits_price = Column(DECIMAL(10, 6), nullable=True)
    is_enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('provider', 'model_id', name='uq_provider_model'),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "provider": self.provider,
            "model_id": self.model_id,
            "credits_price": float(self.credits_price) if self.credits_price else None,
            "is_enabled": self.is_enabled,
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }
