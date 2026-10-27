# Start chat demo

Status: v1 built in `apps/start-chat` and checked against Claude (`claude-sonnet-5-5`) in a browser, 2026-10-27. Runs locally; not deployed. Statements marked **unverified** have not been tested.

## Goal

The baseline the other demos vary from: a single TanStack Start app with TanStack AI on both sides (`useChat` in the browser, `chat()` in a Start server route). The other apps each swap one side: CopilotKit (`generative-ui`) or the AI SDK (`ai-sdk-next`) as the client, Pydantic AI (`pydantic-agui`) as the server, or a separate host (`self-editing-host`).

## Decisions

| Area      | Decision                                                                                                                                                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shape     | One package, `apps/start-chat`, port 3500. Full SSR Start (not SPA mode, unlike `pydantic-agui`), because the server route needs a server runtime.                                                                                                                 |
| Endpoint  | `src/routes/api/chat.ts` is a `createFileRoute` with `server.handlers.POST`. The handler lives in `src/server/agent.ts` (`chatParamsFromRequestBody` → `chat()` → `toServerSentEventsResponse`), the same pattern as `ai-sdk-hono`, so tests can call it directly. |
| Tools     | Definitions in `src/tools.ts`, imported by both sides. `githubRepo` (copied from `ai-sdk-hono`, trimmed) is a server tool. `setAccent` is a client tool: the server passes the bare definition, the page registers `.client()` through `clientTools()`.            |
| Tool list | The server lists every tool itself instead of `mergeAgentTools(…, params.tools)`. In one app it already knows the browser's tools, and it won't accept tools a caller invents.                                                                                     |
| Agent     | `claude-sonnet-5-5`, low reasoning effort with summaries on, `maxIterations(6)`. The system prompt asks for plain text, since the page doesn't render Markdown.                                                                                                    |
| UI        | Plain Tailwind, the same look as `pydantic-agui`. No shadcn.                                                                                                                                                                                                       |
| Dev       | `vp run dev` is `varlock run -- vp dev`. It doesn't use `generative-ui`'s restart-in-a-new-process script; that leak was found with CopilotKit's large dependency graph and has not been checked here (**unverified**).                                            |

## What was checked (2026-10-27)

- `vp build` succeeds. The client bundle has no `api.github.com` or Anthropic code: Start strips the server handler and its imports.
- Route tests with `fakeText`: text streams as AG-UI events; a `setAccent` call streams `TOOL_CALL_START` with no `TOOL_CALL_RESULT` (the browser runs it); a bad body gets a 400. The tool name field on `TOOL_CALL_START` is `toolCallName`.
- In a browser, "How many stars does TanStack/router have? Then make the page violet." made two POSTs to `/api/chat`: `githubRepo` ran on the server, `setAccent` ran in the browser and turned the accent violet, and the second request carried its result back for the final answer.

## Not yet done

- Tool approval (`needsApproval` and `useChat`'s `interrupts`).
- Persistence: the thread id is fixed and messages are lost on reload.
- Server functions (`createServerFn`) as the transport instead of a server route.
- Hosting.
