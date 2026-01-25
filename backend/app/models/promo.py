import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, Integer, DECIMAL, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin

class PromoCode(Base, UUIDMixin):
    __tablename__ = "promo_codes"
    
    code: Mapped[str] = mapped_column(String(50), unique=True)
    type: Mapped[str] = mapped_column(String(20))  # credits, discount, trial
    
    credits_amount: Mapped[Optional[Decimal]] = mapped_column(DECIMAL(10, 2), nullable=True)
    discount_percent: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    trial_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("plans.id"), nullable=True)
    max_uses: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    min_topup_amount: Mapped[Optional[Decimal]] = mapped_column(DECIMAL(10, 2), nullable=True)
    
    valid_from: Mapped[datetime] = mapped_column(DateTime, server_default="now()")
    valid_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default="now()")

class PromoActivation(Base, UUIDMixin):
    __tablename__ = "promo_activations"
    
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    promo_code_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("promo_codes.id"))
    
    credits_received: Mapped[Optional[Decimal]] = mapped_column(DECIMAL(10, 2), nullable=True)
    discount_applied: Mapped[Optional[Decimal]] = mapped_column(DECIMAL(10, 2), nullable=True)
    transaction_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("transactions.id"), nullable=True)
    
    activated_at: Mapped[datetime] = mapped_column(DateTime, server_default="now()")
