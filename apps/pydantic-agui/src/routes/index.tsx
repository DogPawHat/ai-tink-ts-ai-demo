import { useState } from "react";
import type { FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import type { UIMessage } from "@tanstack/ai-react";

export const Route = createFileRoute("/")({ component: Home });

// Created once so every render shares one connection. The Pydantic AI server speaks AG-UI at
// its root; Vite proxies this path to it.
const connection = fetchServerSentEvents("/api/agent");

function Home() {
  const [draft, setDraft] = useState("");
  const { messages, sendMessage, isLoading, error, stop } = useChat({
    threadId: "pydantic-demo",
    connection,
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
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-400">
            TanStack AI × Pydantic AI
          </p>
          <h1 className="text-xl font-semibold text-white">Pydantic AI agent over AG-UI</h1>
          <p className="mt-1 text-sm text-slate-400">
            A TanStack AI React client talking to a FastAPI server. No TanStack code runs on the
            server.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="flex min-h-[70vh] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/50">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">
                Try “Roll three twenty-sided dice” or “What time is it?”
              </p>
            ) : (
              messages.map((message) => <Message key={message.id} message={message} />)
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
                className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950"
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

function Message({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex flex-col items-start gap-2"}>
      {keyParts(message.parts).map(({ key, part }) => {
        if (part.type === "text") {
          return part.content ? (
            <p
              key={key}
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                isUser ? "bg-amber-500 text-slate-950" : "bg-slate-800"
              }`}
            >
              {part.content}
            </p>
          ) : null;
        }
        if (part.type === "tool-call") {
          return (
            <div
              key={key}
              className="max-w-[85%] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
            >
              <p className="text-amber-300">
                {part.name}({part.arguments})
              </p>
              <p className="mt-1 text-slate-400">
                {part.state === "complete" || part.output !== undefined
                  ? `→ ${JSON.stringify(part.output)}`
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

/**
 * Pairs each part with a React key. Tool calls have ids; text parts do not, so a
 * text part is keyed by the tool call before it, which stays stable as parts stream in.
 */
function keyParts(parts: UIMessage["parts"]) {
  let after = "start";
  let count = 0;
  return parts.map((part) => {
    if (part.type === "tool-call") {
      after = part.id;
      count = 0;
      return { key: part.id, part };
    }
    return { key: `${after}:${part.type}:${count++}`, part };
  });
}
