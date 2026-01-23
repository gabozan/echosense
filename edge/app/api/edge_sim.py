import logging
from fastapi import APIRouter, HTTPException, status
from app.models.payloads import DevicePayload
from app.services.forwarder import forward_to_cloud


logger = logging.getLogger(__name__)

router = APIRouter(tags=["edge"])

@router.post("/edge-sim", status_code=status.HTTP_202_ACCEPTED)
async def receive_from_device(payload: DevicePayload):
    data = payload.model_dump(by_alias=True)
    logger.info("Info: Payload received from device: %s", data)

    try:
        cloud_response = await forward_to_cloud(data)
    except RuntimeError as exc:
        logger.error("Error: Error forwarding data to cloud: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Error forwarding data to the cloud service."
        )
    
    logger.info("Info: Cloud responded with status %s", cloud_response.status_code)
    
    return {
        "message": "Data received and forwarded to the cloud.",
        "cloud_status": cloud_response.status_code
    }