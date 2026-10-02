import { createFileRoute } from "@tanstack/react-router";
import { chatParamsFromRequest, toServerSentEventsResponse } from "@tanstack/ai";
import { getAgentConfiguration } from "../lib/agent.server";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const config = getAgentConfiguration();
        if (!config.harness) {
          return new Response(`Agent setup needed: ${config.missing.join(", ")}`, { status: 503 });
        }
        const params = await chatParamsFromRequest(request);
        const message = params.messages.findLast((entry) => entry.role === "user");
        if (!message) return new Response("A user message is required", { status: 400 });
        const session = await config.host.open(config.harness, {
          threadId: params.threadId ?? "local-demo",
        });
        const input =
          "content" in message
            ? message.content
            : message.parts
                .filter((part) => part.type === "text")
                .map((part) => part.content)
                .join("\n");
        if (!input) return new Response("A non-empty prompt is required", { status: 400 });
        const operation = session.prompt(input, { busy: "reject" });
        const delivery = new AbortController();
        const cancel = () => {
          void operation.cancel("Client disconnected");
        };
        const disconnect = () => delivery.abort();
        delivery.signal.addEventListener("abort", cancel, { once: true });
        request.signal.addEventListener("abort", disconnect, { once: true });
        if (request.signal.aborted) disconnect();
        async function* stream() {
          try {
            yield* operation.stream({ signal: delivery.signal });
          } finally {
            request.signal.removeEventListener("abort", disconnect);
            delivery.signal.removeEventListener("abort", cancel);
          }
        }
        return toServerSentEventsResponse(stream(), { abortController: delivery });
      },
    },
  },
});
