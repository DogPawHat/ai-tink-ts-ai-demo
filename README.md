# TanStack AI demos

Demos of [TanStack AI](https://github.com/TanStack/ai), managed as a pnpm workspace with [Vite+](https://viteplus.dev/).

| App                                        | Description                                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| [`apps/self-editing`](apps/self-editing)   | A TanStack Start site that edits its own source through the TanStack AI harness, sandboxed in Drop. |
| [`apps/pydantic-agui`](apps/pydantic-agui) | A TanStack AI React client talking to a Pydantic AI agent over AG-UI, served by FastAPI.            |

## Development

Run `vp install` at the repository root. Then run an app's commands from its directory, or from the root with `-C`:

```sh
vp check
vp -C apps/self-editing test
vp -C apps/self-editing dev
```

Shared lint, format, and staged-file settings live in the root `vite.config.ts`. Each app keeps its own Vite config.
