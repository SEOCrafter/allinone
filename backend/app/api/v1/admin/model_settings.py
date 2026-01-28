from typing import Optional
from decimal import Decimal
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.api.deps import get_admin_user
from app.models.user import User
from app.models.model_setting import ModelSetting
import uuid

router = APIRouter()


class UpdateModelSettingRequest(BaseModel):
    credits_price: Optional[float] = None
    is_enabled: Optional[bool] = None


@router.get("/models/settings")
async def get_all_model_settings(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ModelSetting))
    settings = result.scalars().all()
    
    settings_map = {}
    for s in settings:
        key = f"{s.provider}:{s.model_id}"
        settings_map[key] = s.to_dict()
    
    return {"ok": True, "settings": settings_map}


@router.post("/models/{provider}/{model_id}/settings")
async def update_model_setting(
    provider: str,
    model_id: str,
    data: UpdateModelSettingRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ModelSetting).where(
            ModelSetting.provider == provider,
            ModelSetting.model_id == model_id
        )
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        setting = ModelSetting(
            id=uuid.uuid4(),
            provider=provider,
            model_id=model_id,
            credits_price=Decimal(str(data.credits_price)) if data.credits_price is not None else None,
            is_enabled=data.is_enabled if data.is_enabled is not None else True,
        )
        db.add(setting)
    else:
        if data.credits_price is not None:
            setting.credits_price = Decimal(str(data.credits_price))
        if data.is_enabled is not None:
            setting.is_enabled = data.is_enabled
    
    await db.commit()
    await db.refresh(setting)
    
    return {"ok": True, "setting": setting.to_dict()}
