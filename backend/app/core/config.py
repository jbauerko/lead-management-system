from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+psycopg://leads:leads@localhost:5432/leads"
    frontend_origin: str = "http://localhost:5173"
    pdf_storage_path: str = "./data/pdfs"


@lru_cache
def get_settings() -> Settings:
    return Settings()

