from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET_KEY: str = "dev-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    FRONTEND_ORIGINS: str = "http://localhost:5173"
    AUTH_COOKIE_NAME: str = "crags_session"
    AUTH_COOKIE_SECURE: bool = False
    AUTH_COOKIE_SAMESITE: str = "lax"
    AUTH_COOKIE_DOMAIN: str | None = None

    SUPERADMIN_USERNAME: str = "superadmin"
    SUPERADMIN_EMAIL: str = "superadmin@crags.local"
    SUPERADMIN_PASSWORD: str = ""
    SUPERADMIN_GROUP_NAME: str = "platform-admins"

    def frontend_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.FRONTEND_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"


settings = Settings()
