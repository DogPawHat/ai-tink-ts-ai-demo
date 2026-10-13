# TanStack AI self-editing demo

This TanStack Start app sends chat prompts through TanStack AI's Claude Code adapter (`@tanstack/ai-claude-code`). Claude Code edits the same working tree that Vite serves, so a prompt such as “Make the site purple” appears through Vite hot reload. The Vite server and Claude Code both run inside one [Drop](https://droprun.sh/docs/running/) environment, and `@tanstack/ai-sandbox` with the local-process provider points the agent at the app directory.

The model is `anthropic/claude-haiku-5.5` by default, called through [OpenRouter](https://openrouter.ai)'s Anthropic-compatible endpoint (`https://openrouter.ai/api`). The interface uses shadcn/ui Base UI, Tailwind CSS, and AI Elements for messages and tool activity.

All TanStack AI packages are published releases. The app used OpenCode with Zen models before; see `docs/hosting-plan.md` for why it moved to Claude Code.

## Run locally

1. Install Drop and run `drop init` at the repository root, or reuse its existing environment. Edit its mounts so the repository is read-only and only `apps/self-editing` is writable:

   ```toml
   mounts = [
     "~/Development/ai-tink-ts-ai-demo",
     "~/Development/ai-tink-ts-ai-demo/apps/self-editing::rw",
   ]
   ```

2. Run `vp install` at the repository root on the host. The preview packages reference other matching preview packages, so `pnpm-workspace.yaml` allows URL subdependencies.
3. Set `OPENROUTER_API_KEY` in your shell or git-ignored `.env.local`. Use [Varlock local encryption](https://varlock.dev/guides/local-encryption/) for stored keys. Optional: `AGENT_MODEL` (an OpenRouter model id, default `anthropic/claude-haiku-5.5`) and `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api`; set it to route the calls through a gateway, where the key can then be a placeholder).
4. Add `AGENT_MODEL`, `OPENROUTER_API_KEY`, and `OPENROUTER_BASE_URL` to `[environ].exposed_vars` in the Drop environment config.
5. In `apps/self-editing`, run `vp run setup:drop` to check the mounted Vite+ toolchain and install `@anthropic-ai/claude-code` in the Drop home, then run `vp run dev:drop`. Open `http://localhost:3000`.

The launch decrypts Varlock values on the host, forwards configuration into Drop, and publishes only port 3000 to localhost. Claude Code runs with `permissionMode: "bypassPermissions"`, so it edits files and runs commands without asking. The chat endpoint checks `DROP_ENV` before running it, so plain `vp dev` shows the page but does not run an agent on the host. The OpenRouter key is in the agent's environment, so the agent can read it; use a spend-capped key. Keep this demo local: it has no user authentication or per-user isolation. Drop's environment config controls filesystem access. `scripts/drop.sh` uses the environment named after the repository root, which keeps the rest of the monorepo read-only to the agent.

Claude Code keeps the conversation. The server announces each session in a `claude-code.session-id` event, the page sends it back with every prompt, and Claude Code resumes it. Claude Code reads `CLAUDE.md`, not `AGENTS.md`, so the system prompt tells it to read `AGENTS.md` first.

Varlock's Vite plugin loads configuration for development and builds. Run `vp exec varlock load --agent` for redacted validation. If a locally encrypted key fails to decrypt, reset it using Varlock on this machine before starting the app. Keep `.env.local` out of version control.

## Validation

```sh
vp check
vp test
vp build
```

For checks without a usable local key, prefix each command with `OPENROUTER_API_KEY=''`. This validates the code without making model requests. The test covers the Drop check and the model and sandbox settings; it does not call Claude Code.
