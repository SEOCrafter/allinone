import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, BigInteger, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class File(Base):
    __tablename__ = "files"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    key = Column(String(500), nullable=False, unique=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255))
    
    category = Column(String(50), nullable=False)
    content_type = Column(String(100))
    size_bytes = Column(BigInteger, default=0)
    
    source_url = Column(String(1000))
    source_request_id = Column(UUID(as_uuid=True), ForeignKey("requests.id", ondelete="SET NULL"))
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime)
    
    user = relationship("User", back_populates="files")
    
    __table_args__ = (
        Index("ix_files_user_id", "user_id"),
        Index("ix_files_category", "category"),
        Index("ix_files_user_category", "user_id", "category"),
        Index("ix_files_created_at", "created_at"),
        Index("ix_files_expires_at", "expires_at"),
    )