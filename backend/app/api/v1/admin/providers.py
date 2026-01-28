from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from decimal import Decimal

from app.database import get_db
from app.models.model_provider_price import ModelProviderPrice
from app.api.deps import get_current_admin_user

router = APIRouter(prefix="/providers", tags=["providers"])


class ProviderPriceResponse(BaseModel):
    id: str
    model_name: str
    provider: str
    replicate_model_id: Optional[str]
    price_type: str
    price_usd: float
    is_active: bool

    class Config:
        from_attributes = True


class ProviderPriceUpdate(BaseModel):
    price_usd: Optional[float] = None
    is_active: Optional[bool] = None


class SwitchProviderRequest(BaseModel):
    model_name: str
    new_provider: str


class ModelProvidersResponse(BaseModel):
    model_name: str
    current_provider: str
    providers: List[ProviderPriceResponse]


@router.get("/prices", response_model=List[ProviderPriceResponse])
async def list_provider_prices(
    model_name: Optional[str] = None,
    provider: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin_user),
):
    query = select(ModelProviderPrice)
    
    if model_name:
        query = query.where(ModelProviderPrice.model_name == model_name)
    if provider:
        query = query.where(ModelProviderPrice.provider == provider)
    if is_active is not None:
        query = query.where(ModelProviderPrice.is_active == is_active)
    
    query = query.order_by(ModelProviderPrice.model_name, ModelProviderPrice.provider)
    
    result = await db.execute(query)
    prices = result.scalars().all()
    
    return [
        ProviderPriceResponse(
            id=str(p.id),
            model_name=p.model_name,
            provider=p.provider,
            replicate_model_id=p.replicate_model_id,
            price_type=p.price_type,
            price_usd=float(p.price_usd),
            is_active=p.is_active,
        )
        for p in prices
    ]


@router.get("/models", response_model=List[ModelProvidersResponse])
async def list_models_with_providers(
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin_user),
):
    query = select(ModelProviderPrice).order_by(ModelProviderPrice.model_name, ModelProviderPrice.provider)
    result = await db.execute(query)
    prices = result.scalars().all()
    
    models_dict = {}
    for p in prices:
        if p.model_name not in models_dict:
            models_dict[p.model_name] = {
                "model_name": p.model_name,
                "current_provider": "kie" if any(pr.provider == "kie" and pr.is_active for pr in prices if pr.model_name == p.model_name) else "replicate",
                "providers": [],
            }
        models_dict[p.model_name]["providers"].append(
            ProviderPriceResponse(
                id=str(p.id),
                model_name=p.model_name,
                provider=p.provider,
                replicate_model_id=p.replicate_model_id,
                price_type=p.price_type,
                price_usd=float(p.price_usd),
                is_active=p.is_active,
            )
        )
    
    active_providers = {}
    for p in prices:
        if p.is_active:
            if p.model_name not in active_providers:
                active_providers[p.model_name] = p.provider
    
    for model_name in models_dict:
        if model_name in active_providers:
            models_dict[model_name]["current_provider"] = active_providers[model_name]
    
    return list(models_dict.values())


@router.put("/prices/{price_id}", response_model=ProviderPriceResponse)
async def update_provider_price(
    price_id: UUID,
    data: ProviderPriceUpdate,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin_user),
):
    result = await db.execute(
        select(ModelProviderPrice).where(ModelProviderPrice.id == price_id)
    )
    price = result.scalar_one_or_none()
    
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")
    
    if data.price_usd is not None:
        price.price_usd = Decimal(str(data.price_usd))
    if data.is_active is not None:
        price.is_active = data.is_active
    
    await db.commit()
    await db.refresh(price)
    
    return ProviderPriceResponse(
        id=str(price.id),
        model_name=price.model_name,
        provider=price.provider,
        replicate_model_id=price.replicate_model_id,
        price_type=price.price_type,
        price_usd=float(price.price_usd),
        is_active=price.is_active,
    )


@router.post("/switch")
async def switch_model_provider(
    data: SwitchProviderRequest,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin_user),
):
    result = await db.execute(
        select(ModelProviderPrice).where(
            ModelProviderPrice.model_name == data.model_name,
            ModelProviderPrice.provider == data.new_provider,
        )
    )
    new_provider_price = result.scalar_one_or_none()
    
    if not new_provider_price:
        raise HTTPException(
            status_code=404,
            detail=f"Provider '{data.new_provider}' not found for model '{data.model_name}'"
        )
    
    await db.execute(
        update(ModelProviderPrice)
        .where(ModelProviderPrice.model_name == data.model_name)
        .values(is_active=False)
    )
    
    new_provider_price.is_active = True
    await db.commit()
    
    return {
        "success": True,
        "model_name": data.model_name,
        "new_provider": data.new_provider,
        "price_usd": float(new_provider_price.price_usd),
        "replicate_model_id": new_provider_price.replicate_model_id,
    }


@router.get("/active/{model_name}")
async def get_active_provider(
    model_name: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ModelProviderPrice).where(
            ModelProviderPrice.model_name == model_name,
            ModelProviderPrice.is_active == True,
        )
    )
    price = result.scalar_one_or_none()
    
    if not price:
        raise HTTPException(status_code=404, detail=f"No active provider for model '{model_name}'")
    
    return {
        "model_name": price.model_name,
        "provider": price.provider,
        "replicate_model_id": price.replicate_model_id,
        "price_type": price.price_type,
        "price_usd": float(price.price_usd),
    }


@router.post("/prices")
async def create_provider_price(
    model_name: str,
    provider: str,
    price_type: str,
    price_usd: float,
    replicate_model_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin_user),
):
    existing = await db.execute(
        select(ModelProviderPrice).where(
            ModelProviderPrice.model_name == model_name,
            ModelProviderPrice.provider == provider,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Price already exists for this model/provider")
    
    price = ModelProviderPrice(
        model_name=model_name,
        provider=provider,
        replicate_model_id=replicate_model_id,
        price_type=price_type,
        price_usd=Decimal(str(price_usd)),
        is_active=False,
    )
    db.add(price)
    await db.commit()
    await db.refresh(price)
    
    return ProviderPriceResponse(
        id=str(price.id),
        model_name=price.model_name,
        provider=price.provider,
        replicate_model_id=price.replicate_model_id,
        price_type=price.price_type,
        price_usd=float(price.price_usd),
        is_active=price.is_active,
    )
