from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.request import Request
from app.models.provider import Provider
from app.models.provider_balance import ProviderBalance
from app.services.provider_routing import get_adapter_for_model, normalize_model_name
from app.services.task_events import log_created, log_sent_to_provider, log_completed, log_failed
from app.adapters import AdapterRegistry
from app.config import settings

router = APIRouter()


class VideoGenerateRequest(BaseModel):
    prompt: str
    model: str = "kling-2.6-t2v"
    image_urls: Optional[List[str]] = None
    video_urls: Optional[List[str]] = None
    duration: int = 5
    aspect_ratio: str = "16:9"
    sound: bool = False


class VideoGenerateResponse(BaseModel):
    ok: bool
    video_url: Optional[str] = None
    task_id: Optional[str] = None
    request_id: Optional[str] = None
    credits_spent: Optional[float] = None
    provider_used: Optional[str] = None
    error: Optional[str] = None


class MidjourneyVideoRequest(BaseModel):
    prompt: str
    image_url: str
    model: str = "mj_video"


def extract_task_id(raw_response: dict, provider: str) -> Optional[str]:
    if not raw_response:
        return None
    if provider == "replicate":
        return raw_response.get("id")
    elif provider == "kie":
        return raw_response.get("data", {}).get("taskId")
    return None


@router.post("/generate", response_model=VideoGenerateResponse)
async def generate_video(
    data: VideoGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        adapter, actual_model, provider, price_usd = await get_adapter_for_model(
            db=db,
            model_name=data.model,
            fallback_provider="kie",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    provider_result = await db.execute(
        select(Provider).where(Provider.name == provider)
    )
    provider_record = provider_result.scalar_one_or_none()

    if not provider_record:
        provider_record = Provider(
            id=str(uuid.uuid4()),
            name=provider,
            display_name=provider.upper(),
            type="video",
            is_active=True,
        )
        db.add(provider_record)
        await db.flush()

    request_id = str(uuid.uuid4())
    normalized_model = normalize_model_name(data.model)

    request_record = Request(
        id=request_id,
        user_id=user.id,
        provider_id=provider_record.id,
        type="video",
        endpoint="/api/v1/video/generate",
        model=normalized_model,
        prompt=data.prompt,
        status="processing",
        external_provider=provider,
        started_at=datetime.utcnow(),
    )
    db.add(request_record)
    await db.flush()

    await log_created(db, request_id, provider, normalized_model)

    try:
        params = {
            "model": actual_model,
            "duration": data.duration,
            "aspect_ratio": data.aspect_ratio,
            "sound": data.sound,
        }

        if data.image_urls:
            params["image_urls"] = data.image_urls
        if data.video_urls:
            params["video_urls"] = data.video_urls

        result = await adapter.generate(data.prompt, **params)

        external_task_id = extract_task_id(result.raw_response, provider)
        if external_task_id:
            request_record.external_task_id = external_task_id
            await log_sent_to_provider(db, request_id, external_task_id, provider, result.raw_response)

        if result.success:
            provider_cost = result.provider_cost if result.provider_cost > 0 else price_usd
            credits_spent = provider_cost * 1000

            balance_result = await db.execute(
                select(ProviderBalance).where(ProviderBalance.provider == provider)
            )
            provider_balance = balance_result.scalar_one_or_none()
            if provider_balance:
                provider_balance.balance_usd = provider_balance.balance_usd - Decimal(str(provider_cost))
                provider_balance.total_spent_usd = provider_balance.total_spent_usd + Decimal(str(provider_cost))

            user.credits_balance = user.credits_balance - Decimal(str(credits_spent))

            request_record.status = "completed"
            request_record.credits_spent = Decimal(str(credits_spent))
            request_record.provider_cost = Decimal(str(provider_cost))
            request_record.result_url = result.content
            request_record.result_urls = result.result_urls
            request_record.completed_at = datetime.utcnow()

            await log_completed(db, request_id, result.content, result.result_urls, result.raw_response)

            await db.commit()

            return VideoGenerateResponse(
                ok=True,
                video_url=result.content,
                task_id=external_task_id,
                request_id=request_id,
                credits_spent=credits_spent,
                provider_used=provider,
            )
        else:
            request_record.status = "failed"
            request_record.error_code = result.error_code
            request_record.error_message = result.error_message
            request_record.completed_at = datetime.utcnow()

            await log_failed(db, request_id, result.error_code or "UNKNOWN", result.error_message or "Unknown error", result.raw_response)

            await db.commit()

            return VideoGenerateResponse(
                ok=False,
                task_id=external_task_id,
                request_id=request_id,
                error=result.error_message,
                provider_used=provider,
            )

    except Exception as e:
        request_record.status = "failed"
        request_record.error_message = str(e)
        request_record.completed_at = datetime.utcnow()

        await log_failed(db, request_id, "EXCEPTION", str(e))

        await db.commit()

        return VideoGenerateResponse(
            ok=False,
            request_id=request_id,
            error=str(e),
            provider_used=provider,
        )


@router.post("/midjourney", response_model=VideoGenerateResponse)
async def generate_midjourney_video(
    data: MidjourneyVideoRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        adapter, actual_model, provider, price_usd = await get_adapter_for_model(
            db=db,
            model_name="midjourney",
            fallback_provider="kie",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    provider_result = await db.execute(
        select(Provider).where(Provider.name == provider)
    )
    provider_record = provider_result.scalar_one_or_none()

    if not provider_record:
        provider_record = Provider(
            id=str(uuid.uuid4()),
            name=provider,
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
        external_provider=provider,
        started_at=datetime.utcnow(),
    )
    db.add(request_record)
    await db.flush()

    await log_created(db, request_id, provider, "mj_video")

    try:
        if hasattr(adapter, 'image_to_video'):
            result = await adapter.image_to_video(
                image_url=data.image_url,
                prompt=data.prompt,
            )
        else:
            result = await adapter.generate(
                prompt=data.prompt,
                image_urls=[data.image_url],
                model=actual_model,
            )

        external_task_id = extract_task_id(result.raw_response, provider)
        if external_task_id:
            request_record.external_task_id = external_task_id
            await log_sent_to_provider(db, request_id, external_task_id, provider, result.raw_response)

        if result.success:
            provider_cost = result.provider_cost if result.provider_cost > 0 else price_usd
            credits_spent = provider_cost * 1000

            balance_result = await db.execute(
                select(ProviderBalance).where(ProviderBalance.provider == provider)
            )
            provider_balance = balance_result.scalar_one_or_none()
            if provider_balance:
                provider_balance.balance_usd = provider_balance.balance_usd - Decimal(str(provider_cost))
                provider_balance.total_spent_usd = provider_balance.total_spent_usd + Decimal(str(provider_cost))

            user.credits_balance = user.credits_balance - Decimal(str(credits_spent))

            request_record.status = "completed"
            request_record.credits_spent = Decimal(str(credits_spent))
            request_record.provider_cost = Decimal(str(provider_cost))
            request_record.result_url = result.content
            request_record.result_urls = result.result_urls
            request_record.completed_at = datetime.utcnow()

            await log_completed(db, request_id, result.content, result.result_urls, result.raw_response)

            await db.commit()

            return VideoGenerateResponse(
                ok=True,
                video_url=result.content,
                task_id=external_task_id,
                request_id=request_id,
                credits_spent=credits_spent,
                provider_used=provider,
            )
        else:
            request_record.status = "failed"
            request_record.error_code = result.error_code
            request_record.error_message = result.error_message
            request_record.completed_at = datetime.utcnow()

            await log_failed(db, request_id, result.error_code or "UNKNOWN", result.error_message or "Unknown error", result.raw_response)

            await db.commit()

            return VideoGenerateResponse(
                ok=False,
                task_id=external_task_id,
                request_id=request_id,
                error=result.error_message,
                provider_used=provider,
            )

    except Exception as e:
        request_record.status = "failed"
        request_record.error_message = str(e)
        request_record.completed_at = datetime.utcnow()

        await log_failed(db, request_id, "EXCEPTION", str(e))

        await db.commit()

        return VideoGenerateResponse(
            ok=False,
            request_id=request_id,
            error=str(e),
            provider_used=provider,
        )