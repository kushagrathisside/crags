"""
Application-level response cache.

Two backends share the same public API (get / set / delete):
  - _RedisCache     — distributed, survives restarts, works across replicas
  - _InMemoryCache  — fallback when Redis is not configured or unreachable

The active instance is resolved once at first call via get_cache(), using the
same double-checked-locking pattern as the login rate limiter.

Keys and TTLs
-------------
  crags:cache:systems         60 s  — GET /api/v1/systems/ (unfiltered)
  crags:cache:policies       300 s  — GET /api/v1/policies
  crags:cache:billing:costs  300 s  — GET /api/v1/billing/costs

Cache misses return None.  Values are stored as JSON so both backends return
the same types (list[dict]) — FastAPI's response_model coerces dicts to the
declared Pydantic schema transparently.

Any write to a cached collection should call get_cache().delete(key) to
invalidate.  The health-check reconciler does this automatically for the
systems key when it transitions system statuses.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from typing import Any

_logger = logging.getLogger(__name__)

# ── cache keys (importable constants for callsites) ────────────────────────────
KEY_SYSTEMS = "crags:cache:systems"
KEY_POLICIES = "crags:cache:policies"
KEY_BILLING_COSTS = "crags:cache:billing:costs"

TTL_SYSTEMS = 60      # seconds — health monitor fires every 5 min; 60 s is safe
TTL_POLICIES = 300    # seconds — policies change rarely
TTL_BILLING_COSTS = 300


# ── backends ───────────────────────────────────────────────────────────────────

class _InMemoryCache:
    def __init__(self) -> None:
        self._store: dict[str, tuple[Any, float]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Any | None:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.monotonic() > expires_at:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl: int) -> None:
        with self._lock:
            self._store[key] = (value, time.monotonic() + ttl)

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)


class _RedisCache:
    def __init__(self, client: Any) -> None:
        self._r = client

    def get(self, key: str) -> Any | None:
        raw = self._r.get(key)
        if raw is None:
            return None
        return json.loads(raw)

    def set(self, key: str, value: Any, ttl: int) -> None:
        # default=str handles datetime objects serialised by jsonable_encoder
        self._r.setex(key, ttl, json.dumps(value, default=str))

    def delete(self, key: str) -> None:
        self._r.delete(key)


# ── singleton resolution ───────────────────────────────────────────────────────

_instance: "_InMemoryCache | _RedisCache | None" = None
_init_lock = threading.Lock()


def get_cache() -> "_InMemoryCache | _RedisCache":
    global _instance
    if _instance is not None:
        return _instance
    with _init_lock:
        if _instance is not None:
            return _instance
        from crags.core.config import settings
        if settings.REDIS_URL:
            try:
                import redis as _redis
                client = _redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_timeout=2,
                    socket_connect_timeout=2,
                )
                client.ping()
                _instance = _RedisCache(client)
                _logger.info("Cache: Redis at %s", settings.REDIS_URL)
                return _instance
            except Exception:
                _logger.warning(
                    "Cache: Redis unavailable — falling back to in-memory cache"
                )
        _instance = _InMemoryCache()
        if not settings.REDIS_URL:
            _logger.info("Cache: in-memory (set REDIS_URL for distributed mode)")
        return _instance
