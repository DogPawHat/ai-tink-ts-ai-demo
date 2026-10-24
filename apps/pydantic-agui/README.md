# TanStack AI × Pydantic AI demo

A TanStack AI React client (`@tanstack/ai-react`) talking to a [Pydantic AI](https://ai.pydantic.dev/) agent served by FastAPI. The two sides speak [AG-UI](https://docs.ag-ui.com/): the client POSTs a `RunAgentInput` and the server streams AG-UI events back as server-sent events. No TanStack code runs on the server.

- **Frontend**: TanStack Start in SPA mode (`spa: { enabled: true }`), so the build is a static shell with no server runtime. It uses released TanStack AI packages, not the harness preview that `apps/self-editing` pins.
- **Server** (`server/`): FastAPI app that hands each request to `AGUIAdapter.dispatch_request` from `pydantic_ai.ui.ag_ui`. The agent has two tools, `current_time` and `roll_dice`. Python dependencies are managed with `uv`.
- **Model**: Claude (`claude-haiku-5-5` by default) through the Anthropic API. The server reads `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`; `.env.schema` declares them for Varlock.

## Run locally

1. Run `vp install` at the repository root, and `uv` must be installed.
2. Create `apps/pydantic-agui/.env.local` (git-ignored) with `ANTHROPIC_API_KEY`, encrypted with Varlock [local encryption](https://varlock.dev/guides/local-encryption/). Decryption needs TPM access; see [`docs/development.md`](../../docs/development.md).
3. In one terminal, from `apps/pydantic-agui`, start the server on `127.0.0.1:8010`:

   ```sh
   vp run dev:server
   ```

4. In another, start the client on `http://localhost:3200`:

   ```sh
   vp run dev
   ```

Vite proxies `/api/agent` to the server, which serves AG-UI at that path.

## Deployed

Live at <https://ai-tink-pydantic.fly.dev/?key=<ACCESS_KEY>> (Fly app `ai-tink-pydantic`, org `personal`, region `lhr`). One app serves both sides: the image builds the client, and FastAPI serves `dist/client` (`STATIC_DIR`) next to `/api/agent`. The server pays for every run, so with `ACCESS_KEY` set, a visit to `/?key=<ACCESS_KEY>` sets a cookie and every path except `/health` needs it.

| Variable            | Where                | Purpose                                        |
| ------------------- | -------------------- | ---------------------------------------------- |
| `ANTHROPIC_API_KEY` | secret               | Anthropic API key                              |
| `ACCESS_KEY`        | secret               | Shared key for the page and the agent          |
| `ANTHROPIC_MODEL`   | `fly.toml`, optional | Anthropic model id, default `claude-haiku-5-5` |

The Sprites Anthropic connector that `apps/self-editing-host` uses only accepts calls from inside a Sprite, so this app holds its own key.

```sh
# from the repository root:
fly deploy . --config apps/pydantic-agui/fly.toml \
  --dockerfile apps/pydantic-agui/Dockerfile --remote-only --ha=false
```

## Validation

```sh
vp check                          # format, lint, and type check the TypeScript
vp run test:server                # server tests, using Pydantic AI's TestModel
vp run build
```

The server tests need no API key. They post the same body `fetchServerSentEvents` sends and check the AG-UI event stream.
