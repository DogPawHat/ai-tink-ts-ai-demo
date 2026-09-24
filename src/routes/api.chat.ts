import { createFileRoute } from "@tanstack/react-router";
import { chat, chatParamsFromRequest, toServerSentEventsResponse } from "@tanstack/ai";
import { opencodeText } from "@tanstack/ai-opencode";
import { withSandbox } from "@tanstack/ai-sandbox";
import { getAgentConfiguration } from "../lib/agent.server";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const config = getAgentConfiguration();
        if (config.missing.length > 0 || !config.sandbox || !config.model) {
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
          adapter: opencodeText(config.model, {
            permissionMode: "acceptEdits",
            directory: "/workspace",
          }),
          messages: params.messages,
          systemPrompts: [
            "You are editing the Vite app that hosts this conversation. Make the requested change directly in this project's files. The page at / is the live site. Keep the chat working and give a concise summary of edits. Vite will hot reload the browser.",
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
