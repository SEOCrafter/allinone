from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db

router = APIRouter()

class GenerateRequest(BaseModel):
    prompt: str
    aspect_ratio: str = "1:1"
    style: Optional[str] = None

class ImageResponse(BaseModel):
    ok: bool = True
    request_id: str
    result: dict
    credits: dict

@router.post("/generate", response_model=ImageResponse)
async def generate_image(data: GenerateRequest, db: AsyncSession = Depends(get_db)):
    raise HTTPException(status_code=501, detail="Not implemented")

@router.post("/remove-background", response_model=ImageResponse)
async def remove_background(file_id: str, db: AsyncSession = Depends(get_db)):
    raise HTTPException(status_code=501, detail="Not implemented")

@router.post("/upscale", response_model=ImageResponse)
async def upscale(file_id: str, scale: int = 2, db: AsyncSession = Depends(get_db)):
    raise HTTPException(status_code=501, detail="Not implemented")
