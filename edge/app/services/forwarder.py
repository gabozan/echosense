import logging
import asyncio
import httpx
from typing import Any, Dict, Optional
from app.core.config import settings

LOGGER = logging.getLogger(__name__)

async def forward_to_cloud(payload: Dict[str, Any]) -> httpx.Response:
    if not settings.CLOUD_API_URL:
        LOGGER.error("Error: CLOUD_API_URL is not configured.")
        raise RuntimeError("CLOUD_API_URL is missing")

    headers = {"Content-Type": "application/json"}

    last_exc: Optional[Exception] = None
    
    async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT) as client:
        for attempt in range(settings.MAX_RETRIES + 1):
            try:
                LOGGER.info(f"Info: Cloud upload attempt {attempt + 1}/{settings.MAX_RETRIES + 1}")
                
                response = await client.post(
                    f"{settings.CLOUD_API_URL}/ingestData", 
                    json=payload, 
                    headers=headers
                )
                
                response.raise_for_status()
                
                LOGGER.info(f"Info: Successfully sent to cloud. Status: {response.status_code}")
                return response

            except (httpx.RequestError, httpx.HTTPStatusError) as exc:
                last_exc = exc
                LOGGER.warning(f"Warning: Attempt {attempt + 1} failed: {exc}")
                
                if attempt < settings.MAX_RETRIES:
                    await asyncio.sleep(0.5)

    LOGGER.error("Error: All attempts to send data to the cloud have failed.")
    raise RuntimeError(f"Cloud communication error: {last_exc}")