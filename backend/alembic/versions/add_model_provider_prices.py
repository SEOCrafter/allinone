"""add model provider prices table

Revision ID: add_model_provider_prices
Revises: add_unit_economics
Create Date: 2026-01-28 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'add_model_provider_prices'
down_revision = 'add_unit_economics'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'model_provider_prices',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('model_name', sa.String(100), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('replicate_model_id', sa.String(200), nullable=True),
        sa.Column('price_type', sa.String(20), nullable=False),
        sa.Column('price_usd', sa.DECIMAL(10, 6), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('model_name', 'provider', name='uq_model_provider')
    )

    op.execute("""
        INSERT INTO model_provider_prices (model_name, provider, replicate_model_id, price_type, price_usd) VALUES
        -- Nano Banana (Image)
        ('nano-banana-pro', 'kie', NULL, 'per_image', 0.04),
        ('nano-banana-pro', 'replicate', 'google/nano-banana-pro', 'per_image', 0.05),
        ('nano-banana', 'kie', NULL, 'per_image', 0.03),
        ('nano-banana', 'replicate', 'google/nano-banana', 'per_image', 0.04),
        
        -- Kling (Video)
        ('kling-2.6-t2v', 'kie', NULL, 'per_second', 0.056),
        ('kling-2.6-t2v', 'replicate', 'kwaivgi/kling-v2.6', 'per_second', 0.06),
        ('kling-2.6-i2v', 'kie', NULL, 'per_second', 0.056),
        ('kling-2.6-i2v', 'replicate', 'kwaivgi/kling-v2.6', 'per_second', 0.06),
        ('kling-2.6-motion', 'kie', NULL, 'per_second', 0.07),
        ('kling-2.6-motion', 'replicate', 'kwaivgi/kling-v2.6-motion-control', 'per_second', 0.06),
        
        -- Veo (Video with Audio)
        ('veo-3', 'kie', NULL, 'per_second', 0.70),
        ('veo-3', 'replicate', 'google/veo-3', 'per_second', 0.75),
        ('veo-3.1', 'kie', NULL, 'per_second', 0.70),
        ('veo-3.1', 'replicate', 'google/veo-3.1', 'per_second', 0.75),
        ('veo-3-fast', 'replicate', 'google/veo-3-fast', 'per_second', 0.15),
        ('veo-2', 'replicate', 'google/veo-2', 'per_second', 0.40),
        
        -- Hailuo / MiniMax (Video)
        ('hailuo-02', 'kie', NULL, 'per_request', 0.30),
        ('hailuo-02', 'replicate', 'minimax/hailuo-02', 'per_request', 0.34),
        ('hailuo-02-fast', 'replicate', 'minimax/hailuo-02-fast', 'per_request', 0.25),
        ('hailuo-2.3', 'kie', NULL, 'per_request', 0.50),
        ('hailuo-2.3', 'replicate', 'minimax/hailuo-2.3', 'per_request', 0.59),
        
        -- Sora (Video)
        ('sora-2', 'kie', NULL, 'per_second', 0.08),
        ('sora-2', 'replicate', 'openai/sora-2', 'per_second', 0.10),
        ('sora-2-pro', 'replicate', 'openai/sora-2-pro', 'per_second', 0.50),
        
        -- Seedance (Video)
        ('seedance-pro', 'kie', NULL, 'per_second', 0.12),
        ('seedance-pro', 'replicate', 'bytedance/seedance-1-pro', 'per_second', 0.15),
        ('seedance-pro-fast', 'replicate', 'bytedance/seedance-1-pro-fast', 'per_second', 0.10),
        ('seedance-lite', 'replicate', 'bytedance/seedance-1-lite', 'per_second', 0.05),
        
        -- Flux (Image)
        ('flux-pro', 'kie', NULL, 'per_image', 0.035),
        ('flux-pro', 'replicate', 'black-forest-labs/flux-pro', 'per_image', 0.04),
        ('flux-schnell', 'replicate', 'black-forest-labs/flux-schnell', 'per_image', 0.003),
        ('flux-dev', 'replicate', 'black-forest-labs/flux-dev', 'per_image', 0.025),
        
        -- Stable Diffusion (Image)
        ('sd-3.5-large', 'replicate', 'stability-ai/stable-diffusion-3.5-large', 'per_image', 0.065),
        ('sd-3.5-large-turbo', 'replicate', 'stability-ai/stable-diffusion-3.5-large-turbo', 'per_image', 0.04),
        ('sd-3.5-medium', 'replicate', 'stability-ai/stable-diffusion-3.5-medium', 'per_image', 0.035),
        
        -- Imagen 4 (Image)
        ('imagen-4', 'replicate', 'google/imagen-4', 'per_image', 0.03),
        ('imagen-4-fast', 'replicate', 'google/imagen-4-fast', 'per_image', 0.02),
        ('imagen-4-ultra', 'replicate', 'google/imagen-4-ultra', 'per_image', 0.05),
        
        -- Face Swap (Image)
        ('face-swap', 'replicate', 'omniedgeio/face-swap', 'per_image', 0.01),
        
        -- MiniMax Speech (Audio)
        ('minimax-speech-turbo', 'replicate', 'minimax/speech-02-turbo', 'per_request', 0.02),
        ('minimax-speech-hd', 'replicate', 'minimax/speech-02-hd', 'per_request', 0.04),
        
        -- MiniMax Image
        ('minimax-image', 'replicate', 'minimax/image-01', 'per_image', 0.04),
        
        -- MiniMax Video
        ('minimax-video', 'replicate', 'minimax/video-01', 'per_request', 0.30),
        
        -- Runway (Image only on Replicate)
        ('runway-gen4-image', 'replicate', 'runwayml/gen4-image', 'per_image', 0.05),
        ('runway-gen4-turbo', 'replicate', 'runwayml/gen4-image-turbo', 'per_image', 0.03),
        ('runway-gen4-video', 'replicate', 'runwayml/gen4-turbo', 'per_second', 0.05),
        
        -- Luma (Video/Image)
        ('luma-ray', 'replicate', 'luma/ray', 'per_second', 0.05),
        ('luma-ray-flash', 'replicate', 'luma/ray-flash-2-540p', 'per_second', 0.02),
        ('luma-photon-flash', 'replicate', 'luma/photon-flash', 'per_image', 0.02),
        
        -- Midjourney (KIE only)
        ('midjourney', 'kie', NULL, 'per_image', 0.06)
    """)

    op.add_column('provider_balances', sa.Column('is_auto_balance', sa.Boolean(), server_default='false'))
    
    op.execute("""
        INSERT INTO provider_balances (id, provider, balance_usd, total_deposited_usd, total_spent_usd, is_auto_balance)
        VALUES (gen_random_uuid(), 'replicate', 0, 0, 0, false)
        ON CONFLICT (provider) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_column('provider_balances', 'is_auto_balance')
    op.drop_table('model_provider_prices')
