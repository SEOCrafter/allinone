from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tariff import Tariff, TariffItem

router = APIRouter()


class TariffItemPublic(BaseModel):
    item_type: str
    adapter_name: Optional[str]
    model_id: Optional[str]
    custom_description: Optional[str]
    credits_override: Optional[float]
    is_enabled: bool


class TariffPublic(BaseModel):
    id: str
    name: str
    description: Optional[str]
    price: float
    currency: str
    credits: float
    items: List[TariffItemPublic]


@router.get("", response_model=List[TariffPublic])
async def get_active_tariffs(db: AsyncSession = Depends(get_db)):
    """Получить активные тарифы для фронта"""
    result = await db.execute(
        select(Tariff)
        .options(selectinload(Tariff.items))
        .where(Tariff.is_active == True)
        .order_by(Tariff.sort_order, Tariff.price)
    )
    tariffs = result.scalars().all()
    
    return [
        TariffPublic(
            id=str(t.id),
            name=t.name,
            description=t.description,
            price=float(t.price),
            currency=t.currency,
            credits=float(t.credits),
            items=[
                TariffItemPublic(
                    item_type=item.item_type,
                    adapter_name=item.adapter_name,
                    model_id=item.model_id,
                    custom_description=item.custom_description,
                    credits_override=float(item.credits_override) if item.credits_override else None,
                    is_enabled=item.is_enabled
                )
                for item in sorted(t.items, key=lambda x: x.sort_order)
                if item.is_enabled
            ]
        )
        for t in tariffs
    ]