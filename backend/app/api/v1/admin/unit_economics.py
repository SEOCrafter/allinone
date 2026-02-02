from typing import Optional, List
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.database import get_db
from app.api.deps import get_admin_user
from app.models.user import User
from app.models.unit_economics import UnitEconomics
import uuid

router = APIRouter()


class UnitEconomicsCreate(BaseModel):
    name: str
    currency: str = "RUB"
    subscription_price: float
    credits_in_plan: int
    requests_in_plan: int
    avg_tokens_input: int = 500
    avg_tokens_output: int = 1000
    overhead_percent: float = 15.0
    selected_model: str
    notes: Optional[str] = None


class UnitEconomicsUpdate(BaseModel):
    name: Optional[str] = None
    currency: Optional[str] = None
    subscription_price: Optional[float] = None
    credits_in_plan: Optional[int] = None
    requests_in_plan: Optional[int] = None
    avg_tokens_input: Optional[int] = None
    avg_tokens_output: Optional[int] = None
    overhead_percent: Optional[float] = None
    selected_model: Optional[str] = None
    notes: Optional[str] = None


class UnitEconomicsResponse(BaseModel):
    id: str
    name: str
    currency: str
    subscription_price: float
    credits_in_plan: int
    requests_in_plan: int
    avg_tokens_input: int
    avg_tokens_output: int
    overhead_percent: float
    selected_model: str
    notes: Optional[str]
    created_at: str
    updated_at: str


@router.get("")
async def list_calculations(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UnitEconomics).order_by(UnitEconomics.created_at.desc())
    )
    calculations = result.scalars().all()
    
    return {
        "ok": True,
        "calculations": [
            {
                "id": str(c.id),
                "name": c.name,
                "currency": c.currency,
                "subscription_price": float(c.subscription_price),
                "credits_in_plan": c.credits_in_plan,
                "requests_in_plan": c.requests_in_plan,
                "avg_tokens_input": c.avg_tokens_input,
                "avg_tokens_output": c.avg_tokens_output,
                "overhead_percent": float(c.overhead_percent),
                "selected_model": c.selected_model,
                "notes": c.notes,
                "created_at": c.created_at.isoformat().replace("+00:00", "") + "Z" if c.created_at else None,
                "updated_at": c.updated_at.isoformat().replace("+00:00", "") + "Z" if c.updated_at else None,
            }
            for c in calculations
        ]
    }


@router.post("")
async def create_calculation(
    data: UnitEconomicsCreate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    calculation = UnitEconomics(
        id=uuid.uuid4(),
        name=data.name,
        currency=data.currency,
        subscription_price=Decimal(str(data.subscription_price)),
        credits_in_plan=data.credits_in_plan,
        requests_in_plan=data.requests_in_plan,
        avg_tokens_input=data.avg_tokens_input,
        avg_tokens_output=data.avg_tokens_output,
        overhead_percent=Decimal(str(data.overhead_percent)),
        selected_model=data.selected_model,
        notes=data.notes,
    )
    
    db.add(calculation)
    await db.commit()
    await db.refresh(calculation)
    
    return {
        "ok": True,
        "calculation": {
            "id": str(calculation.id),
            "name": calculation.name,
            "currency": calculation.currency,
            "subscription_price": float(calculation.subscription_price),
            "credits_in_plan": calculation.credits_in_plan,
            "requests_in_plan": calculation.requests_in_plan,
            "avg_tokens_input": calculation.avg_tokens_input,
            "avg_tokens_output": calculation.avg_tokens_output,
            "overhead_percent": float(calculation.overhead_percent),
            "selected_model": calculation.selected_model,
            "notes": calculation.notes,
            "created_at": calculation.created_at.isoformat().replace("+00:00", "") + "Z" if calculation.created_at else None,
            "updated_at": calculation.updated_at.isoformat().replace("+00:00", "") + "Z" if calculation.updated_at else None,
        }
    }


@router.put("/{calc_id}")
async def update_calculation(
    calc_id: str,
    data: UnitEconomicsUpdate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UnitEconomics).where(UnitEconomics.id == calc_id)
    )
    calculation = result.scalar_one_or_none()
    
    if not calculation:
        raise HTTPException(status_code=404, detail="Расчёт не найден")
    
    if data.name is not None:
        calculation.name = data.name
    if data.currency is not None:
        calculation.currency = data.currency
    if data.subscription_price is not None:
        calculation.subscription_price = Decimal(str(data.subscription_price))
    if data.credits_in_plan is not None:
        calculation.credits_in_plan = data.credits_in_plan
    if data.requests_in_plan is not None:
        calculation.requests_in_plan = data.requests_in_plan
    if data.avg_tokens_input is not None:
        calculation.avg_tokens_input = data.avg_tokens_input
    if data.avg_tokens_output is not None:
        calculation.avg_tokens_output = data.avg_tokens_output
    if data.overhead_percent is not None:
        calculation.overhead_percent = Decimal(str(data.overhead_percent))
    if data.selected_model is not None:
        calculation.selected_model = data.selected_model
    if data.notes is not None:
        calculation.notes = data.notes
    
    await db.commit()
    await db.refresh(calculation)
    
    return {
        "ok": True,
        "calculation": {
            "id": str(calculation.id),
            "name": calculation.name,
            "currency": calculation.currency,
            "subscription_price": float(calculation.subscription_price),
            "credits_in_plan": calculation.credits_in_plan,
            "requests_in_plan": calculation.requests_in_plan,
            "avg_tokens_input": calculation.avg_tokens_input,
            "avg_tokens_output": calculation.avg_tokens_output,
            "overhead_percent": float(calculation.overhead_percent),
            "selected_model": calculation.selected_model,
            "notes": calculation.notes,
            "created_at": calculation.created_at.isoformat() + "Z" if calculation.created_at else None,
            "updated_at": calculation.updated_at.isoformat() + "Z" if calculation.updated_at else None,
        }
    }


@router.delete("/{calc_id}")
async def delete_calculation(
    calc_id: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UnitEconomics).where(UnitEconomics.id == calc_id)
    )
    calculation = result.scalar_one_or_none()
    
    if not calculation:
        raise HTTPException(status_code=404, detail="Расчёт не найден")
    
    await db.delete(calculation)
    await db.commit()
    
    return {"ok": True, "deleted_id": calc_id}
