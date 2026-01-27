CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    key VARCHAR(500) NOT NULL UNIQUE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    
    category VARCHAR(50) NOT NULL,
    content_type VARCHAR(100),
    size_bytes BIGINT DEFAULT 0,
    
    source_url VARCHAR(1000),
    source_request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS ix_files_category ON files(category);
CREATE INDEX IF NOT EXISTS ix_files_user_category ON files(user_id, category);
CREATE INDEX IF NOT EXISTS ix_files_created_at ON files(created_at);
CREATE INDEX IF NOT EXISTS ix_files_expires_at ON files(expires_at);

COMMENT ON TABLE files IS 'User files stored in S3/MinIO';
COMMENT ON COLUMN files.key IS 'S3 object key: users/{user_id}/{category}/{filename}';
COMMENT ON COLUMN files.category IS 'images, videos, audio, uploads, temp';
COMMENT ON COLUMN files.expires_at IS 'Auto-delete time for temp files';