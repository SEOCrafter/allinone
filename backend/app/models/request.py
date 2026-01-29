import uuid
from decimal import Decimal
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Text, Integer, Boolean, DECIMAL, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin

class Request(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "requests"
    
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    api_key_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("api_keys.id"), nullable=True)
    
    type: Mapped[str] = mapped_column(String(20))
    endpoint: Mapped[str] = mapped_column(String(100))
    provider_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("providers.id"))
    model: Mapped[str] = mapped_column(String(100))
    
    prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    params: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    status: Mapped[str] = mapped_column(String(20), default="pending")
    credits_spent: Mapped[Decimal] = mapped_column(DECIMAL(10, 4), default=0)
    provider_cost: Mapped[Decimal] = mapped_column(DECIMAL(10, 6), default=0)
    
    tokens_input: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tokens_output: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    error_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    parent_request_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("requests.id"), nullable=True)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    external_task_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    external_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    result_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    result_urls: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    
    user: Mapped["User"] = relationship(back_populates="requests")
    results: Mapped[list["Result"]] = relationship(back_populates="request")
    files: Mapped[list["RequestFile"]] = relationship(back_populates="request")

class RequestFile(Base, UUIDMixin):
    __tablename__ = "request_files"
    
    request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("requests.id"))
    type: Mapped[str] = mapped_column(String(20))
    original_name: Mapped[str] = mapped_column(String(255))
    storage_path: Mapped[str] = mapped_column(String(500))
    public_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column()
    file_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default="now()")
    
    request: Mapped["Request"] = relationship(back_populates="files")

class Result(Base, UUIDMixin):
    __tablename__ = "results"
    
    request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("requests.id"))
    type: Mapped[str] = mapped_column(String(20))
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    storage_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    public_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    size_bytes: Mapped[Optional[int]] = mapped_column(nullable=True)
    file_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default="now()")
    
    request: Mapped["Request"] = relationship(back_populates="results")