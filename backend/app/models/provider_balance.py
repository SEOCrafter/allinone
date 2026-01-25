from sqlalchemy import Column, String, Numeric, DateTime, func
from app.database import Base
import uuid


class ProviderBalance(Base):
    __tablename__ = "provider_balances"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    provider = Column(String(50), nullable=False, unique=True)
    balance_usd = Column(Numeric(12, 6), nullable=False, default=0)
    total_deposited_usd = Column(Numeric(12, 6), nullable=False, default=0)
    total_spent_usd = Column(Numeric(12, 6), nullable=False, default=0)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime, server_default=func.now())