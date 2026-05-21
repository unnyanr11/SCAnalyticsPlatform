"""Shared async HTTP client with retry, rate-limit, and circuit-breaker support.

All API adapters import `build_client()` and call `request()` on it.
This keeps transport concerns out of the adapter layer.
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
    before_sleep_log,
)

from app.core.config import settings

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rate-limit token bucket (per-host)
# ---------------------------------------------------------------------------

@dataclass
class _TokenBucket:
    """Simple async token bucket for per-host rate limiting."""
    rate: float          # tokens/second
    capacity: float
    _tokens: float = field(init=False)
    _last: float  = field(init=False)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False, repr=False)

    def __post_init__(self) -> None:
        self._tokens = self.capacity
        self._last   = time.monotonic()

    async def acquire(self) -> None:
        async with self._lock:
            now    = time.monotonic()
            elapsed = now - self._last
            self._last = now
            self._tokens = min(self.capacity, self._tokens + elapsed * self.rate)
            if self._tokens < 1:
                wait = (1 - self._tokens) / self.rate
                log.debug("Rate-limit bucket: sleeping %.2fs", wait)
                await asyncio.sleep(wait)
                self._tokens = 0
            else:
                self._tokens -= 1


# One bucket per upstream host
_BUCKETS: dict[str, _TokenBucket] = {
    "www.simcompanies.com": _TokenBucket(rate=2.0, capacity=5),   # 2 req/s, burst 5
    "simcotools.app":       _TokenBucket(rate=3.0, capacity=10),
    "api.simcotools.com":   _TokenBucket(rate=3.0, capacity=10),
}


def _bucket_for(url: str) -> _TokenBucket | None:
    for host, bucket in _BUCKETS.items():
        if host in url:
            return bucket
    return None


# ---------------------------------------------------------------------------
# Shared client
# ---------------------------------------------------------------------------

class AsyncHttpClient:
    """Thin async HTTP client wrapper.

    Features:
    - Exponential back-off retry (tenacity)
    - Per-host token-bucket rate limiting
    - Configurable timeouts
    - Automatic JSON decoding
    """

    def __init__(
        self,
        base_url: str = "",
        headers: dict[str, str] | None = None,
        timeout: float = 15.0,
        max_retries: int = 3,
    ) -> None:
        self._base_url = base_url
        self._timeout  = timeout
        self._max_retries = max_retries
        self._headers = {
            "Accept": "application/json",
            "User-Agent": f"SCAnalyticsPlatform/{settings.APP_VERSION}",
            **(headers or {}),
        }
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "AsyncHttpClient":
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers=self._headers,
            timeout=httpx.Timeout(self._timeout),
            follow_redirects=True,
            http2=True,
        )
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._client:
            await self._client.aclose()

    async def request(
        self,
        method: str,
        url: str,
        **kwargs: Any,
    ) -> Any:
        """Send a request with retry + rate-limiting. Returns parsed JSON."""
        bucket = _bucket_for(self._base_url + url)

        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(self._max_retries),
            wait=wait_exponential(multiplier=1, min=1, max=30),
            retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
            before_sleep=before_sleep_log(log, logging.WARNING),
            reraise=True,
        ):
            with attempt:
                if bucket:
                    await bucket.acquire()

                assert self._client is not None
                resp = await self._client.request(method, url, **kwargs)

                # Honour 429 Retry-After
                if resp.status_code == 429:
                    retry_after = float(resp.headers.get("Retry-After", "5"))
                    log.warning("429 rate-limited on %s — sleeping %ss", url, retry_after)
                    await asyncio.sleep(retry_after)
                    raise httpx.HTTPStatusError(
                        "429", request=resp.request, response=resp
                    )

                resp.raise_for_status()
                return resp.json()

    async def get(self, url: str, **kwargs: Any) -> Any:
        return await self.request("GET", url, **kwargs)


def build_client(
    base_url: str,
    extra_headers: dict[str, str] | None = None,
    timeout: float = 15.0,
    max_retries: int = 3,
) -> AsyncHttpClient:
    return AsyncHttpClient(
        base_url=base_url,
        headers=extra_headers,
        timeout=timeout,
        max_retries=max_retries,
    )
