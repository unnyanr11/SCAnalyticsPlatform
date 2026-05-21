"""
Thread-safe model registry.

Caches trained XGBoost boosters and Prophet models per product_id
so repeated calls to the same product reuse already-fitted models
(TTL: 30 minutes).
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional


_TTL_SECONDS = 1800   # 30 minutes


@dataclass
class _CacheEntry:
    model:      Any
    fitted_at:  float = field(default_factory=time.monotonic)

    def is_stale(self) -> bool:
        return (time.monotonic() - self.fitted_at) > _TTL_SECONDS


class ModelRegistry:
    """Singleton. Stores {product_id: {model_key: CacheEntry}}."""

    _instance: Optional["ModelRegistry"] = None
    _lock = threading.Lock()

    def __new__(cls) -> "ModelRegistry":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._store: Dict[str, _CacheEntry] = {}
            cls._instance._mu = threading.Lock()
        return cls._instance

    def _key(self, product_id: int, model_name: str) -> str:
        return f"{product_id}:{model_name}"

    def get(self, product_id: int, model_name: str) -> Any | None:
        with self._mu:
            entry = self._store.get(self._key(product_id, model_name))
            if entry is None or entry.is_stale():
                return None
            return entry.model

    def put(self, product_id: int, model_name: str, model: Any) -> None:
        with self._mu:
            self._store[self._key(product_id, model_name)] = _CacheEntry(model=model)

    def evict(self, product_id: int) -> None:
        with self._mu:
            keys = [k for k in self._store if k.startswith(f"{product_id}:")]
            for k in keys:
                del self._store[k]

    def purge_stale(self) -> int:
        """Remove all expired entries. Returns count removed."""
        with self._mu:
            stale = [k for k, v in self._store.items() if v.is_stale()]
            for k in stale:
                del self._store[k]
            return len(stale)


# Module-level singleton
registry = ModelRegistry()
