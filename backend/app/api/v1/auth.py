import hashlib
import hmac
import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.services.auth import AuthService
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()
auth_service = AuthService()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TelegramAuthRequest(BaseModel):
    id: int
    first_name: str = ""
    last_name: str = ""
    username: str = ""
    photo_url: str = ""
    auth_date: int
    hash: str


class TokenResponse(BaseModel):
    ok: bool = True
    access_token: str
    refresh_token: str
    user: dict


def verify_telegram_auth(data: dict, bot_token: str) -> bool:
    check_hash = data.pop("hash", "")
    data_check_arr = sorted([f"{k}={v}" for k, v in data.items() if v != ""])
    data_check_string = "\n".join(data_check_arr)
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    h = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    return h == check_hash


def user_to_dict(user) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "credits_balance": float(user.credits_balance),
        "telegram_id": user.telegram_id,
        "avatar_url": getattr(user, 'avatar_url', None),
    }


@router.post("/register", response_model=TokenResponse)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await auth_service.get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = await auth_service.create_user(db, data.email, data.password)

    return TokenResponse(
        access_token=auth_service.create_access_token(user.id),
        refresh_token=auth_service.create_refresh_token(user.id),
        user=user_to_dict(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await auth_service.get_user_by_email(db, data.email)
    if not user or not auth_service.verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.is_blocked:
        raise HTTPException(status_code=403, detail="User is blocked")

    return TokenResponse(
        access_token=auth_service.create_access_token(user.id),
        refresh_token=auth_service.create_refresh_token(user.id),
        user=user_to_dict(user),
    )


@router.post("/telegram", response_model=TokenResponse)
async def telegram_auth(data: TelegramAuthRequest, db: AsyncSession = Depends(get_db)):
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=500, detail="Telegram bot not configured")

    if abs(time.time() - data.auth_date) > 86400:
        raise HTTPException(status_code=401, detail="Telegram auth expired")

    auth_data = {
        "id": str(data.id),
        "first_name": data.first_name,
        "last_name": data.last_name,
        "username": data.username,
        "photo_url": data.photo_url,
        "auth_date": str(data.auth_date),
        "hash": data.hash,
    }

    if not verify_telegram_auth(auth_data, settings.TELEGRAM_BOT_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid Telegram auth")

    user = await auth_service.get_user_by_telegram_id(db, data.id)

    if not user:
        name = data.first_name
        if data.last_name:
            name += f" {data.last_name}"
        user = await auth_service.create_telegram_user(
            db, telegram_id=data.id, name=name, username=data.username, avatar_url=data.photo_url
        )

    if user.is_blocked:
        raise HTTPException(status_code=403, detail="User is blocked")

    changed = False
    if not user.name and data.first_name:
        user.name = data.first_name
        if data.last_name:
            user.name += f" {data.last_name}"
        changed = True
    if data.photo_url and getattr(user, 'avatar_url', None) != data.photo_url:
        user.avatar_url = data.photo_url
        changed = True
    if changed:
        await db.flush()

    return TokenResponse(
        access_token=auth_service.create_access_token(user.id),
        refresh_token=auth_service.create_refresh_token(user.id),
        user=user_to_dict(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = auth_service.decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = await auth_service.get_user_by_id(db, payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.is_blocked:
        raise HTTPException(status_code=403, detail="User is blocked")

    return TokenResponse(
        access_token=auth_service.create_access_token(user.id),
        refresh_token=auth_service.create_refresh_token(user.id),
        user=user_to_dict(user),
    )

@router.post("/telegram-link")
async def telegram_link(
    data: TelegramAuthRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=500, detail="Telegram bot not configured")

    if abs(time.time() - data.auth_date) > 86400:
        raise HTTPException(status_code=401, detail="Telegram auth expired")

    auth_data = {
        "id": str(data.id),
        "first_name": data.first_name,
        "last_name": data.last_name,
        "username": data.username,
        "photo_url": data.photo_url,
        "auth_date": str(data.auth_date),
        "hash": data.hash,
    }

    if not verify_telegram_auth(auth_data, settings.TELEGRAM_BOT_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid Telegram auth")

    existing = await auth_service.get_user_by_telegram_id(db, data.id)
    if existing and existing.id != current_user.id:
        raise HTTPException(status_code=400, detail="Этот Telegram уже привязан к другому аккаунту")

    current_user.telegram_id = data.id
    if data.photo_url:
        current_user.avatar_url = data.photo_url
    if not current_user.name and data.first_name:
        current_user.name = data.first_name
        if data.last_name:
            current_user.name += f" {data.last_name}"
    await db.commit()
    await db.refresh(current_user)

    return {"ok": True, "user": user_to_dict(current_user)}