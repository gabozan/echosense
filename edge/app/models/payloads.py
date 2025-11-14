from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, validator


class DevicePayload(BaseModel):
    id: str = Field(..., description="Unique identifier of the device")
    laeq: float = Field(..., ge=0, description="Equivalent sound level (dB)")
    peak: float = Field(..., ge=0, description="Maximum sound level (dB)")
    class_: str = Field(
        ...,
        alias="class",
        description="Sound category (silence, traffic, voices, music, machinery, etc.)",
    )
    battery: int = Field(
        ..., ge=0, le=100, description="Remaining battery percentage of the device"
    )
    status: Literal["online", "offline", "error"] = Field(
        ..., description="Current status of the node"
    )
    timestamp: datetime = Field(
        ..., description="UTC timestamp when the measurement was generated"
    )

    class Config:
        populate_by_name = True

    @validator("class_")
    def normalize_class(cls, value: str) -> str:
        return value.strip().lower()
