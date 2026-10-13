# Self-editing site

The TanStack Start site that visitors change. It has no chat and no AI code: the chat is a widget that a proxy on each visitor's Sprite injects into every page (see [`apps/self-editing-host`](../self-editing-host)). The coding agent edits this app's files, and Vite hot reloads the visitor's browser.

`apps/self-editing-host` packs this directory (`src`, `public`, `package.json`, `tsconfig.json`, `vite.config.ts`, `components.json`, `AGENTS.md`) into the template tarball that every new Sprite starts from, so what is here is what a visitor gets after "Reset".

## Run it alone

```sh
vp install     # at the repository root
vp dev         # from this directory; serves http://127.0.0.1:5173
```

`vite.config.ts` binds `127.0.0.1:5173` and allows any host, because the proxy on a Sprite forwards to it under the Sprite's own hostname.

## The chat slot

`<ChatSlot />` (`src/components/chat-slot.tsx`) marks where the chat panel appears; `src/routes/index.tsx` puts it beside the live site. The widget fills it. Without one on the page the chat floats in the corner instead, so removing it is safe. Always use the component rather than a hand-written element: it adds its marker only after mount, which keeps server-rendered markup and hydration in step.

## For the agent

`AGENTS.md` is the agent's briefing: it is told to read it first. Keep it focused on this app; it must not mention the host or the widget beyond saying the chat is injected from outside.
