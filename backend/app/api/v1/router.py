from fastapi import APIRouter
from app.api.v1 import auth, users, chat, images, video, tasks, files, payments, providers, plans
from app.api.v1.admin import router as admin_router

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(users.router, prefix="/user", tags=["User"])
api_router.include_router(chat.router, prefix="/chat", tags=["Chat"])
api_router.include_router(images.router, prefix="/images", tags=["Images"])
api_router.include_router(video.router, prefix="/video", tags=["Video"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
api_router.include_router(files.router, prefix="/files", tags=["Files"])
api_router.include_router(payments.router, prefix="/payments", tags=["Payments"])
api_router.include_router(providers.router, prefix="/providers", tags=["Providers"])
api_router.include_router(plans.router, prefix="/plans", tags=["Plans"])
api_router.include_router(admin_router, prefix="/admin", tags=["Admin"])