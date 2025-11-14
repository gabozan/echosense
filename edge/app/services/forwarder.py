import logging
from typing import Any, Dict
import httpx
from app.core.config import settings


logger = logging.getLogger(__name__)

async def forward_to_cloud(payload: Dict[str, Any]) -> httpx.Response:
    """
    Forwards the validated payload to the cloud endpoint (Azure).
    Implements basic retry logic in case of network errors.
    """
    if not settings.CLOUD_API_URL:
        logger.error("CLOUD_API_URL is not configured in environment variables.")
        raise RuntimeError("CLOUD_API_URL is not configured")

    headers = {
        "Content-Type": "application/json",
    }

    if settings.CLOUD_API_KEY:
        headers["X-API-Key"] = settings.CLOUD_API_KEY

    attempt = 0
    last_exc: Exception | None = None

    async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT) as client:
        while attempt <= settings.MAX_RETRIES:
            try:
                logger.info(
                    "Sending payload to cloud (attempt %d/%d)",
                    attempt + 1,
                    settings.MAX_RETRIES + 1,
                )
                response = await client.post(
                    settings.CLOUD_API_URL,
                    json=payload,
                    headers=headers,
                )
                logger.info(
                    "Cloud response: %s %s",
                    response.status_code,
                    response.reason_phrase,
                )
                response.raise_for_status()
                return response
            except (httpx.RequestError, httpx.HTTPStatusError) as exc:
                last_exc = exc
                logger.warning(
                    "Error sending to cloud on attempt %d: %s", attempt + 1, exc
                )
                attempt += 1

    logger.error("Final failure sending to cloud after multiple retries.")
    raise RuntimeError(f"Could not forward payload to cloud: {last_exc}")
