import { defineConfig } from "vite-plus";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [tanstackStart(), viteReact(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // CopilotKit's React package imports its own CSS, which Node cannot load during SSR.
  ssr: { noExternal: [/^@copilotkit\/react-/] },
  server: { host: "127.0.0.1", port: 3300, strictPort: true },
});
