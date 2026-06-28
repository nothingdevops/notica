from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    app_env: str = "development"
    log_level: str = "info"
    app_url: str = "http://localhost:5173"
    display_timezone: str = "UTC"

    # SSO — optional Keycloak auth
    sso_enabled: bool = False
    keycloak_url: str = "http://localhost:8080/auth"      # internal URL for JWKS fetch
    keycloak_realm: str = "notica"
    keycloak_client_id: str = "notica-frontend"
    keycloak_issuer: str = ""  # external URL for iss verify; if empty → derive from keycloak_url
    keycloak_required_role: str = "notica-user"  # realm role required to access Notica; "" = no role check

    model_config = {"env_file": (".env", ".env.local"), "extra": "ignore"}


settings = Settings()
