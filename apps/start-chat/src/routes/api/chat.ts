import { createFileRoute } from "@tanstack/react-router";
import { handleChat } from "../../server/agent";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: ({ request }) => handleChat(request),
    },
  },
});
