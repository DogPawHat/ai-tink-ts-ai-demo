import { createFileRoute } from "@tanstack/react-router";
import { createHandler } from "@/server/runtime";

let handler: ReturnType<typeof createHandler> | undefined;

export const Route = createFileRoute("/api/copilotkit/$")({
  server: {
    handlers: {
      ANY: ({ request }) => (handler ??= createHandler())(request),
    },
  },
});
