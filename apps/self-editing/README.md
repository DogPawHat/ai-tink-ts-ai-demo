# TanStack AI self-editing demo

This TanStack Start app sends chat prompts through TanStack AI's OpenCode adapter (`@tanstack/ai-opencode`). OpenCode edits the same working tree that Vite serves, so a prompt such as “Make the site purple” appears through Vite hot reload. The Vite server and OpenCode both run inside one [Drop](https://droprun.sh/docs/running/) environment, and `@tanstack/ai-sandbox` with the local-process provider points the agent at the app directory.

The model is an OpenCode Zen model, `opencode/deepseek-v4.1-flash` by default. The interface uses shadcn/ui Base UI, Tailwind CSS, and AI Elements for messages and tool activity.

All TanStack AI packages are the published releases. The app used the native harness from [PR #1555](https://github.com/TanStack/ai/pull/1555) before; see `docs/hosting-plan.md` for why it went back to OpenCode.

## Run locally

1. Install Drop and run `drop init` at the repository root, or reuse its existing environment. Edit its mounts so the repository is read-only and only `apps/self-editing` is writable:

   ```toml
   mounts = [
     "~/Development/ai-tink-ts-ai-demo",
     "~/Development/ai-tink-ts-ai-demo/apps/self-editing::rw",
   ]
   ```

2. Run `vp install` at the repository root on the host. The preview packages reference other matching preview packages, so `pnpm-workspace.yaml` allows URL subdependencies.
3. Set `OPENCODE_API_KEY` in your shell or git-ignored `.env.local`. Use [Varlock local encryption](https://varlock.dev/guides/local-encryption/) for stored keys. Existing encrypted keys are reused. The key is optional if OpenCode is already authenticated inside Drop.
4. Add `OPENCODE_MODEL` and `OPENCODE_API_KEY` to `[environ].exposed_vars` in the Drop environment config. `OPENCODE_MODEL` defaults to `opencode/deepseek-v4.1-flash` and is passed to OpenCode as `provider/model`.
5. In `apps/self-editing`, run `vp run setup:drop` to check the mounted Vite+ toolchain and install `opencode-ai` in the Drop home, then run `vp run dev:drop`. Open `http://localhost:3000`.

The launch decrypts Varlock values on the host, forwards configuration into Drop, and publishes only port 3000 to localhost. OpenCode's internal server stays on Drop's isolated loopback and runs with `permissionMode: "acceptEdits"`. The chat endpoint checks `DROP_ENV` before running OpenCode, so plain `vp dev` shows the page but does not run an agent on the host. Keep this demo local: it has no user authentication or per-user isolation. Drop's environment config controls filesystem access. `scripts/drop.sh` uses the environment named after the repository root, which keeps the rest of the monorepo read-only to the agent.

OpenCode keeps the conversation. The server announces each new session in an `opencode.session-id` event, the page sends it back with every prompt, and OpenCode resumes it.

Varlock's Vite plugin loads configuration for development and builds. Run `vp exec varlock load --agent` for redacted validation. If a locally encrypted key fails to decrypt, reset it using Varlock on this machine before starting the app. Keep `.env.local` out of version control.

## Validation

```sh
vp check
vp test
vp build
```

For checks without a usable local key, prefix each command with `OPENCODE_API_KEY=''`. This validates the code without making model requests. The test covers the Drop check and the model and sandbox settings; it does not call OpenCode.
