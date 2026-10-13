# Self-editing demo: current architecture

`apps/self-editing` is a single TanStack Start app. The chat, the agent, and the site the agent edits run in one `vp dev` process inside Drop.

## Pieces

- **Page** (`src/routes/index.tsx`): the chat UI uses `useChat` with `fetchServerSentEvents("/api/chat")` and sits beside a "Live site" card. The card is part of the same React page, not a separate site. The page keeps the Claude Code session ID from the `claude-code.session-id` custom event and sends it back as `sessionId` in the request body.
- **Chat endpoint** (`src/routes/api.chat.ts`): calls `chat()` with `claudeCodeText(model, { authMode: "host", permissionMode: "bypassPermissions", env })`, a system prompt, `modelOptions: { sessionId }`, and `withSandbox(sandbox)` middleware, then streams the result as server-sent events.
- **Sandbox** (`src/lib/agent.server.ts`): `defineSandbox` with `localProcessSandbox({ dir: process.cwd() })` and a `localSource` workspace, so the sandbox is the app directory. The function refuses to run unless `DROP_ENV` is set.
- **Claude Code**: the `claude` CLI (`@anthropic-ai/claude-code`), installed in the Drop home by the `setup:drop` command. The adapter runs it with `--output-format stream-json`. It runs its own tools (shell, read, edit, search). It reads `CLAUDE.md`, not `AGENTS.md`, so the system prompt tells it to read `AGENTS.md` first.
- **Model and key**: `AGENT_MODEL` (default `anthropic/claude-haiku-5.5`), `OPENROUTER_API_KEY`, and `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api`), forwarded into Drop. `agent.server.ts` turns them into the `ANTHROPIC_*` variables Claude Code reads, and maps every model alias to the one model so its background calls do not ask for a Claude id that OpenRouter lacks. `authMode: "host"` stops the adapter injecting an `ANTHROPIC_API_KEY`.

The loop: the agent edits files in `apps/self-editing`, and Vite hot reloads the page the visitor is chatting on.

## Dependencies

All TanStack AI packages are published releases: `@tanstack/ai` ^0.68, `ai-react`, `ai-claude-code`, `ai-sandbox`, and `ai-sandbox-local-process`. The first version of the app used OpenCode (`ai-opencode`) with the same sandbox packages. On 2026-10-02 it moved to the native harness from [TanStack/ai PR #1555](https://github.com/TanStack/ai/pull/1555) through pkg.pr.new, and on 2026-10-13 it moved back to OpenCode and then to Claude Code; see [hosting-plan.md](hosting-plan.md#harness-backend-options). The `ai` package is still a dependency, for the types the AI Elements components import.

## Fragile points

These come from running everything in one process:

1. **The agent can break its own chat.** The chat UI is in `index.tsx`, the main file the agent edits. Only the system prompt asks it to keep the chat working. A compile error in that file removes the chat.
2. **Server edits restart the agent.** Editing `agent.server.ts` or `api.chat.ts` reloads server modules and can cut off the response being streamed. The Claude Code session ID lives in the page, so the session can be resumed, but only on the same machine, because Claude Code stores sessions on disk.
3. **Claude Code acts on the local filesystem.** With `permissionMode: "bypassPermissions"` it edits files and runs commands directly. Drop is the only isolation.
4. **One environment holds everything.** The API key, model calls, and editable code share a Drop environment. That is acceptable locally. In a hosted sandbox the agent can read the key, so it needs a Sprites Connector or a spend-capped key; see [hosting-plan.md](hosting-plan.md).
5. **No automated check of the agent path.** The unit test covers the settings only. The adapter path needs a real Claude Code install and an OpenRouter key.

[hosting-plan.md](hosting-plan.md) describes the split that removes points 1 and 2.
