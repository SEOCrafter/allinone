from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_admin_user
from app.models.user import User
from app.models.request import Request
from app.models.provider import Provider

router = APIRouter()


@router.get("")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Общая статистика платформы."""
    
    # Users count
    users_total = await db.execute(select(func.count(User.id)))
    users_total = users_total.scalar()
    
    users_by_role = await db.execute(
        select(User.role, func.count(User.id)).group_by(User.role)
    )
    users_by_role = {row[0]: row[1] for row in users_by_role.fetchall()}
    
    # Requests count
    requests_total = await db.execute(select(func.count(Request.id)))
    requests_total = requests_total.scalar()
    
    requests_by_status = await db.execute(
        select(Request.status, func.count(Request.id)).group_by(Request.status)
    )
    requests_by_status = {row[0]: row[1] for row in requests_by_status.fetchall()}
    
    # Costs
    total_credits = await db.execute(select(func.sum(Request.credits_spent)))
    total_credits = total_credits.scalar() or 0
    
    total_provider_cost = await db.execute(select(func.sum(Request.provider_cost)))
    total_provider_cost = total_provider_cost.scalar() or 0
    
    # Tokens
    total_tokens_in = await db.execute(select(func.sum(Request.tokens_input)))
    total_tokens_in = total_tokens_in.scalar() or 0
    
    total_tokens_out = await db.execute(select(func.sum(Request.tokens_output)))
    total_tokens_out = total_tokens_out.scalar() or 0
    
    # By provider
    providers_result = await db.execute(select(Provider))
    providers = {p.id: p.name for p in providers_result.scalars().all()}
    
    requests_by_provider = await db.execute(
        select(Request.provider_id, func.count(Request.id), func.sum(Request.provider_cost))
        .group_by(Request.provider_id)
    )
    
    by_provider = []
    for row in requests_by_provider.fetchall():
        provider_id, count, cost = row
        by_provider.append({
            "provider": providers.get(provider_id, "unknown"),
            "requests": count,
            "cost_usd": float(cost or 0),
        })
    
    return {
        "ok": True,
        "stats": {
            "users": {
                "total": users_total,
                "by_role": users_by_role,
            },
            "requests": {
                "total": requests_total,
                "by_status": requests_by_status,
            },
            "costs": {
                "total_credits_spent": float(total_credits),
                "total_provider_cost_usd": float(total_provider_cost),
            },
            "tokens": {
                "total_input": total_tokens_in,
                "total_output": total_tokens_out,
            },
            "by_provider": by_provider,
        }
    }


@router.get("/expenses")
async def get_expenses(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Статистика расходов (заглушка для будущей детализации)."""
    return {
        "ok": True,
        "message": "Detailed expenses statistics coming soon",
        "expenses": {
            "daily": [],
            "weekly": [],
            "monthly": [],
        }
    }