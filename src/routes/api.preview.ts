import { createFileRoute } from "@tanstack/react-router";
import { getAgentConfiguration } from "../lib/agent.server";

const previewPort = 5173;

export const Route = createFileRoute("/api/preview")({
  server: {
    handlers: {
      POST: async () => {
        const config = getAgentConfiguration();
        if (config.missing.length > 0 || !config.sandbox) {
          return new Response(`Sandbox setup needed: ${config.missing.join(", ")}`, {
            status: 503,
          });
        }

        const handle = await config.sandbox.ensure({
          threadId: "local-demo",
          runId: "preview",
          adapterName: "opencode",
        });
        const readyCommand = `node -e 'fetch("http://127.0.0.1:${previewPort}/canvas").then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'`;
        const ready = await handle.process.exec(readyCommand);
        if (ready.exitCode !== 0) {
          await handle.process.spawn(
            `pnpm exec vp dev --host 0.0.0.0 --port ${previewPort} --strictPort`,
            { cwd: handle.workspaceRoot },
          );
          let started = false;
          for (let attempt = 0; attempt < 20; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            if ((await handle.process.exec(readyCommand)).exitCode === 0) {
              started = true;
              break;
            }
          }
          if (!started) return new Response("Sandbox preview did not start", { status: 502 });
        }

        const channel = await handle.ports.connect(previewPort);
        return Response.json({ url: new URL("/canvas", channel.url).toString() });
      },
    },
  },
});
