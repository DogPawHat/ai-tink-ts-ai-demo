import { useEffect, useMemo, useRef, useState } from "react";
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";

export interface WidgetConfig {
  host: string;
  sprite: string;
  token: string;
}

interface Stored {
  open: boolean;
  sessionId?: string;
  messages: ChatMessage[];
}

// The parts of a TanStack AI UI message that the widget renders.
interface Part {
  type: string;
  content?: string;
  name?: string;
  state?: string;
}
interface ChatMessage {
  id: string;
  role: string;
  parts: Part[];
  [key: string]: unknown;
}

const BUBBLE = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

function load(key: string): Stored {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? "null") as Stored | null;
    if (stored && Array.isArray(stored.messages)) return stored;
  } catch {
    // A missing or corrupt entry starts a fresh conversation.
  }
  return { open: false, messages: [] };
}

export function Widget({ host, sprite, token }: WidgetConfig) {
  const storageKey = `aitink:${sprite}`;
  const initial = useMemo(() => load(storageKey), [storageKey]);
  const [open, setOpen] = useState(initial.open);
  const [draft, setDraft] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>(initial.sessionId);
  const [resetting, setResetting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, isLoading, error, stop } = useChat({
    threadId: sprite,
    initialMessages: initial.messages as never,
    connection: fetchServerSentEvents(`${host}/api/chat`, () => ({
      headers: { authorization: `Bearer ${token}`, "x-sprite": sprite },
      body: { sessionId },
    })),
    onCustomEvent: (name, value) => {
      const id = (value as { sessionId?: unknown } | null)?.sessionId;
      if (name === "claude-code.session-id" && typeof id === "string") setSessionId(id);
    },
  });

  // Vite reloads the whole page after some edits, so keep the conversation.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ open, sessionId, messages }));
    } catch {
      // Storage may be full or blocked; the chat still works.
    }
  }, [storageKey, open, sessionId, messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isLoading, open]);

  function submit() {
    const prompt = draft.trim();
    if (!prompt || isLoading || resetting) return;
    setDraft("");
    void sendMessage(prompt);
  }

  async function reset() {
    if (
      !window.confirm("Reset the site to its original state? Your changes and this chat are lost.")
    )
      return;
    setResetting(true);
    try {
      await fetch(`${host}/api/reset`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "x-sprite": sprite },
      });
      localStorage.removeItem(storageKey);
      // The site restarts. Reload once it answers again.
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, 4000));
        const alive = await fetch("/", { cache: "no-store" }).then(
          (r) => r.ok,
          () => false,
        );
        if (alive) break;
      }
      location.reload();
    } catch {
      setResetting(false);
    }
  }

  if (!open) {
    return (
      <div className="root">
        <button className="launcher" aria-label="Open the site agent" onClick={() => setOpen(true)}>
          {BUBBLE}
        </button>
      </div>
    );
  }

  return (
    <div className="root">
      <div className="panel" role="dialog" aria-label="Site agent">
        <div className="header">
          <span className={`dot${isLoading ? " busy" : ""}`} />
          <span className="title">Site agent</span>
          <button
            className="iconbtn"
            onClick={() => void reset()}
            disabled={resetting || isLoading}
            title="Reset the site"
          >
            Reset
          </button>
          <button className="iconbtn" onClick={() => setOpen(false)} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="messages">
          {messages.length === 0 && (
            <div className="empty">Describe a change to this site. Try “Make the site purple.”</div>
          )}
          {(messages as unknown as ChatMessage[]).map((message) => (
            <MessageView key={message.id} message={message} />
          ))}
          <div ref={endRef} />
        </div>
        {resetting && (
          <div className="notice">
            Resetting the site. This takes about a minute, then the page reloads.
          </div>
        )}
        {error && <div className="error-banner">{error.message}</div>}
        <div className="composer">
          <textarea
            rows={1}
            value={draft}
            placeholder="What should change?"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
          {isLoading ? (
            <button className="send stop" onClick={() => stop()}>
              Stop
            </button>
          ) : (
            <button className="send" onClick={submit} disabled={!draft.trim() || resetting}>
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageView({ message }: { message: ChatMessage }) {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.content ?? "")
    .join("");
  const tools = message.parts.filter((part) => part.type === "tool-call");
  return (
    <>
      {tools.length > 0 && (
        <div className="tools">
          {tools.map((tool, index) => (
            <span key={index} className={`chip${tool.state === "error" ? " error" : ""}`}>
              {tool.name}
            </span>
          ))}
        </div>
      )}
      {text && (
        <div className={`msg ${message.role === "user" ? "user" : "assistant"}`}>{text}</div>
      )}
    </>
  );
}
