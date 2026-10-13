import { createFileRoute } from "@tanstack/react-router";
import { chat, chatParamsFromRequest, toServerSentEventsResponse } from "@tanstack/ai";
import { claudeCodeText } from "@tanstack/ai-claude-code";
import { withSandbox } from "@tanstack/ai-sandbox";
import { getAgentConfiguration } from "../lib/agent.server";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const config = getAgentConfiguration();
        if (config.missing.length > 0 || !config.sandbox) {
          return new Response(`Agent setup needed: ${config.missing.join(", ")}`, {
            status: 503,
          });
        }

        const params = await chatParamsFromRequest(request);
        const sessionId =
          typeof params.forwardedProps.sessionId === "string"
            ? params.forwardedProps.sessionId
            : undefined;
        const response = chat({
          adapter: claudeCodeText(config.model, {
            // Credentials come from `env`, not from an injected ANTHROPIC_API_KEY.
            authMode: "host",
            // Drop is the isolation boundary, so the agent runs without prompts.
            permissionMode: "bypassPermissions",
            env: config.env,
          }),
          messages: params.messages,
          systemPrompts: [
            "You are editing the Vite app that hosts this conversation. Read AGENTS.md first, then read before editing and make the requested change directly in this project's files. The page at / is the live site. Keep the chat working and give a concise summary of edits. Vite will hot reload the browser. Use vp for package management and validation.",
          ],
          threadId: params.threadId ?? "local-demo",
          runId: params.runId,
          modelOptions: { sessionId },
          stream: true,
          middleware: [withSandbox(config.sandbox)],
        });

        return toServerSentEventsResponse(response);
      },
    },
  },
});
