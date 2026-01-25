import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, Integer, DECIMAL, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class Plan(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "plans"
    
    name: Mapped[str] = mapped_column(String(50))  # Free, Pro, Business
    slug: Mapped[str] = mapped_column(String(50), unique=True)
    
    price_monthly: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), default=0)
    price_yearly: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), default=0)
    credits_monthly: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), default=0)
    
    rate_limit_rpm: Mapped[int] = mapped_column(Integer, default=10)
    max_file_size_mb: Mapped[int] = mapped_column(Integer, default=10)
    features: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

class UserSubscription(Base, UUIDMixin):
    __tablename__ = "user_subscriptions"
    
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plans.id"))
    
    status: Mapped[str] = mapped_column(String(20))  # active, cancelled, expired
    current_period_start: Mapped[datetime] = mapped_column(DateTime)
    current_period_end: Mapped[datetime] = mapped_column(DateTime)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)
    
    payment_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    external_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default="now()")
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
