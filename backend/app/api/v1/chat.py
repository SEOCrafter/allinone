import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.generation import generation_service

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    system_prompt: Optional[str] = None
    provider: Optional[str] = None  # openai, anthropic
    model: Optional[str] = None

class CreditsInfo(BaseModel):
    spent: float
    remaining: float

class ChatResponse(BaseModel):
    ok: bool = True
    request_id: str
    message: str
    conversation_id: str
    provider: str
    model: str
    tokens: dict
    credits: CreditsInfo

class ErrorResponse(BaseModel):
    ok: bool = False
    error: dict

@router.post("")
async def chat(data: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Текстовый чат с AI.
    
    - **message**: Текст запроса
    - **system_prompt**: Системный промпт (опционально)
    - **provider**: openai, anthropic (по умолчанию openai)
    - **model**: Конкретная модель (опционально)
    """
    result = await generation_service.chat(
        message=data.message,
        system_prompt=data.system_prompt,
        provider=data.provider,
        model=data.model,
    )
    
    if not result.success:
        raise HTTPException(
            status_code=502,
            detail={
                "code": result.error_code,
                "message": result.error_message,
            }
        )
    
    credits_spent = float(generation_service.calculate_credits(result))
    
    # TODO: Сохранить в БД, списать кредиты
    
    return ChatResponse(
        request_id=str(uuid.uuid4()),
        message=result.content,
        conversation_id=data.conversation_id or str(uuid.uuid4()),
        provider=data.provider or "openai",
        model=data.model or "gpt-4o-mini",
        tokens={
            "input": result.tokens_input,
            "output": result.tokens_output,
        },
        credits=CreditsInfo(
            spent=credits_spent,
            remaining=100.0,  # TODO: из БД
        ),
    )
