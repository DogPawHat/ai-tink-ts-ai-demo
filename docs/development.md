# Development

## Layout and toolchain

- pnpm workspace (`packages: [apps/*]` in `pnpm-workspace.yaml`), managed with [Vite+](https://viteplus.dev/) (`vp`). Local `vite-plus` is pinned to 0.3.2 through the pnpm catalog.
- Shared `lint`, `fmt`, and `staged` settings live in the root `vite.config.ts`. Vite+ ignores `lint` and `fmt` blocks in app configs; use `overrides` in the root config for app-specific rules.
- Each app keeps its own `vite.config.ts` for plugins, aliases, and the dev server.
- Vite+ docs ship in `node_modules/vite-plus/docs`. `guide/monorepo.md` and `guide/run.md` cover workspace behavior.

## Commands

Run from the repository root:

```sh
vp install                      # install the whole workspace
vp check                        # format, lint, and type check every app
vp -C apps/self-editing test    # one app's tests
vp -C apps/self-editing build   # one app's build
```

`vp dev` and `vp build` at the root do not pick an app in non-interactive shells; pass `-C apps/<name>`. `vp <name>` runs a built-in command and `vp run <name>` runs a `package.json` script, so `vp dev` and `vp run dev` can differ.

The pre-commit hook runs `vp staged`, which runs `vp check --fix` on staged files.

## Secrets: Varlock and the TPM

`apps/self-editing/.env.schema` declares configuration. The git-ignored `apps/self-editing/.env.local` holds `OPENCODE_API_KEY`, encrypted with Varlock's local encryption on the `linux-tpm` backend.

Loading the Vite config runs the Varlock plugin, so `vp check`, `vp build`, `vp dev`, and the pre-commit hook all need to decrypt the key. Decryption needs access to `/dev/tpmrm0`, which belongs to the `tss` group.

- On this machine the user is in `tss`, but processes started before the user was added do not have the group. Symptom: `Decryption failed ... Backend: linux-tpm (file-based)`. Check with `id`; group 103 (`tss`) should be listed.
- Fix it for one command with `sg tss -c '<command>'`. Restarting the agent host or logging in again fixes it for good.
- `sg` runs the command through the login shell, which is fish here. Fish does not support heredocs, so pass commit messages with `git commit -F <file>`, not `<<EOF`.
- For checks that do not need the real key, `OPENCODE_API_KEY=placeholder vp check` gets past Varlock.
- Run `vp exec varlock load --agent` from `apps/self-editing` for a redacted view of loaded values.

## Drop

[Drop](https://droprun.sh/docs/running/) 0.2.1 sandboxes the self-editing app on the host. Its environment config is outside the repository, at `~/.config/drop/home-dogpawhat-Development-ai-tink-ts-ai-demo.toml`. It extends `base.toml` and mounts:

- the repository root read-only, so the agent can read shared config and `node_modules` but cannot change other apps;
- `apps/self-editing` read-write.

`OPENCODE_MODEL` and `OPENCODE_API_KEY` are listed in `[environ].exposed_vars`. `apps/self-editing/scripts/drop.sh` derives the environment ID from the repository root, because it runs from the app directory and Drop would otherwise derive a different ID from the working directory. Renaming or moving the repository changes that ID.

From `apps/self-editing`: `vp run setup:drop` checks the mounted Vite+ toolchain, and `vp run dev:drop` starts the app on `127.0.0.1:3000`.

## Tailscale

The machine is `dogpawbot.taildd39d.ts.net`, and the self-editing Vite config allows that host. Drop publishes port 3000 on localhost only. As of 2026-10-12, Tailscale Serve forwards ports 3773 and 3100, not 3000, so the demo is not reachable over the tailnet without a new Serve entry.

## Related checkouts on this machine

- `~/Development/ai`: a TanStack AI checkout last synced 2026-09-22. It predates the native harness in PR #1555, which this app no longer uses. It has the sandbox packages (`packages/ai-sandbox*`) and examples referenced in the other docs (`examples/ag-ui`, `examples/sandbox-cloudflare`, `examples/sandbox-web`).
- `flyctl` is installed at `~/.fly/bin` and logged in. The `sprite` CLI (v0.0.1-rc48) is installed at `~/.local/bin/sprite` and authenticated to the `ciaran-curley` org through the flyctl session. Pass `-o ciaran-curley` to commands. Its token is stored unencrypted in `~/.sprites/keyring/`.
