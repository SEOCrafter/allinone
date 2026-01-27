from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
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


class VideoGenerateRequest(BaseModel):
    prompt: str
    provider: str = "kling"
    model: str = "kling-2.6/text-to-video"
    image_urls: Optional[List[str]] = None
    video_urls: Optional[List[str]] = None
    duration: str = "5"
    aspect_ratio: str = "16:9"
    sound: bool = False


class VideoGenerateResponse(BaseModel):
    ok: bool
    video_url: Optional[str] = None
    task_id: Optional[str] = None
    request_id: Optional[str] = None
    credits_spent: Optional[float] = None
    error: Optional[str] = None


class MidjourneyVideoRequest(BaseModel):
    prompt: str
    image_url: str
    model: str = "mj_video"


def get_api_key(provider: str) -> Optional[str]:
    key_map = {
        "kling": settings.KIE_API_KEY,
        "midjourney": settings.KIE_API_KEY,
        "nano_banana": settings.KIE_API_KEY,
    }
    return key_map.get(provider)


@router.post("/generate", response_model=VideoGenerateResponse)
async def generate_video(
    data: VideoGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    api_key = get_api_key(data.provider)
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
        provider_record = Provider(
            id=str(uuid.uuid4()),
            name=data.provider,
            display_name=adapter.display_name,
            type="video",
            is_active=True,
        )
        db.add(provider_record)
        await db.flush()

    request_id = str(uuid.uuid4())

    request_record = Request(
        id=request_id,
        user_id=user.id,
        provider_id=provider_record.id,
        type="video",
        endpoint="/api/v1/video/generate",
        model=data.model,
        prompt=data.prompt,
        status="processing",
    )
    db.add(request_record)
    await db.flush()

    try:
        params = {
            "model": data.model,
            "duration": data.duration,
            "aspect_ratio": data.aspect_ratio,
            "sound": data.sound,
        }

        if data.image_urls:
            params["image_urls"] = data.image_urls
        if data.video_urls:
            params["video_urls"] = data.video_urls

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

            return VideoGenerateResponse(
                ok=True,
                video_url=result.content,
                request_id=request_id,
                credits_spent=credits_spent,
            )
        else:
            request_record.status = "failed"
            request_record.error_code = result.error_code
            request_record.error_message = result.error_message
            await db.commit()

            return VideoGenerateResponse(
                ok=False,
                error=result.error_message,
            )

    except Exception as e:
        request_record.status = "failed"
        request_record.error_message = str(e)
        await db.commit()

        return VideoGenerateResponse(
            ok=False,
            error=str(e),
        )


@router.post("/midjourney", response_model=VideoGenerateResponse)
async def generate_midjourney_video(
    data: MidjourneyVideoRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    api_key = settings.KIE_API_KEY
    if not api_key:
        raise HTTPException(status_code=400, detail="Midjourney not configured")

    adapter = AdapterRegistry.get_adapter("midjourney", api_key)
    if not adapter:
        raise HTTPException(status_code=400, detail="Midjourney adapter not found")

    provider_result = await db.execute(
        select(Provider).where(Provider.name == "midjourney")
    )
    provider_record = provider_result.scalar_one_or_none()

    if not provider_record:
        provider_record = Provider(
            id=str(uuid.uuid4()),
            name="midjourney",
            display_name="Midjourney",
            type="image",
            is_active=True,
        )
        db.add(provider_record)
        await db.flush()

    request_id = str(uuid.uuid4())

    request_record = Request(
        id=request_id,
        user_id=user.id,
        provider_id=provider_record.id,
        type="video",
        endpoint="/api/v1/video/midjourney",
        model="mj_video",
        prompt=data.prompt,
        status="processing",
    )
    db.add(request_record)
    await db.flush()

    try:
        result = await adapter.image_to_video(
            image_url=data.image_url,
            prompt=data.prompt,
        )

        if result.success:
            credits_spent = result.provider_cost * 1000

            balance_result = await db.execute(
                select(ProviderBalance).where(ProviderBalance.provider == "midjourney")
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

            return VideoGenerateResponse(
                ok=True,
                video_url=result.content,
                request_id=request_id,
                credits_spent=credits_spent,
            )
        else:
            request_record.status = "failed"
            request_record.error_code = result.error_code
            request_record.error_message = result.error_message
            await db.commit()

            return VideoGenerateResponse(
                ok=False,
                error=result.error_message,
            )

    except Exception as e:
        request_record.status = "failed"
        request_record.error_message = str(e)
        await db.commit()

        return VideoGenerateResponse(
            ok=False,
            error=str(e),
        )
