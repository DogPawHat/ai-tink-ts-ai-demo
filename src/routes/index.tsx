import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [draft, setDraft] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [previewUrl, setPreviewUrl] = useState("/canvas");
  const [previewStatus, setPreviewStatus] = useState("Local starter");
  const [previewBusy, setPreviewBusy] = useState(false);
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

  async function launchPreview() {
    setPreviewBusy(true);
    setPreviewStatus("Starting sandbox…");
    try {
      const response = await fetch("/api/preview", { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      const result: { url: string } = await response.json();
      setPreviewUrl(result.url);
      setPreviewStatus("Vercel Sandbox");
    } catch (cause) {
      setPreviewStatus(cause instanceof Error ? cause.message : "Preview failed");
    } finally {
      setPreviewBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="masthead">
        <div>
          <span className="eyebrow">TanStack Start × TanStack AI</span>
          <h1>Ask the app to change itself.</h1>
          <p>Prompts stream through TanStack AI to a coding agent in a Vercel Sandbox.</p>
        </div>
        <Link to="/canvas" className="preview-link">
          Open editable canvas ↗
        </Link>
      </header>

      <section className="workspace" aria-label="Agent workspace">
        <div className="panel conversation">
          <div className="panel-heading">
            <h2>Conversation</h2>
            <span>{isLoading ? "Agent working…" : "Ready"}</span>
          </div>
          <div className="messages" aria-live="polite">
            {messages.length === 0 ? (
              <div className="empty-state">
                <p>Try “Turn the canvas into a colorful task board.”</p>
                <small>Sandbox configuration is documented in README.md.</small>
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
            <label htmlFor="prompt">What should the agent change?</label>
            <textarea
              id="prompt"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Describe a change to the canvas…"
              rows={3}
              disabled={isLoading}
            />
            <div className="composer-actions">
              <span>Edits run in a remote sandbox.</span>
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
        <div className="panel preview-panel">
          <div className="panel-heading">
            <h2>Preview</h2>
            <div className="preview-controls">
              <span>{previewStatus}</span>
              <button type="button" onClick={() => void launchPreview()} disabled={previewBusy}>
                {previewBusy ? "Starting…" : "Launch sandbox"}
              </button>
            </div>
          </div>
          <iframe title="Editable canvas preview" src={previewUrl} />
        </div>
      </section>
    </main>
  );
}
