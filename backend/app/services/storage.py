import os
import uuid
import hashlib
import mimetypes
from datetime import datetime, timedelta
from typing import Optional, BinaryIO, Literal
from enum import Enum

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError


class FileCategory(str, Enum):
    IMAGES = "images"
    VIDEOS = "videos"
    AUDIO = "audio"
    UPLOADS = "uploads"
    TEMP = "temp"


class StorageService:
    def __init__(self):
        self.endpoint_url = os.environ.get("S3_ENDPOINT", "http://ai-minio:9000")
        self.access_key = os.environ.get("S3_ACCESS_KEY")
        self.secret_key = os.environ.get("S3_SECRET_KEY")
        self.bucket = os.environ.get("S3_BUCKET", "ai-aggregator")
        self.public_endpoint = os.environ.get("S3_PUBLIC_ENDPOINT", self.endpoint_url)
        
        self.client = boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=Config(signature_version="s3v4"),
        )
    
    def _get_path(
        self,
        user_id: str,
        category: FileCategory,
        filename: str,
    ) -> str:
        return f"users/{user_id}/{category.value}/{filename}"
    
    def _generate_filename(self, original_filename: str, content: Optional[bytes] = None) -> str:
        ext = os.path.splitext(original_filename)[1].lower() if original_filename else ""
        unique_id = uuid.uuid4().hex[:12]
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        
        if content:
            content_hash = hashlib.md5(content[:1024]).hexdigest()[:8]
            return f"{timestamp}_{content_hash}_{unique_id}{ext}"
        
        return f"{timestamp}_{unique_id}{ext}"
    
    async def upload_file(
        self,
        user_id: str,
        category: FileCategory,
        file_data: BinaryIO,
        original_filename: str,
        content_type: Optional[str] = None,
    ) -> dict:
        content = file_data.read()
        file_data.seek(0)
        
        filename = self._generate_filename(original_filename, content)
        key = self._get_path(user_id, category, filename)
        
        if not content_type:
            content_type = mimetypes.guess_type(original_filename)[0] or "application/octet-stream"
        
        metadata = {
            "original_filename": original_filename,
            "user_id": user_id,
            "category": category.value,
            "uploaded_at": datetime.utcnow().isoformat(),
        }
        
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
            Metadata=metadata,
        )
        
        return {
            "key": key,
            "filename": filename,
            "original_filename": original_filename,
            "size_bytes": len(content),
            "content_type": content_type,
            "category": category.value,
        }
    
    async def upload_from_url(
        self,
        user_id: str,
        category: FileCategory,
        source_url: str,
        filename_hint: Optional[str] = None,
    ) -> dict:
        import httpx
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(source_url)
            response.raise_for_status()
            content = response.content
            content_type = response.headers.get("content-type", "application/octet-stream")
        
        if not filename_hint:
            from urllib.parse import urlparse
            path = urlparse(source_url).path
            filename_hint = os.path.basename(path) or "file"
        
        ext = mimetypes.guess_extension(content_type.split(";")[0]) or ""
        if not os.path.splitext(filename_hint)[1]:
            filename_hint += ext
        
        filename = self._generate_filename(filename_hint, content)
        key = self._get_path(user_id, category, filename)
        
        metadata = {
            "original_filename": filename_hint,
            "source_url": source_url[:256],
            "user_id": user_id,
            "category": category.value,
            "uploaded_at": datetime.utcnow().isoformat(),
        }
        
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
            Metadata=metadata,
        )
        
        return {
            "key": key,
            "filename": filename,
            "original_filename": filename_hint,
            "size_bytes": len(content),
            "content_type": content_type,
            "category": category.value,
            "source_url": source_url,
        }
    
    def get_presigned_url(
        self,
        key: str,
        expires_in: int = 3600,
        for_upload: bool = False,
    ) -> str:
        method = "put_object" if for_upload else "get_object"
        
        url = self.client.generate_presigned_url(
            method,
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )
        
        if self.public_endpoint != self.endpoint_url:
            url = url.replace(self.endpoint_url, self.public_endpoint)
        
        return url
    
    def get_presigned_upload_url(
        self,
        user_id: str,
        category: FileCategory,
        filename: str,
        content_type: str,
        expires_in: int = 3600,
    ) -> dict:
        generated_filename = self._generate_filename(filename)
        key = self._get_path(user_id, category, generated_filename)
        
        url = self.client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )
        
        if self.public_endpoint != self.endpoint_url:
            url = url.replace(self.endpoint_url, self.public_endpoint)
        
        return {
            "upload_url": url,
            "key": key,
            "expires_in": expires_in,
        }
    
    async def delete_file(self, key: str) -> bool:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False
    
    async def list_user_files(
        self,
        user_id: str,
        category: Optional[FileCategory] = None,
        limit: int = 100,
    ) -> list[dict]:
        prefix = f"users/{user_id}/"
        if category:
            prefix += f"{category.value}/"
        
        response = self.client.list_objects_v2(
            Bucket=self.bucket,
            Prefix=prefix,
            MaxKeys=limit,
        )
        
        files = []
        for obj in response.get("Contents", []):
            files.append({
                "key": obj["Key"],
                "size_bytes": obj["Size"],
                "last_modified": obj["LastModified"].isoformat(),
            })
        
        return files
    
    async def get_file_info(self, key: str) -> Optional[dict]:
        try:
            response = self.client.head_object(Bucket=self.bucket, Key=key)
            return {
                "key": key,
                "size_bytes": response["ContentLength"],
                "content_type": response.get("ContentType"),
                "last_modified": response["LastModified"].isoformat(),
                "metadata": response.get("Metadata", {}),
            }
        except ClientError:
            return None
    
    async def get_storage_stats(self, user_id: str) -> dict:
        stats = {
            "total_files": 0,
            "total_size_bytes": 0,
            "by_category": {},
        }
        
        for category in FileCategory:
            prefix = f"users/{user_id}/{category.value}/"
            response = self.client.list_objects_v2(
                Bucket=self.bucket,
                Prefix=prefix,
            )
            
            count = 0
            size = 0
            for obj in response.get("Contents", []):
                count += 1
                size += obj["Size"]
            
            stats["by_category"][category.value] = {
                "files": count,
                "size_bytes": size,
            }
            stats["total_files"] += count
            stats["total_size_bytes"] += size
        
        return stats


storage_service = StorageService()