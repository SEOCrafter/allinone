import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin

class ApiKey(Base, UUIDMixin):
    __tablename__ = "api_keys"
    
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    key_hash: Mapped[str] = mapped_column(String(64))  # SHA-256
    key_prefix: Mapped[str] = mapped_column(String(8))  # First 8 chars for display
    name: Mapped[str] = mapped_column(String(100))
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    rate_limit_rpm: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    allowed_endpoints: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default="now()")
    
    user: Mapped["User"] = relationship(back_populates="api_keys")
