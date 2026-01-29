"""add task events table

Revision ID: add_task_events
Revises: add_external_task_tracking
Create Date: 2026-01-29

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision = 'add_task_events'
down_revision = 'add_external_task_tracking'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'task_events',
        sa.Column('id', UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('request_id', UUID(), sa.ForeignKey('requests.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('external_status', sa.String(50), nullable=True),
        sa.Column('response_data', JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    
    op.create_index('idx_task_events_request_id', 'task_events', ['request_id'])
    op.create_index('idx_task_events_created_at', 'task_events', ['created_at'])


def downgrade():
    op.drop_index('idx_task_events_created_at')
    op.drop_index('idx_task_events_request_id')
    op.drop_table('task_events')