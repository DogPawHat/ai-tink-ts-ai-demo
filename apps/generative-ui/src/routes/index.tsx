import { createFileRoute } from "@tanstack/react-router";
import { CopilotChat, CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { GenComponents } from "@/genui/gen-components";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" enableInspector={false}>
      <GenComponents />
      <div className="flex h-dvh flex-col">
        <header className="border-b px-4 py-2 text-sm font-medium">Generative UI</header>
        <CopilotChat className="min-h-0 flex-1" />
      </div>
    </CopilotKit>
  );
}
