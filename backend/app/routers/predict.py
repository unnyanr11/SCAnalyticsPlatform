"""
FastAPI router — /api/v1/predict

Endpoints:
  POST /api/v1/predict                       — run a full prediction
  GET  /api/v1/predict/{product_id}/latest   — return cached latest prediction
"""
from __future__ import annotations

import logging
import time
from typing import Dict

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from fastapi.responses import JSONResponse

from ..ai.profit_predictor import ProfitPredictor
from ..ai.schemas import PredictionRequest, PredictionResult

logger  = logging.getLogger(__name__)
router  = APIRouter(prefix="/api/v1/predict", tags=["AI Predictor"])

# Module-level predictor (shared across requests)
_predictor = ProfitPredictor()

# Simple in-memory LRU-like cache: {product_id: PredictionResult}
_cache: Dict[int, PredictionResult] = {}
_CACHE_TTL_MS = 5 * 60 * 1000   # 5 minutes


def _is_fresh(result: PredictionResult) -> bool:
    return (int(time.time() * 1000) - result.generated_at) < _CACHE_TTL_MS


# ---------------------------------------------------------------------------
# POST /api/v1/predict
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=PredictionResult,
    summary="Run AI profit prediction",
    description=(
        "Accepts historical market data and returns a full prediction "
        "including Prophet forecasts, XGBoost margins, risk scores, "
        "and AI-generated reasoning."
    ),
)
async def predict(
    request:          PredictionRequest,
    background_tasks: BackgroundTasks,
) -> PredictionResult:
    # Return fresh cached result if available
    cached = _cache.get(request.product_id)
    if cached and _is_fresh(cached):
        logger.debug("[predict] cache hit product_id=%d", request.product_id)
        return cached

    try:
        result = await _predictor.predict(request)
    except Exception as exc:
        logger.exception("[predict] prediction failed for product_id=%d", request.product_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {exc}",
        ) from exc

    _cache[request.product_id] = result

    # Background: purge stale model registry entries periodically
    background_tasks.add_task(_purge_registry)

    return result


# ---------------------------------------------------------------------------
# GET /api/v1/predict/{product_id}/latest
# ---------------------------------------------------------------------------

@router.get(
    "/{product_id}/latest",
    response_model=PredictionResult,
    summary="Get latest cached prediction",
)
async def get_latest(product_id: int) -> PredictionResult:
    result = _cache.get(product_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No prediction cached for product_id={product_id}.",
        )
    if not _is_fresh(result):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cached prediction is stale. Submit a new /predict request.",
        )
    return result


# ---------------------------------------------------------------------------
# GET /api/v1/predict/health
# ---------------------------------------------------------------------------

@router.get("/health", include_in_schema=False)
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "cache_size": len(_cache)})


def _purge_registry() -> None:
    from ..ai.model_registry import registry
    removed = registry.purge_stale()
    if removed:
        logger.debug("[ModelRegistry] purged %d stale entries", removed)
