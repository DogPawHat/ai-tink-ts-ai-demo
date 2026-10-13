from collections.abc import Callable

from fastapi import FastAPI, Request
from pydantic_ai.models import Model
from pydantic_ai.ui.ag_ui import AGUIAdapter
from starlette.responses import Response

from .agent import agent, zen_model


def create_app(model_factory: Callable[[], Model] = zen_model) -> FastAPI:
    app = FastAPI(title="Pydantic AI over AG-UI")

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/")
    async def run_agent(request: Request) -> Response:
        return await AGUIAdapter.dispatch_request(request, agent=agent, model=model_factory())

    return app


app = create_app()
