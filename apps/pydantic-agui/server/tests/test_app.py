import json

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic_ai.models.test import TestModel

from pydantic_agui.main import create_app


def run_input(text: str) -> dict:
    """The request body `fetchServerSentEvents` sends: a RunAgentInput plus `data`."""
    return {
        "threadId": "thread-1",
        "runId": "run-1",
        "state": {},
        "messages": [{"id": "msg-1", "role": "user", "content": text}],
        "tools": [],
        "context": [],
        "forwardedProps": {},
        "data": {},
    }


def parse_sse(body: str) -> list[dict]:
    return [
        json.loads(line.removeprefix("data: "))
        for line in body.splitlines()
        if line.startswith("data: ")
    ]


@pytest.fixture
def client() -> AsyncClient:
    app = create_app(lambda: TestModel())
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_health(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.json() == {"status": "ok"}


async def test_run_streams_ag_ui_events(client: AsyncClient) -> None:
    response = await client.post(
        "/api/agent", json=run_input("What time is it?"), headers={"accept": "text/event-stream"}
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    types = [event["type"] for event in parse_sse(response.text)]
    assert types[0] == "RUN_STARTED"
    assert types[-1] == "RUN_FINISHED"
    # TestModel calls every tool once, so the tools are wired up.
    assert "TOOL_CALL_START" in types
    assert "TEXT_MESSAGE_CONTENT" in types


async def test_access_key_gates_everything_but_health() -> None:
    app = create_app(lambda: TestModel(), access_key="secret")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
        assert (await client.get("/health")).status_code == 200
        assert (await client.post("/api/agent", json=run_input("hi"))).status_code == 401
        assert (await client.get("/?key=wrong")).status_code == 401

        response = await client.get("/?key=secret")
        assert response.status_code == 303
        assert response.headers["location"] == "/"
        response = await client.post(
            "/api/agent", json=run_input("hi"), headers={"accept": "text/event-stream"}
        )
        assert response.status_code == 200


async def test_serves_the_client_shell(tmp_path) -> None:
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path / "_shell.html").write_text("<html>shell</html>")
    app = create_app(lambda: TestModel(), static_dir=tmp_path)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/")).text == "<html>shell</html>"
        assert (await client.get("/any/route")).text == "<html>shell</html>"
        assert (await client.get("/assets/app.js")).text == "console.log(1)"
