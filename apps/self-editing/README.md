# TanStack AI self-editing demo

This TanStack Start app uses the native TanStack AI harness from [PR #1555](https://github.com/TanStack/ai/pull/1555), pinned through pkg.pr.new to commit `5cc000e`. The harness reads and edits the working tree and runs shell commands with its workspace tools. The app and harness run together inside [Drop](https://droprun.sh/docs/running/), so edits appear through Vite hot reload.

The model is OpenCode Zen's `deepseek-v4.1-flash`, called directly through `https://opencode.ai/zen/v1/chat/completions`. No OpenCode CLI or server is needed. The interface uses shadcn/ui Base UI, Tailwind CSS, and AI Elements for messages and tool activity.

## Run locally

1. Install Drop and run `drop init` at the repository root, or reuse its existing environment. Edit its mounts so the repository is read-only and only `apps/self-editing` is writable:

   ```toml
   mounts = [
     "~/Development/ai-tink-ts-ai-demo",
     "~/Development/ai-tink-ts-ai-demo/apps/self-editing::rw",
   ]
   ```

2. Run `vp install` at the repository root on the host. The preview packages reference other matching preview packages, so `pnpm-workspace.yaml` allows URL subdependencies.
3. Set `OPENCODE_API_KEY` in your shell or git-ignored `.env.local`. Use [Varlock local encryption](https://varlock.dev/guides/local-encryption/) for stored keys. Existing encrypted keys are reused. The native harness requires the API key; it does not use the OpenCode CLI's saved authentication.
4. Add `OPENCODE_MODEL` and `OPENCODE_API_KEY` to `[environ].exposed_vars` in the Drop environment config. `OPENCODE_MODEL` defaults to `opencode/deepseek-v4.1-flash`; the `opencode/` prefix is removed for Zen API requests.
5. In `apps/self-editing`, run `vp run setup:drop` to check the mounted Vite+ toolchain, then `vp run dev:drop`. Open `http://localhost:3000`.

The launch decrypts Varlock values on the host, forwards configuration into Drop, and publishes only port 3000 to localhost. Workspace tools run autonomously inside Drop. The chat endpoint checks `DROP_ENV` before opening a harness session. Keep this demo local: it has no user authentication or per-user isolation. Drop's environment config controls filesystem access. `scripts/drop.sh` uses the environment named after the repository root, which keeps the rest of the monorepo read-only to the agent.

The server holds one harness session per thread in memory. Each prompt continues that session, and stopping a request cancels its operation. History is lost on a server restart, including a server reload after edits to server code. The UI renders the harness's streamed messages and tool calls.

Varlock's Vite plugin loads configuration for development and builds. Run `vp exec varlock load --agent` for redacted validation. If a locally encrypted key fails to decrypt, reset it using Varlock on this machine before starting the app. Keep `.env.local` out of version control.

## Validation

```sh
vp check
vp test
vp build
```

For checks without a usable local key, prefix each command with `OPENCODE_API_KEY=''`. This validates the code without making model requests. The harness test uses a scripted model to verify real workspace edits, streamed tool activity, and session history.
