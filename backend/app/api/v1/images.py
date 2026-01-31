from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, field_validator
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

ALLOWED_ASPECT_RATIOS = {
    "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", 
    "4:5", "5:4", "21:9", "9:21", "16:10", "10:16"
}

ASPECT_RATIO_MAPPING = {
    "16:10": "16:9",
    "10:16": "9:16",
}

class GenerateRequest(BaseModel):
    prompt: str
    model: str = "nano-banana-pro"
    negative_prompt: Optional[str] = None
    width: int = 1024
    height: int = 1024
    aspect_ratio: str = "1:1"
    resolution: Optional[str] = None
    steps: Optional[int] = None
    guidance: Optional[float] = None
    cfg: Optional[float] = None
    style: Optional[str] = None
    output_format: str = "png"
    image_input: Optional[List[str]] = None
    seed: Optional[int] = None
    prompt_strength: Optional[float] = None
    num_outputs: int = 1
    wait_for_result: bool = False

    @field_validator("aspect_ratio")
    @classmethod
    def validate_aspect_ratio(cls, v: str) -> str:
        v = v.strip()
        if v in ASPECT_RATIO_MAPPING:
            return ASPECT_RATIO_MAPPING[v]
        if v not in ALLOWED_ASPECT_RATIOS:
            allowed = ", ".join(sorted(ALLOWED_ASPECT_RATIOS))
            raise ValueError(f"aspect_ratio must be one of: {allowed}")
        return v

    @field_validator("cfg")
    @classmethod
    def validate_cfg(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v < 1 or v > 10):
            raise ValueError("cfg must be between 1 and 10")
        return v

    @field_validator("prompt_strength")
    @classmethod
    def validate_prompt_strength(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v < 0 or v > 1):
            raise ValueError("prompt_strength must be between 0 and 1")
        return v

    @field_validator("resolution")
    @classmethod
    def validate_resolution(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        allowed = {"1K", "2K", "4K", "512", "768", "1024", "1080p", "720p", "0.5 MP", "1 MP", "2 MP", "4 MP", "match_input_image"}
        if v not in allowed:
            return None
        return v

    @field_validator("output_format")
    @classmethod
    def validate_output_format(cls, v: str) -> str:
        allowed = {"png", "jpg", "jpeg", "webp"}
        v = v.lower()
        if v not in allowed:
            return "png"
        return v

    @field_validator("num_outputs")
    @classmethod
    def validate_num_outputs(cls, v: int) -> int:
        if v < 1:
            return 1
        if v > 4:
            return 4
        return v

class GenerateResponse(BaseModel):
    ok: bool
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None
    task_id: Optional[str] = None
    request_id: Optional[str] = None
    credits_spent: Optional[float] = None
    provider_used: Optional[str] = None
    status: Optional[str] = None
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
    resolution: Optional[str] = None
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


def extract_task_id(raw_response: dict, provider: str) -> Optional[str]:
    if not raw_response:
        return None
    if provider == "replicate":
        return raw_response.get("id")
    elif provider == "kie":
        resp = raw_response.get("response", raw_response)
        return resp.get("data", {}).get("taskId")
    return None


def get_image_adapter_type(model: str) -> str:
    model_lower = model.lower()
    if "nano-banana" in model_lower:
        return "nano_banana"
    elif "midjourney" in model_lower:
        return "midjourney"
    elif "flux" in model_lower:
        return "flux"
    elif "imagen" in model_lower:
        return "imagen"
    elif "sd-" in model_lower or "stable-diffusion" in model_lower:
        return "stable_diffusion"
    elif "face-swap" in model_lower:
        return "face_swap"
    elif "runway" in model_lower:
        return "runway"
    elif "luma" in model_lower:
        return "luma"
    elif "minimax" in model_lower:
        return "minimax"
    return "default"


def calculate_image_cost(
    price_usd: float,
    price_type: str,
    price_variants: Optional[dict],
    resolution: str = "1K",
    num_images: int = 1,
) -> float:
    if price_variants:
        variant = price_variants.get(resolution)
        if variant and "price_usd" in variant:
            return float(variant["price_usd"]) * num_images
    
    if price_type in ("per_image", "per_request", "per_generation"):
        return price_usd * num_images
    
    return price_usd if price_usd > 0 else 0.05


def build_generate_params(data: GenerateRequest, actual_model: str, wait: bool = None) -> dict:
    params = {
        "model": actual_model,
        "aspect_ratio": data.aspect_ratio,
        "resolution": data.resolution,
        "output_format": data.output_format,
        "width": data.width,
        "height": data.height,
        "wait_for_result": wait if wait is not None else data.wait_for_result,
    }
    if data.negative_prompt:
        params["negative_prompt"] = data.negative_prompt
    if data.steps is not None:
        params["steps"] = data.steps
    if data.guidance is not None:
        params["guidance"] = data.guidance
    if data.cfg is not None:
        params["cfg"] = data.cfg
    if data.style:
        params["style"] = data.style
    if data.image_input:
        params["image_input"] = data.image_input
        params["image_urls"] = data.image_input
    if data.seed is not None:
        params["seed"] = data.seed
    if data.prompt_strength is not None:
        params["prompt_strength"] = data.prompt_strength
    if data.num_outputs > 1:
        params["num_outputs"] = data.num_outputs
    return params


@router.post("/generate", response_model=GenerateResponse)
async def generate_image(
    data: GenerateRequest,
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
            type="image",
            is_active=True,
        )
        db.add(provider_record)
        await db.flush()

    request_id = str(uuid.uuid4())
    normalized_model = normalize_model_name(data.model)

    request_params = {
        "aspect_ratio": data.aspect_ratio,
        "resolution": data.resolution,
        "output_format": data.output_format,
    }

    request_record = Request(
        id=request_id,
        user_id=user.id,
        provider_id=provider_record.id,
        type="image",
        endpoint="/api/v1/images/generate",
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
        params = build_generate_params(data, actual_model)
        result = await adapter.generate(data.prompt, **params)

        external_task_id = extract_task_id(result.raw_response, provider)
        if external_task_id:
            request_record.external_task_id = external_task_id
            await log_sent_to_provider(db, request_id, external_task_id, provider, result.raw_response)

        if result.success:
            provider_cost = result.provider_cost if result.provider_cost > 0 else calculate_image_cost(
                price_usd, price_type, price_variants, data.resolution, data.num_outputs
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

            image_url = result.content if isinstance(result.content, str) else result.content.get('url', '') if result.content else ''
            image_urls = result.result_urls if hasattr(result, 'result_urls') and result.result_urls else None

            request_record.status = "completed"
            request_record.credits_spent = Decimal(str(credits_spent))
            request_record.provider_cost = Decimal(str(provider_cost))
            request_record.result_url = image_url
            request_record.result_urls = image_urls
            request_record.completed_at = datetime.utcnow()

            await log_completed(db, request_id, image_url, image_urls, result.raw_response)
            await db.commit()

            return GenerateResponse(
                ok=True,
                image_url=image_url,
                image_urls=image_urls,
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
                    args=(request_id, external_task_id, provider, 1, 120, get_image_adapter_type(normalized_model)),
                    delay=5000,
                )
                
                return GenerateResponse(
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

            return GenerateResponse(
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

        return GenerateResponse(
            ok=False,
            request_id=request_id,
            error=str(e),
            provider_used=provider,
            status="failed",
        )


@router.post("/generate-async", response_model=GenerateResponse)
async def generate_image_async(
    data: GenerateRequest,
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
            type="image",
            is_active=True,
        )
        db.add(provider_record)
        await db.flush()

    request_id = str(uuid.uuid4())
    normalized_model = normalize_model_name(data.model)

    estimated_cost = calculate_image_cost(price_usd, price_type, price_variants, data.resolution, data.num_outputs)
    estimated_credits = estimated_cost * 1000

    request_params = {
        "aspect_ratio": data.aspect_ratio,
        "resolution": data.resolution,
        "output_format": data.output_format,
    }

    request_record = Request(
        id=request_id,
        user_id=user.id,
        provider_id=provider_record.id,
        type="image",
        endpoint="/api/v1/images/generate-async",
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
        params = build_generate_params(data, actual_model, wait=False)
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
                args=(request_id, external_task_id, provider, 1, 60, get_image_adapter_type(normalized_model)),
                delay=3000,
            )

            return GenerateResponse(
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

            return GenerateResponse(
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

        return GenerateResponse(
            ok=False,
            request_id=request_id,
            error=str(e),
            provider_used=provider,
            status="failed",
        )


@router.post("/nano-banana", response_model=GenerateResponse)
async def generate_nano_banana(
    data: NanoBananaRequest,
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
            display_name="Nano Banana Pro",
            type="image",
            is_active=True,
        )
        db.add(provider_record)
        await db.flush()

    request_id = str(uuid.uuid4())
    normalized_model = normalize_model_name(data.model)

    estimated_cost = calculate_image_cost(price_usd, price_type, price_variants, data.resolution)
    estimated_credits = estimated_cost * 1000

    request_record = Request(
        id=request_id,
        user_id=user.id,
        provider_id=provider_record.id,
        type="image",
        endpoint="/api/v1/images/nano-banana",
        model=normalized_model,
        prompt=data.prompt,
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
            "aspect_ratio": data.aspect_ratio,
            "resolution": data.resolution,
            "output_format": data.output_format,
            "wait_for_result": False,
        }
        if data.image_input:
            params["image_input"] = data.image_input
            params["image_urls"] = data.image_input

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
                args=(request_id, external_task_id, provider, 1, 60, "nano_banana"),
                delay=3000,
            )

            return GenerateResponse(
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

            return GenerateResponse(
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

        return GenerateResponse(
            ok=False,
            request_id=request_id,
            error=str(e),
            provider_used=provider,
            status="failed",
        )


@router.post("/midjourney", response_model=GenerateResponse)
async def generate_midjourney(
    data: MidjourneyRequest,
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

    estimated_cost = calculate_image_cost(price_usd, price_type, price_variants, data.speed)
    estimated_credits = estimated_cost * 1000

    request_record = Request(
        id=request_id,
        user_id=user.id,
        provider_id=provider_record.id,
        type="image",
        endpoint="/api/v1/images/midjourney",
        model=data.task_type,
        prompt=data.prompt,
        status="processing",
        external_provider=provider,
        credits_spent=Decimal(str(estimated_credits)),
        provider_cost=Decimal(str(estimated_cost)),
        started_at=datetime.utcnow(),
    )
    db.add(request_record)
    await db.flush()

    await log_created(db, request_id, provider, data.task_type)

    try:
        result = await adapter.generate(
            prompt=data.prompt,
            task_type=data.task_type,
            file_url=data.file_url,
            aspect_ratio=data.aspect_ratio,
            version=data.version,
            speed=data.speed,
            stylization=data.stylization,
            weirdness=data.weirdness,
            wait_for_result=False,
        )

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
                args=(request_id, external_task_id, provider, 1, 120, "midjourney"),
                delay=5000,
            )

            return GenerateResponse(
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

            return GenerateResponse(
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

        return GenerateResponse(
            ok=False,
            request_id=request_id,
            error=str(e),
            provider_used=provider,
            status="failed",
        )


@router.post("/image-to-image", response_model=GenerateResponse)
async def image_to_image(
    data: ImageToImageRequest,
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
            type="image",
            is_active=True,
        )
        db.add(provider_record)
        await db.flush()

    request_id = str(uuid.uuid4())
    normalized_model = normalize_model_name(data.model)

    estimated_cost = calculate_image_cost(price_usd, price_type, price_variants)
    estimated_credits = estimated_cost * 1000

    request_record = Request(
        id=request_id,
        user_id=user.id,
        provider_id=provider_record.id,
        type="image",
        endpoint="/api/v1/images/image-to-image",
        model=normalized_model,
        prompt=data.prompt,
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
                wait_for_result=False,
            )

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
                args=(request_id, external_task_id, provider, 1, 120, get_image_adapter_type(normalized_model)),
                delay=5000,
            )

            return GenerateResponse(
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

            return GenerateResponse(
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

        return GenerateResponse(
            ok=False,
            request_id=request_id,
            error=str(e),
            provider_used=provider,
            status="failed",
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