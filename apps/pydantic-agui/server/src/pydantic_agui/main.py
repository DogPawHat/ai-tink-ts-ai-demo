import hashlib
import hmac
import os
from collections.abc import Callable
from pathlib import Path

from fastapi import FastAPI, Request
from pydantic_ai.capabilities import WebSearch
from pydantic_ai.models import Model
from pydantic_ai.ui.ag_ui import AGUIAdapter
from starlette.responses import FileResponse, PlainTextResponse, RedirectResponse, Response
from starlette.staticfiles import StaticFiles

from .agent import agent, anthropic_model

ACCESS_COOKIE = "pydantic_agui_access"


def create_app(
    model_factory: Callable[[], Model] = anthropic_model,
    access_key: str | None = None,
    static_dir: Path | None = None,
    web_search: bool = True,
) -> FastAPI:
    """The AG-UI endpoint at /api/agent, plus the built client when `static_dir` is set.

    With an `access_key`, a visit to `/?key=<access_key>` sets a cookie, and every
    other path except /health needs that cookie. The server pays for each run, so
    the deployed app sets one.

    `web_search` adds Anthropic's own web search, which runs inside Anthropic's
    API, needs no other key, and is billed per search. Pydantic AI's AG-UI
    adapter sends each search to the client and reads it back from the history,
    so later runs see what was read. Tests turn it off: `TestModel` doesn't
    support provider-run tools.
    """
    app = FastAPI(title="Pydantic AI over AG-UI")
    capabilities = [WebSearch(max_uses=5)] if web_search else []
    cookie_value = hashlib.sha256(f"access:{access_key}".encode()).hexdigest() if access_key else ""

    @app.middleware("http")
    async def require_access(request: Request, call_next) -> Response:
        if not access_key or request.url.path == "/health":
            return await call_next(request)
        key = request.query_params.get("key")
        if key is not None and hmac.compare_digest(key, access_key):
            response = RedirectResponse(request.url.path, status_code=303)
            response.set_cookie(
                ACCESS_COOKIE, cookie_value, max_age=31536000, httponly=True, secure=True, samesite="lax"
            )
            return response
        if hmac.compare_digest(request.cookies.get(ACCESS_COOKIE, ""), cookie_value):
            return await call_next(request)
        return PlainTextResponse("Open this page with ?key=<access key>.", status_code=401)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/agent")
    async def run_agent(request: Request) -> Response:
        return await AGUIAdapter.dispatch_request(
            request, agent=agent, model=model_factory(), capabilities=capabilities
        )

    if static_dir is not None:
        # The client is a SPA build: hashed assets plus one shell page for every route.
        app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")
        shell = static_dir / "_shell.html"

        @app.get("/{path:path}")
        async def spa(path: str) -> FileResponse:
            return FileResponse(shell)

    return app


static = os.environ.get("STATIC_DIR")
app = create_app(
    access_key=os.environ.get("ACCESS_KEY") or None,
    static_dir=Path(static) if static else None,
)
