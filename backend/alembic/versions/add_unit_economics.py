"""add unit_economics table

Revision ID: add_unit_economics
Revises: add_user_role
Create Date: 2025-01-27

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'add_unit_economics'
down_revision: Union[str, None] = 'add_user_role_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'unit_economics',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='RUB'),
        sa.Column('subscription_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('credits_in_plan', sa.Integer(), nullable=False),
        sa.Column('requests_in_plan', sa.Integer(), nullable=False),
        sa.Column('avg_tokens_input', sa.Integer(), nullable=False, server_default='500'),
        sa.Column('avg_tokens_output', sa.Integer(), nullable=False, server_default='1000'),
        sa.Column('overhead_percent', sa.Numeric(5, 2), nullable=False, server_default='15'),
        sa.Column('selected_model', sa.String(100), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('unit_economics')
