from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Set to "production" to enable strict security checks at startup.
    APP_ENV: str = "development"

    DATABASE_URL: str
    JWT_SECRET_KEY: str = "dev-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REFRESH_COOKIE_NAME: str = "crags_refresh"
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 60

    FRONTEND_ORIGINS: str = "http://localhost:5173"
    AUTH_COOKIE_NAME: str = "crags_session"
    AUTH_COOKIE_SECURE: bool = False
    AUTH_COOKIE_SAMESITE: str = "lax"
    AUTH_COOKIE_DOMAIN: str | None = None

    SUPERADMIN_USERNAME: str = "superadmin"
    SUPERADMIN_EMAIL: str = "superadmin@crags.local"
    SUPERADMIN_PASSWORD: str = ""
    SUPERADMIN_GROUP_NAME: str = "platform-admins"

    # Redis — optional; used for distributed login rate limiting.
    # Leave empty to use the in-process fallback (single-replica only).
    REDIS_URL: str = ""

    # Scheduler
    RECONCILE_INTERVAL_MINUTES: int = 5
    AUDIT_RETAIN_DAYS: int = 90

    # Notifications — all optional; EMAIL_ENABLED=False disables SMTP and logs instead.
    FRONTEND_URL: str = "http://localhost:5173"
    EMAIL_ENABLED: bool = False
    EMAIL_FROM: str = "crags@localhost"
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True

    def frontend_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.FRONTEND_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"


settings = Settings()
