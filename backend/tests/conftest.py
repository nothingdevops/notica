import base64
import os
import time

import pytest
import pytest_asyncio
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://notica:changeme@localhost:5432/notica",
)


@pytest_asyncio.fixture
async def db_session():
    """Async DB session with per-test transaction rollback for isolation."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.connect() as conn:
        trans = await conn.begin()
        session = AsyncSession(
            bind=conn,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        yield session
        await session.close()
        await trans.rollback()
    await engine.dispose()


def _int_to_b64url(n: int) -> str:
    data = n.to_bytes((n.bit_length() + 7) // 8, "big")
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


@pytest.fixture(scope="session")
def test_rsa_key():
    """Returns (private_pem_bytes, jwks_dict) for a test RSA-2048 keypair."""
    private_key = rsa.generate_private_key(65537, 2048, default_backend())
    private_pem = private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    )
    pub = private_key.public_key().public_numbers()
    jwks = {
        "keys": [
            {
                "kty": "RSA",
                "use": "sig",
                "alg": "RS256",
                "kid": "test-key-1",
                "n": _int_to_b64url(pub.n),
                "e": _int_to_b64url(pub.e),
            }
        ]
    }
    return private_pem, jwks


@pytest.fixture(scope="session")
def valid_token(test_rsa_key):
    from jose import jwt
    private_pem, _ = test_rsa_key
    return jwt.encode(
        {
            "sub": "test-user",
            "preferred_username": "testuser",
            "iss": "http://localhost:8080/auth/realms/notica",
            "exp": int(time.time()) + 300,
        },
        private_pem,
        algorithm="RS256",
    )
