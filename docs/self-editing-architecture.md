# Self-editing demo: architecture

Visitors open their own copy of a site and change it by chatting with a coding agent. The site and the agent run on a [Fly Sprite](https://docs.fly.io/sprites) (a hardware-isolated microVM) per visitor. A small Fly app, the host, sets the Sprite up and runs the agent.

```
Browser                       Fly app "ai-tink-host" (host)           Sprite "ai-tink-<id>" (one per visitor)
  │  GET /?key=…                ├─ landing + cookie → Sprite name         ├─ :8080 proxy (service, root-owned file)
  ├────────────────────────────►├─ creates + sets up the Sprite ─────────►│   ├─ forwards to Vite on :5173
  │  302 → Sprite URL           │   (uploads site, pnpm install, services) │   ├─ passes Vite's HMR WebSocket through
  │◄────────────────────────────┤                                          │   └─ injects <script src=host/widget.js>
  │  page + widget.js           ├─ GET /widget.js                          ├─ :5173 `vp dev` serving ~/site (agent-writable)
  │◄───────────────────────────────────────────────────────────────────────┤
  │  POST /api/chat (SSE) ─────►├─ chat(): Claude Code via the sandbox ──►├─ claude … ──► Sprites gateway ──► Anthropic
  │◄────────────────────────────┤   adapter, exec over the Sprites API     └─ edits ~/site → Vite → browser hot reload
```

## Pieces

- **Site** (`apps/self-editing`): a TanStack Start app with no chat. It is what the agent edits. `scripts/pack-site.mjs` packs it into `dist/site.tgz`, the template every Sprite starts from.
- **Host** (`apps/self-editing-host/src/server`): a plain Node HTTP server on Fly.
  - **Landing** (`index.ts`, `pages.ts`): gated by `?key=<ACCESS_KEY>` (then a cookie). A second cookie holds the visitor's Sprite name, `ai-tink-<12 hex>`. A visit starts setup if the Sprite is missing, shows a progress page, and redirects to the Sprite's URL when it is ready.
  - **Setup** (`sprites.ts`): idempotent and one run per Sprite at a time. Create the Sprite with a private URL, upload the template, install pnpm and the site's dependencies, install the proxy under `/opt/ai-tink`, create the `site` and `proxy` services, wait until the page answers, write a ready marker. About 25 to 30 s. "Reset" repeats it after deleting the site.
  - **Chat** (`chat.ts`, `sandbox.ts`): `chat()` with `claudeCodeText` and `withSandbox`, streamed as server-sent events. `sandbox.ts` attaches to the visitor's Sprite and replaces the Sprites provider's slow process and file calls; see Fragile points.
- **Proxy** (`src/sprite/proxy.mjs`): a Sprite service behind the Sprite's one public port. It lives outside the site, so an edit to the site cannot remove the chat. When Vite is down it serves a page that still has the chat, so the visitor can ask the agent to fix it.
- **Widget** (`src/widget`): a React app with its own CSS in a shadow DOM, built to one `widget.js`. It keeps the conversation and the Claude Code session id in `localStorage`, because Vite sometimes reloads the whole page after an edit.
  - **Placement** (`placement.ts`): the site marks where the chat goes with `<ChatSlot />` (`apps/self-editing/src/components/chat-slot.tsx`), which renders a `div[data-aitink-slot]`. The widget moves its host element into that slot and fills it; with no slot it floats in the corner behind an "Edit this site" launcher. A mutation observer re-places it when the site adds, removes, or re-renders the slot, so a React remount or an edit that deletes the slot cannot lose the chat or its draft. `ChatSlot` adds the marker only after React has mounted, so the widget never touches server-rendered markup before hydration.
- **Agent**: Claude Code (`claude`, preinstalled on Sprites) with `claude-haiku-5-5`. Its `ANTHROPIC_BASE_URL` is the Sprites gateway for the Anthropic connector, so the Sprite never holds a key. The adapter runs it with `bypassPermissions`; the Sprite is the isolation boundary. It reads `AGENTS.md` in the site first.

## Access and trust

- **Sprite URLs are private to your Fly org.** Only members logged in to Fly can open them. That is why the first version is for the owner only.
- **Widget token:** `HMAC-SHA256(TOKEN_SECRET, "widget:" + spriteName)`, baked into the injected `<script>` tag. `POST /api/chat` needs `Authorization: Bearer <token>`, an `X-Sprite` header, and an `Origin` that is that Sprite's own `https://<name>-<org>.sprites.app`. CORS allows only such origins.
- **Model key:** a Sprites connector (`CTHG1MvraRUcrHgF8uTjQA`, Anthropic, API key) holds it. Its access policy admits only Sprites named `ai-tink-*`. The Sprite calls `https://api.sprites.dev/v1/gateway/anthropic/<id>/v1/messages`; Claude Code sends a placeholder bearer token, which the gateway replaces. Verified 2026-10-24 from a throwaway Sprite: a raw Messages call and `claude -p` with the host's env both worked, and the Sprite's environment held no key. The earlier OpenRouter connector (`lnJFr15GNm0eu22128A3lg`) is gone.
- **The agent can do anything on its own Sprite**, including read the widget token, change the services, and use `sudo` (passwordless on Sprites). It cannot reach other Sprites or the host's secrets. A broken Sprite is repaired with "Reset".

## Fragile points

1. **The TanStack Sprites provider is slow.** Every process call and `mkdir`, `remove`, `rename`, `exists` waits about 11 s, because the provider waits for the exec socket to close and the server keeps it open that long after the exit frame. `sandbox.ts` replaces them with `@fly/sprites` calls. A chat run went from 64 s to 11 s. The upstream fix is to resolve on the exit frame.
2. **Sprite names.** `defineSandbox` names new Sprites with a bare hash, which the connector's `ai-tink-` prefix would deny. The host never lets the framework create a Sprite; `sandbox.ts` attaches to the one the host made.
3. **The agent can break its own site**, and a syntax error shows the fallback page. Deleting `<ChatSlot />` only moves the chat to the corner. The agent cannot easily break the chat itself, but it can with `sprite-env` or `sudo`. Reset restores both.
4. **Host state is in memory:** setup progress, the one-run-at-a-time set, and the hourly counters. Fly stops an idle host; a restart clears them. Sprites and their sessions are not affected.
5. **No cleanup of Sprites yet,** and no per-visitor limit on how many Sprites can be made. Only the owner can enter.
6. **The widget's first load needs the host awake.** A stopped Fly machine starts in a few seconds.
