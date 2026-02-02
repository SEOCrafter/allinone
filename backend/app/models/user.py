import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional
from sqlalchemy import String, BigInteger, Boolean, Text, DECIMAL, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    telegram_id: Mapped[Optional[int]] = mapped_column(BigInteger, unique=True, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    credits_balance: Mapped[Decimal] = mapped_column(DECIMAL(12, 6), default=0)
    role: Mapped[str] = mapped_column(String(20), default="user")
    language: Mapped[str] = mapped_column(String(5), default="ru")
    timezone: Mapped[str] = mapped_column(String(50), default="Europe/Moscow")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    blocked_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    blocked_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    rate_limit_rpm: Mapped[Optional[int]] = mapped_column(nullable=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    api_keys: Mapped[list["ApiKey"]] = relationship(back_populates="user")
    requests: Mapped[list["Request"]] = relationship(back_populates="user")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="user")
    files: Mapped[list["File"]] = relationship(back_populates="user")