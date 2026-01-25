from decimal import Decimal
from uuid import UUID
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.request import Request, Result

class RequestService:
    
    @staticmethod
    async def create_request(
        db: AsyncSession,
        user_id: UUID,
        request_type: str,
        endpoint: str,
        provider_id: UUID,
        model: str,
        prompt: str,
        params: Optional[dict] = None,
    ) -> Request:
        req = Request(
            user_id=user_id,
            type=request_type,
            endpoint=endpoint,
            provider_id=provider_id,
            model=model,
            prompt=prompt,
            params=params,
            status="pending",
        )
        db.add(req)
        await db.flush()
        await db.refresh(req)
        return req
    
    @staticmethod
    async def complete_request(
        db: AsyncSession,
        request: Request,
        content: str,
        tokens_input: int,
        tokens_output: int,
        credits_spent: Decimal,
        provider_cost: Decimal,
    ) -> Request:
        request.status = "completed"
        request.tokens_input = tokens_input
        request.tokens_output = tokens_output
        request.credits_spent = credits_spent
        request.provider_cost = provider_cost
        
        # Сохраняем результат
        result = Result(
            request_id=request.id,
            type="text",
            content=content,
        )
        db.add(result)
        await db.flush()
        return request
    
    @staticmethod
    async def fail_request(
        db: AsyncSession,
        request: Request,
        error_code: str,
        error_message: str,
    ) -> Request:
        request.status = "failed"
        request.error_code = error_code
        request.error_message = error_message
        await db.flush()
        return request

request_service = RequestService()
