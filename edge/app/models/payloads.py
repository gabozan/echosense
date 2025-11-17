from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator


class DevicePayload(BaseModel):
    id: str = Field(..., description="Unique identifier of the device")
    laeq: float = Field(..., ge=0, description="Equivalent sound level (dB)")
    peak: float = Field(..., ge=0, description="Maximum sound level (dB)")
    class_: Literal["silence", "traffic", "voices", "music", "machinery", "unknown"] = Field(
        ...,
        alias="class",
        description="Sound category (silence, traffic, voices, music, machinery, unknown)",
    )
    status: Literal["online", "offline", "error"] = Field(
        ..., description="Current status of the node"
    )
    timestamp: datetime = Field(
        ..., description="UTC timestamp when the measurement was generated"
    )

    model_config = {
        "populate_by_name": True
    }

    @field_validator("class_")
    @classmethod
    def normalize_class(cls, value: str) -> str:
        return value.strip().lower()
