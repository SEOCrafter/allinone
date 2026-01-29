from typing import Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.api.deps import get_admin_user
from app.models.user import User
from app.models.provider_balance import ProviderBalance
from app.models.model_provider_price import ModelProviderPrice
from app.adapters import AdapterRegistry
from app.config import settings
import httpx

router = APIRouter()


class TestChatRequest(BaseModel):
    message: str
    model: Optional[str] = None
    system_prompt: Optional[str] = None


class SetBalanceRequest(BaseModel):
    balance_usd: float


class DepositRequest(BaseModel):
    amount_usd: float


@router.get("")
async def list_adapters(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    adapters = AdapterRegistry.list_adapters(include_models=True)
    
    result = await db.execute(select(ModelProviderPrice))
    db_prices = result.scalars().all()
    
    price_map = {}
    for p in db_prices:
        key = p.model_name
        if key not in price_map:
            price_map[key] = {
                "price_type": p.price_type,
                "price_usd": float(p.price_usd),
            }
    
    def normalize_model_id(model_id: str) -> str:
        if "/" in model_id:
            return model_id.split("/")[-1]
        return model_id
    
    def find_price(model_id: str) -> dict:
        if model_id in price_map:
            return price_map[model_id]
        
        normalized = normalize_model_id(model_id)
        if normalized in price_map:
            return price_map[normalized]
        
        variations = [
            normalized,
            normalized.replace("text-to-video", "t2v"),
            normalized.replace("image-to-video", "i2v"),
            normalized.replace("t2v", "text-to-video"),
            normalized.replace("i2v", "image-to-video"),
            normalized.replace("/", "-"),
            normalized.replace("_", "-"),
            model_id.replace("/", "-"),
        ]
        
        for var in variations:
            if var in price_map:
                return price_map[var]
        
        for db_name in price_map:
            norm_db = db_name.replace("-", "").replace("_", "").replace("/", "").lower()
            norm_model = normalized.replace("-", "").replace("_", "").replace("/", "").lower()
            if norm_db == norm_model:
                return price_map[db_name]
            if norm_db in norm_model or norm_model in norm_db:
                if len(norm_db) > 5 and len(norm_model) > 5:
                    return price_map[db_name]
        
        return None
    
    for adapter in adapters:
        if "models" in adapter:
            for model in adapter["models"]:
                model_id = model["id"]
                price_data = find_price(model_id)
                if price_data:
                    model["pricing"]["per_request"] = price_data["price_usd"]
                    model["pricing"]["price_type"] = price_data["price_type"]
    
    db_only_models = []
    adapter_model_ids = set()
    for adapter in adapters:
        if "models" in adapter:
            for m in adapter["models"]:
                adapter_model_ids.add(m["id"])
                adapter_model_ids.add(normalize_model_id(m["id"]))
    
    for model_name, price_data in price_map.items():
        if model_name not in adapter_model_ids:
            model_type = "video"
            if "flux" in model_name or "midjourney" in model_name or "nano" in model_name or "mj_" in model_name or "imagen" in model_name:
                model_type = "image"
            
            db_only_models.append({
                "id": model_name,
                "display_name": model_name.replace("-", " ").replace("_", " ").title(),
                "type": model_type,
                "pricing": {
                    "input_per_1k": 0,
                    "output_per_1k": 0,
                    "per_request": price_data["price_usd"],
                    "price_type": price_data["price_type"],
                }
            })
    
    if db_only_models:
        adapters.append({
            "name": "other",
            "display_name": "Other Models",
            "type": "mixed",
            "models": db_only_models
        })
    
    return {"ok": True, "adapters": adapters}

@router.get("/status")
async def adapters_status(
    admin: User = Depends(get_admin_user),
):
    results = []
    import time

    if settings.OPENAI_API_KEY:
        try:
            start = time.time()
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"},
                    json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "Hi"}], "max_tokens": 5},
                )
                latency = int((time.time() - start) * 1000)
                if response.status_code == 200:
                    results.append({"name": "openai", "status": "healthy", "latency_ms": latency, "error": None})
                else:
                    results.append({"name": "openai", "status": "degraded", "latency_ms": latency, "error": response.text})
        except Exception as e:
            results.append({"name": "openai", "status": "unhealthy", "latency_ms": None, "error": str(e)})

    if settings.ANTHROPIC_API_KEY:
        try:
            start = time.time()
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={"x-api-key": settings.ANTHROPIC_API_KEY, "Content-Type": "application/json", "anthropic-version": "2023-06-01"},
                    json={"model": "claude-haiku-4-5-20251001", "messages": [{"role": "user", "content": "Hi"}], "max_tokens": 5},
                )
                latency = int((time.time() - start) * 1000)
                if response.status_code == 200:
                    results.append({"name": "anthropic", "status": "healthy", "latency_ms": latency, "error": None})
                else:
                    results.append({"name": "anthropic", "status": "degraded", "latency_ms": latency, "error": response.text})
        except Exception as e:
            results.append({"name": "anthropic", "status": "unhealthy", "latency_ms": None, "error": str(e)})

    if settings.GEMINI_API_KEY:
        try:
            start = time.time()
            adapter = AdapterRegistry.get_adapter("gemini", settings.GEMINI_API_KEY)
            result = await adapter.generate("Hi", model="gemini-2.0-flash", max_tokens=5)
            latency = int((time.time() - start) * 1000)
            if result.success:
                results.append({"name": "gemini", "status": "healthy", "latency_ms": latency, "error": None})
            else:
                results.append({"name": "gemini", "status": "degraded", "latency_ms": latency, "error": result.error_message})
        except Exception as e:
            results.append({"name": "gemini", "status": "unhealthy", "latency_ms": None, "error": str(e)})

    if settings.DEEPSEEK_API_KEY:
        try:
            start = time.time()
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.deepseek.com/chat/completions",
                    headers={"Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}", "Content-Type": "application/json"},
                    json={"model": "deepseek-chat", "messages": [{"role": "user", "content": "Hi"}], "max_tokens": 5},
                )
                latency = int((time.time() - start) * 1000)
                if response.status_code == 200:
                    results.append({"name": "deepseek", "status": "healthy", "latency_ms": latency, "error": None})
                else:
                    results.append({"name": "deepseek", "status": "degraded", "latency_ms": latency, "error": response.text})
        except Exception as e:
            results.append({"name": "deepseek", "status": "unhealthy", "latency_ms": None, "error": str(e)})

    if settings.KIE_API_KEY:
        try:
            start = time.time()
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    "https://api.kie.ai/api/v1/chat/credit",
                    headers={"Authorization": f"Bearer {settings.KIE_API_KEY}"},
                )
                latency = int((time.time() - start) * 1000)
                if response.status_code == 200:
                    kie_status = "healthy"
                    kie_error = None
                else:
                    kie_status = "degraded"
                    kie_error = response.text
        except Exception as e:
            latency = None
            kie_status = "unhealthy"
            kie_error = str(e)
        for name in ["nano_banana", "kling", "midjourney", "veo", "sora", "hailuo", "runway", "seedance", "flux"]:
            results.append({"name": name, "status": kie_status, "latency_ms": latency, "error": kie_error})

    if settings.REPLICATE_API_KEY:
        try:
            start = time.time()
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    "https://api.replicate.com/v1/account",
                    headers={"Authorization": f"Bearer {settings.REPLICATE_API_KEY}"},
                )
                latency = int((time.time() - start) * 1000)
                if response.status_code == 200:
                    results.append({"name": "replicate", "status": "healthy", "latency_ms": latency, "error": None})
                else:
                    results.append({"name": "replicate", "status": "degraded", "latency_ms": latency, "error": response.text})
        except Exception as e:
            results.append({"name": "replicate", "status": "unhealthy", "latency_ms": None, "error": str(e)})

    return {"ok": True, "adapters": results}


@router.get("/balances")
async def adapters_balances(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ProviderBalance))
    balances = result.scalars().all()
    return {
        "ok": True,
        "balances": [
            {
                "provider": b.provider,
                "status": "active" if float(b.balance_usd) > 0 else "low",
                "balance_usd": float(b.balance_usd),
                "total_deposited_usd": float(b.total_deposited_usd),
                "total_spent_usd": float(b.total_spent_usd),
                "updated_at": (b.updated_at.isoformat() + "Z") if b.updated_at else None,
            }
            for b in balances
        ]
    }


@router.post("/balances/{provider}/set")
async def set_balance(
    provider: str,
    data: SetBalanceRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ProviderBalance).where(ProviderBalance.provider == provider))
    balance = result.scalar_one_or_none()
    if not balance:
        raise HTTPException(status_code=404, detail=f"Provider {provider} not found")
    balance.balance_usd = Decimal(str(data.balance_usd))
    balance.total_deposited_usd = Decimal(str(data.balance_usd))
    balance.total_spent_usd = Decimal("0")
    await db.commit()
    await db.refresh(balance)
    return {"ok": True, "provider": provider, "balance_usd": float(balance.balance_usd)}


@router.post("/balances/{provider}/deposit")
async def deposit_balance(
    provider: str,
    data: DepositRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ProviderBalance).where(ProviderBalance.provider == provider))
    balance = result.scalar_one_or_none()
    if not balance:
        raise HTTPException(status_code=404, detail=f"Provider {provider} not found")
    balance.balance_usd = balance.balance_usd + Decimal(str(data.amount_usd))
    balance.total_deposited_usd = balance.total_deposited_usd + Decimal(str(data.amount_usd))
    await db.commit()
    await db.refresh(balance)
    return {"ok": True, "provider": provider, "balance_usd": float(balance.balance_usd)}


@router.post("/{adapter_name}/health")
async def adapter_health(
    adapter_name: str,
    admin: User = Depends(get_admin_user),
):
    health_models = {"openai": "gpt-4o-mini", "anthropic": "claude-haiku-4-5-20251001", "gemini": "gemini-2.5-flash", "deepseek": "deepseek-chat"}
    api_keys = {
        "openai": settings.OPENAI_API_KEY, "anthropic": settings.ANTHROPIC_API_KEY,
        "gemini": settings.GEMINI_API_KEY, "deepseek": settings.DEEPSEEK_API_KEY,
        "nano_banana": settings.KIE_API_KEY, "kling": settings.KIE_API_KEY, "midjourney": settings.KIE_API_KEY,
        "veo": settings.KIE_API_KEY, "sora": settings.KIE_API_KEY, "hailuo": settings.KIE_API_KEY,
        "runway": settings.KIE_API_KEY, "seedance": settings.KIE_API_KEY, "flux": settings.KIE_API_KEY,
        "replicate": settings.REPLICATE_API_KEY,
    }
    api_key = api_keys.get(adapter_name)
    if not api_key:
        raise HTTPException(status_code=400, detail=f"No API key for {adapter_name}")
    adapter = AdapterRegistry.get_adapter(adapter_name, api_key)
    if not adapter:
        raise HTTPException(status_code=404, detail=f"Adapter {adapter_name} not found")
    import time
    start = time.time()
    result = await adapter.generate("Hi", model=health_models.get(adapter_name), max_tokens=5)
    latency = int((time.time() - start) * 1000)
    if result.success:
        return {"ok": True, "adapter": adapter_name, "status": "healthy", "latency_ms": latency, "error": None}
    else:
        return {"ok": False, "adapter": adapter_name, "status": "degraded", "latency_ms": latency, "error": result.error_message}


@router.post("/{adapter_name}/test")
async def test_adapter(
    adapter_name: str,
    data: TestChatRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.request import Request, Result
    from app.models.provider import Provider
    from datetime import datetime
    import uuid

    api_keys = {
        "openai": settings.OPENAI_API_KEY, "anthropic": settings.ANTHROPIC_API_KEY,
        "gemini": settings.GEMINI_API_KEY, "deepseek": settings.DEEPSEEK_API_KEY,
        "nano_banana": settings.KIE_API_KEY, "kling": settings.KIE_API_KEY, "midjourney": settings.KIE_API_KEY,
        "veo": settings.KIE_API_KEY, "sora": settings.KIE_API_KEY, "hailuo": settings.KIE_API_KEY,
        "runway": settings.KIE_API_KEY, "seedance": settings.KIE_API_KEY, "flux": settings.KIE_API_KEY,
        "replicate": settings.REPLICATE_API_KEY,
    }
    api_key = api_keys.get(adapter_name)
    if not api_key:
        raise HTTPException(status_code=400, detail=f"No API key for {adapter_name}")
    adapter = AdapterRegistry.get_adapter(adapter_name, api_key)
    if not adapter:
        raise HTTPException(status_code=404, detail=f"Adapter {adapter_name} not found")

    provider_result = await db.execute(select(Provider).where(Provider.name == adapter_name))
    provider = provider_result.scalar_one_or_none()
    if not provider:
        provider = Provider(id=uuid.uuid4(), name=adapter_name, display_name=adapter.display_name, type=adapter.provider_type.value, is_active=True)
        db.add(provider)
        await db.flush()

    frontend_request = {"endpoint": "/api/v1/chat", "method": "POST", "body": {"message": data.message, "provider": adapter_name, "model": data.model or adapter.default_model, "system_prompt": data.system_prompt}}
    params = {}
    if data.model:
        params["model"] = data.model
    if data.system_prompt:
        params["system_prompt"] = data.system_prompt

    request_record = Request(id=uuid.uuid4(), user_id=admin.id, provider_id=provider.id, type="chat", endpoint="/api/v1/admin/adapters/test", model=data.model or adapter.default_model, prompt=data.message, params=params, status="processing", started_at=datetime.utcnow())
    db.add(request_record)
    await db.flush()

    result = await adapter.generate(data.message, **params)
    request_record.completed_at = datetime.utcnow()

    if result.success:
        request_record.status = "completed"
        request_record.tokens_input = result.tokens_input or 0
        request_record.tokens_output = result.tokens_output or 0
        request_record.provider_cost = result.provider_cost
        result_record = Result(id=uuid.uuid4(), request_id=request_record.id, type="text", content=result.content)
        db.add(result_record)
    else:
        request_record.status = "failed"
        request_record.error_code = result.error_code
        request_record.error_message = result.error_message

    if result.success and result.provider_cost and result.provider_cost > 0:
        balance_provider = adapter_name
        if adapter_name in ("midjourney", "nano_banana", "kling", "veo", "sora", "hailuo", "runway", "seedance", "flux"):
            balance_provider = "kie"
        balance_result = await db.execute(select(ProviderBalance).where(ProviderBalance.provider == balance_provider))
        balance = balance_result.scalar_one_or_none()
        if balance:
            balance.balance_usd = balance.balance_usd - Decimal(str(result.provider_cost))
            balance.total_spent_usd = balance.total_spent_usd + Decimal(str(result.provider_cost))

    await db.commit()

    provider_request = None
    provider_response_raw = None
    if result.raw_response:
        provider_request = result.raw_response.get("request")
        provider_response_raw = result.raw_response.get("response")

    if result.success:
        return {"ok": True, "frontend_request": frontend_request, "provider_request": provider_request, "provider_response_raw": provider_response_raw, "parsed": {"content": result.content, "tokens_input": result.tokens_input, "tokens_output": result.tokens_output, "provider_cost_usd": result.provider_cost}}
    else:
        return {"ok": False, "frontend_request": frontend_request, "provider_request": provider_request, "provider_response_raw": provider_response_raw, "error": {"code": result.error_code, "message": result.error_message}}