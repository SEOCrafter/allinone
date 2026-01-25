from fastapi import APIRouter
from app.api.v1 import auth, users, chat, images, tasks, files, payments

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(users.router, prefix="/user", tags=["User"])
api_router.include_router(chat.router, prefix="/chat", tags=["Chat"])
api_router.include_router(images.router, prefix="/images", tags=["Images"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
api_router.include_router(files.router, prefix="/files", tags=["Files"])
api_router.include_router(payments.router, prefix="/payments", tags=["Payments"])
