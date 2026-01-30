from fastapi import APIRouter
from app.api.v1.admin import requests, users, adapters, stats, unit_economics, providers, model_settings, tariffs

router = APIRouter()

router.include_router(requests.router, prefix="/requests", tags=["Admin - Requests"])
router.include_router(users.router, prefix="/users", tags=["Admin - Users"])
router.include_router(adapters.router, prefix="/adapters", tags=["Admin - Adapters"])
router.include_router(stats.router, prefix="/stats", tags=["Admin - Stats"])
router.include_router(unit_economics.router, prefix="/unit-economics", tags=["Admin - Unit Economics"])
router.include_router(providers.router, tags=["Admin - Providers"])
router.include_router(model_settings.router, tags=["Admin - Model Settings"])
router.include_router(tariffs.router, prefix="/tariffs", tags=["Admin - Tariffs"])