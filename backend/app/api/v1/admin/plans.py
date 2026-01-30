from typing import Optional, List
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.plan import Plan, PlanItem
from app.models.model_setting import ModelSetting
from app.api.deps import get_current_superadmin

router = APIRouter()


class PlanItemCreate(BaseModel):
    item_type: str
    adapter_name: Optional[str] = None
    model_id: Optional[str] = None
    custom_description: Optional[str] = None
    credits_override: Optional[float] = None
    credits_scope: str = "plan_only"
    is_enabled: bool = True
    sort_order: int = 0


class PlanItemResponse(BaseModel):
    id: str
    item_type: str
    adapter_name: Optional[str]
    model_id: Optional[str]
    custom_description: Optional[str]
    credits_override: Optional[float]
    credits_scope: str
    is_enabled: bool
    sort_order: int


class PlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    currency: str = "RUB"
    credits: float
    is_active: bool = True
    sort_order: int = 0
    items: List[PlanItemCreate] = []


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    credits: Optional[float] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    items: Optional[List[PlanItemCreate]] = None


class PlanResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    price: float
    currency: str
    credits: float
    is_active: bool
    sort_order: int
    items: List[PlanItemResponse]


@router.get("", response_model=List[PlanResponse])
async def list_plans(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_superadmin)
):
    """Список всех тарифов"""
    result = await db.execute(
        select(Plan)
        .options(selectinload(Plan.items))
        .order_by(Plan.sort_order, Plan.created_at)
    )
    plans = result.scalars().all()
    
    return [
        PlanResponse(
            id=str(p.id),
            name=p.name,
            description=p.description,
            price=float(p.price),
            currency=p.currency,
            credits=float(p.credits),
            is_active=p.is_active,
            sort_order=p.sort_order,
            items=[
                PlanItemResponse(
                    id=str(item.id),
                    item_type=item.item_type,
                    adapter_name=item.adapter_name,
                    model_id=item.model_id,
                    custom_description=item.custom_description,
                    credits_override=float(item.credits_override) if item.credits_override else None,
                    credits_scope=item.credits_scope,
                    is_enabled=item.is_enabled,
                    sort_order=item.sort_order
                )
                for item in sorted(p.items, key=lambda x: x.sort_order)
            ]
        )
        for p in plans
    ]


@router.get("/{plan_id}", response_model=PlanResponse)
async def get_plan(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_superadmin)
):
    """Получить тариф по ID"""
    result = await db.execute(
        select(Plan)
        .options(selectinload(Plan.items))
        .where(Plan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return PlanResponse(
        id=str(plan.id),
        name=plan.name,
        description=plan.description,
        price=float(plan.price),
        currency=plan.currency,
        credits=float(plan.credits),
        is_active=plan.is_active,
        sort_order=plan.sort_order,
        items=[
            PlanItemResponse(
                id=str(item.id),
                item_type=item.item_type,
                adapter_name=item.adapter_name,
                model_id=item.model_id,
                custom_description=item.custom_description,
                credits_override=float(item.credits_override) if item.credits_override else None,
                credits_scope=item.credits_scope,
                is_enabled=item.is_enabled,
                sort_order=item.sort_order
            )
            for item in sorted(plan.items, key=lambda x: x.sort_order)
        ]
    )


@router.post("", response_model=PlanResponse)
async def create_plan(
    data: PlanCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_superadmin)
):
    """Создать новый тариф"""
    plan = Plan(
        name=data.name,
        description=data.description,
        price=Decimal(str(data.price)),
        currency=data.currency,
        credits=Decimal(str(data.credits)),
        is_active=data.is_active,
        sort_order=data.sort_order
    )
    
    for item_data in data.items:
        item = PlanItem(
            item_type=item_data.item_type,
            adapter_name=item_data.adapter_name,
            model_id=item_data.model_id,
            custom_description=item_data.custom_description,
            credits_override=Decimal(str(item_data.credits_override)) if item_data.credits_override else None,
            credits_scope=item_data.credits_scope,
            is_enabled=item_data.is_enabled,
            sort_order=item_data.sort_order
        )
        plan.items.append(item)
        
        if item_data.credits_override and item_data.credits_scope == "global":
            await apply_global_credits(db, item_data.adapter_name, item_data.model_id, item_data.credits_override)
    
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    
    return await get_plan(plan.id, db, _)


@router.put("/{plan_id}", response_model=PlanResponse)
async def update_plan(
    plan_id: UUID,
    data: PlanUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_superadmin)
):
    """Обновить тариф"""
    result = await db.execute(
        select(Plan)
        .options(selectinload(Plan.items))
        .where(Plan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    if data.name is not None:
        plan.name = data.name
    if data.description is not None:
        plan.description = data.description
    if data.price is not None:
        plan.price = Decimal(str(data.price))
    if data.currency is not None:
        plan.currency = data.currency
    if data.credits is not None:
        plan.credits = Decimal(str(data.credits))
    if data.is_active is not None:
        plan.is_active = data.is_active
    if data.sort_order is not None:
        plan.sort_order = data.sort_order
    
    if data.items is not None:
        for item in plan.items:
            await db.delete(item)
        
        for item_data in data.items:
            item = PlanItem(
                plan_id=plan.id,
                item_type=item_data.item_type,
                adapter_name=item_data.adapter_name,
                model_id=item_data.model_id,
                custom_description=item_data.custom_description,
                credits_override=Decimal(str(item_data.credits_override)) if item_data.credits_override else None,
                credits_scope=item_data.credits_scope,
                is_enabled=item_data.is_enabled,
                sort_order=item_data.sort_order
            )
            db.add(item)
            
            if item_data.credits_override and item_data.credits_scope == "global":
                await apply_global_credits(db, item_data.adapter_name, item_data.model_id, item_data.credits_override)
    
    await db.commit()
    
    return await get_plan(plan_id, db, _)


@router.patch("/{plan_id}/toggle")
async def toggle_plan(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_superadmin)
):
    """Включить/выключить тариф"""
    result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    plan.is_active = not plan.is_active
    await db.commit()
    
    return {"ok": True, "is_active": plan.is_active}


@router.delete("/{plan_id}")
async def delete_plan(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_superadmin)
):
    """Удалить тариф"""
    result = await db.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    await db.delete(plan)
    await db.commit()
    
    return {"ok": True}


async def apply_global_credits(db: AsyncSession, adapter_name: str, model_id: str, credits: float):
    """Применить цену глобально в model_settings"""
    if not adapter_name or not model_id:
        return
    
    result = await db.execute(
        select(ModelSetting).where(
            ModelSetting.adapter_name == adapter_name,
            ModelSetting.model_id == model_id
        )
    )
    setting = result.scalar_one_or_none()
    
    if setting:
        setting.credits_price = Decimal(str(credits))
    else:
        setting = ModelSetting(
            adapter_name=adapter_name,
            model_id=model_id,
            credits_price=Decimal(str(credits)),
            is_enabled=True
        )
        db.add(setting)