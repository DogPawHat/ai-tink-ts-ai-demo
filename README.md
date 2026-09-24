# TanStack AI self-editing demo

This TanStack Start app sends chat prompts through TanStack AI's OpenCode adapter. OpenCode edits the same working tree that Vite serves, so a prompt such as “Make the site purple” appears through Vite hot reload. The Vite server and OpenCode both run inside one [Drop](https://droprun.sh/docs/running/) environment.

## Run locally

1. Install [Drop](https://droprun.sh/docs/installation/) and create an environment in this repo with `drop init`. If you already ran it here, reuse that environment.
2. Run `vp install` on the host. Set `OPENCODE_MODEL` to an `opencode/*` model available through OpenCode Zen, either in your shell or in a git-ignored `.env.local` file. Set `OPENCODE_API_KEY` in `.env.local` or authenticate OpenCode inside Drop. Use [Varlock local encryption](https://varlock.dev/guides/local-encryption/) for the stored key.
3. Install OpenCode in the Drop home using `vp run setup:drop`. This mounts the local Vite+ toolchain read only and installs `opencode-ai` only in the Drop environment.
4. In the Drop environment config created by `drop init`, add `OPENCODE_MODEL` and `OPENCODE_API_KEY` to `[environ].exposed_vars`. Start the app with `vp run dev:drop`, then open `http://localhost:3000`. This launch decrypts Varlock values on the host, then forwards those two variables to Drop.

The Drop launch publishes only port 3000 to host localhost. OpenCode's internal server stays on Drop's isolated loopback. `drop init` grants write access to this project and read-only access to `.git`; review the generated Drop config if you changed it. The agent can edit project files, including this app's source, and Vite will reload those edits. Keep the app local: it has no user authentication or per-user isolation.

The chat endpoint checks `DROP_ENV` before running OpenCode, so starting the app with plain `vp dev` shows the page but does not run an agent on the host.

Varlock's Vite plugin loads the schema for development and builds. Run `vp exec varlock load --agent` to inspect validation results with the key redacted. Keep `.env.local` out of version control. The key is optional because OpenCode can use its own authentication; `OPENCODE_MODEL` is checked by the chat endpoint when running inside Drop.

## Validation

```sh
vp check
vp test
vp build
```
