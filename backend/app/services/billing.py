from decimal import Decimal
from uuid import UUID
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.request import Request

class BillingService:
    
    @staticmethod
    async def check_balance(db: AsyncSession, user_id: UUID, required: Decimal) -> bool:
        result = await db.execute(select(User.credits_balance).where(User.id == user_id))
        balance = result.scalar_one_or_none()
        return balance is not None and balance >= required
    
    @staticmethod
    async def deduct_credits(db: AsyncSession, user_id: UUID, amount: Decimal) -> Decimal:
        result = await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(credits_balance=User.credits_balance - amount)
            .returning(User.credits_balance)
        )
        new_balance = result.scalar_one()
        return new_balance
    
    @staticmethod
    async def get_balance(db: AsyncSession, user_id: UUID) -> Decimal:
        result = await db.execute(select(User.credits_balance).where(User.id == user_id))
        return result.scalar_one_or_none() or Decimal("0")
    
    @staticmethod
    async def add_credits(db: AsyncSession, user_id: UUID, amount: Decimal) -> Decimal:
        result = await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(credits_balance=User.credits_balance + amount)
            .returning(User.credits_balance)
        )
        return result.scalar_one()

billing_service = BillingService()
