from contextlib import contextmanager

from sqlalchemy import create_engine, text

from .config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
system_engine = create_engine(settings.system_database_url, pool_pre_ping=True)


@contextmanager
def tenant_session(agency_id):
    with engine.begin() as conn:
        conn.execute(text("SELECT set_config('app.agency_id', :v, true)"), {"v": str(agency_id)})
        yield conn
