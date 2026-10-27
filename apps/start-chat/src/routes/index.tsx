import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { clientTools, fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import type { UIMessage } from "@tanstack/ai-react";
import { keyParts } from "../key-parts";
import { setAccentDef, type Accent } from "../tools";

export const Route = createFileRoute("/")({ component: Home });

// Created once so every render shares one connection. /api/chat is a server
// route in this same app (src/routes/api/chat.ts).
const connection = fetchServerSentEvents("/api/chat");

// Full class names, so Tailwind sees them in the source.
const ACCENT_CLASSES: Record<Accent, { text: string; button: string; bubble: string }> = {
  amber: { text: "text-amber-400", button: "bg-amber-500", bubble: "bg-amber-500" },
  emerald: { text: "text-emerald-400", button: "bg-emerald-500", bubble: "bg-emerald-500" },
  sky: { text: "text-sky-400", button: "bg-sky-500", bubble: "bg-sky-500" },
  rose: { text: "text-rose-400", button: "bg-rose-500", bubble: "bg-rose-500" },
  violet: { text: "text-violet-400", button: "bg-violet-500", bubble: "bg-violet-500" },
};

function Home() {
  const [draft, setDraft] = useState("");
  const [accent, setAccent] = useState<Accent>("amber");
  const classes = ACCENT_CLASSES[accent];

  // The browser half of setAccent. The model calls it like any other tool;
  // useChat runs it here and sends the result back to the server.
  const tools = useMemo(
    () =>
      clientTools(
        setAccentDef.client(({ color }) => {
          setAccent(color);
          return { color };
        }),
      ),
    [],
  );

  const { messages, sendMessage, isLoading, error, stop } = useChat({
    threadId: "start-chat",
    connection,
    tools,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isLoading) return;
    setDraft("");
    void sendMessage(text);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className={`text-xs font-medium uppercase tracking-[0.2em] ${classes.text}`}>
            TanStack Start × TanStack AI
          </p>
          <h1 className="text-xl font-semibold text-white">One app, both halves</h1>
          <p className="mt-1 text-sm text-slate-400">
            <code>useChat</code> in the browser, <code>chat()</code> in a Start server route, and
            tool definitions shared between them.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="flex min-h-[70vh] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/50">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">
                Try “How many stars does TanStack/router have?” or “Make the page violet.”
              </p>
            ) : (
              messages.map((message) => (
                <Message key={message.id} message={message} bubble={classes.bubble} />
              ))
            )}
            {error ? <p className="text-sm text-red-300">{error.message}</p> : null}
          </div>
          <form className="flex gap-2 border-t border-slate-800 p-4" onSubmit={submit}>
            <label htmlFor="message" className="sr-only">
              Message
            </label>
            <input
              id="message"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              placeholder="Message the agent…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            {isLoading ? (
              <button
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium"
                type="button"
                onClick={stop}
              >
                Stop
              </button>
            ) : (
              <button
                className={`rounded-lg px-3 py-2 text-sm font-medium text-slate-950 ${classes.button}`}
                type="submit"
              >
                Send
              </button>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}

function Message({ message, bubble }: { message: UIMessage; bubble: string }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex flex-col items-start gap-2"}>
      {keyParts(message.parts).map(({ key, part }) => {
        if (part.type === "text") {
          return part.content ? (
            <p
              key={key}
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                isUser ? `${bubble} text-slate-950` : "bg-slate-800"
              }`}
            >
              {part.content}
            </p>
          ) : null;
        }
        if (part.type === "thinking") {
          return part.content ? (
            <details key={key} className="max-w-[85%] text-xs text-slate-400">
              <summary className="cursor-pointer">Reasoning</summary>
              <p className="mt-1 whitespace-pre-wrap">{part.content}</p>
            </details>
          ) : null;
        }
        if (part.type === "tool-call") {
          return (
            <div
              key={key}
              className="max-w-[85%] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
            >
              <p className="text-slate-200">
                {part.name}({part.arguments})
              </p>
              <p className="mt-1 break-all text-slate-400">
                {part.state === "complete" || part.output !== undefined
                  ? `→ ${JSON.stringify(withoutReplay(part.output))}`
                  : part.state}
              </p>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

/** Web search results carry the pages' encrypted text for the server to replay; it isn't worth showing. */
function withoutReplay(output: unknown) {
  if (!output || typeof output !== "object" || !("replay" in output)) return output;
  const { replay: _replay, ...rest } = output;
  return rest;
}
