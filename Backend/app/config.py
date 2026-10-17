from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://app_user:app_pw@localhost:5433/agencydesk"
    system_database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5433/agencydesk"
    jwt_secret: str = "agencydesk-dev-only-change-in-production"
    identity_ttl_minutes: int = 10
    workspace_ttl_minutes: int = 60
    storage_dir: str = "./storage"
    max_upload_bytes: int = 10 * 1024 * 1024
    frontend_origin: str = "http://localhost:5173"


settings = Settings()
