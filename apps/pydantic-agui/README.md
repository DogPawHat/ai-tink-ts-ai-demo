# TanStack AI × Pydantic AI demo

A TanStack AI React client (`@tanstack/ai-react`) talking to a [Pydantic AI](https://ai.pydantic.dev/) agent served by FastAPI. The two sides speak [AG-UI](https://docs.ag-ui.com/): the client POSTs a `RunAgentInput` and the server streams AG-UI events back as server-sent events. No TanStack code runs on the server.

- **Frontend**: TanStack Start in SPA mode (`spa: { enabled: true }`), so the build is a static shell with no server runtime. It uses released TanStack AI packages, not the harness preview that `apps/self-editing` pins.
- **Server** (`server/`): FastAPI app that hands each request to `AGUIAdapter.dispatch_request` from `pydantic_ai.ui.ag_ui`. The agent has two tools, `current_time` and `roll_dice`. Python dependencies are managed with `uv`.
- **Model**: OpenCode Zen through its OpenAI-compatible endpoint, the same as `apps/self-editing`. The server reads `OPENCODE_API_KEY` and `OPENCODE_MODEL`; `.env.schema` declares them for Varlock.

## Run locally

1. Run `vp install` at the repository root, and `uv` must be installed.
2. Create `apps/pydantic-agui/.env.local` (git-ignored) with `OPENCODE_API_KEY`. To reuse the key from `apps/self-editing`, copy that app's `.env.local`: the Varlock [local encryption](https://varlock.dev/guides/local-encryption/) key is machine-wide, so the copy decrypts here. Decryption needs TPM access; see [`docs/development.md`](../../docs/development.md).
3. In one terminal, from `apps/pydantic-agui`, start the server on `127.0.0.1:8010`:

   ```sh
   vp run dev:server
   ```

4. In another, start the client on `http://localhost:3200`:

   ```sh
   vp run dev
   ```

Vite proxies `/api/agent` to the server's root.

## Validation

```sh
vp check                          # format, lint, and type check the TypeScript
vp run test:server                # server tests, using Pydantic AI's TestModel
vp run build
```

The server tests need no API key. They post the same body `fetchServerSentEvents` sends and check the AG-UI event stream.
