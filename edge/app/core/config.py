import os
from dataclasses import dataclass
from dotenv import load_dotenv


load_dotenv()

@dataclass
class Settings:
    CLOUD_API_URL: str = os.getenv("CLOUD_API_URL", "")
    REQUEST_TIMEOUT: float = float(os.getenv("REQUEST_TIMEOUT", "5.0"))
    MAX_RETRIES: int = int(os.getenv("MAX_RETRIES", "2"))

settings = Settings()