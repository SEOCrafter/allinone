from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
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
from app.services.provider_routing import get_adapter_for_model, normalize_model_name
from app.adapters import AdapterRegistry
from app.config import settings

router = APIRouter()


class GenerateRequest(BaseModel):
    prompt: str
    model: str = "nano-banana-pro"
    negative_prompt: Optional[str] = None
    width: int = 1024
    height: int = 1024
    aspect_ratio: str = "1:1"
    resolution: str = "1K"
    steps: Optional[int] = None
    guidance: Optional[float] = None
    style: Optional[str] = None


class GenerateResponse(BaseModel):
    ok: bool
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None
    request_id: Optional[str] = None
    credits_spent: Optional[float] = None
    provider_used: Optional[str] = None
    error: Optional[str] = None


class ImageToImageRequest(BaseModel):
    prompt: str
    model: str = "midjourney"
    image_url: str
    aspect_ratio: str = "1:1"
    version: str = "7"
    speed: str = "fast"
    stylization: int = 100


class NanoBananaRequest(BaseModel):
    prompt: str
    model: str = "nano-banana-pro"
    aspect_ratio: str = "1:1"
    resolution: str = "1K"
    output_format: str = "png"
    image_input: Optional[List[str]] = None


class MidjourneyRequest(BaseModel):
    prompt: str
    task_type: str = "mj_txt2img"
    file_url: Optional[str] = None
    aspect_ratio: str = "1:1"
    version: str = "7"
    speed: str = "fast"
    stylization: int = 100
    weirdness: int = 0


@router.post("/generate", response_model=GenerateResponse)
async def generate_image(
    data: GenerateRequest,
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
            type="image",
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
        type="image",
        endpoint="/api/v1/images/generate",
        model=normalized_model,
        prompt=data.prompt,
        status="processing",
    )
    db.add(request_record)
    await db.flush()

    try:
        params = {
            "model": actual_model,
            "aspect_ratio": data.aspect_ratio,
            "resolution": data.resolution,
            "width": data.width,
            "height": data.height,
        }
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

            await db.commit()

            image_url = result.content if isinstance(result.content, str) else result.content.get('url', '') if result.content else ''
            image_urls = result.result_urls if hasattr(result, 'result_urls') and result.result_urls else None

            return GenerateResponse(
                ok=True,
                image_url=image_url,
                image_urls=image_urls,
                request_id=request_id,
                credits_spent=credits_spent,
                provider_used=provider,
            )
        else:
            request_record.status = "failed"
            request_record.error_code = result.error_code
            request_record.error_message = result.error_message
            await db.commit()

            return GenerateResponse(
                ok=False,
                error=result.error_message,
                provider_used=provider,
            )

    except Exception as e:
        request_record.status = "failed"
        request_record.error_message = str(e)
        await db.commit()

        return GenerateResponse(
            ok=False,
            error=str(e),
            provider_used=provider,
        )


@router.post("/nano-banana", response_model=GenerateResponse)
async def generate_nano_banana(
    data: NanoBananaRequest,
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
            display_name="Nano Banana Pro",
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
        type="image",
        endpoint="/api/v1/images/nano-banana",
        model=data.model,
        prompt=data.prompt,
        status="processing",
    )
    db.add(request_record)
    await db.flush()

    try:
        params = {
            "model": actual_model,
            "aspect_ratio": data.aspect_ratio,
            "resolution": data.resolution,
            "output_format": data.output_format,
        }
        if data.image_input:
            params["image_input"] = data.image_input
            params["image_urls"] = data.image_input

        result = await adapter.generate(data.prompt, **params)

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

            await db.commit()

            return GenerateResponse(
                ok=True,
                image_url=result.content,
                request_id=request_id,
                credits_spent=credits_spent,
                provider_used=provider,
            )
        else:
            request_record.status = "failed"
            request_record.error_code = result.error_code
            request_record.error_message = result.error_message
            await db.commit()

            return GenerateResponse(
                ok=False,
                error=result.error_message,
                provider_used=provider,
            )

    except Exception as e:
        request_record.status = "failed"
        request_record.error_message = str(e)
        await db.commit()

        return GenerateResponse(
            ok=False,
            error=str(e),
            provider_used=provider,
        )


@router.post("/midjourney", response_model=GenerateResponse)
async def generate_midjourney(
    data: MidjourneyRequest,
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
        type="image",
        endpoint="/api/v1/images/midjourney",
        model=data.task_type,
        prompt=data.prompt,
        status="processing",
    )
    db.add(request_record)
    await db.flush()

    try:
        if provider == "kie":
            result = await adapter.generate(
                prompt=data.prompt,
                task_type=data.task_type,
                file_url=data.file_url,
                aspect_ratio=data.aspect_ratio,
                version=data.version,
                speed=data.speed,
                stylization=data.stylization,
                weirdness=data.weirdness,
            )
        else:
            params = {
                "model": actual_model,
                "aspect_ratio": data.aspect_ratio,
            }
            if data.file_url:
                params["image_urls"] = [data.file_url]
            result = await adapter.generate(data.prompt, **params)

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

            await db.commit()

            return GenerateResponse(
                ok=True,
                image_url=result.content,
                request_id=request_id,
                credits_spent=credits_spent,
                provider_used=provider,
            )
        else:
            request_record.status = "failed"
            request_record.error_code = result.error_code
            request_record.error_message = result.error_message
            await db.commit()

            return GenerateResponse(
                ok=False,
                error=result.error_message,
                provider_used=provider,
            )

    except Exception as e:
        request_record.status = "failed"
        request_record.error_message = str(e)
        await db.commit()

        return GenerateResponse(
            ok=False,
            error=str(e),
            provider_used=provider,
        )


@router.post("/image-to-image", response_model=GenerateResponse)
async def image_to_image(
    data: ImageToImageRequest,
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
        type="image",
        endpoint="/api/v1/images/image-to-image",
        model=data.model,
        prompt=data.prompt,
        status="processing",
    )
    db.add(request_record)
    await db.flush()

    try:
        if provider == "kie" and hasattr(adapter, 'image_to_image'):
            result = await adapter.image_to_image(
                prompt=data.prompt,
                image_url=data.image_url,
                aspect_ratio=data.aspect_ratio,
                version=data.version,
                speed=data.speed,
                stylization=data.stylization,
            )
        else:
            result = await adapter.generate(
                prompt=data.prompt,
                model=actual_model,
                image_urls=[data.image_url],
                aspect_ratio=data.aspect_ratio,
            )

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

            await db.commit()

            return GenerateResponse(
                ok=True,
                image_url=result.content,
                request_id=request_id,
                credits_spent=credits_spent,
                provider_used=provider,
            )
        else:
            request_record.status = "failed"
            request_record.error_code = result.error_code
            request_record.error_message = result.error_message
            await db.commit()

            return GenerateResponse(
                ok=False,
                error=result.error_message,
                provider_used=provider,
            )

    except Exception as e:
        request_record.status = "failed"
        request_record.error_message = str(e)
        await db.commit()

        return GenerateResponse(
            ok=False,
            error=str(e),
            provider_used=provider,
        )


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