# Generative UI demo

A chat where the agent answers with UI. [CopilotKit](https://docs.copilotkit.ai/) runs the browser side; TanStack AI's `chat()` runs the agent on the server, inside CopilotKit's `BuiltInAgent` in TanStack mode. The two speak [AG-UI](https://docs.ag-ui.com/). Design notes and findings are in [`docs/generative-ui-demo.md`](../../docs/generative-ui-demo.md).

The agent draws in two ways:

- **Registered components**, styled with the site's Tailwind and shadcn setup: `callout`, `statRow`, `dataTable`, `chart` (TanStack Charts), `timeline`, `cardGrid`, and the interactive `choicePicker`, which waits for your answer.
- **[Open Generative UI](https://docs.copilotkit.ai/generative-ui/open-generative-ui)** for anything else: the agent writes HTML, CSS, and JS that run in a sandboxed iframe, styled from the site's theme tokens.

Two server tools give it real data: `npmDownloads` (npm registry) and `githubRepo` (GitHub API). Neither needs a key.

## Layout

```
src/
  routes/api/copilotkit.$.ts   # the AG-UI endpoint (CopilotKit runtime handler)
  server/runtime.ts            # BuiltInAgent + chat() on Claude
  server/data-tools.ts         # npmDownloads, githubRepo
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

`vp run dev` wraps `vp dev` in `varlock run`. Plain `vp dev` starts without the key: the page works, and a chat message shows the missing-key error.

| Variable                        | Purpose                                                 |
| ------------------------------- | ------------------------------------------------------- |
| `ANTHROPIC_API_KEY`             | Anthropic API key (server only)                         |
| `ANTHROPIC_MODEL`               | Anthropic model id, default `claude-haiku-5-5`          |
| `COPILOTKIT_TELEMETRY_DISABLED` | `true` by default in `.env.schema`; turns off telemetry |

The dev server leaks about 50 MB each time Vite restarts it in place (after a `vite.config.ts` or `.env.local` change), because of a Vite 8 / Rolldown bug that keeps every old server alive. Restart the process after many such edits. See the docs for the cause and a minimal repro.

## Validation

```sh
vp check        # from the repository root: format, lint, type check
vp test         # from apps/generative-ui; no API key or network needed
vp build
```

The route tests use TanStack AI's `fakeText` adapter in place of Claude.
