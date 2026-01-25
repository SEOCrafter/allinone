"""Initial tables

Revision ID: 83ee20f0db58
Revises: 
Create Date: 2026-01-25 13:14:30.238708

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '83ee20f0db58'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table('plans',
    sa.Column('name', sa.String(length=50), nullable=False),
    sa.Column('slug', sa.String(length=50), nullable=False),
    sa.Column('price_monthly', sa.DECIMAL(precision=10, scale=2), nullable=False),
    sa.Column('price_yearly', sa.DECIMAL(precision=10, scale=2), nullable=False),
    sa.Column('credits_monthly', sa.DECIMAL(precision=12, scale=2), nullable=False),
    sa.Column('rate_limit_rpm', sa.Integer(), nullable=False),
    sa.Column('max_file_size_mb', sa.Integer(), nullable=False),
    sa.Column('features', sa.JSON(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('slug')
    )
    op.create_table('providers',
    sa.Column('name', sa.String(length=50), nullable=False),
    sa.Column('display_name', sa.String(length=100), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('health_status', sa.String(length=20), nullable=False),
    sa.Column('fallback_provider_id', sa.Uuid(), nullable=True),
    sa.Column('priority', sa.Integer(), nullable=False),
    sa.Column('config', sa.JSON(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['fallback_provider_id'], ['providers.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_table('users',
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('password_hash', sa.String(length=255), nullable=True),
    sa.Column('telegram_id', sa.BigInteger(), nullable=True),
    sa.Column('phone', sa.String(length=20), nullable=True),
    sa.Column('credits_balance', sa.DECIMAL(precision=12, scale=2), nullable=False),
    sa.Column('language', sa.String(length=5), nullable=False),
    sa.Column('timezone', sa.String(length=50), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('is_blocked', sa.Boolean(), nullable=False),
    sa.Column('blocked_reason', sa.Text(), nullable=True),
    sa.Column('blocked_until', sa.DateTime(), nullable=True),
    sa.Column('rate_limit_rpm', sa.Integer(), nullable=True),
    sa.Column('deleted_at', sa.DateTime(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email'),
    sa.UniqueConstraint('telegram_id')
    )
    op.create_table('api_keys',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('key_hash', sa.String(length=64), nullable=False),
    sa.Column('key_prefix', sa.String(length=8), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('rate_limit_rpm', sa.Integer(), nullable=True),
    sa.Column('allowed_endpoints', sa.JSON(), nullable=True),
    sa.Column('expires_at', sa.DateTime(), nullable=True),
    sa.Column('last_used_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default='now()', nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('promo_codes',
    sa.Column('code', sa.String(length=50), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('credits_amount', sa.DECIMAL(precision=10, scale=2), nullable=True),
    sa.Column('discount_percent', sa.Integer(), nullable=True),
    sa.Column('trial_days', sa.Integer(), nullable=True),
    sa.Column('plan_id', sa.Uuid(), nullable=True),
    sa.Column('max_uses', sa.Integer(), nullable=True),
    sa.Column('used_count', sa.Integer(), nullable=False),
    sa.Column('min_topup_amount', sa.DECIMAL(precision=10, scale=2), nullable=True),
    sa.Column('valid_from', sa.DateTime(), server_default='now()', nullable=False),
    sa.Column('valid_until', sa.DateTime(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_by', sa.Uuid(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default='now()', nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['plan_id'], ['plans.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code')
    )
    op.create_table('provider_pricing',
    sa.Column('provider_id', sa.Uuid(), nullable=False),
    sa.Column('model', sa.String(length=100), nullable=False),
    sa.Column('display_name', sa.String(length=100), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('price_input_per_1k', sa.DECIMAL(precision=10, scale=6), nullable=False),
    sa.Column('price_output_per_1k', sa.DECIMAL(precision=10, scale=6), nullable=False),
    sa.Column('price_per_request', sa.DECIMAL(precision=10, scale=4), nullable=False),
    sa.Column('credits_input_per_1k', sa.DECIMAL(precision=10, scale=4), nullable=False),
    sa.Column('credits_output_per_1k', sa.DECIMAL(precision=10, scale=4), nullable=False),
    sa.Column('credits_per_request', sa.DECIMAL(precision=10, scale=4), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('capabilities', sa.JSON(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['provider_id'], ['providers.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('transactions',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('amount_currency', sa.DECIMAL(precision=12, scale=2), nullable=False),
    sa.Column('currency', sa.String(length=3), nullable=False),
    sa.Column('credits_added', sa.DECIMAL(precision=12, scale=2), nullable=False),
    sa.Column('payment_method', sa.String(length=50), nullable=True),
    sa.Column('payment_provider', sa.String(length=50), nullable=True),
    sa.Column('external_id', sa.String(length=255), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('extra_data', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default='now()', nullable=False),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('user_subscriptions',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('plan_id', sa.Uuid(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('current_period_start', sa.DateTime(), nullable=False),
    sa.Column('current_period_end', sa.DateTime(), nullable=False),
    sa.Column('cancel_at_period_end', sa.Boolean(), nullable=False),
    sa.Column('payment_provider', sa.String(length=50), nullable=True),
    sa.Column('external_subscription_id', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default='now()', nullable=False),
    sa.Column('cancelled_at', sa.DateTime(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['plan_id'], ['plans.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('promo_activations',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('promo_code_id', sa.Uuid(), nullable=False),
    sa.Column('credits_received', sa.DECIMAL(precision=10, scale=2), nullable=True),
    sa.Column('discount_applied', sa.DECIMAL(precision=10, scale=2), nullable=True),
    sa.Column('transaction_id', sa.Uuid(), nullable=True),
    sa.Column('activated_at', sa.DateTime(), server_default='now()', nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['promo_code_id'], ['promo_codes.id'], ),
    sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('requests',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('api_key_id', sa.Uuid(), nullable=True),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('endpoint', sa.String(length=100), nullable=False),
    sa.Column('provider_id', sa.Uuid(), nullable=False),
    sa.Column('model', sa.String(length=100), nullable=False),
    sa.Column('prompt', sa.Text(), nullable=True),
    sa.Column('params', sa.JSON(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('credits_spent', sa.DECIMAL(precision=10, scale=4), nullable=False),
    sa.Column('provider_cost', sa.DECIMAL(precision=10, scale=6), nullable=False),
    sa.Column('tokens_input', sa.Integer(), nullable=True),
    sa.Column('tokens_output', sa.Integer(), nullable=True),
    sa.Column('error_code', sa.String(length=50), nullable=True),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('retry_count', sa.Integer(), nullable=False),
    sa.Column('parent_request_id', sa.Uuid(), nullable=True),
    sa.Column('is_favorite', sa.Boolean(), nullable=False),
    sa.Column('ip_address', sa.String(length=45), nullable=True),
    sa.Column('user_agent', sa.String(length=500), nullable=True),
    sa.Column('started_at', sa.DateTime(), nullable=True),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['api_key_id'], ['api_keys.id'], ),
    sa.ForeignKeyConstraint(['parent_request_id'], ['requests.id'], ),
    sa.ForeignKeyConstraint(['provider_id'], ['providers.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('request_files',
    sa.Column('request_id', sa.Uuid(), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('original_name', sa.String(length=255), nullable=False),
    sa.Column('storage_path', sa.String(length=500), nullable=False),
    sa.Column('public_url', sa.String(length=500), nullable=True),
    sa.Column('mime_type', sa.String(length=100), nullable=False),
    sa.Column('size_bytes', sa.Integer(), nullable=False),
    sa.Column('file_metadata', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default='now()', nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['request_id'], ['requests.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('results',
    sa.Column('request_id', sa.Uuid(), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('content', sa.Text(), nullable=True),
    sa.Column('storage_path', sa.String(length=500), nullable=True),
    sa.Column('public_url', sa.String(length=500), nullable=True),
    sa.Column('mime_type', sa.String(length=100), nullable=True),
    sa.Column('size_bytes', sa.Integer(), nullable=True),
    sa.Column('file_metadata', sa.JSON(), nullable=True),
    sa.Column('expires_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default='now()', nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['request_id'], ['requests.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

def downgrade() -> None:
    op.drop_table('results')
    op.drop_table('request_files')
    op.drop_table('requests')
    op.drop_table('promo_activations')
    op.drop_table('user_subscriptions')
    op.drop_table('transactions')
    op.drop_table('provider_pricing')
    op.drop_table('promo_codes')
    op.drop_table('api_keys')
    op.drop_table('users')
    op.drop_table('providers')
    op.drop_table('plans')
