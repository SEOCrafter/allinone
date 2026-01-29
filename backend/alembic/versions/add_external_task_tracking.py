"""add external task tracking

Revision ID: add_external_task_tracking
Revises: add_model_provider_prices
Create Date: 2026-01-29

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_external_task_tracking'
down_revision = 'add_model_provider_prices'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('requests', sa.Column('external_task_id', sa.String(100), nullable=True))
    op.add_column('requests', sa.Column('external_provider', sa.String(50), nullable=True))
    op.add_column('requests', sa.Column('result_url', sa.String(1000), nullable=True))
    op.add_column('requests', sa.Column('result_urls', sa.JSON(), nullable=True))
    
    op.create_index('idx_requests_external_task', 'requests', ['external_task_id'])
    op.create_index('idx_requests_status', 'requests', ['status'])


def downgrade():
    op.drop_index('idx_requests_status')
    op.drop_index('idx_requests_external_task')
    op.drop_column('requests', 'result_urls')
    op.drop_column('requests', 'result_url')
    op.drop_column('requests', 'external_provider')
    op.drop_column('requests', 'external_task_id')