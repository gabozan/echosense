import logging
import time
import asyncio
from typing import Any, Dict
import httpx
from app.core.config import settings


logger = logging.getLogger(__name__)

async def forward_to_cloud(payload: Dict[str, Any]) -> httpx.Response:
    if not settings.CLOUD_API_URL:
        logger.error("​❌ CLOUD_API_URL is not configured in environment variables.")
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
                    "☁️ Sending payload to cloud (attempt %d/%d)", 
                    attempt + 1, 
                    settings.MAX_RETRIES + 1
                )

                start = time.perf_counter()
                response = await client.post(
                    settings.CLOUD_API_URL,
                    json=payload,
                    headers=headers
                )
                latency_ms = (time.perf_counter() - start) * 1000
                
                logger.info(
                    "Cloud response: %s %s (latency: %.2f ms)", 
                    response.status_code, 
                    response.reason_phrase, 
                    latency_ms
                )

                response.raise_for_status()
                return response
            except httpx.RequestError as exc:
                last_exc = exc
                logger.warning(
                    "🌐 Network error on attempt %d: %s",
                    attempt + 1,
                    exc,
                )
            except httpx.HTTPStatusError as exc:
                last_exc = exc
                logger.warning(
                    "⚠️​ Cloud returned error status on attempt %d: %s",
                    attempt + 1,
                    exc,
                )
            attempt += 1
            await asyncio.sleep(0.5)

    logger.error("❌ Final failure sending to cloud after %d attempts.", settings.MAX_RETRIES + 1)
    raise RuntimeError(f"Could not forward payload to cloud: {last_exc}")
