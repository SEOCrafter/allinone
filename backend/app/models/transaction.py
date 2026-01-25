import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional
from sqlalchemy import String, DECIMAL, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin

class Transaction(Base, UUIDMixin):
    __tablename__ = "transactions"
    
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    type: Mapped[str] = mapped_column(String(20))  # topup, refund, bonus, promo
    
    amount_currency: Mapped[Decimal] = mapped_column(DECIMAL(12, 2))
    currency: Mapped[str] = mapped_column(String(3))  # RUB, USD, STARS
    credits_added: Mapped[Decimal] = mapped_column(DECIMAL(12, 2))
    
    payment_method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    payment_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    status: Mapped[str] = mapped_column(String(20), default="pending")
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default="now()")
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    user: Mapped["User"] = relationship(back_populates="transactions")
