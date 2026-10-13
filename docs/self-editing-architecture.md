# Self-editing demo: current architecture

`apps/self-editing` is a single TanStack Start app. The chat, the agent, and the site the agent edits run in one `vp dev` process inside Drop.

## Pieces

- **Page** (`src/routes/index.tsx`): the chat UI uses `useChat` with `fetchServerSentEvents("/api/chat")` and sits beside a "Live site" card. The card is part of the same React page, not a separate site. The page keeps the OpenCode session ID from the `opencode.session-id` custom event and sends it back as `sessionId` in the request body.
- **Chat endpoint** (`src/routes/api.chat.ts`): calls `chat()` with `opencodeText(model, { permissionMode: "acceptEdits", directory: "/workspace" })`, a system prompt, `modelOptions: { sessionId }`, and `withSandbox(sandbox)` middleware, then streams the result as server-sent events.
- **Sandbox** (`src/lib/agent.server.ts`): `defineSandbox` with `localProcessSandbox({ dir: process.cwd() })` and a `localSource` workspace, so the sandbox is the app directory. The function refuses to run unless `DROP_ENV` is set.
- **OpenCode**: the `opencode` CLI, installed in the Drop home by `vp run setup:drop`. The adapter starts `opencode serve` and drives it through `@opencode-ai/sdk`. OpenCode runs its own tools (shell, read, edit, search) and loads `AGENTS.md` from the app directory. `apps/self-editing/AGENTS.md` is therefore part of the agent's instructions at runtime.
- **Model and key**: `OPENCODE_MODEL` (default `opencode/deepseek-v4.1-flash`, an OpenCode Zen model) and `OPENCODE_API_KEY`, forwarded into Drop. The key is optional if OpenCode is logged in inside Drop.

The loop: the agent edits files in `apps/self-editing`, and Vite hot reloads the page the visitor is chatting on.

## Dependencies

All TanStack AI packages are published releases: `@tanstack/ai` ^0.68, `ai-react`, `ai-opencode`, `ai-sandbox`, and `ai-sandbox-local-process`. The first version of the app used the same stack. On 2026-10-02 it moved to the native harness from [TanStack/ai PR #1555](https://github.com/TanStack/ai/pull/1555) through pkg.pr.new, and on 2026-10-13 it moved back; see [hosting-plan.md](hosting-plan.md#harness-backend-options). The `ai` package is still a dependency, for the types the AI Elements components import.

## Fragile points

These come from running everything in one process:

1. **The agent can break its own chat.** The chat UI is in `index.tsx`, the main file the agent edits. Only the system prompt asks it to keep the chat working. A compile error in that file removes the chat.
2. **Server edits restart the agent.** Editing `agent.server.ts` or `api.chat.ts` reloads server modules and can cut off the response being streamed. The OpenCode session ID lives in the page, so it can be resumed, but only against the same OpenCode server.
3. **OpenCode acts on the local filesystem.** With `permissionMode: "acceptEdits"` it edits files and runs commands directly. Drop is the only isolation.
4. **One environment holds everything.** The API key, model calls, and editable code share a Drop environment. That is acceptable locally. In a hosted sandbox the agent can read the key, so it needs a Sprites Connector or a spend-capped key; see [hosting-plan.md](hosting-plan.md).
5. **No automated check of the agent path.** The unit test covers the settings only. The adapter path needs a real OpenCode install and a Zen key.

[hosting-plan.md](hosting-plan.md) describes the split that removes points 1 and 2.
