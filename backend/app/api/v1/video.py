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
from app.workers.polling import poll_task
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
    mode: str = "std"
    character_orientation: str = "image"
    wait_for_result: bool = True


class VideoGenerateResponse(BaseModel):
    ok: bool
    video_url: Optional[str] = None
    task_id: Optional[str] = None
    request_id: Optional[str] = None
    credits_spent: Optional[float] = None
    provider_used: Optional[str] = None
    status: Optional[str] = None
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
        resp = raw_response.get("response", raw_response)
        return resp.get("data", {}).get("taskId")
    return None


def get_adapter_type(model: str) -> str:
    model_lower = model.lower()
    if "veo" in model_lower:
        return "veo"
    elif "hailuo" in model_lower:
        return "hailuo"
    elif "sora" in model_lower:
        return "sora"
    elif "runway" in model_lower:
        return "runway"
    return "default"


def calculate_video_cost(
    price_usd: float,
    price_type: str,
    price_variants: Optional[dict],
    duration: int,
    sound: bool,
    mode: str = "std",
) -> float:
    if price_variants:
        variant_key = f"{duration}s_{'with_sound' if sound else 'no_sound'}"
        variant = price_variants.get(variant_key)
        if variant and "price_usd" in variant:
            return float(variant["price_usd"])
        
        mode_key = "1080p" if mode == "pro" else "720p"
        variant = price_variants.get(mode_key)
        if variant and "price_per_second" in variant:
            return float(variant["price_per_second"]) * duration
    
    if price_type in ("per_generation", "per_request", "per_image"):
        return price_usd
    elif price_type == "per_second":
        return price_usd * duration
    
    return price_usd * duration if price_usd > 0 else 0.05 * duration


@router.post("/generate", response_model=VideoGenerateResponse)
async def generate_video(
    data: VideoGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        adapter, actual_model, provider, price_usd, price_type, price_variants = await get_adapter_for_model(
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

    request_params = {
        "duration": data.duration,
        "aspect_ratio": data.aspect_ratio,
        "sound": data.sound,
        "mode": data.mode,
        "character_orientation": data.character_orientation,
    }

    request_record = Request(
        id=request_id,
        user_id=user.id,
        provider_id=provider_record.id,
        type="video",
        endpoint="/api/v1/video/generate",
        model=normalized_model,
        prompt=data.prompt,
        params=request_params,
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
            "mode": data.mode,
            "character_orientation": data.character_orientation,
            "wait_for_result": data.wait_for_result,
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
            provider_cost = result.provider_cost if result.provider_cost > 0 else calculate_video_cost(
                price_usd, price_type, price_variants, data.duration, data.sound, data.mode
            )
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
                status="completed",
            )
        else:
            if external_task_id and not data.wait_for_result:
                request_record.status = "processing"
                await db.commit()
                
                poll_task.send_with_options(
                    args=(request_id, external_task_id, provider, 1, 120, get_adapter_type(normalized_model)),
                    delay=5000,
                )
                
                return VideoGenerateResponse(
                    ok=True,
                    task_id=external_task_id,
                    request_id=request_id,
                    provider_used=provider,
                    status="processing",
                )
            
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
                status="failed",
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
            status="failed",
        )


@router.post("/generate-async", response_model=VideoGenerateResponse)
async def generate_video_async(
    data: VideoGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        adapter, actual_model, provider, price_usd, price_type, price_variants = await get_adapter_for_model(
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

    estimated_cost = calculate_video_cost(price_usd, price_type, price_variants, data.duration, data.sound, data.mode)
    estimated_credits = estimated_cost * 1000

    request_params = {
        "duration": data.duration,
        "aspect_ratio": data.aspect_ratio,
        "sound": data.sound,
        "mode": data.mode,
        "character_orientation": data.character_orientation,
    }

    request_record = Request(
        id=request_id,
        user_id=user.id,
        provider_id=provider_record.id,
        type="video",
        endpoint="/api/v1/video/generate-async",
        model=normalized_model,
        prompt=data.prompt,
        params=request_params,
        status="processing",
        external_provider=provider,
        credits_spent=Decimal(str(estimated_credits)),
        provider_cost=Decimal(str(estimated_cost)),
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
            "mode": data.mode,
            "character_orientation": data.character_orientation,
            "wait_for_result": False,
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
            
            balance_result = await db.execute(
                select(ProviderBalance).where(ProviderBalance.provider == provider)
            )
            provider_balance = balance_result.scalar_one_or_none()
            if provider_balance:
                provider_balance.balance_usd = provider_balance.balance_usd - Decimal(str(estimated_cost))
                provider_balance.total_spent_usd = provider_balance.total_spent_usd + Decimal(str(estimated_cost))
            
            user.credits_balance = user.credits_balance - Decimal(str(estimated_credits))
            
            await db.commit()

            poll_task.send_with_options(
                args=(request_id, external_task_id, provider, 1, 120, get_adapter_type(normalized_model)),
                delay=5000,
            )

            return VideoGenerateResponse(
                ok=True,
                task_id=external_task_id,
                request_id=request_id,
                credits_spent=estimated_credits,
                provider_used=provider,
                status="processing",
            )
        else:
            request_record.status = "failed"
            request_record.error_code = result.error_code or "NO_TASK_ID"
            request_record.error_message = result.error_message or "Provider did not return task ID"
            request_record.completed_at = datetime.utcnow()

            await log_failed(db, request_id, "NO_TASK_ID", result.error_message or "Provider did not return task ID", result.raw_response)
            await db.commit()

            return VideoGenerateResponse(
                ok=False,
                request_id=request_id,
                error=result.error_message or "Provider did not return task ID",
                provider_used=provider,
                status="failed",
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
            status="failed",
        )


@router.post("/midjourney", response_model=VideoGenerateResponse)
async def generate_midjourney_video(
    data: MidjourneyVideoRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        adapter, actual_model, provider, price_usd, price_type, price_variants = await get_adapter_for_model(
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
                status="completed",
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
                status="failed",
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
            status="failed",
        )