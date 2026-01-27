"""add provider balances table

Revision ID: add_provider_balances
Revises: add_user_role
Create Date: 2026-01-25
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_provider_balances'
down_revision = 'add_user_role_001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'provider_balances',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('provider', sa.String(50), nullable=False, unique=True),
        sa.Column('balance_usd', sa.Numeric(12, 6), nullable=False, default=0),
        sa.Column('total_deposited_usd', sa.Numeric(12, 6), nullable=False, default=0),
        sa.Column('total_spent_usd', sa.Numeric(12, 6), nullable=False, default=0),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    
    # Вставляем начальные записи
    op.execute("""
        INSERT INTO provider_balances (id, provider, balance_usd, total_deposited_usd, total_spent_usd)
        VALUES 
            ('pb-openai-001', 'openai', 0, 0, 0),
            ('pb-anthropic-001', 'anthropic', 0, 0, 0)
    """)


def downgrade():
    op.drop_table('provider_balances')