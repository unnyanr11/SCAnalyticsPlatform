"""Application startup and shutdown event handlers."""

import structlog

from app.db.session  import init_db, close_db
from app.db.redis    import init_redis, close_redis

log = structlog.get_logger(__name__)


async def on_startup() -> None:
    log.info("sca.startup", msg="Initialising database connection pool")
    await init_db()
    log.info("sca.startup", msg="Initialising Redis connection")
    await init_redis()
    log.info("sca.startup", msg="SCAnalyticsPlatform backend ready")


async def on_shutdown() -> None:
    log.info("sca.shutdown", msg="Closing database pool")
    await close_db()
    log.info("sca.shutdown", msg="Closing Redis connection")
    await close_redis()
