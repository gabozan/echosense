from fastapi import FastAPI
from app.api import edge_sim, health
from app.core.logging_config import configure_logging


def create_app() -> FastAPI:
    configure_logging()

    app = FastAPI(
        title="EchoSense Edge",
        description="Edge gateway to receive data from the ESP32 and forward it to the cloud.",
        version="1.0.0",
    )

    app.include_router(health.router)
    app.include_router(edge_sim.router)

    return app


app = create_app()
