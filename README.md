# TanStack AI demos

Demos of [TanStack AI](https://github.com/TanStack/ai), managed as a pnpm workspace with [Vite+](https://viteplus.dev/).

| App                                                | Description                                                                                                                              |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/self-editing`](apps/self-editing)           | The site that visitors change: a TanStack Start app with no chat. Every visitor Sprite starts from a copy of it.                         |
| [`apps/self-editing-host`](apps/self-editing-host) | The Fly app behind the demo: it sets up a Sprite per visitor, serves the chat widget, and runs Claude Code on the Sprite with Haiku 5.5. |

## Development

Run `vp install` at the repository root. Then run an app's commands from its directory, or from the root with `-C`:

```sh
vp check
vp -C apps/self-editing-host test
vp -C apps/self-editing dev
```

Shared lint, format, and staged-file settings live in the root `vite.config.ts`. Each app keeps its own Vite config. See [`docs/`](docs/README.md) for the architecture and hosting notes.
