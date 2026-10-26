# AI SDK × TanStack AI demo: Next.js client

A Next.js chat built with the [AI SDK](https://ai-sdk.dev/) (`useChat`), [shadcn/ui](https://ui.shadcn.com/), and [AI Elements](https://ai-sdk.dev/elements). It talks to a separate agent server, [`apps/ai-sdk-hono`](../ai-sdk-hono): Hono running TanStack AI's `chat()`. Design notes and findings are in [`docs/ai-sdk-demo.md`](../../docs/ai-sdk-demo.md).

The two libraries speak different streaming protocols. The server sends standard [AG-UI](https://docs.ag-ui.com/) events; `useChat` reads the AI SDK's UI message stream. `src/lib/ag-ui-transport.ts` is a custom `ChatTransport` that translates in the browser, so the server stays plain TanStack AI.

## Layout

```
src/
  app/chat.tsx               # useChat + AI Elements (Conversation, Message, Reasoning, Tool, PromptInput, Suggestion)
  lib/ag-ui-transport.ts     # AgUiChatTransport: UIMessage[] → RunAgentInput, AG-UI events → UIMessageChunk
  lib/key-parts.ts           # React keys for message parts
  components/ai-elements/    # AI Elements, added with `shadcn add @ai-elements/<name>`
  components/ui/             # shadcn components (Radix, Nova preset)
next.config.ts               # rewrites /api/agent to the Hono server
```

## Run locally

Start the server first (see its README), then from `apps/ai-sdk-next`:

```sh
vp run dev        # next dev on http://localhost:3400
```

`vp dev` would start Vite, not Next.js; use `vp run dev`, `vp run build`, and `vp run start`. `/api/agent` is rewritten to `AGENT_URL` (default `http://127.0.0.1:8020`), so the browser never talks to the server directly: no CORS, and no key in the browser.

## Adding AI Elements

```sh
./node_modules/.bin/shadcn add @ai-elements/<name>
```

Then run `vp check --fix` from the repository root to format the new files.

## Validation

```sh
vp check            # from the repository root: format, lint, type check
vp test             # from apps/ai-sdk-next; no API key or network needed
vp run build        # next build
```

The transport tests run the real Hono app in-process with TanStack AI's `fakeText` model, and read the result with the AI SDK's own `readUIMessageStream`.
