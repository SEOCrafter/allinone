from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import RedirectResponse, StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.file import File as FileModel
from app.api.deps import get_current_user
from app.services.storage import storage_service, FileCategory


router = APIRouter()


class FileUploadResponse(BaseModel):
    id: UUID
    key: str
    filename: str
    original_filename: Optional[str]
    category: str
    content_type: Optional[str]
    size_bytes: int
    url: str


class PresignedUploadRequest(BaseModel):
    filename: str
    content_type: str
    category: str = "uploads"


class PresignedUploadResponse(BaseModel):
    upload_url: str
    key: str
    expires_in: int


class FileListResponse(BaseModel):
    files: list[FileUploadResponse]
    total: int


class StorageStatsResponse(BaseModel):
    total_files: int
    total_size_bytes: int
    total_size_mb: float
    by_category: dict


class SaveFromUrlRequest(BaseModel):
    url: str
    category: str = "images"
    filename_hint: Optional[str] = None


@router.post("/save-from-url", response_model=FileUploadResponse)
async def save_from_url(
    request: SaveFromUrlRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cat = FileCategory(request.category)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid category: {request.category}")
    
    try:
        result = await storage_service.upload_from_url(
            user_id=str(current_user.id),
            category=cat,
            source_url=request.url,
            filename_hint=request.filename_hint,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to download file: {str(e)}")
    
    import uuid as uuid_module
    file_id = uuid_module.uuid4()
    db_file = FileModel(
        id=file_id,
        user_id=current_user.id,
        key=result["key"],
        filename=result["filename"],
        original_filename=result["original_filename"],
        category=request.category,
        content_type=result["content_type"],
        size_bytes=result["size_bytes"],
    )
    db.add(db_file)
    await db.commit()
    
    return FileUploadResponse(
        id=file_id,
        key=result["key"],
        filename=result["filename"],
        original_filename=result["original_filename"],
        category=request.category,
        content_type=result["content_type"],
        size_bytes=result["size_bytes"],
        url=f"/api/v1/files/download/{file_id}",
    )


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    category: str = Query(default="uploads", pattern="^(images|videos|audio|uploads|temp)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cat = FileCategory(category)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}")
    
    result = await storage_service.upload_file(
        user_id=str(current_user.id),
        category=cat,
        file_data=file.file,
        original_filename=file.filename,
        content_type=file.content_type,
    )
    
    expires_at = None
    if cat == FileCategory.TEMP:
        expires_at = datetime.utcnow() + timedelta(hours=24)
    
    import uuid as uuid_module
    file_id = uuid_module.uuid4()
    db_file = FileModel(
        id=file_id,
        user_id=current_user.id,
        key=result["key"],
        filename=result["filename"],
        original_filename=result["original_filename"],
        category=category,
        content_type=result["content_type"],
        size_bytes=result["size_bytes"],
        expires_at=expires_at,
    )
    db.add(db_file)
    await db.commit()
    
    url = storage_service.get_presigned_url(result["key"], expires_in=3600)
    
    return FileUploadResponse(
        id=file_id,
        key=result["key"],
        filename=result["filename"],
        original_filename=result["original_filename"],
        category=category,
        content_type=result["content_type"],
        size_bytes=result["size_bytes"],
        url=f"/api/v1/files/download/{file_id}",
    )


@router.post("/presigned-upload", response_model=PresignedUploadResponse)
async def get_presigned_upload_url(
    request: PresignedUploadRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        cat = FileCategory(request.category)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid category: {request.category}")
    
    result = storage_service.get_presigned_upload_url(
        user_id=str(current_user.id),
        category=cat,
        filename=request.filename,
        content_type=request.content_type,
        expires_in=3600,
    )
    
    return PresignedUploadResponse(**result)


@router.get("/download/{file_id}")
async def download_file(
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(FileModel).where(
            FileModel.id == file_id,
            FileModel.user_id == current_user.id,
        )
    )
    db_file = result.scalar_one_or_none()
    
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_obj = storage_service.client.get_object(
        Bucket=storage_service.bucket,
        Key=db_file.key,
    )
    
    return StreamingResponse(
        file_obj["Body"].iter_chunks(),
        media_type=db_file.content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{db_file.original_filename or db_file.filename}"'
        }
    )

@router.get("/url/{file_id}")
async def get_file_url(
    file_id: UUID,
    expires_in: int = Query(default=3600, ge=60, le=86400),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(FileModel).where(
            FileModel.id == file_id,
            FileModel.user_id == current_user.id,
        )
    )
    db_file = result.scalar_one_or_none()
    
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    url = storage_service.get_presigned_url(db_file.key, expires_in=expires_in)
    
    return {"url": url, "expires_in": expires_in}


@router.get("", response_model=FileListResponse)
async def list_files(
    category: Optional[str] = Query(default=None, pattern="^(images|videos|audio|uploads|temp)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(FileModel).where(FileModel.user_id == current_user.id)
    count_query = select(func.count(FileModel.id)).where(FileModel.user_id == current_user.id)
    
    if category:
        query = query.where(FileModel.category == category)
        count_query = count_query.where(FileModel.category == category)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    query = query.order_by(FileModel.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    db_files = result.scalars().all()
    
    files = []
    for f in db_files:
        files.append(FileUploadResponse(
            id=f.id,
            key=f.key,
            filename=f.filename,
            original_filename=f.original_filename,
            category=f.category,
            content_type=f.content_type,
            size_bytes=f.size_bytes,
            url=f"/api/v1/files/download/{f.id}",
        ))
    
    return FileListResponse(files=files, total=total)


@router.delete("/{file_id}")
async def delete_file(
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(FileModel).where(
            FileModel.id == file_id,
            FileModel.user_id == current_user.id,
        )
    )
    db_file = result.scalar_one_or_none()
    
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    await storage_service.delete_file(db_file.key)
    
    await db.delete(db_file)
    await db.commit()
    
    return {"deleted": True, "file_id": str(file_id)}


@router.get("/stats", response_model=StorageStatsResponse)
async def get_storage_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stats = await storage_service.get_storage_stats(str(current_user.id))
    stats["total_size_mb"] = round(stats["total_size_bytes"] / (1024 * 1024), 2)
    return StorageStatsResponse(**stats)