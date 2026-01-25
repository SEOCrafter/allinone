from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db

router = APIRouter()

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TelegramAuthRequest(BaseModel):
    init_data: str

class TokenResponse(BaseModel):
    ok: bool = True
    access_token: str
    refresh_token: str
    user: dict

@router.post("/register", response_model=TokenResponse)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # TODO: Implement
    raise HTTPException(status_code=501, detail="Not implemented")

@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    # TODO: Implement
    raise HTTPException(status_code=501, detail="Not implemented")

@router.post("/telegram", response_model=TokenResponse)
async def telegram_auth(data: TelegramAuthRequest, db: AsyncSession = Depends(get_db)):
    # TODO: Implement
    raise HTTPException(status_code=501, detail="Not implemented")

@router.post("/refresh")
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_db)):
    # TODO: Implement
    raise HTTPException(status_code=501, detail="Not implemented")
