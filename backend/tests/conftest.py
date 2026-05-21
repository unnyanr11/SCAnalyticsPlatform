"""
SC Analytics Platform — Pytest Configuration

Shared fixtures for the test suite.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    """Async HTTP client pointed at the FastAPI test app."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"
