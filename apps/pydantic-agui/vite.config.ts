import { defineConfig } from "vite-plus";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const AGENT_SERVER = "http://127.0.0.1:8010";

export default defineConfig({
  plugins: [tanstackStart({ spa: { enabled: true } }), viteReact(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 3200,
    allowedHosts: ["dogpawbot.taildd39d.ts.net"],
    // The Pydantic AI server serves AG-UI at /api/agent, as it does when deployed.
    proxy: { "/api/agent": AGENT_SERVER },
  },
});
