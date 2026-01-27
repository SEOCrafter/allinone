import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DECIMAL, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class UnitEconomics(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "unit_economics"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="RUB")
    subscription_price: Mapped[Decimal] = mapped_column(DECIMAL(12, 2), nullable=False)
    credits_in_plan: Mapped[int] = mapped_column(Integer, nullable=False)
    requests_in_plan: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_tokens_input: Mapped[int] = mapped_column(Integer, default=500)
    avg_tokens_output: Mapped[int] = mapped_column(Integer, default=1000)
    overhead_percent: Mapped[Decimal] = mapped_column(DECIMAL(5, 2), default=15)
    selected_model: Mapped[str] = mapped_column(String(100), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
