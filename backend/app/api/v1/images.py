from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.request import Request
from app.models.provider import Provider
from app.models.provider_balance import ProviderBalance
from app.adapters import AdapterRegistry
from app.config import settings

router = APIRouter()


class GenerateRequest(BaseModel):
    prompt: str
    provider: str = "openai"
    model: Optional[str] = None
    negative_prompt: Optional[str] = None
    width: int = 1024
    height: int = 1024
    steps: Optional[int] = None
    guidance: Optional[float] = None
    style: Optional[str] = None


class GenerateResponse(BaseModel):
    ok: bool
    image_url: Optional[str] = None
    request_id: Optional[str] = None
    credits_spent: Optional[float] = None
    error: Optional[str] = None


class ImageToImageRequest(BaseModel):
    prompt: str
    provider: str = "openai"
    model: Optional[str] = None
    image_url: str
    strength: float = 0.7


@router.post("/generate", response_model=GenerateResponse)
async def generate_image(
    data: GenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    api_keys = {
        "openai": settings.OPENAI_API_KEY,
        "midjourney": getattr(settings, 'MIDJOURNEY_API_KEY', None),
        "nanobanana": getattr(settings, 'NANOBANANA_API_KEY', None),
        "stability": getattr(settings, 'STABILITY_API_KEY', None),
    }
    
    api_key = api_keys.get(data.provider)
    if not api_key:
        raise HTTPException(status_code=400, detail=f"Provider {data.provider} not configured")
    
    adapter = AdapterRegistry.get_adapter(data.provider, api_key)
    if not adapter:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {data.provider}")
    
    provider_result = await db.execute(
        select(Provider).where(Provider.name == data.provider)
    )
    provider_record = provider_result.scalar_one_or_none()
    
    if not provider_record:
        raise HTTPException(status_code=400, detail=f"Provider {data.provider} not found in database")
    
    request_id = str(uuid.uuid4())
    model = data.model or getattr(adapter, 'default_model', 'dall-e-3')
    
    request_record = Request(
        id=request_id,
        user_id=user.id,
        provider_id=provider_record.id,
        type="image",
        endpoint="/api/v1/images/generate",
        model=model,
        prompt=data.prompt,
        status="processing",
    )
    db.add(request_record)
    await db.flush()
    
    try:
        params = {
            "width": data.width,
            "height": data.height,
        }
        if data.model:
            params["model"] = data.model
        if data.negative_prompt:
            params["negative_prompt"] = data.negative_prompt
        if data.steps:
            params["steps"] = data.steps
        if data.guidance:
            params["guidance"] = data.guidance
        if data.style:
            params["style"] = data.style
        
        if hasattr(adapter, 'generate_image'):
            result = await adapter.generate_image(data.prompt, **params)
        else:
            result = await adapter.generate(data.prompt, **params)
        
        if result.success:
            credits_spent = result.provider_cost * 1000
            
            balance_result = await db.execute(
                select(ProviderBalance).where(ProviderBalance.provider == data.provider)
            )
            provider_balance = balance_result.scalar_one_or_none()
            if provider_balance:
                provider_balance.balance_usd = provider_balance.balance_usd - Decimal(str(result.provider_cost))
                provider_balance.total_spent_usd = provider_balance.total_spent_usd + Decimal(str(result.provider_cost))
            
            user.credits_balance = user.credits_balance - Decimal(str(credits_spent))
            
            request_record.status = "completed"
            request_record.credits_spent = Decimal(str(credits_spent))
            request_record.provider_cost = Decimal(str(result.provider_cost))
            
            await db.commit()
            
            image_url = result.content if isinstance(result.content, str) else result.content.get('url', '')
            
            return GenerateResponse(
                ok=True,
                image_url=image_url,
                request_id=request_id,
                credits_spent=credits_spent,
            )
        else:
            request_record.status = "failed"
            request_record.error_code = result.error_code
            request_record.error_message = result.error_message
            await db.commit()
            
            return GenerateResponse(
                ok=False,
                error=result.error_message,
            )
            
    except Exception as e:
        request_record.status = "failed"
        request_record.error_message = str(e)
        await db.commit()
        
        return GenerateResponse(
            ok=False,
            error=str(e),
        )


@router.post("/image-to-image", response_model=GenerateResponse)
async def image_to_image(
    data: ImageToImageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    api_keys = {
        "openai": settings.OPENAI_API_KEY,
        "midjourney": getattr(settings, 'MIDJOURNEY_API_KEY', None),
        "stability": getattr(settings, 'STABILITY_API_KEY', None),
    }
    
    api_key = api_keys.get(data.provider)
    if not api_key:
        raise HTTPException(status_code=400, detail=f"Provider {data.provider} not configured")
    
    adapter = AdapterRegistry.get_adapter(data.provider, api_key)
    if not adapter:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {data.provider}")
    
    provider_result = await db.execute(
        select(Provider).where(Provider.name == data.provider)
    )
    provider_record = provider_result.scalar_one_or_none()
    
    if not provider_record:
        raise HTTPException(status_code=400, detail=f"Provider {data.provider} not found")
    
    request_id = str(uuid.uuid4())
    
    request_record = Request(
        id=request_id,
        user_id=user.id,
        provider_id=provider_record.id,
        type="image",
        endpoint="/api/v1/images/image-to-image",
        model=data.model or "img2img",
        prompt=data.prompt,
        status="processing",
    )
    db.add(request_record)
    await db.flush()
    
    try:
        if hasattr(adapter, 'image_to_image'):
            result = await adapter.image_to_image(
                prompt=data.prompt,
                image_url=data.image_url,
                strength=data.strength,
                model=data.model,
            )
        else:
            request_record.status = "failed"
            request_record.error_message = "Provider does not support image-to-image"
            await db.commit()
            return GenerateResponse(ok=False, error="Provider does not support image-to-image")
        
        if result.success:
            credits_spent = result.provider_cost * 1000
            
            user.credits_balance = user.credits_balance - Decimal(str(credits_spent))
            request_record.status = "completed"
            request_record.credits_spent = Decimal(str(credits_spent))
            request_record.provider_cost = Decimal(str(result.provider_cost))
            
            await db.commit()
            
            return GenerateResponse(
                ok=True,
                image_url=result.content,
                request_id=request_id,
                credits_spent=credits_spent,
            )
        else:
            request_record.status = "failed"
            request_record.error_message = result.error_message
            await db.commit()
            
            return GenerateResponse(ok=False, error=result.error_message)
            
    except Exception as e:
        request_record.status = "failed"
        request_record.error_message = str(e)
        await db.commit()
        return GenerateResponse(ok=False, error=str(e))


@router.post("/remove-background", response_model=GenerateResponse)
async def remove_background(
    file_url: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raise HTTPException(status_code=501, detail="Not implemented yet")


@router.post("/upscale", response_model=GenerateResponse)
async def upscale(
    file_url: str,
    scale: int = 2,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raise HTTPException(status_code=501, detail="Not implemented yet")