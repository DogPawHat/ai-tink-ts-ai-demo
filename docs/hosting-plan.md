# Hosting plan for the self-editing demo

Status: planned, not started. Decided 2026-10-12.

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
- **Hot reload through the Sprite URL**: unverified. The proxy must also pass through Vite's WebSocket.
- **Chat history across reloads**: full page reloads re-inject the widget, so the host must keep the session. Use persistent storage, not `memoryPersistence()`.
- **Cost controls**: visitors spend model tokens and Sprite time. Plan for access control or invite codes, rate limits, a time limit per Sprite, and cleanup of abandoned Sprites. `~/Development/ai/examples/sandbox-web` has a reaper example.

## Sprite facts and limits

From the Fly docs (2026-10-12) and the TanStack provider source:

- The public URL is `https://<sprite-name>-<org-id>.sprites.app/`. It is private to the org by default; `sprite config update --url-auth public` makes it public.
- The URL forwards only the Sprite's HTTP service, one port. The TanStack provider assumes port 8080 (`SPRITE_DEFAULT_HTTP_PORT`). Other ports are reachable only through `sprite proxy`, which is not public.
- WebSocket support through the URL is not documented. **Unverified.**
- Checkpoints capture the writable filesystem, not running processes. Restore is in place on the same Sprite, restarts the environment, and keeps services defined on disk. The docs do not describe creating a new Sprite from a checkpoint, so new visitors need a fresh setup or a pool of prepared Sprites that are reset between visitors.
- `@tanstack/ai-sandbox-sprites` 0.2.4 supports filesystem access, exec, background processes, the HTTP port, and checkpoints. Its source says process-kill behavior is unverified against a live Sprite and may leak child processes.
- The Sprites docs read did not list prices.

## Open questions

1. **Can the native harness's tools act on a remote sandbox?** `workspaceTools` in PR #1555 currently works on a local root. Read the PR branch to find out. The fallback is custom read, write, edit, and exec tools built on `@tanstack/ai-sandbox-sprites`.
2. Does Vite hot reload work through the Sprite URL and the injecting proxy?
3. How long does a fresh Sprite take to be ready, and is a pool of prepared Sprites needed?

## First step

Test the risky parts on one hand-made Sprite before writing app code:

1. Install the `sprite` CLI and create a Sprite.
2. Run Vite dev behind a small proxy on port 8080 that injects a script.
3. Check hot reload through the public URL.
4. Load a widget script from a different origin.

None of this needs the harness. Open question 1 can be researched in parallel.

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
