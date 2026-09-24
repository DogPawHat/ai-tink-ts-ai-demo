import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [draft, setDraft] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const { messages, sendMessage, isLoading, error, stop } = useChat({
    threadId: "local-demo",
    connection: fetchServerSentEvents("/api/chat", () => ({ body: { sessionId } })),
    onCustomEvent: (name, value) => {
      if (
        name === "opencode.session-id" &&
        typeof value === "object" &&
        value !== null &&
        "sessionId" in value &&
        typeof value.sessionId === "string"
      ) {
        setSessionId(value.sessionId);
      }
    },
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || isLoading) return;
    void sendMessage(prompt);
    setDraft("");
  }

  return (
    <main className="shell">
      <header className="masthead">
        <span className="eyebrow">TanStack AI × OpenCode × Drop</span>
        <h1>Make this site yours.</h1>
        <p>
          Describe a change. OpenCode edits this app, and Vite shows it as soon as the files change.
        </p>
      </header>

      <section className="workspace" aria-label="Live site and chat">
        <div className="panel showcase">
          <span className="eyebrow">Live site</span>
          <div className="showcase-content">
            <span className="showcase-icon" aria-hidden="true">
              ✦
            </span>
            <h2>Your next idea starts here.</h2>
            <p>Try a new color, layout, or look. This page is the agent's workspace.</p>
          </div>
        </div>

        <div className="panel conversation">
          <div className="panel-heading">
            <h2>Conversation</h2>
            <span>{isLoading ? "Agent working…" : "Ready"}</span>
          </div>
          <div className="messages" aria-live="polite">
            {messages.length === 0 ? (
              <div className="empty-state">
                <p>Try “Make the site purple.”</p>
                <small>The agent edits this running app inside Drop.</small>
              </div>
            ) : (
              messages.map((message) => (
                <article key={message.id} className={`message message-${message.role}`}>
                  <strong>{message.role === "user" ? "You" : "Agent"}</strong>
                  {message.parts.map((part, index) => {
                    if (part.type === "text") return <p key={index}>{part.content}</p>;
                    if (part.type === "tool-call")
                      return (
                        <details key={index} className="tool-event">
                          <summary>{part.name}</summary>
                          <pre>{JSON.stringify(part, null, 2)}</pre>
                        </details>
                      );
                    return null;
                  })}
                </article>
              ))
            )}
          </div>
          {error && (
            <p className="error" role="alert">
              {error.message}
            </p>
          )}
          <form onSubmit={submit} className="composer">
            <label htmlFor="prompt">What should change?</label>
            <textarea
              id="prompt"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Describe a change to this site…"
              rows={3}
              disabled={isLoading}
            />
            <div className="composer-actions">
              <span>Edits appear here through Vite hot reload.</span>
              {isLoading ? (
                <button type="button" onClick={stop}>
                  Stop
                </button>
              ) : (
                <button type="submit" disabled={!draft.trim()}>
                  Send prompt
                </button>
              )}
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
