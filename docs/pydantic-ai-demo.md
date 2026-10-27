# Pydantic AI demo

Status: first version built in `apps/pydantic-agui` (2026-10-13). Verified against the live Zen model (`deepseek-v4.1-flash`) through the Vite proxy and a browser: tool calls and the final answer stream to the client. On 2026-10-24 it moved to Claude (`claude-haiku-5-5`, Anthropic API) and was deployed as the Fly app `ai-tink-pydantic`, gated by an access key; see the app's README. A live run against Claude is **unverified** until `ANTHROPIC_API_KEY` is set on the app.

## Goal

Show the TanStack AI client libraries (`@tanstack/ai-client`, `@tanstack/ai-react`) working with an agent written in [Pydantic AI](https://ai.pydantic.dev/) and served by FastAPI. No TanStack code runs on the server.

## Approach

TanStack AI clients speak the [AG-UI](https://docs.ag-ui.com/) protocol. A server accepts a `RunAgentInput` by POST and streams AG-UI events as server-sent events. Pydantic AI supports AG-UI, so a FastAPI app can expose a Pydantic AI agent as an AG-UI endpoint. **Verified 2026-10-13** with `pydantic-ai-slim` 2.55.0: install the `ag-ui` extra and call `AGUIAdapter.dispatch_request(request, agent=agent, model=...)` from `pydantic_ai.ui.ag_ui` in a FastAPI route. The body that `fetchServerSentEvents` sends (a `RunAgentInput` plus an extra `data` field) is accepted, and the response is `text/event-stream` with `RUN_STARTED`, `TOOL_CALL_*`, `TEXT_MESSAGE_*`, and `RUN_FINISHED` events.

Reference: `~/Development/ai/examples/ag-ui` in the TanStack AI checkout. It is a React client that talks to hand-written AG-UI servers in Go, Rust, PHP, Zig, Bash, and Python. This demo replaces the hand-written Python server with Pydantic AI, so it can show agent features: tools, typed output, and possibly client-side tools or approval interrupts.

## Layout

```
apps/pydantic-agui/   # frontend: TanStack Start in SPA mode
  server/             # FastAPI + Pydantic AI, managed with uv
```

Dev ports: client 3200, server 8010. Vite proxies `/api/agent` to the server, which serves AG-UI at `/api/agent`. The client uses released `@tanstack/ai-react` and `@tanstack/ai` 1.0.0, not the PR #1555 preview that `apps/self-editing` pins. See the app's README for commands.

The server module sets no model on the agent. `create_app` takes a model factory, and the default builds an Anthropic model from `ANTHROPIC_API_KEY`. Tests pass `TestModel`, so they need no key.

Deployed as one Fly app rather than two: FastAPI serves the SPA build next to the agent endpoint, so there is no CORS and one access-key gate covers both.

## Undecided

Decided: TanStack Start in SPA mode for the frontend, Claude through the Anthropic API for the model (OpenCode Zen until 2026-10-24), and a `package.json` script (`dev:server`, wrapped in `varlock run`) to start the Python server. Python is not linted or type checked by `vp check`.

## Not yet done

- The preview browser in the agent host could not reach the dev server, so browser checks used a local Playwright Chromium.
- The UI ignores the reasoning events the live model sends; it renders only text and tool calls.
- Typed output, client-side tools, and approval interrupts.
- Python lint and type checking (for example `ruff`).

## Possible third demo

Not decided. Candidates that show something the other two do not:

- Generative UI or client-side tools.
- Durable chats with `@tanstack/ai-persistence` and the durable-stream packages, where a chat survives a server restart. The hosted self-editing demo needs this anyway.

## Credentials

Locally, `apps/pydantic-agui/.env.local` (git-ignored, Varlock-encrypted) needs `ANTHROPIC_API_KEY`; the old copy holds only the OpenCode key, so add the Anthropic key to it. The `linux-tpm` encryption key is machine-wide. On Fly, the key is the `ANTHROPIC_API_KEY` secret. Decryption needs the `tss` group (see [development.md](development.md)): `sg tss -c 'vp run dev:server'`.

## Web search

Added 2026-10-27: Anthropic's own web search, through Pydantic AI's `WebSearch` capability (`max_uses=5`). It is passed per run in `dispatch_request(capabilities=…)` rather than on the `Agent`, because `TestModel` raises on any provider-run tool; `create_app(web_search=False)` turns it off in tests. Pydantic AI's AG-UI adapter already sends provider-run calls to the client (ids prefixed `pyd_ai_builtin|`) and rebuilds them from history, so no replay code was needed. The client hides fields named `encrypted_*` in tool cards.

Found live: Pydantic AI uses Anthropic's newer search, which Claude can also call from code execution. The first attempt ran a `code_execution` call that failed on the result's shape, then the model searched directly. A follow-up asked, without searching again, for the URL it used; it answered from the replayed results and corrected its earlier version from another result in the same search.
