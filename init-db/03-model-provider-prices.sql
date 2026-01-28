-- Migration: Add model_provider_prices table
-- Run this on the database to add Replicate support

-- Create the table
CREATE TABLE IF NOT EXISTS model_provider_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    replicate_model_id VARCHAR(200),
    price_type VARCHAR(20) NOT NULL,
    price_usd DECIMAL(10, 6) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(model_name, provider)
);

-- Add is_auto_balance column to provider_balances
ALTER TABLE provider_balances ADD COLUMN IF NOT EXISTS is_auto_balance BOOLEAN DEFAULT false;

-- Insert Replicate as provider
INSERT INTO provider_balances (id, provider, balance_usd, total_deposited_usd, total_spent_usd, is_auto_balance)
VALUES (gen_random_uuid(), 'replicate', 0, 0, 0, false)
ON CONFLICT (provider) DO NOTHING;

-- Insert model prices
INSERT INTO model_provider_prices (model_name, provider, replicate_model_id, price_type, price_usd, is_active) VALUES
-- Nano Banana (Image)
('nano-banana-pro', 'kie', NULL, 'per_image', 0.04, true),
('nano-banana-pro', 'replicate', 'google/nano-banana-pro', 'per_image', 0.05, false),
('nano-banana', 'kie', NULL, 'per_image', 0.03, true),
('nano-banana', 'replicate', 'google/nano-banana', 'per_image', 0.04, false),

-- Kling (Video)
('kling-2.6-t2v', 'kie', NULL, 'per_second', 0.056, true),
('kling-2.6-t2v', 'replicate', 'kwaivgi/kling-v2.6', 'per_second', 0.06, false),
('kling-2.6-i2v', 'kie', NULL, 'per_second', 0.056, true),
('kling-2.6-i2v', 'replicate', 'kwaivgi/kling-v2.6', 'per_second', 0.06, false),
('kling-2.6-motion', 'kie', NULL, 'per_second', 0.07, true),
('kling-2.6-motion', 'replicate', 'kwaivgi/kling-v2.6-motion-control', 'per_second', 0.06, false),

-- Veo (Video with Audio)
('veo-3', 'kie', NULL, 'per_second', 0.70, true),
('veo-3', 'replicate', 'google/veo-3', 'per_second', 0.75, false),
('veo-3.1', 'kie', NULL, 'per_second', 0.70, true),
('veo-3.1', 'replicate', 'google/veo-3.1', 'per_second', 0.75, false),
('veo-3-fast', 'replicate', 'google/veo-3-fast', 'per_second', 0.15, false),
('veo-2', 'replicate', 'google/veo-2', 'per_second', 0.40, false),

-- Hailuo / MiniMax (Video)
('hailuo-02', 'kie', NULL, 'per_request', 0.30, true),
('hailuo-02', 'replicate', 'minimax/hailuo-02', 'per_request', 0.34, false),
('hailuo-02-fast', 'replicate', 'minimax/hailuo-02-fast', 'per_request', 0.25, false),
('hailuo-2.3', 'kie', NULL, 'per_request', 0.50, true),
('hailuo-2.3', 'replicate', 'minimax/hailuo-2.3', 'per_request', 0.59, false),

-- Sora (Video)
('sora-2', 'kie', NULL, 'per_second', 0.08, true),
('sora-2', 'replicate', 'openai/sora-2', 'per_second', 0.10, false),
('sora-2-pro', 'replicate', 'openai/sora-2-pro', 'per_second', 0.50, false),

-- Seedance (Video)
('seedance-pro', 'kie', NULL, 'per_second', 0.12, true),
('seedance-pro', 'replicate', 'bytedance/seedance-1-pro', 'per_second', 0.15, false),
('seedance-pro-fast', 'replicate', 'bytedance/seedance-1-pro-fast', 'per_second', 0.10, false),
('seedance-lite', 'replicate', 'bytedance/seedance-1-lite', 'per_second', 0.05, false),

-- Flux (Image)
('flux-pro', 'kie', NULL, 'per_image', 0.035, true),
('flux-pro', 'replicate', 'black-forest-labs/flux-pro', 'per_image', 0.04, false),
('flux-schnell', 'replicate', 'black-forest-labs/flux-schnell', 'per_image', 0.003, false),
('flux-dev', 'replicate', 'black-forest-labs/flux-dev', 'per_image', 0.025, false),

-- Stable Diffusion (Image) - Replicate only
('sd-3.5-large', 'replicate', 'stability-ai/stable-diffusion-3.5-large', 'per_image', 0.065, false),
('sd-3.5-large-turbo', 'replicate', 'stability-ai/stable-diffusion-3.5-large-turbo', 'per_image', 0.04, false),
('sd-3.5-medium', 'replicate', 'stability-ai/stable-diffusion-3.5-medium', 'per_image', 0.035, false),

-- Imagen 4 (Image) - Replicate only
('imagen-4', 'replicate', 'google/imagen-4', 'per_image', 0.03, false),
('imagen-4-fast', 'replicate', 'google/imagen-4-fast', 'per_image', 0.02, false),
('imagen-4-ultra', 'replicate', 'google/imagen-4-ultra', 'per_image', 0.05, false),

-- Face Swap (Image) - Replicate only
('face-swap', 'replicate', 'omniedgeio/face-swap', 'per_image', 0.01, false),

-- MiniMax Speech (Audio) - Replicate only
('minimax-speech-turbo', 'replicate', 'minimax/speech-02-turbo', 'per_request', 0.02, false),
('minimax-speech-hd', 'replicate', 'minimax/speech-02-hd', 'per_request', 0.04, false),

-- MiniMax Image - Replicate only
('minimax-image', 'replicate', 'minimax/image-01', 'per_image', 0.04, false),

-- MiniMax Video - Replicate only
('minimax-video', 'replicate', 'minimax/video-01', 'per_request', 0.30, false),

-- Runway (Image/Video) - Replicate only
('runway-gen4-image', 'replicate', 'runwayml/gen4-image', 'per_image', 0.05, false),
('runway-gen4-turbo', 'replicate', 'runwayml/gen4-image-turbo', 'per_image', 0.03, false),
('runway-gen4-video', 'replicate', 'runwayml/gen4-turbo', 'per_second', 0.05, false),

-- Luma (Video/Image) - Replicate only
('luma-ray', 'replicate', 'luma/ray', 'per_second', 0.05, false),
('luma-ray-flash', 'replicate', 'luma/ray-flash-2-540p', 'per_second', 0.02, false),
('luma-photon-flash', 'replicate', 'luma/photon-flash', 'per_image', 0.02, false),

-- Midjourney (KIE only)
('midjourney', 'kie', NULL, 'per_image', 0.06, true)

ON CONFLICT (model_name, provider) DO UPDATE SET
    replicate_model_id = EXCLUDED.replicate_model_id,
    price_type = EXCLUDED.price_type,
    price_usd = EXCLUDED.price_usd;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_model_provider_prices_model ON model_provider_prices(model_name);
CREATE INDEX IF NOT EXISTS idx_model_provider_prices_provider ON model_provider_prices(provider);
CREATE INDEX IF NOT EXISTS idx_model_provider_prices_active ON model_provider_prices(is_active);

-- View current state
SELECT model_name, provider, replicate_model_id, price_type, price_usd, is_active 
FROM model_provider_prices 
ORDER BY model_name, provider;
