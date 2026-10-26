# Self-editing host

The Fly app behind the self-editing demo. It sets up one [Fly Sprite](https://docs.fly.io/sprites) per visitor, serves the chat widget, and runs [Claude Code](https://www.npmjs.com/package/@anthropic-ai/claude-code) on that Sprite with `claude-sonnet-5-5`, through the Sprites gateway to an Anthropic connector. The Sprite never holds a model key.

Live at <https://ai-tink-host.fly.dev> (Fly app `ai-tink-host`, org `personal`, region `lhr`). See [`docs/self-editing-architecture.md`](../../docs/self-editing-architecture.md) for how the pieces fit.

## Use it

Open `https://ai-tink-host.fly.dev/?key=<ACCESS_KEY>` while logged in to Fly as a member of the org. The first visit sets up a Sprite (about 30 s), then redirects to its URL. Sprite URLs are private to the org, so only org members can open them. A cookie keeps the same Sprite for the next visit. The chat panel sits beside the live site. If you remove the slot from the page, it floats in the corner behind an "Edit this site" button. "Reset" restores the site to the template. An existing Sprite keeps the template it started from, so use "Reset" to pick up a newer one.

## Environment

| Variable          | Where                | Purpose                                                        |
| ----------------- | -------------------- | -------------------------------------------------------------- |
| `SPRITES_API_KEY` | secret               | Sprites API token: create Sprites, run commands in them        |
| `ACCESS_KEY`      | secret               | Shared key for the landing page                                |
| `TOKEN_SECRET`    | secret               | Signs the per-Sprite widget tokens (HMAC)                      |
| `GATEWAY_URL`     | `fly.toml`           | `https://api.sprites.dev/v1/gateway/anthropic/<connection id>` |
| `PUBLIC_URL`      | `fly.toml`           | This host's origin; the proxy loads `widget.js` from it        |
| `AGENT_MODEL`     | `fly.toml`, optional | Anthropic model id, default `claude-sonnet-5-5`                |

Rotate a secret with `fly secrets set NAME=... --app ai-tink-host`. Rotating `TOKEN_SECRET` invalidates the widget on existing Sprites until they are reset.

## Build and deploy

```sh
vp install
vp -C apps/self-editing-host run build     # server, widget, and the site tarball into dist/
vp -C apps/self-editing-host test

# from the repository root:
fly deploy . --config apps/self-editing-host/fly.toml \
  --dockerfile apps/self-editing-host/Dockerfile --remote-only --ha=false
```

To run it locally, set the variables above (`PUBLIC_URL` as `http://localhost:8787` and `PORT=8787` for example) and run `node dist/index.mjs`. It creates real Sprites in the org. A browser cannot test the widget against a local host, because the Sprite pages are https and the host is not; test against the deployed host.

## Layout

- `src/server/` - the HTTP server (`index.ts`), Sprite setup (`sprites.ts`), the sandbox adapter for the chat (`sandbox.ts`), the chat endpoint and its auth (`chat.ts`), token helpers (`auth.ts`), config, and the landing pages.
- `src/sprite/proxy.mjs` - runs on each Sprite behind its one public port: forwards to Vite, passes the HMR WebSocket through, injects the widget tag, and serves a fallback page when the site is down.
- `src/widget/` - the chat widget: a React app with its own CSS in a shadow DOM, built to one `widget.js`. `placement.ts` puts it in the site's `<ChatSlot />` when there is one, and in the corner otherwise.
- `scripts/pack-site.mjs` - packs `apps/self-editing` into `dist/site.tgz`.

## Operating notes

- **Cleanup:** nothing deletes Sprites. List them with `sprite -o ciaran-curley list` and remove one with `sprite -o ciaran-curley destroy -s <name>`. Idle Sprites cost no compute.
- **A broken site:** the proxy serves a fallback page that still has the chat. Ask the agent to undo the change, or use "Reset".
- **Limits:** one run at a time per Sprite, 40 runs per hour per Sprite, prompts up to 4000 characters, 30 agent turns per run. They are in memory, so a host restart clears the counters.
- **State:** the host keeps no database. The Sprite is the source of truth, and its name is in the visitor's cookie.
