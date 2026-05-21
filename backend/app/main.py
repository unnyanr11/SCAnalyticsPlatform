"""
SC Analytics Platform — FastAPI Backend Entry Point

Strictly an analytics and decision-support API.
No gameplay automation. No account interactions.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SC Analytics Platform API",
    description=(
        "AI-powered market intelligence for Sim Companies. "
        "Analytics, forecasting, and decision support only. "
        "This API never automates gameplay."
    ),
    version="1.0.0",
    docs_url="/docs" if settings.APP_DEBUG else None,
    redoc_url="/redoc" if settings.APP_DEBUG else None,
)

# ---------------------------------------------------------------------------
# CORS — only allow the extension origin and local dev
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.APP_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["system"])
async def health() -> JSONResponse:
    """Liveness probe. Returns 200 when the API is running."""
    return JSONResponse({"status": "ok", "version": app.version})


# ---------------------------------------------------------------------------
# Routers (imported as features are built)
# ---------------------------------------------------------------------------
# from app.api import market, predictions, phases, arbitrage, optimizer
# app.include_router(market.router, prefix="/api/v1/market", tags=["market"])
# app.include_router(predictions.router, prefix="/api/v1/predictions", tags=["predictions"])
# app.include_router(phases.router, prefix="/api/v1/phases", tags=["phases"])
# app.include_router(arbitrage.router, prefix="/api/v1/arbitrage", tags=["arbitrage"])
# app.include_router(optimizer.router, prefix="/api/v1/optimizer", tags=["optimizer"])
