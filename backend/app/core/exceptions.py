"""Application-level exception hierarchy and FastAPI exception handlers."""

from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError


class SCAException(Exception):
    """Base for all SC Analytics domain exceptions."""
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    detail:      str = "Internal server error"

    def __init__(self, detail: str | None = None) -> None:
        self.detail = detail or self.__class__.detail
        super().__init__(self.detail)


class NotFoundError(SCAException):
    status_code = status.HTTP_404_NOT_FOUND
    detail      = "Resource not found"


class CacheError(SCAException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    detail      = "Cache unavailable"


class RateLimitError(SCAException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    detail      = "Rate limit exceeded"


class ValidationError(SCAException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    detail      = "Validation failed"


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(SCAException)
    async def sca_handler(
        _request: Request, exc: SCAException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.detail},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"error": "Validation error", "detail": exc.errors()},
        )
