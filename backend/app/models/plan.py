import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DECIMAL, DateTime, ForeignKey, Boolean, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin


class Plan(Base, UUIDMixin):
    __tablename__ = "plans"
    
    name: Mapped[str] = mapped_column(String(50))
    slug: Mapped[str] = mapped_column(String(50), unique=True)
    price_monthly: Mapped[Decimal] = mapped_column(DECIMAL(10, 2))
    price_yearly: Mapped[Decimal] = mapped_column(DECIMAL(10, 2))
    credits_monthly: Mapped[Decimal] = mapped_column(DECIMAL(12, 2))
    rate_limit_rpm: Mapped[int] = mapped_column(Integer)
    max_file_size_mb: Mapped[int] = mapped_column(Integer)
    features: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default="now()")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default="now()")


class UserSubscription(Base, UUIDMixin):
    __tablename__ = "user_subscriptions"
    
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plans.id"))
    status: Mapped[str] = mapped_column(String(20), default="active")
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default="now()")
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default="now()")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default="now()")