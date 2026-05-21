"""SC Analytics Platform — FastAPI Application Entry Point."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config   import settings
from app.core.logging  import configure_logging
from app.core.events   import on_startup, on_shutdown
from app.api.router    import api_router
from app.websocket.router import ws_router

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await on_startup()
    yield
    await on_shutdown()


def create_app() -> FastAPI:
    app = FastAPI(
        title="SC Analytics Platform API",
        description="AI-powered market intelligence backend for Sim Companies.",
        version="0.1.0",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # --- Middleware ---
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # --- Routers ---
    app.include_router(api_router,  prefix=settings.API_PREFIX)
    app.include_router(ws_router,   prefix="/ws")

    return app


app = create_app()
