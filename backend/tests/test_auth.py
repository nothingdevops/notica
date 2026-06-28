import time
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt as jose_jwt


@pytest.mark.asyncio
async def test_sso_disabled_passes_without_token():
    """When SSO off, require_auth must pass even with no token."""
    from app.core.auth import require_auth
    with patch("app.core.auth.settings") as mock_cfg:
        mock_cfg.sso_enabled = False
        result = await require_auth(None)
    assert result == {}


@pytest.mark.asyncio
async def test_sso_enabled_no_token_raises_401():
    """When SSO on, missing token must raise 401."""
    from app.core.auth import require_auth
    with patch("app.core.auth.settings") as mock_cfg:
        mock_cfg.sso_enabled = True
        with pytest.raises(HTTPException) as exc:
            await require_auth(None)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_malformed_token_raises_401():
    """Token that is not valid JWT must raise 401."""
    from app.core.auth import require_auth
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not.a.jwt")
    with patch("app.core.auth._get_jwks", new=AsyncMock(return_value={"keys": []})):
        with patch("app.core.auth.settings") as mock_cfg:
            mock_cfg.sso_enabled = True
            mock_cfg.keycloak_url = "http://localhost:8080/auth"
            mock_cfg.keycloak_realm = "notica"
            mock_cfg.keycloak_issuer = ""
            with pytest.raises(HTTPException) as exc:
                await require_auth(credentials)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_expired_token_raises_401(test_rsa_key):
    """A correctly signed but expired token must raise 401."""
    from app.core.auth import require_auth
    private_pem, jwks = test_rsa_key
    expired = jose_jwt.encode(
        {
            "sub": "u1",
            "iss": "http://localhost:8080/auth/realms/notica",
            "exp": int(time.time()) - 10,
        },
        private_pem,
        algorithm="RS256",
    )
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=expired)
    with patch("app.core.auth._get_jwks", new=AsyncMock(return_value=jwks)):
        with patch("app.core.auth.settings") as mock_cfg:
            mock_cfg.sso_enabled = True
            mock_cfg.keycloak_url = "http://localhost:8080/auth"
            mock_cfg.keycloak_realm = "notica"
            mock_cfg.keycloak_issuer = ""
            with pytest.raises(HTTPException) as exc:
                await require_auth(credentials)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_valid_token_returns_payload(test_rsa_key, valid_token):
    """A valid non-expired token signed by our key must return the JWT payload."""
    from app.core.auth import require_auth
    _, jwks = test_rsa_key
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=valid_token)
    with patch("app.core.auth._get_jwks", new=AsyncMock(return_value=jwks)):
        with patch("app.core.auth.settings") as mock_cfg:
            mock_cfg.sso_enabled = True
            mock_cfg.keycloak_url = "http://localhost:8080/auth"
            mock_cfg.keycloak_realm = "notica"
            mock_cfg.keycloak_issuer = "http://localhost:8080/auth/realms/notica"
            payload = await require_auth(credentials)
    assert payload["sub"] == "test-user"
    assert payload["preferred_username"] == "testuser"
