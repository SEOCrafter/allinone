"""add email verification fields

Revision ID: add_email_verification
Revises: 
Create Date: 2026-02-03
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_email_verification'
down_revision = 'add_task_events'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('users', sa.Column('email_verified', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('users', sa.Column('verification_token', sa.String(255), nullable=True))
    op.execute("UPDATE users SET email_verified = true WHERE email IS NOT NULL")

def downgrade():
    op.drop_column('users', 'verification_token')
    op.drop_column('users', 'email_verified')
