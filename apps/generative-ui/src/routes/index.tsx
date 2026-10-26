import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CopilotChat,
  CopilotKit,
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

type SendMessage = (message: string) => Promise<void>;

// Sandboxed widgets call sendFollowUp; ChatSetup, inside the provider, fills this in.
const followUp: { send?: SendMessage } = {};

// CopilotKit needs these to keep the same identity across renders.
const openGenerativeUI = {
  designSkill,
  sandboxFunctions: [
    {
      name: "sendFollowUp",
      description:
        "Sends a message to the assistant as if the user typed it, starting the next turn. Use it for buttons such as 'Explain this result'.",
      parameters: type({ message: "string" }),
      handler: async ({ message }: { message: string }) => {
        await followUp.send?.(message);
        return { sent: true };
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
      <div className="flex h-dvh flex-col">
        <header className="border-b px-4 py-2 text-sm font-medium">Generative UI</header>
        <CopilotChat className="min-h-0 flex-1" />
      </div>
    </CopilotKit>
  );
}

function ChatSetup() {
  const { agent } = useAgent();
  const { copilotkit } = useCopilotKit();
  useConfigureSuggestions({ suggestions, available: "before-first-message" });
  useEffect(() => {
    followUp.send = async (message) => {
      agent.addMessage({ id: crypto.randomUUID(), role: "user", content: message });
      await copilotkit.runAgent({ agent });
    };
  }, [agent, copilotkit]);
  return null;
}
