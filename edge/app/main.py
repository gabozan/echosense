from fastapi import FastAPI
from app.api import edge_sim, health
from app.core.logging_config import configure_logging


def create_app() -> FastAPI:
    configure_logging()

    app = FastAPI(title="EchoSense Edge")
    app.include_router(health.router)
    app.include_router(edge_sim.router)

    return app

app = create_app()
