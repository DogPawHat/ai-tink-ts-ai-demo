# Development

## Layout and toolchain

- pnpm workspace (`packages: [apps/*]` in `pnpm-workspace.yaml`), managed with [Vite+](https://viteplus.dev/) (`vp`). Local `vite-plus` is pinned to 1.4.0 through the pnpm catalog (updated 2026-10-24, along with TanStack AI 1.0 and TypeScript 7). Vite+ 1.4 ships Vitest 5, so pnpm warns that `@tanstack/ai-sandbox`, `ai-persistence`, and `ai-skills` 1.0.0 want a `vitest` ^4.1.10 peer. Checks, tests, and builds pass despite the warning; the deployed host was verified after the update on 2026-10-24: a widget-style request (run from the Fly machine with its secrets, via `fly ssh console`) set up a Sprite, and Claude Code edited the site through the Anthropic connector. The browser widget itself was not retested.
- Shared `lint`, `fmt`, and `staged` settings live in the root `vite.config.ts`. Vite+ ignores `lint` and `fmt` blocks in app configs; use `overrides` in the root config for app-specific rules.
- Each app keeps its own `vite.config.ts` for plugins, aliases, and the dev server.
- pnpm enforces a minimum release age. When `vp add` picks a version that is too new, pnpm adds a `minimumReleaseAgeExclude` entry to `pnpm-workspace.yaml`; remove it and ask for an older range instead (done for `@tanstack/react-query` on 2026-10-26). `allowBuilds` denies `@scarf/scarf`, CopilotKit's install-time telemetry.
- `vp install` runs the root `prepare` script (`vp config`), which can rewrite the Vite+ section of `AGENTS.md`. Don't commit that by accident.
- Vite+ docs ship in `node_modules/vite-plus/docs`. `guide/monorepo.md` and `guide/run.md` cover workspace behavior.

## Commands

Run from the repository root:

```sh
vp install                      # install the whole workspace
vp check                        # format, lint, and type check every app
vp -C apps/self-editing test    # one app's tests
vp -C apps/self-editing build   # one app's build
vp run doctor                   # React Doctor over every app
```

`vp dev` and `vp build` at the root do not pick an app in non-interactive shells; pass `-C apps/<name>`. `vp <name>` runs a built-in command and `vp run <name>` runs a `package.json` script, so `vp dev` and `vp run dev` can differ.

The pre-commit hook runs `vp staged`, which runs `vp check --fix` on staged files. It then runs [React Doctor](https://github.com/millionco/react-doctor) on staged files; its findings are printed but don't block the commit.

React Doctor (installed 2026-10-26 with `react-doctor install`) also added its agent skill under `.claude/skills/` and `.agents/skills/`, and a GitHub Actions workflow that comments on pull requests. By default it sends a score and crash reports to its servers, and a full scan checks dependencies through Socket.dev; pass `--no-telemetry --no-supply-chain` to keep a run local. The installer writes its hook to `.vite-hooks/_/pre-commit`, which `vp config` generates and git ignores, so the hook lives in the tracked `.vite-hooks/pre-commit` instead. `doctor.config.json` keeps Python virtualenvs (`**/.venv/**`) out of the scan: its security rules read `.py` files, and they flagged third-party code inside `apps/pydantic-agui/server/.venv` even though git ignores that folder (seen 2026-10-26 with 0.9.18).

## Running the host and testing it

- The host needs `SPRITES_API_KEY`, `ACCESS_KEY`, `TOKEN_SECRET`, `GATEWAY_URL`, and `PUBLIC_URL`; see [`apps/self-editing-host/README.md`](../apps/self-editing-host/README.md). The Sprites token is in `~/.sprites/keyring/sprites-cli-*/sprites-org-https-*/` (a plain file; the CLI could not use a system keyring).
- To check chat and security from the shell, send a request that looks like the widget's: an `Origin` of `https://<sprite>-<org>.sprites.app`, `X-Sprite`, and `Authorization: Bearer <token>`, where the token is the HMAC from the architecture doc. Curl does not cover browser behavior, though: a real browser found a CORS preflight failure (the chat client adds `x-run-id`) that curl missed.
- For a browser test, Playwright's Chromium is cached under `~/.cache/ms-playwright`. Install `playwright-core` in a scratch directory and launch it with `executablePath`. Sprite URLs are private, so make the test Sprite public for the test (`sprite config update --url-auth public`) and set it back to `sprite` afterwards.
- Do not use `pkill -f '<pattern>'` or `pgrep -f` with a pattern that also appears in your own command line: it kills the shell that runs it (exit 144). Kill by pid or port.

## Related checkouts on this machine

- `~/Development/ai`: a TanStack AI checkout last synced 2026-09-22. It predates the native harness in PR #1555, which this app no longer uses. It has the sandbox packages (`packages/ai-sandbox*`) and examples referenced in the other docs (`examples/ag-ui`, `examples/sandbox-cloudflare`, `examples/sandbox-web`).
- `flyctl` is installed at `~/.fly/bin` and logged in; the host is the Fly app `ai-tink-host`, and the Pydantic demo is `ai-tink-pydantic`. `ai-tink-genui`, `ai-tink-ai-sdk`, and `ai-tink-start-chat` are the other demos (each app's `fly.toml` and `Dockerfile`, built from the repository root). There is no Docker on this machine; builds run on Fly's remote builder (`--remote-only`). Deploy them one at a time: pnpm 12 checks the whole workspace lockfile (about 1,500 packages) against its supply-chain policies on every install, even a filtered one. On 2026-10-27, six such installs at once (three images, two stages each) took about 90 s each and ran the builder out of memory (exit 137). The newer Dockerfiles share a BuildKit cache mount at `/pnpm` (`PNPM_CONFIG_STORE_DIR`, `PNPM_CONFIG_CACHE_DIR`; pnpm 12 has no `--cache-dir` flag), which holds the store and the record of a passed check, so after the first build the check is skipped ("verified 52s ago"). The three deploys then took 68 to 123 s each. If that stops being enough, [pnpm's Docker guide](https://pnpm.io/docker) installs once and copies a `pnpm deploy --prod` output into the runtime stage. When you change a non-secret variable in an app's `fly.toml` `[env]`, also set it on the running app, since `fly.toml` only applies on the next deploy: `fly machine update <id> -a <app> --env NAME=value --skip-start -y` (list machine ids with `fly machine list -a <app>`). Secrets go through `fly secrets set`. Done for the switch to `claude-sonnet-5-5` on 2026-10-26. The `sprite` CLI (v0.0.1-rc48) is installed at `~/.local/bin/sprite` and authenticated to the `ciaran-curley` org through the flyctl session. Pass `-o ciaran-curley` to commands. Its token is stored unencrypted in `~/.sprites/keyring/`.

Drop (the earlier local sandbox) is no longer used by the app. Its environment config still exists at `~/.config/drop/home-dogpawhat-Development-ai-tink-ts-ai-demo.toml`, and Claude Code is installed in its home; neither is needed now.
