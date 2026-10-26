import { useRenderTool } from "@copilotkit/react-core/v2";
import { type } from "arktype";
import { Database, LoaderCircle } from "lucide-react";

/** A one-line status for the server's data tools, which have no UI of their own. */
function Status({ done, label }: { done: boolean; label: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {done ? <Database className="size-3" /> : <LoaderCircle className="size-3 animate-spin" />}
      {label}
    </p>
  );
}

const npmArgs = type({ package: "string", period: "string" });
const githubArgs = type({ repo: "string" });

export function DataToolStatus() {
  useRenderTool({
    name: "npmDownloads",
    parameters: npmArgs,
    render: ({ parameters, status }) => (
      <Status
        done={status === "complete"}
        label={`npm downloads for ${parameters.package ?? "…"}, ${parameters.period?.replace("-", " ") ?? ""}`}
      />
    ),
  });
  useRenderTool({
    name: "githubRepo",
    parameters: githubArgs,
    render: ({ parameters, status }) => (
      <Status done={status === "complete"} label={`GitHub repository ${parameters.repo ?? "…"}`} />
    ),
  });
  return null;
}
