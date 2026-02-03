from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta, date
from typing import Optional
from decimal import Decimal
from app.database import get_db
from app.api.deps import get_admin_user
from app.models.user import User
from app.models.request import Request
from app.models.transaction import Transaction
from app.models.provider import Provider

router = APIRouter()

TAX_RATE = Decimal("0.05")


def get_period_dates(period: str) -> tuple[datetime, datetime]:
    now = datetime.now()
    today_start = datetime.combine(now.date(), datetime.min.time())
    today_end = datetime.combine(now.date(), datetime.max.time())
    
    if period == "today":
        return today_start, today_end
    elif period == "yesterday":
        yesterday = now.date() - timedelta(days=1)
        return datetime.combine(yesterday, datetime.min.time()), datetime.combine(yesterday, datetime.max.time())
    elif period == "current_week":
        week_start = now.date() - timedelta(days=now.weekday())
        return datetime.combine(week_start, datetime.min.time()), today_end
    elif period == "last_week":
        week_start = now.date() - timedelta(days=now.weekday() + 7)
        week_end = week_start + timedelta(days=6)
        return datetime.combine(week_start, datetime.min.time()), datetime.combine(week_end, datetime.max.time())
    elif period == "current_month":
        month_start = now.date().replace(day=1)
        return datetime.combine(month_start, datetime.min.time()), today_end
    elif period == "last_month":
        first_of_this_month = now.date().replace(day=1)
        last_month_end = first_of_this_month - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)
        return datetime.combine(last_month_start, datetime.min.time()), datetime.combine(last_month_end, datetime.max.time())
    elif period == "year":
        year_start = now.date().replace(month=1, day=1)
        return datetime.combine(year_start, datetime.min.time()), today_end
    else:
        return datetime.min, today_end


@router.get("")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    users_total = await db.execute(select(func.count(User.id)))
    users_total = users_total.scalar()
    
    users_by_role = await db.execute(
        select(User.role, func.count(User.id)).group_by(User.role)
    )
    users_by_role = {row[0]: row[1] for row in users_by_role.fetchall()}
    
    requests_total = await db.execute(select(func.count(Request.id)))
    requests_total = requests_total.scalar()
    
    requests_by_status = await db.execute(
        select(Request.status, func.count(Request.id)).group_by(Request.status)
    )
    requests_by_status = {row[0]: row[1] for row in requests_by_status.fetchall()}
    
    total_credits = await db.execute(select(func.sum(Request.credits_spent)))
    total_credits = total_credits.scalar() or 0
    
    total_provider_cost = await db.execute(select(func.sum(Request.provider_cost)))
    total_provider_cost = total_provider_cost.scalar() or 0
    
    total_tokens_in = await db.execute(select(func.sum(Request.tokens_input)))
    total_tokens_in = total_tokens_in.scalar() or 0
    
    total_tokens_out = await db.execute(select(func.sum(Request.tokens_output)))
    total_tokens_out = total_tokens_out.scalar() or 0
    
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


@router.get("/users-details")
async def get_users_details(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    offset = (page - 1) * limit
    
    total_result = await db.execute(select(func.count(User.id)))
    total = total_result.scalar()
    
    users_result = await db.execute(
        select(User)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    users = users_result.scalars().all()
    
    user_ids = [u.id for u in users]
    
    payments_query = await db.execute(
        select(
            Transaction.user_id,
            func.sum(Transaction.amount_currency).label("total_payments")
        )
        .where(
            and_(
                Transaction.user_id.in_(user_ids),
                Transaction.status == "completed",
                Transaction.type == "deposit"
            )
        )
        .group_by(Transaction.user_id)
    )
    payments_map = {row[0]: float(row[1] or 0) for row in payments_query.fetchall()}
    
    requests_query = await db.execute(
        select(
            Request.user_id,
            func.count(Request.id).label("generations_count"),
            func.sum(Request.provider_cost).label("total_cost"),
            func.sum(Request.credits_spent).label("total_revenue")
        )
        .where(Request.user_id.in_(user_ids))
        .group_by(Request.user_id)
    )
    requests_map = {}
    for row in requests_query.fetchall():
        requests_map[row[0]] = {
            "generations": row[1] or 0,
            "cost": float(row[2] or 0),
            "revenue": float(row[3] or 0),
        }
    
    result = []
    for user in users:
        payments = payments_map.get(user.id, 0)
        tax = payments * float(TAX_RATE)
        req_data = requests_map.get(user.id, {"generations": 0, "cost": 0, "revenue": 0})
        profit = req_data["revenue"] - req_data["cost"]
        
        result.append({
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "telegram_id": user.telegram_id,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "payments": payments,
            "tax_5_percent": round(tax, 2),
            "generations_count": req_data["generations"],
            "cost": round(req_data["cost"], 6),
            "revenue": round(req_data["revenue"], 4),
            "profit": round(profit, 4),
            "credits_balance": float(user.credits_balance or 0),
        })
    
    return {
        "ok": True,
        "users": result,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit,
        }
    }


@router.get("/users/{user_id}/generations")
async def get_user_generations(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    offset = (page - 1) * limit
    
    total_result = await db.execute(
        select(func.count(Request.id)).where(Request.user_id == user_id)
    )
    total = total_result.scalar()
    
    requests_result = await db.execute(
        select(Request)
        .where(Request.user_id == user_id)
        .order_by(Request.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    requests = requests_result.scalars().all()
    
    provider_ids = list(set(r.provider_id for r in requests if r.provider_id))
    providers_result = await db.execute(
        select(Provider).where(Provider.id.in_(provider_ids))
    )
    providers_map = {p.id: p.display_name for p in providers_result.scalars().all()}
    
    result = []
    for req in requests:
        revenue = float(req.credits_spent or 0)
        cost = float(req.provider_cost or 0)
        profit = revenue - cost
        
        result.append({
            "id": str(req.id),
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "model": req.model,
            "provider": providers_map.get(req.provider_id, "unknown"),
            "type": req.type,
            "status": req.status,
            "tokens_input": req.tokens_input,
            "tokens_output": req.tokens_output,
            "cost": round(cost, 6),
            "revenue": round(revenue, 4),
            "profit": round(profit, 4),
            "prompt": req.prompt[:100] + "..." if req.prompt and len(req.prompt) > 100 else req.prompt,
        })
    
    return {
        "ok": True,
        "generations": result,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit if total else 0,
        }
    }


@router.get("/periods")
async def get_stats_by_periods(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    periods = ["today", "yesterday", "current_week", "last_week", "current_month", "last_month", "year", "all_time"]
    period_names = {
        "today": "Сегодня",
        "yesterday": "Вчера",
        "current_week": "Текущая неделя",
        "last_week": "Прошлая неделя",
        "current_month": "Текущий месяц",
        "last_month": "Прошлый месяц",
        "year": "Год",
        "all_time": "Всё время",
    }
    
    result = []
    
    for period in periods:
        start_date, end_date = get_period_dates(period)
        
        if period == "all_time":
            users_count = await db.execute(select(func.count(User.id)))
            requests_query = select(
                func.count(Request.id),
                func.sum(Request.provider_cost),
                func.sum(Request.credits_spent)
            )
            payments_query = select(func.sum(Transaction.amount_currency)).where(
                and_(Transaction.status == "completed", Transaction.type == "deposit")
            )
        else:
            users_count = await db.execute(
                select(func.count(User.id)).where(
                    and_(User.created_at >= start_date, User.created_at <= end_date)
                )
            )
            requests_query = select(
                func.count(Request.id),
                func.sum(Request.provider_cost),
                func.sum(Request.credits_spent)
            ).where(
                and_(Request.created_at >= start_date, Request.created_at <= end_date)
            )
            payments_query = select(func.sum(Transaction.amount_currency)).where(
                and_(
                    Transaction.status == "completed",
                    Transaction.type == "deposit",
                    Transaction.created_at >= start_date,
                    Transaction.created_at <= end_date
                )
            )
        
        users_count = users_count.scalar() or 0
        
        requests_result = await db.execute(requests_query)
        req_row = requests_result.fetchone()
        requests_count = req_row[0] or 0
        total_cost = float(req_row[1] or 0)
        total_revenue = float(req_row[2] or 0)
        
        payments_result = await db.execute(payments_query)
        total_payments = float(payments_result.scalar() or 0)
        
        profit = total_revenue - total_cost
        tax = total_payments * float(TAX_RATE)
        net_profit = profit - tax
        
        result.append({
            "period": period,
            "name": period_names[period],
            "new_users": users_count,
            "generations": requests_count,
            "payments": round(total_payments, 2),
            "cost": round(total_cost, 6),
            "revenue": round(total_revenue, 4),
            "profit": round(profit, 4),
            "tax": round(tax, 2),
            "net_profit": round(net_profit, 4),
        })
    
    return {"ok": True, "periods": result}


@router.get("/charts")
async def get_charts_data(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
    days: int = Query(30, ge=7, le=365),
):
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=days - 1)
    
    all_dates = []
    current = start_date
    while current <= end_date:
        all_dates.append(current)
        current += timedelta(days=1)
    
    users_by_day = await db.execute(
        select(
            func.date(User.created_at).label("day"),
            func.count(User.id).label("count")
        )
        .where(User.created_at >= datetime.combine(start_date, datetime.min.time()))
        .group_by(func.date(User.created_at))
    )
    users_map = {row[0]: row[1] for row in users_by_day.fetchall()}
    
    requests_by_day = await db.execute(
        select(
            func.date(Request.created_at).label("day"),
            func.count(Request.id).label("count"),
            func.sum(Request.provider_cost).label("cost"),
            func.sum(Request.credits_spent).label("revenue")
        )
        .where(Request.created_at >= datetime.combine(start_date, datetime.min.time()))
        .group_by(func.date(Request.created_at))
    )
    requests_map = {}
    for row in requests_by_day.fetchall():
        requests_map[row[0]] = {
            "count": row[1] or 0,
            "cost": float(row[2] or 0),
            "revenue": float(row[3] or 0),
        }
    
    payments_by_day = await db.execute(
        select(
            func.date(Transaction.created_at).label("day"),
            func.sum(Transaction.amount_currency).label("amount")
        )
        .where(
            and_(
                Transaction.status == "completed",
                Transaction.type == "deposit",
                Transaction.created_at >= datetime.combine(start_date, datetime.min.time())
            )
        )
        .group_by(func.date(Transaction.created_at))
    )
    payments_map = {row[0]: float(row[1] or 0) for row in payments_by_day.fetchall()}
    
    chart_data = []
    cumulative_users = 0
    
    initial_users = await db.execute(
        select(func.count(User.id)).where(
            User.created_at < datetime.combine(start_date, datetime.min.time())
        )
    )
    cumulative_users = initial_users.scalar() or 0
    
    for d in all_dates:
        new_users = users_map.get(d, 0)
        cumulative_users += new_users
        req_data = requests_map.get(d, {"count": 0, "cost": 0, "revenue": 0})
        payments = payments_map.get(d, 0)
        profit = req_data["revenue"] - req_data["cost"]
        
        chart_data.append({
            "date": d.isoformat(),
            "new_users": new_users,
            "total_users": cumulative_users,
            "generations": req_data["count"],
            "cost": round(req_data["cost"], 6),
            "revenue": round(req_data["revenue"], 4),
            "profit": round(profit, 4),
            "payments": round(payments, 2),
        })
    
    totals = {
        "new_users": sum(d["new_users"] for d in chart_data),
        "generations": sum(d["generations"] for d in chart_data),
        "cost": round(sum(d["cost"] for d in chart_data), 6),
        "revenue": round(sum(d["revenue"] for d in chart_data), 4),
        "profit": round(sum(d["profit"] for d in chart_data), 4),
        "payments": round(sum(d["payments"] for d in chart_data), 2),
    }
    
    return {
        "ok": True,
        "days": days,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "data": chart_data,
        "totals": totals,
    }


@router.get("/expenses")
async def get_expenses(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    return {
        "ok": True,
        "message": "Use /admin/stats/periods and /admin/stats/charts for detailed expenses",
    }