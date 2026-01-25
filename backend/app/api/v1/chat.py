from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    system_prompt: Optional[str] = None

class ChatResponse(BaseModel):
    ok: bool = True
    request_id: str
    message: str
    conversation_id: str
    credits: dict

@router.post("", response_model=ChatResponse)
async def chat(data: ChatRequest, db: AsyncSession = Depends(get_db)):
    # TODO: Implement - select provider, call adapter, save result
    raise HTTPException(status_code=501, detail="Not implemented")
