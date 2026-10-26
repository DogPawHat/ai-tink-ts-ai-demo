# AI SDK × TanStack AI demo: Hono server

The agent behind [`apps/ai-sdk-next`](../ai-sdk-next): a [Hono](https://hono.dev/) app on Node that runs TanStack AI's `chat()` on Claude and serves it over [AG-UI](https://docs.ag-ui.com/) at `POST /api/agent`. It has no AI SDK code; any AG-UI client (TanStack AI's, CopilotKit's, or the Next.js app's transport) can use it. Design notes are in [`docs/ai-sdk-demo.md`](../../docs/ai-sdk-demo.md).

- `src/app.ts`: `chatParamsFromRequestBody` → `chat()` → `toServerSentEventsResponse`. Tools the browser declares are merged in with `mergeAgentTools`.
- `src/data-tools.ts`: `npmDownloads` and `githubRepo`, copied from `apps/generative-ui`. Public APIs, no keys.
- `src/main.ts`: `@hono/node-server` on `127.0.0.1:8020`. Node runs the TypeScript directly (type stripping), so there is no build step.

## Run locally

1. Run `vp install` at the repository root.
2. Create `apps/ai-sdk-hono/.env.local` (git-ignored) with `ANTHROPIC_API_KEY`, encrypted with Varlock [local encryption](https://varlock.dev/guides/local-encryption/). Decryption needs TPM access; see [`docs/development.md`](../../docs/development.md).
3. From `apps/ai-sdk-hono`:

   ```sh
   sg tss -c 'vp run dev'     # varlock run -- node --watch src/main.ts
   ```

| Variable            | Purpose                                         |
| ------------------- | ----------------------------------------------- |
| `ANTHROPIC_API_KEY` | Anthropic API key                               |
| `ANTHROPIC_MODEL`   | Anthropic model id, default `claude-sonnet-5-5` |
| `PORT`, `HOST`      | Listen address, default `127.0.0.1:8020`        |

## Validation

```sh
vp test     # from apps/ai-sdk-hono; uses TanStack AI's fakeText adapter
```
