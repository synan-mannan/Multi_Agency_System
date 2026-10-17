from pathlib import Path

from alembic import op

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    schema = Path(__file__).resolve().parents[1].joinpath("schema.sql").read_text()
    op.get_bind().exec_driver_sql(schema.replace("%", "%%"))


def downgrade():
    raise NotImplementedError("The initial schema migration is intentionally irreversible")
