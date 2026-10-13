# Self-editing demo: current architecture

`apps/self-editing` is a single TanStack Start app. The chat, the agent, and the site the agent edits run in one `vp dev` process inside Drop.

## Pieces

- **Page** (`src/routes/index.tsx`): the chat UI uses `useChat` with `fetchServerSentEvents("/api/chat")` and sits beside a "Live site" card. The card is part of the same React page, not a separate site.
- **Chat endpoint** (`src/routes/api.chat.ts`): opens a harness session for the thread, calls `session.prompt(input, { busy: "reject" })`, and streams the operation as server-sent events. A client disconnect cancels the operation.
- **Agent** (`src/lib/agent.server.ts`): `defineHarness` with an OpenAI-compatible chat-completions adapter pointed at OpenCode Zen (`https://opencode.ai/zen/v1`), plus the `workspaceTools` and `projectInstructions` plugins rooted at `process.cwd()`. It refuses to start unless `DROP_ENV` and `OPENCODE_API_KEY` are set.
- **Persistence**: `memoryPersistence()`, so sessions live in the server process.
- **Project instructions**: `projectInstructions` reads `AGENTS.md` and `CLAUDE.md` from the app directory only. `apps/self-editing/AGENTS.md` is part of the runtime system prompt.

The loop: the agent edits files in `apps/self-editing`, and Vite hot reloads the page the visitor is chatting on.

## Dependencies

TanStack AI packages come from the open [TanStack/ai PR #1555](https://github.com/TanStack/ai/pull/1555) through pkg.pr.new at commit `5cc000e`: `@tanstack/ai`, `ai-harness`, `ai-persistence`, `ai-react`, and `openai-base`. The previews depend on matching preview packages, so `pnpm-workspace.yaml` sets `blockExoticSubdeps: false`. The PR is large and still changing; check its compatibility table before moving the pin.

## Fragile points

These come from running everything in one process:

1. **The agent can break its own chat.** The chat UI is in `index.tsx`, the main file the agent edits. Only the system prompt asks it to keep the chat working. A compile error in that file removes the chat.
2. **Server edits restart the agent.** Editing `agent.server.ts` or `api.chat.ts` reloads server modules, which loses the in-memory session and can cut off the response being streamed.
3. **Tools act on the local filesystem.** `workspaceTools` reads and writes files and runs shell commands directly. Drop is the only isolation.
4. **One process holds everything.** The API key, model calls, and editable code share a process. Inside Drop that is acceptable; in a hosted sandbox the agent could read the key.

[hosting-plan.md](hosting-plan.md) describes the split that removes points 1, 2, and 4.
