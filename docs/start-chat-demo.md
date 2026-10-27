# Start chat demo

Status: v1 built in `apps/start-chat` and checked against Claude (`claude-sonnet-5-5`) in a browser, 2026-10-27. Runs locally. Fly config for `ai-tink-start-chat` added 2026-10-27; not deployed. Statements marked **unverified** have not been tested.

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

## Web search

Added 2026-10-27: Anthropic's own web search, with `webSearchMiddleware` and `restoreWebSearches` copied from `apps/generative-ui` (see [generative-ui-demo.md](generative-ui-demo.md#web-search) for why they exist). The middleware sends each search's arguments and result, including the pages' encrypted text, to the browser; `restoreWebSearches` turns them back into Anthropic's search blocks when the history returns, as it does after every client tool. The page hides the encrypted `replay` field.

Checked live: "Search the web for the latest TanStack Router release and tell me its version. Then make the page sky." searched once, ran `setAccent` in the browser, and the second request (history with the replayed search) answered from the release page it had read.

## What was checked (2026-10-27)

- `vp build` succeeds. The client bundle has no `api.github.com` or Anthropic code: Start strips the server handler and its imports.
- Route tests with `fakeText`: text streams as AG-UI events; a `setAccent` call streams `TOOL_CALL_START` with no `TOOL_CALL_RESULT` (the browser runs it); a bad body gets a 400. The tool name field on `TOOL_CALL_START` is `toolCallName`.
- In a browser, "How many stars does TanStack/router have? Then make the page violet." made two POSTs to `/api/chat`: `githubRepo` ran on the server, `setAccent` ran in the browser and turned the accent violet, and the second request carried its result back for the final answer.

## Not yet done

- Tool approval (`needsApproval` and `useChat`'s `interrupts`).
- Persistence: the thread id is fixed and messages are lost on reload.
- Server functions (`createServerFn`) as the transport instead of a server route.
- Deploying: Fly config is ready (see [Hosting](#hosting-2026-10-27)), but the app does not exist on Fly yet.

## Hosting (2026-10-27)

One Fly app, `ai-tink-start-chat` (`fly.toml` and `Dockerfile` in the app). Start's build is a fetch handler that serves no static files, so `src/serve.ts` wraps it in [srvx](https://srvx.h3.dev/) (already a dependency of Start's plugin) with `dist/client` as static files and the same access-key gate as `ai-tink-pydantic`, in `src/server/access-gate.ts`. Checked locally without Docker (there is none on this machine) by repeating the Dockerfile's steps in a scratch directory: the filtered install and build, then a `--prod` install with only the built files copied in. Behind `ACCESS_KEY=secret`, `/health` answered 200, `/` 401 without the cookie and 200 with it, and `/api/chat` reached the route (400 for an empty body). A run against Claude through the production server, and the image build on Fly, are **unverified**.
