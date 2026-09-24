# TanStack AI self-editing demo

This TanStack Start app sends chat prompts through TanStack AI's OpenCode adapter. OpenCode edits the same working tree that Vite serves, so a prompt such as “Make the site purple” appears through Vite hot reload. The Vite server and OpenCode both run inside one [Drop](https://droprun.sh/docs/running/) environment.

## Run locally

1. Install [Drop](https://droprun.sh/docs/installation/) and create an environment in this repo with `drop init`. If you already ran it here, reuse that environment.
2. Run `vp install` on the host. Copy `.env.example` to `.env.local` and set `OPENCODE_MODEL` to a model available in OpenCode. You can authenticate OpenCode inside Drop or set the matching provider API key in `.env.local`.
3. Install OpenCode in the Drop home using `vp run setup:drop`. This mounts the local Vite+ toolchain read only and installs `opencode-ai` only in the Drop environment.
4. Start the app with `vp run dev:drop`, then open `http://localhost:3000`.

The Drop launch publishes only port 3000 to host localhost. OpenCode's internal server stays on Drop's isolated loopback. `drop init` grants write access to this project and read-only access to `.git`; review the generated Drop config if you changed it. The agent can edit project files, including this app's source, and Vite will reload those edits. Keep the app local: it has no user authentication or per-user isolation.

The chat endpoint checks `DROP_ENV` before running OpenCode, so starting the app with plain `vp dev` shows the page but does not run an agent on the host.

## Validation

```sh
vp check
vp test
vp build
```
