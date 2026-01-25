from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.config import settings
from app.database import engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"Starting AI Aggregator API [{settings.APP_ENV}]")
    yield
    await engine.dispose()

app = FastAPI(
    title="AI Aggregator API",
    description="Vse neiroset'i vnutri",
    version="1.0.0",
    docs_url="/docs" if settings.APP_DEBUG else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

app.include_router(api_router, prefix="/api/v1")
