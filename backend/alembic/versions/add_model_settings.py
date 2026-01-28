"""add model_settings table

Revision ID: add_model_settings
Revises: add_unit_economics
Create Date: 2026-01-28

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'add_model_settings'
down_revision: Union[str, None] = 'add_unit_economics'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'model_settings',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('model_id', sa.String(100), nullable=False),
        sa.Column('credits_price', sa.Numeric(10, 6), nullable=True),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint('provider', 'model_id', name='uq_provider_model'),
    )
    op.create_index('idx_model_settings_provider', 'model_settings', ['provider'])
    op.create_index('idx_model_settings_enabled', 'model_settings', ['is_enabled'])


def downgrade() -> None:
    op.drop_index('idx_model_settings_enabled')
    op.drop_index('idx_model_settings_provider')
    op.drop_table('model_settings')
