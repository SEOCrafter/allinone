from typing import Optional, List
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tariff import Tariff, TariffItem
from app.models.model_setting import ModelSetting
from app.api.deps import get_superadmin_user

router = APIRouter()


class TariffItemCreate(BaseModel):
    item_type: str
    adapter_name: Optional[str] = None
    model_id: Optional[str] = None
    custom_description: Optional[str] = None
    credits_override: Optional[float] = None
    credits_scope: str = "plan_only"
    is_enabled: bool = True
    sort_order: int = 0


class TariffItemResponse(BaseModel):
    id: str
    item_type: str
    adapter_name: Optional[str]
    model_id: Optional[str]
    custom_description: Optional[str]
    credits_override: Optional[float]
    credits_scope: str
    is_enabled: bool
    sort_order: int


class TariffCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    currency: str = "RUB"
    credits: float
    is_active: bool = True
    sort_order: int = 0
    items: List[TariffItemCreate] = []


class TariffUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    credits: Optional[float] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    items: Optional[List[TariffItemCreate]] = None


class TariffResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    price: float
    currency: str
    credits: float
    is_active: bool
    sort_order: int
    items: List[TariffItemResponse]


@router.get("", response_model=List[TariffResponse])
async def list_tariffs(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_superadmin_user)
):
    """Список всех тарифов"""
    result = await db.execute(
        select(Tariff)
        .options(selectinload(Tariff.items))
        .order_by(Tariff.sort_order, Tariff.created_at)
    )
    tariffs = result.scalars().all()
    
    return [
        TariffResponse(
            id=str(t.id),
            name=t.name,
            description=t.description,
            price=float(t.price),
            currency=t.currency,
            credits=float(t.credits),
            is_active=t.is_active,
            sort_order=t.sort_order,
            items=[
                TariffItemResponse(
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
                for item in sorted(t.items, key=lambda x: x.sort_order)
            ]
        )
        for t in tariffs
    ]


@router.get("/{tariff_id}", response_model=TariffResponse)
async def get_tariff(
    tariff_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_superadmin_user)
):
    """Получить тариф по ID"""
    result = await db.execute(
        select(Tariff)
        .options(selectinload(Tariff.items))
        .where(Tariff.id == tariff_id)
    )
    tariff = result.scalar_one_or_none()
    
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")
    
    return TariffResponse(
        id=str(tariff.id),
        name=tariff.name,
        description=tariff.description,
        price=float(tariff.price),
        currency=tariff.currency,
        credits=float(tariff.credits),
        is_active=tariff.is_active,
        sort_order=tariff.sort_order,
        items=[
            TariffItemResponse(
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
            for item in sorted(tariff.items, key=lambda x: x.sort_order)
        ]
    )


@router.post("", response_model=TariffResponse)
async def create_tariff(
    data: TariffCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_superadmin_user)
):
    """Создать новый тариф"""
    tariff = Tariff(
        name=data.name,
        description=data.description,
        price=Decimal(str(data.price)),
        currency=data.currency,
        credits=Decimal(str(data.credits)),
        is_active=data.is_active,
        sort_order=data.sort_order
    )
    
    for item_data in data.items:
        item = TariffItem(
            item_type=item_data.item_type,
            adapter_name=item_data.adapter_name,
            model_id=item_data.model_id,
            custom_description=item_data.custom_description,
            credits_override=Decimal(str(item_data.credits_override)) if item_data.credits_override else None,
            credits_scope=item_data.credits_scope,
            is_enabled=item_data.is_enabled,
            sort_order=item_data.sort_order
        )
        tariff.items.append(item)
        
        if item_data.credits_override and item_data.credits_scope == "global":
            await apply_global_credits(db, item_data.adapter_name, item_data.model_id, item_data.credits_override)
    
    db.add(tariff)
    await db.commit()
    await db.refresh(tariff)
    
    return await get_tariff(tariff.id, db, _)


@router.put("/{tariff_id}", response_model=TariffResponse)
async def update_tariff(
    tariff_id: UUID,
    data: TariffUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_superadmin_user)
):
    """Обновить тариф"""
    result = await db.execute(
        select(Tariff)
        .options(selectinload(Tariff.items))
        .where(Tariff.id == tariff_id)
    )
    tariff = result.scalar_one_or_none()
    
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")
    
    if data.name is not None:
        tariff.name = data.name
    if data.description is not None:
        tariff.description = data.description
    if data.price is not None:
        tariff.price = Decimal(str(data.price))
    if data.currency is not None:
        tariff.currency = data.currency
    if data.credits is not None:
        tariff.credits = Decimal(str(data.credits))
    if data.is_active is not None:
        tariff.is_active = data.is_active
    if data.sort_order is not None:
        tariff.sort_order = data.sort_order
    
    if data.items is not None:
        for item in tariff.items:
            await db.delete(item)
        
        for item_data in data.items:
            item = TariffItem(
                tariff_id=tariff.id,
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
    
    return await get_tariff(tariff_id, db, _)


@router.patch("/{tariff_id}/toggle")
async def toggle_tariff(
    tariff_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_superadmin_user)
):
    """Включить/выключить тариф"""
    result = await db.execute(select(Tariff).where(Tariff.id == tariff_id))
    tariff = result.scalar_one_or_none()
    
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")
    
    tariff.is_active = not tariff.is_active
    await db.commit()
    
    return {"ok": True, "is_active": tariff.is_active}


@router.delete("/{tariff_id}")
async def delete_tariff(
    tariff_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_superadmin_user)
):
    """Удалить тариф"""
    result = await db.execute(select(Tariff).where(Tariff.id == tariff_id))
    tariff = result.scalar_one_or_none()
    
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")
    
    await db.delete(tariff)
    await db.commit()
    
    return {"ok": True}


async def apply_global_credits(db: AsyncSession, adapter_name: str, model_id: str, credits: float):
    """Применить цену глобально в model_settings"""
    if not adapter_name or not model_id:
        return
    
    result = await db.execute(
        select(ModelSetting).where(
            ModelSetting.provider == adapter_name,
            ModelSetting.model_id == model_id
        )
    )
    setting = result.scalar_one_or_none()
    
    if setting:
        setting.credits_price = Decimal(str(credits))
    else:
        setting = ModelSetting(
            provider=adapter_name,
            model_id=model_id,
            credits_price=Decimal(str(credits)),
            is_enabled=True
        )
        db.add(setting)