# Pydantic AI demo

Status: planned, not started.

## Goal

Show the TanStack AI client libraries (`@tanstack/ai-client`, `@tanstack/ai-react`) working with an agent written in [Pydantic AI](https://ai.pydantic.dev/) and served by FastAPI. No TanStack code runs on the server.

## Approach

TanStack AI clients speak the [AG-UI](https://docs.ag-ui.com/) protocol. A server accepts a `RunAgentInput` by POST and streams AG-UI events as server-sent events. Pydantic AI supports AG-UI, so a FastAPI app can expose a Pydantic AI agent as an AG-UI endpoint. **Unverified:** confirm the current Pydantic AI AG-UI API before building.

Reference: `~/Development/ai/examples/ag-ui` in the TanStack AI checkout. It is a React client that talks to hand-written AG-UI servers in Go, Rust, PHP, Zig, Bash, and Python. This demo replaces the hand-written Python server with Pydantic AI, so it can show agent features: tools, typed output, and possibly client-side tools or approval interrupts.

## Proposed layout

```
apps/pydantic-agui/   # frontend (TanStack Start or a Vite SPA; undecided)
  server/             # FastAPI + Pydantic AI, managed with uv
```

Deploy the frontend and the FastAPI server as Fly apps (see [hosting-plan.md](hosting-plan.md)).

## Undecided

- Frontend framework: TanStack Start, to match `apps/self-editing`, or a Vite SPA, closer to the upstream example.
- Model provider for the Python agent: OpenCode Zen through an OpenAI-compatible provider, or another provider.
- How Vite+ runs the Python server. `vp run` tasks can run any command, so a `package.json` script that calls `uv` may be enough.

## Possible third demo

Not decided. Candidates that show something the other two do not:

- Generative UI or client-side tools.
- Durable chats with `@tanstack/ai-persistence` and the durable-stream packages, where a chat survives a server restart. The hosted self-editing demo needs this anyway.
