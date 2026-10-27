# AI SDK demo

Status: v1 built in `apps/ai-sdk-next` (client) and `apps/ai-sdk-hono` (server), and checked against Claude (`claude-sonnet-5-5`) in a browser, 2026-10-26. Runs locally; not deployed. Statements marked **unverified** have not been tested.

## Goal

A Next.js site built with the Vercel AI SDK, shadcn/ui, and AI Elements, talking to a separate backend that runs TanStack AI on Hono. With this, the repository shows TanStack AI's server paired with every common client: its own (`self-editing`), CopilotKit (`generative-ui`), and the AI SDK (this one). It also has a TanStack client on a non-TanStack server (`pydantic-agui`).

## The protocol problem

`useChat` reads the AI SDK's UI message stream (`text-start`, `tool-input-available`, …). TanStack AI's `chat()` emits AG-UI events (`TEXT_MESSAGE_CONTENT`, `TOOL_CALL_START`, …). Neither library converts to the other: TanStack AI's skills (`@tanstack/ai#ai-core/*`, via TanStack Intent) cover only its own client and AG-UI, and the AI SDK has no AG-UI transport.

**Decided (owner, 2026-10-26): translate in the browser.** The server stays plain TanStack AI over standard AG-UI (`chatParamsFromRequestBody` → `chat()` → `toServerSentEventsResponse`), so any AG-UI client can use it. The Next.js app has a custom `ChatTransport`, `AgUiChatTransport` in `src/lib/ag-ui-transport.ts`. It is typed with the protocol's own types from `@ag-ui/core` (`RunAgentInput`, `Message`, the `AGUIEvent` union, and the `EventType` enum; 26 kB of runtime, no Zod). `@ag-ui/client`'s `HttpAgent` was not used: it brings RxJS, uuid, and fast-json-patch to replace about 20 lines of SSE parsing.

Rejected: a Hono adapter that emits the AI SDK's protocol, so the client could use the stock `DefaultChatTransport`. It would tie the server to one client.

## How the transport maps

Request: the AI SDK's `UIMessage[]` becomes an AG-UI `RunAgentInput` (`threadId` is the chat id). Each assistant turn is split per step: an assistant message with its text and `toolCalls`, then one `tool` message per result. A failed call's result is a `tool` message with the error text as `content` and in the spec's `error` field. Calls without a result (still streaming, or stopped) are dropped, since Claude rejects a `tool_use` with no `tool_result`. Reasoning is not sent back; each request starts a new user turn, and Claude doesn't need earlier turns' thinking.

Response, per AG-UI event:

| AG-UI                                | AI SDK chunk                                              |
| ------------------------------------ | --------------------------------------------------------- |
| `RUN_STARTED`                        | `start`, `start-step`                                     |
| `TEXT_MESSAGE_*`                     | `text-start` / `text-delta` / `text-end`                  |
| `REASONING_MESSAGE_*`                | `reasoning-start` / `reasoning-delta` / `reasoning-end`   |
| `TOOL_CALL_START` / `_ARGS` / `_END` | `tool-input-start` / `-delta` / `-available` (`dynamic`)  |
| `TOOL_CALL_RESULT`                   | `tool-output-available` (content parsed as JSON if it is) |
| `RUN_FINISHED`                       | `finish-step` (records TanStack's finish reason)          |
| `RUN_ERROR`                          | `error`                                                   |
| end of stream                        | closes open parts, `finish`                               |

Findings that shaped it (from TanStack AI 1.0.0's actual stream, captured with `fakeText`):

- **`RUN_FINISHED` comes after every model call** in the agent loop, not once per run. With a server tool, the stream is `RUN_STARTED … TOOL_CALL_END RUN_FINISHED TOOL_CALL_RESULT TEXT_MESSAGE_* RUN_FINISHED`. So `RUN_FINISHED` ends a step, and the message finishes when the stream closes.
- **`TOOL_CALL_RESULT` arrives after that step's `RUN_FINISHED`.** It updates the tool part by id, outside any step.
- **Message ids can repeat across steps** (`fakeText` uses `r-text` for every step), so the transport makes its own part ids.
- **AG-UI has no finish reason.** TanStack AI adds one in `metadata.tanstack.finishReason` (and its own event types declare `finishReason`, but the wire carries the metadata); the transport reads that. Likewise, `TOOL_CALL_END` has no parsed input in the spec, so the transport parses the streamed argument deltas.
- **The `*_CHUNK` shorthand events are ignored.** TanStack AI doesn't send them; another AG-UI server might.
- **Server tools aren't declared in the browser**, so they arrive as `dynamic-tool` parts, which AI Elements' `Tool` renders.

## Streaming through the Next.js rewrite

`next.config.ts` rewrites `/api/agent` to the Hono server, so there's no CORS and no key in the browser. **Found 2026-10-26:** Next.js gzips proxied responses and buffered the whole SSE stream: direct, the first text arrived at 0.65 s; through Next.js, all of it arrived at once after 6.6 s. The server now sends `Cache-Control: no-cache, no-transform`, which the compression respects. Re-measured afterwards, through both `next dev` and `next start`: text streams in about 150 chunks, the first after 0.7 to 1.3 s. A route test checks the header.

## Decisions

| Area        | Decision                                                                                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Packages    | Two workspace packages, `apps/ai-sdk-next` (port 3400) and `apps/ai-sdk-hono` (port 8020), like `self-editing` and `self-editing-host`.                                                                                 |
| Client      | Next.js 16 (Turbopack), AI SDK 7 (`ai`, `@ai-sdk/react` 4), shadcn with Radix and the Nova preset (AI Elements is built on Radix), dark mode from `prefers-color-scheme`.                                               |
| AI Elements | `conversation`, `message` (Streamdown Markdown), `prompt-input`, `reasoning`, `tool`, `suggestion`, `shimmer`, added with `shadcn add @ai-elements/<name>`. Vendored, and edited only to pass lint.                     |
| Server      | Hono 4 on `@hono/node-server`. Node 24 runs the TypeScript directly (relative imports end in `.ts`), so there is no build step.                                                                                         |
| Agent       | `claude-sonnet-5-5`, low reasoning effort with summaries on, `maxIterations(6)`, the `npmDownloads` and `githubRepo` tools and Anthropic web search copied from `generative-ui` (not shared, as elsewhere in the repo). |
| Toolchain   | `vp check` lints, formats, and type checks both apps; `vp test` runs Vitest. Next.js builds with `vp run build` (`next build`), not `vp build`.                                                                         |
| Tests       | Transport tests run the real Hono app in-process (the Next app has `ai-sdk-hono` as a dev dependency) with `fakeText`, and read the result with the AI SDK's `readUIMessageStream`.                                     |

## What was checked (2026-10-26)

In a browser against `claude-sonnet-5-5`:

- "Compare weekly npm downloads of zod, valibot, and arktype": three `npmDownloads` calls rendered as AI Elements tool cards, then a Markdown table.
- A follow-up ("Which of those has the most GitHub stars?"): three `githubRepo` calls and a one-sentence answer, so the converted history (assistant tool calls plus tool results) was accepted by Anthropic.
- Stop during a run, then a new message: the chat recovered and answered.

Not seen live: reasoning. At low effort Sonnet didn't think on these prompts, so the `Reasoning` component is covered only by the transport test (`fakeText` thinking).

## Web search

Added 2026-10-27: Anthropic's own web search, with the middleware and `restoreWebSearches` from `generative-ui`. The transport already sends a tool result back as the JSON it received, so the replay needed no client change; the chat only hides the encrypted `replay` field in the tool card. Checked live: a search for the latest TanStack Query release, then a follow-up asking, without searching again, what the GitHub releases page said. The answer quoted details from the page (commit and package versions), so the replayed search reached Claude.

## Not yet done

- Client-side tools and tool approval. The server already merges browser-declared tools (`mergeAgentTools`), but the transport sends `tools: []` and doesn't send back reasoning signatures, which Claude needs when a turn continues after a client tool result.
- `reconnectToStream` returns `null`; there is no resumable stream.
- Bundle size: AI Elements' `MessageResponse` loads Streamdown with its Mermaid, KaTeX, CJK, and code plugins.
- Hosting. The likely shape is two Fly apps, or one Next.js app with the Hono app mounted in a route handler.

## Agent skills

TanStack AI, TanStack Start, ArkType, and Varlock ship agent skills in their npm packages, readable with [TanStack Intent](https://www.npmjs.com/package/@tanstack/intent): `vp dlx @tanstack/intent@latest list`, then `… load @tanstack/ai#ai-core/ag-ui-protocol`. `intent install` would add skill-loading guidance to the agent config files; it has not been run. `next dev` writes `apps/ai-sdk-next/AGENTS.md`, which points agents at the Next.js docs bundled in `node_modules/next/dist/docs/`.
