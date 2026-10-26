# TanStack AI demos

Demos of [TanStack AI](https://github.com/TanStack/ai), managed as a pnpm workspace with [Vite+](https://viteplus.dev/).

| App                                                | Description                                                                                                                               |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/self-editing`](apps/self-editing)           | The site that visitors change: a TanStack Start app with no chat. Every visitor Sprite starts from a copy of it.                          |
| [`apps/self-editing-host`](apps/self-editing-host) | The Fly app behind the demo: it sets up a Sprite per visitor, serves the chat widget, and runs Claude Code on the Sprite with Sonnet 5.5. |
| [`apps/pydantic-agui`](apps/pydantic-agui)         | A TanStack AI React client talking to a Pydantic AI agent over AG-UI, served by FastAPI.                                                  |
| [`apps/ai-sdk-next`](apps/ai-sdk-next)             | A Next.js chat on the AI SDK, shadcn, and AI Elements, talking to `ai-sdk-hono` through a custom AG-UI transport.                         |
| [`apps/ai-sdk-hono`](apps/ai-sdk-hono)             | Hono and TanStack AI's `chat()` on Claude, served over AG-UI.                                                                             |

## Development

Run `vp install` at the repository root. Then run an app's commands from its directory, or from the root with `-C`:

```sh
vp check
vp -C apps/self-editing-host test
vp -C apps/self-editing dev
```

Shared lint, format, and staged-file settings live in the root `vite.config.ts`. Each app keeps its own Vite config. See [`docs/`](docs/README.md) for the architecture and hosting notes.
