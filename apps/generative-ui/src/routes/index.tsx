import { useMemo, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CopilotChat,
  CopilotKit,
  SandboxFunctionsContext,
  useAgent,
  useConfigureSuggestions,
  useCopilotKit,
} from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { type } from "arktype";
import { DataToolStatus } from "@/genui/data-tool-status";
import { designSkill } from "@/genui/design-skill";
import { GenComponents } from "@/genui/gen-components";

export const Route = createFileRoute("/")({ component: Home });

const suggestions = [
  {
    title: "Compare npm downloads",
    message: "Compare weekly npm downloads of @tanstack/react-query and swr over the last year",
  },
  {
    title: "Pick a state library",
    message: "Help me pick a state library, ask me questions first",
  },
  {
    title: "Mortgage calculator",
    message: "Build me an interactive mortgage calculator",
  },
];

const sendFollowUp = {
  name: "sendFollowUp",
  description:
    "Sends a message to the assistant as if the user typed it, starting the next turn. Use it for buttons such as 'Explain this result'.",
  parameters: type({ message: "string" }),
};

// CopilotKit needs these to keep the same identity across renders. The provider tells
// the model about sendFollowUp from here; SandboxFunctions supplies the handler that
// sandboxed widgets actually call, since it needs the agent from inside the provider.
const openGenerativeUI = {
  designSkill,
  sandboxFunctions: [
    {
      ...sendFollowUp,
      handler: async () => {
        throw new Error("sendFollowUp is only available inside SandboxFunctions");
      },
    },
  ],
};

function Home() {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      enableInspector={false}
      openGenerativeUI={openGenerativeUI}
    >
      <GenComponents />
      <DataToolStatus />
      <ChatSetup />
      <SandboxFunctions>
        <div className="flex h-dvh flex-col">
          <header className="border-b px-4 py-2 text-sm font-medium">Generative UI</header>
          <CopilotChat className="min-h-0 flex-1" />
        </div>
      </SandboxFunctions>
    </CopilotKit>
  );
}

function ChatSetup() {
  useConfigureSuggestions({ suggestions, available: "before-first-message" });
  return null;
}

/** Gives sandboxed widgets a sendFollowUp that sends through this chat's agent. */
function SandboxFunctions({ children }: { children: ReactNode }) {
  const { agent } = useAgent();
  const { copilotkit } = useCopilotKit();
  // The sandbox is rebuilt when these change, so keep them stable.
  const functions = useMemo(
    () => [
      {
        ...sendFollowUp,
        handler: async ({ message }: { message: string }) => {
          agent.addMessage({ id: crypto.randomUUID(), role: "user", content: message });
          await copilotkit.runAgent({ agent });
          return { sent: true };
        },
      },
    ],
    [agent, copilotkit],
  );
  return <SandboxFunctionsContext value={functions}>{children}</SandboxFunctionsContext>;
}
