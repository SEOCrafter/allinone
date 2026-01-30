from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.plan import Plan, PlanItem

router = APIRouter()


class PlanItemPublic(BaseModel):
    item_type: str
    adapter_name: Optional[str]
    model_id: Optional[str]
    custom_description: Optional[str]
    credits_override: Optional[float]
    is_enabled: bool


class PlanPublic(BaseModel):
    id: str
    name: str
    description: Optional[str]
    price: float
    currency: str
    credits: float
    items: List[PlanItemPublic]


@router.get("", response_model=List[PlanPublic])
async def get_active_plans(db: AsyncSession = Depends(get_db)):
    """Получить активные тарифы для фронта"""
    result = await db.execute(
        select(Plan)
        .options(selectinload(Plan.items))
        .where(Plan.is_active == True)
        .order_by(Plan.sort_order, Plan.price)
    )
    plans = result.scalars().all()
    
    return [
        PlanPublic(
            id=str(p.id),
            name=p.name,
            description=p.description,
            price=float(p.price),
            currency=p.currency,
            credits=float(p.credits),
            items=[
                PlanItemPublic(
                    item_type=item.item_type,
                    adapter_name=item.adapter_name,
                    model_id=item.model_id,
                    custom_description=item.custom_description,
                    credits_override=float(item.credits_override) if item.credits_override else None,
                    is_enabled=item.is_enabled
                )
                for item in sorted(p.items, key=lambda x: x.sort_order)
                if item.is_enabled
            ]
        )
        for p in plans
    ]