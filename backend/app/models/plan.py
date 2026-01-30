import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, DECIMAL, DateTime, ForeignKey, Boolean, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin


class Plan(Base, UUIDMixin):
    __tablename__ = "plans"
    
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(DECIMAL(12, 2))
    currency: Mapped[str] = mapped_column(String(10), default="RUB")
    credits: Mapped[Decimal] = mapped_column(DECIMAL(12, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default="now()")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default="now()", onupdate=datetime.utcnow)
    
    items: Mapped[List["PlanItem"]] = relationship(back_populates="plan", cascade="all, delete-orphan")


class PlanItem(Base, UUIDMixin):
    __tablename__ = "plan_items"
    
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plans.id", ondelete="CASCADE"))
    item_type: Mapped[str] = mapped_column(String(50))
    adapter_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    model_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    custom_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    credits_override: Mapped[Optional[Decimal]] = mapped_column(DECIMAL(10, 4), nullable=True)
    credits_scope: Mapped[str] = mapped_column(String(20), default="plan_only")
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default="now()")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default="now()", onupdate=datetime.utcnow)
    
    plan: Mapped["Plan"] = relationship(back_populates="items")