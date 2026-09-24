import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/canvas")({ component: Canvas });

function Canvas() {
  return (
    <main className="canvas">
      <div className="canvas-card">
        <span className="eyebrow">Editable surface</span>
        <h1>Your next prompt starts here.</h1>
        <p>
          This is the page the coding agent will transform inside a Vercel Sandbox. The control page
          remains available while this preview changes.
        </p>
        <Link to="/" className="text-link">
          Back to the control page
        </Link>
      </div>
    </main>
  );
}
