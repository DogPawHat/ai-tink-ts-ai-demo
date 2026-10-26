# Docs for agents

Notes for coding agents working on this repository. Read these before changing app structure, hosting, or the development setup.

| Doc                                                          | Covers                                                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| [development.md](development.md)                             | Toolchain, commands, running and testing the host, and local machine quirks                               |
| [self-editing-architecture.md](self-editing-architecture.md) | How the site, host, proxy, widget, and agent fit together, and where it is fragile                        |
| [hosting-plan.md](hosting-plan.md)                           | The plan to host the self-editing demo on Fly.io Sprites, what was built, the spikes, rejected options    |
| [pydantic-ai-demo.md](pydantic-ai-demo.md)                   | The demo of TanStack AI clients talking to a Pydantic AI backend (`apps/pydantic-agui`)                   |
| [generative-ui-demo.md](generative-ui-demo.md)               | The planned demo of a CopilotKit client with generative UI on a TanStack AI server (`apps/generative-ui`) |

## Status

Last updated 2026-10-13. `apps/self-editing` (the site) and `apps/self-editing-host` (the Fly app) exist, and the first, owner-only version is deployed. `apps/pydantic-agui` is deployed as `ai-tink-pydantic`. Statements marked **unverified** have not been tested; check them before relying on them, and update these docs when you do.

## Keeping these docs useful

- Record decisions with their reasons, and record rejected options so they are not re-researched.
- Mark claims you have not tested as unverified.
- Do not put these notes in `apps/self-editing/AGENTS.md`. The agent is told to read that file at runtime.
