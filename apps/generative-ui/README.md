# Generative UI demo

A chat where the agent answers with UI. [CopilotKit](https://docs.copilotkit.ai/) runs the browser side; TanStack AI's `chat()` runs the agent on the server, inside CopilotKit's `BuiltInAgent` in TanStack mode. The two speak [AG-UI](https://docs.ag-ui.com/). Design notes and findings are in [`docs/generative-ui-demo.md`](../../docs/generative-ui-demo.md).

The agent draws in two ways:

- **Registered components**, styled with the site's Tailwind and shadcn setup: `callout`, `statRow`, `dataTable`, `chart` (TanStack Charts), `timeline`, `cardGrid`, and the interactive `choicePicker`, which waits for your answer.
- **[Open Generative UI](https://docs.copilotkit.ai/generative-ui/open-generative-ui)** for anything else: the agent writes HTML, CSS, and JS that run in a sandboxed iframe, styled from the site's theme tokens.

Two server tools give it real data: `npmDownloads` (npm registry) and `githubRepo` (GitHub API). Neither needs a key. It can also search the web with Anthropic's own web search, which uses the Anthropic key and is billed per search.

## Layout

```
src/
  routes/api/copilotkit.$.ts   # the AG-UI endpoint (CopilotKit runtime handler)
  server/runtime.ts            # BuiltInAgent + chat() on Claude
  server/data-tools.ts         # npmDownloads, githubRepo
  server/web-search.ts         # Anthropic web search, kept in history across runs
  server/sandbox-tool.ts       # repairs generateSandboxedUi arguments (see the docs)
  genui/define.tsx             # defineGenComponent: validation, skeleton, Suspense, error boundary
  genui/components/*.tsx       # one file per component; each registers itself
  genui/design-skill.ts        # styling guidance for sandboxed widgets
  lib/chart-spec.ts            # the agent's JSON chart description → defineChart()
  components/ui/chart.tsx      # shadcn's chart pieces on TanStack Charts
```

## Adding a component

Add a file to `src/genui/components/` that default-exports `defineGenComponent({ name, description, schema, render })` (or `defineInteractiveGenComponent` for one that waits for the user). The schema is ArkType and must describe plain data, since the model only sees its JSON Schema: no morphs, `.narrow`, or `Date`. The `description` is what the model reads to decide when to use it. The registry and the tests pick the file up automatically.

## Run locally

1. Run `vp install` at the repository root.
2. Create `apps/generative-ui/.env.local` (git-ignored) with `ANTHROPIC_API_KEY`, encrypted with Varlock [local encryption](https://varlock.dev/guides/local-encryption/). Decryption needs TPM access; see [`docs/development.md`](../../docs/development.md).
3. From `apps/generative-ui`, start the app on `http://localhost:3300`:

   ```sh
   sg tss -c 'vp run dev'
   ```

`vp run dev` runs `scripts/dev.mjs`, which wraps `vp dev` in `varlock run` and restarts the whole process when Vite would restart in place (a `vite.config.ts` or `.env` change, or the `r` shortcut). Plain `vp dev` starts without the key: the page works, and a chat message shows the missing-key error.

| Variable                        | Purpose                                                 |
| ------------------------------- | ------------------------------------------------------- |
| `ANTHROPIC_API_KEY`             | Anthropic API key (server only)                         |
| `ANTHROPIC_MODEL`               | Anthropic model id, default `claude-sonnet-5-5`         |
| `COPILOTKIT_TELEMETRY_DISABLED` | `true` by default in `.env.schema`; turns off telemetry |

Restarting in a new process works around a Vite 8 / Rolldown bug that keeps every in-place-restarted server alive (about 50 MB each here); it also lets Varlock pick up changed env values. Plain `vp dev` still leaks. See the docs for the cause and a minimal repro.

## Deploy

Live at <https://ai-tink-genui.fly.dev/?key=<ACCESS_KEY>> (Fly app `ai-tink-genui`, org `personal`, region `lhr`), deployed 2026-10-27; secrets (`ANTHROPIC_API_KEY`, `ACCESS_KEY`) not set yet, so the gate is off and chats fail. `src/serve.ts` is the production server: Start's build is a fetch handler with no static file serving, so [srvx](https://srvx.h3.dev/) serves `dist/client` in front of it, behind the gate in `src/server/access-gate.ts`. Run it locally with `vp build && node src/serve.ts` (port 8080). The server pays for every run, so with `ACCESS_KEY` set, a visit to `/?key=<ACCESS_KEY>` sets a cookie, and every path except `/health` needs it, the same gate as `apps/pydantic-agui`.

| Variable                        | Where                | Purpose                                          |
| ------------------------------- | -------------------- | ------------------------------------------------ |
| `ANTHROPIC_API_KEY`             | secret               | Anthropic API key                                |
| `ACCESS_KEY`                    | secret               | Shared key for the page and the agent            |
| `ANTHROPIC_MODEL`               | `fly.toml`, optional | Anthropic model id, default `claude-sonnet-5-5`  |
| `COPILOTKIT_TELEMETRY_DISABLED` | `fly.toml`           | `true`; `.env.schema` isn't loaded in production |

```sh
# once:
fly apps create ai-tink-genui --org personal
fly secrets set ANTHROPIC_API_KEY=... ACCESS_KEY=... --app ai-tink-genui --stage
# from the repository root:
fly deploy . --config apps/generative-ui/fly.toml \
  --dockerfile apps/generative-ui/Dockerfile --remote-only --ha=false
```

## Validation

```sh
vp check        # from the repository root: format, lint, type check
vp test         # from apps/generative-ui; no API key or network needed
vp build
```

The route tests use TanStack AI's `fakeText` adapter in place of Claude.
