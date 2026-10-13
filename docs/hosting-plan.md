# Hosting plan for the self-editing demo

Status: planned. Decided 2026-10-12. The infrastructure spike passed on 2026-10-13; see [Spike results](#spike-results).

## Goal

Host the self-editing demo publicly instead of on a developer machine, with each visitor getting their own copy of the site to change.

## Decision: Fly.io for everything

- **Self-editing site**: one [Fly.io Sprite](https://docs.fly.io/sprites) per visitor.
- **Agent host**: a normal Fly app running the harness and holding the model API key.
- **Other demos**, including the Pydantic AI backend: normal Fly apps.

Reasons:

- Sprites are hardware-isolated microVMs, which suits code changed by an untrusted visitor's agent.
- The Sprite filesystem persists while idle, and idle Sprites have no compute charge. A request to the Sprite URL wakes it.
- Checkpoints are fast copy-on-write snapshots of the writable filesystem. Restoring a clean checkpoint gives a "reset" for a broken site.
- TanStack AI has a Sprites provider, `@tanstack/ai-sandbox-sprites`.
- A FastAPI backend deploys the same way as the JavaScript apps.

## Design: serve the site from the Sprite, run the agent outside it

Visitors open the Sprite's URL and use the real site directly, with no iframe. The chat is a widget injected into every page.

```
Fly app (host)                         Sprite (one per visitor)
├─ landing: "start demo"               ├─ :8080  small proxy (root-owned, read-only)
│   → assigns a Sprite, redirects      │    ├─ forwards to Vite dev on :5173
├─ /api/chat  harness + model key      │    └─ injects <script src="host/widget.js">
├─ widget.js  the chat UI bundle       │        into every HTML response
└─ drives tools on the Sprite ───────► └─ /app  the TanStack Start site (agent-writable)
```

- **Widget**: the current `useChat` UI built as a standalone script, rendered in a shadow DOM so the agent's global CSS cannot restyle it. It calls the host's `/api/chat`.
- **Proxy**: injects the widget into HTML responses. If Vite or server rendering fails, it serves a fallback page that still has the widget, so the visitor can ask the agent to undo the change. It lives outside `/app`, is owned by root, and the agent's commands run as an unprivileged user.
- **Host**: runs the harness, keeps sessions, and holds the API key. The key never enters the Sprite.

Why not inject the widget from app code or `vite.config.ts`: the agent can edit both, so one bad edit would remove the chat.

## Things to handle

- **Cross-origin calls**: the widget runs on `*.sprites.app` and calls the Fly app. It needs CORS and a per-visitor token that binds a browser to its Sprite.
- **Remote tools**: the harness's file and shell tools must act on the Sprite. See open question 1.
- **Hot reload through the Sprite URL**: works; the proxy must pass Vite's WebSocket through. See [Spike results](#spike-results).
- **Chat history across reloads**: full page reloads re-inject the widget, so the host must keep the session. Use persistent storage, not `memoryPersistence()`.
- **Cost controls**: visitors spend model tokens and Sprite time. Plan for access control or invite codes, rate limits, a time limit per Sprite, and cleanup of abandoned Sprites. `~/Development/ai/examples/sandbox-web` has a reaper example.

## Sprite facts and limits

From the Fly docs (2026-10-12) and the TanStack provider source:

- The public URL is `https://<sprite-name>-<org-id>.sprites.app/`. It is private to the org by default; `sprite config update --url-auth public` makes it public.
- The URL forwards only the Sprite's HTTP service, one port. The TanStack provider assumes port 8080 (`SPRITE_DEFAULT_HTTP_PORT`). Other ports are reachable only through `sprite proxy`, which is not public.
- WebSocket support through the URL is not documented, but it works in practice. See [Spike results](#spike-results).
- Checkpoints capture the writable filesystem, not running processes. Restore is in place on the same Sprite, restarts the environment, and keeps services defined on disk. The docs do not describe creating a new Sprite from a checkpoint, so new visitors need a fresh setup or a pool of prepared Sprites that are reset between visitors.
- `@tanstack/ai-sandbox-sprites` 0.2.4 supports filesystem access, exec, background processes, the HTTP port, and checkpoints. Its source says process-kill behavior is unverified against a live Sprite and may leak child processes.
- The Sprites docs read did not list prices.

## Open questions

1. ~~**Can the native harness's tools act on a remote sandbox?**~~ Yes at the head of PR #1555, no at our pin. See [Harness backend options](#harness-backend-options).
2. ~~Does Vite hot reload work through the Sprite URL and the injecting proxy?~~ Yes. See [Spike results](#spike-results).
3. ~~How long does a fresh Sprite take to be ready?~~ Under a second to create and run a first command. Whether a pool is still needed depends on how long app setup takes; see [Spike results](#spike-results).

## Spike results

Run on 2026-10-13 against a hand-made Sprite (`sprite` CLI v0.0.1-rc48, Sprite runtime 0.0.2-beta.5), with a minimal Vite 7 app, not the real site. All the Sprites were destroyed afterwards. The scripts were throwaway; the design below is what they showed.

Setup: a Node proxy on :8080 forwarded to Vite on :5173 and ran as a Sprite service with `--http-port 8080`. It sent `accept-encoding: identity` upstream, injected a `<script>` before `</body>` in HTML responses, and piped WebSocket upgrades to Vite as raw TCP. A second Sprite stood in for the host app and served `widget.js` plus a CORS SSE endpoint.

| Question                                                                              | Result                                                                                                                                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public URL, proxy, and injection                                                      | Worked. The injected tag appears in `/`; non-HTML responses pass through unchanged.                                                                                             |
| Vite's HMR WebSocket through the Sprite URL                                           | Worked. `wss://` connected with the `vite-hmr` subprotocol and received `connected`, then a `full-reload` when a file was edited on the Sprite.                                 |
| HMR in a real browser                                                                 | Worked. Editing a CSS file changed the style with no page reload (a `window` marker survived).                                                                                  |
| Widget script loaded from a different origin                                          | Worked.                                                                                                                                                                         |
| CORS preflight with a custom `authorization` header from the widget to another origin | Worked.                                                                                                                                                                         |
| SSE through the Sprite edge                                                           | Not buffered. Chunks arrived about one second apart, as sent. The host app will be a normal Fly app, not a Sprite, so this only shows the Sprite edge does not break streaming. |
| Fallback page                                                                         | With Vite stopped, the proxy served a 503 page that still contained the widget tag.                                                                                             |
| Fresh Sprite readiness                                                                | `sprite create` returned in 0.4 s and the first `exec` took 0.23 s. The Sprite image has Node 24 and npm, but not `pnpm` or `vp`.                                               |

Not tested: the real app, `vp`/pnpm install time inside a Sprite, wake time from a cold Sprite, how long a WebSocket survives idle and wake cycles, the `tss`-style process-user split (agent as an unprivileged user with a root-owned proxy), network policy, and cost.

Things learned:

- Sprites are Linux VMs with a services runtime, not Docker images. Create the long-running processes with `sprite-env services create ... --http-port 8080`, which restarts them after a cold boot and starts them on an incoming request. A process started by hand does not survive a cold boot.
- The URL is org-private by default (Bearer token). `sprite config update --url-auth public` made it public for the test; visitor Sprites will need that, so the Sprite must never hold secrets.
- `sprite create` prints success and then hangs when run without a TTY. Run it under `timeout`, or create Sprites through the API or the `@tanstack/ai-sandbox-sprites` provider instead.
- `sprite org auth` reused the `flyctl` login and stored an API token unencrypted in `~/.sprites/keyring/`, because no system keyring is available.
- Vite needed `server.allowedHosts: true` (or the Sprite hostname). The real app's `allowedHosts` is currently the Tailscale name.
- The Sprite edge forwards to one HTTP port, so the proxy on :8080 must be the only public listener.

## Next steps

1. Spike a published harness adapter in a Sprite; see [Harness backend options](#harness-backend-options). Open question 1 is answered there.
2. Repeat the spike with the real app: install `vp`, run `vp dev` behind the proxy, and measure setup time to decide whether a pool of prepared Sprites is needed.
3. Build the widget bundle and the host app.

## Harness backend options

Researched 2026-10-13. All of this is from reading GitHub and the docs, not from running code against a Sprite.

### State of the native harness (PR #1555)

- `@tanstack/ai-harness` is **not on npm and not on `main`**. It exists only in [TanStack/ai#1555](https://github.com/TanStack/ai/pull/1555) (1123 files, about 100 commits, labels `merge-conflicts` and `waiting-on: author`, last updated 2026-10-12).
- The earlier phase PRs (#1513 to #1554) were closed on 2026-09-28 and combined into #1551, then #1555. Since then the author lands pieces of the owner stack as small PRs to `main`: tool choice (#1696), prompt caching (#1697), replay across models (#1698), `LogRecordsCapability` (#1714), host hooks (#1715), router picks (#1722). Open ones include subagents (#1723, #1727, #1731) and compaction (#1728, #1729). The harness package itself, with sessions, plugins, and the coding tools, has not been split out yet.
- Compatibility changes are listed in the PR body. Two affect us: `workspaceTools` moves to `@tanstack/ai-harness/plugins/coding` (our code imports it from `/plugins`), and `defineHarness` gains a 4th type parameter.
- **Remote tools (open question 1):** at the PR head (`6101b7d`), `workspaceTools({ root, backend })` takes a `WorkspaceBackend`, and `sandboxWorkspaceBackend(handle)` from `@tanstack/ai-sandbox/harness` sends every read, write, and command to any sandbox provider, including Sprites. See `docs/harness/coding-tools-backends.md` in the PR. Our pin, `5cc000e`, has no `coding/backend` and cannot do this. Moving the pin means taking a large, conflicting, still-changing PR.
- The native harness keeps the agent loop and the model key on the host, which is what this plan wants. The cost is that it depends on an unmerged PR.

### Published alternative: a coding-agent harness running in the Sprite

`main` has a separate, published path: `@tanstack/ai-sandbox` 0.5.22, `@tanstack/ai-sandbox-sprites` 0.2.5, and harness adapters `@tanstack/ai-opencode` 0.4.19, `ai-claude-code` 0.8.1, `ai-codex`, `ai-grok-build`, and `ai-acp` (`acpCompatible`, any ACP agent). Against `@tanstack/ai` 0.68.0:

```ts
chat({
  adapter: opencodeText("opencode/<model>"), // or claudeCodeText, codexText, ...
  messages,
  threadId,
  middleware: [withSandbox(defineSandbox({ id, provider: spritesSandbox({ apiKey }), workspace }))],
});
```

The host streams the result to `useChat` as ordinary AG-UI chunks, so the widget and the host route keep the same shape as today. The agent CLI runs inside the Sprite and edits `/app` directly, so no remote tool code is needed. Docs: `docs/sandbox/overview.md`, `harnesses.md`, `auth.md` in TanStack/ai.

Differences from the plan above, all **unverified**:

- **The model key reaches the Sprite.** The agent process runs in the sandbox and gets its credentials as workspace secrets (`createSecrets`). That breaks "the key never enters the Sprite". Options: a spend-capped key per demo, or a [Sprites Connector](https://docs.fly.io/sprites/concepts/connectors). A Custom API connector stores the key in the Fly org, the Sprite calls `https://api.sprites.dev/v1/gateway/<provider>/<connection_id>/<path>`, and the Sprite never holds the token. Zen is OpenAI-compatible, so the agent would need a configurable base URL, which OpenCode's `config` option may allow. Not tried.
- **Which harness.** `claudeCodeText`, `codexText`, and `grokBuildText` run the CLI through `exec` and need no extra port. Sprites has `writableStdin: false`, and the adapters handle that by writing the prompt to a file. They need that vendor's key or login, not Zen. `opencodeText` fits Zen best, and the repo used OpenCode before the native harness. But in a sandbox it runs `opencode serve` and reaches it with `ports.connect(port)`. On Sprites that makes the Sprite URL public and uses the **one** proxied port, which our site proxy already uses. Fixing that means routing an authenticated `/__agent/` path through the proxy. `acpCompatible` over stdio needs writable stdin, which Sprites lacks, so it would need the WebSocket transport and the same port.
- **Version pin.** This path needs stable `@tanstack/ai` 0.68.0. The app currently pins preview builds of `@tanstack/ai`, `ai-react`, `openai-base`, and the harness packages from #1555. Moving to published packages means dropping `blockExoticSubdeps: false` and rewriting `agent.server.ts` and `api.chat.ts`.
- **Sessions.** Harness sessions live in the Sprite or the host process. With `memoryPersistence()` they are lost when the host restarts; the sandbox docs describe durable runs and takeover for more.

### Decision (2026-10-13)

The app goes back to OpenCode, as in its first version, on published packages (`@tanstack/ai-opencode`, `ai-sandbox`, `ai-sandbox-local-process`). The code change is done for the local Drop setup. Hosting on Sprites is still planned: the sandbox provider becomes `spritesSandbox()`, and the open points above (model key, single public port for `opencode serve`) are still unresolved. The design near the top of this doc assumes the agent runs outside the Sprite; with OpenCode it runs inside, so revise that section when the Sprites spike is done.

### Recommendation (before the decision)

Do not build on #1555 yet. It is large, conflicting, and being split. Spike a published harness on a Sprite first, with these checks:

1. Run `chat()` with `withSandbox(spritesSandbox(...))` and a published harness adapter against a Sprite, with the proxy on :8080 and `vp dev` or Vite on :5173.
2. Check how the model key can be kept out of the Sprite, using a Connector or a scoped key.
3. If OpenCode is chosen, check the single-port conflict.

Revisit the native harness when its package is split out and published. By then `sandboxWorkspaceBackend` will let the same Sprite setup work with host-side tools.

## Rejected options

- **Cloudflare Workers with the Sandbox SDK** (`@tanstack/ai-sandbox-cloudflare`, `examples/sandbox-cloudflare`). A strong fit for the sandbox, with Durable Objects for durable runs. Rejected because the Pydantic AI backend would need a separate host or container, and Fly hosts everything one way.
- **[celld](https://github.com/denoland/celld)**: Deno's self-hosted, Apache-2.0 runtime for Cloudflare Workers apps, including Containers and the Sandbox SDK. It would run the Cloudflare design on our own servers. Rejected for now:
  - Containers are experimental.
  - Containers share the host kernel unless gVisor or Kata is configured.
  - Preview URLs need a wildcard hostname at the load balancer.
  - A container is destroyed when its Durable Object moves to another node.
  - The TanStack Cloudflare provider uses `exposePort` and none of the APIs celld rejects. This was checked by reading the code, not by running it.
- **Iframe preview of the sandbox inside a host page.** It works, but visitors would not use the real site. Replaced by the injected widget.
- **Running the agent inside the sandbox.** The visitor's agent could read the API key.
