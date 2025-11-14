from fastapi import APIRouter, status
from app.core.config import settings


router = APIRouter(tags=["health"])

@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
    }
