# Docs for agents

Notes for coding agents working on this repository. Read these before changing app structure, hosting, or the development setup.

| Doc                                                          | Covers                                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| [development.md](development.md)                             | Toolchain, commands, Drop, Varlock, and local machine quirks                                       |
| [self-editing-architecture.md](self-editing-architecture.md) | How `apps/self-editing` works today and where it is fragile                                        |
| [hosting-plan.md](hosting-plan.md)                           | The plan to host the self-editing demo on Fly.io Sprites, with rejected options and open questions |
| [pydantic-ai-demo.md](pydantic-ai-demo.md)                   | The planned demo of TanStack AI clients talking to a Pydantic AI backend                           |

## Status

Last updated 2026-10-13. Only `apps/self-editing` exists, and it uses the OpenCode adapter. The hosting plan and the Pydantic AI demo are planned, not built. Statements marked **unverified** have not been tested; check them before relying on them, and update these docs when you do.

## Keeping these docs useful

- Record decisions with their reasons, and record rejected options so they are not re-researched.
- Mark claims you have not tested as unverified.
- Do not put these notes in `apps/self-editing/AGENTS.md`. The OpenCode agent loads that file into its system prompt at runtime.
