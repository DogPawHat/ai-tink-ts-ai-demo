# TanStack Start × TanStack AI

The baseline demo: one TanStack Start app with TanStack AI on both sides. The browser uses `useChat` from `@tanstack/ai-react`; a Start server route runs `chat()` with `@tanstack/ai-anthropic`. They speak AG-UI over server-sent events at `/api/chat`, on the same origin, so there's no proxy and no CORS. Notes are in [`docs/start-chat-demo.md`](../../docs/start-chat-demo.md).

The point of a single app is that the tool definitions in `src/tools.ts` are imported by both halves:

- **`githubRepo`** runs on the server (`.server()` in `src/server/agent.ts`) and calls the GitHub API, which needs no key.
- **`setAccent`** runs in the browser (`.client()` in `src/routes/index.tsx`) and changes the page's accent colour. The server passes the bare definition to `chat()`, so the model can call it; `useChat` runs it and sends the result back in the next request.

Reasoning summaries are on at low effort and render as a collapsible "Reasoning" block.

## Layout

```
src/
  tools.ts             shared tool definitions (ArkType schemas)
  server/agent.ts      chat() handler, githubRepo implementation, system prompt
  routes/api/chat.ts   POST /api/chat server route
  routes/index.tsx     useChat page, setAccent implementation
  key-parts.ts         stable React keys for message parts
```

## Run locally

1. Run `vp install` at the repository root.
2. Create `apps/start-chat/.env.local` (git-ignored) with `ANTHROPIC_API_KEY`, encrypted with Varlock [local encryption](https://varlock.dev/guides/local-encryption/). The key is machine-wide, so a copy of another app's `.env.local` works. Decryption needs TPM access; see [`docs/development.md`](../../docs/development.md).
3. From `apps/start-chat`, run `sg tss -c 'vp run dev'` and open <http://127.0.0.1:3500>.

`ANTHROPIC_MODEL` defaults to `claude-sonnet-5-5`.

## Checks

`vp check` at the root lints, formats, and type checks. `vp -C apps/start-chat test` runs the route tests, which use `fakeText` from `@tanstack/ai/testing` and need no key.
