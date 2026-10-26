import { defineConfig, type Plugin } from "vite-plus";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const DEPENDENCY = /\/node_modules\/(?!.*@tanstack[+/_])/;

/**
 * Start's compiler parses with Babel, and caches, every module whose code
 * matches `.handler(` or `createMiddleware`. CopilotKit's pre-bundled
 * dependencies match, so in dev it held about 400 MB of syntax trees for
 * code that never uses Start, and kept them across server restarts until the
 * process ran out of memory. Only app code and TanStack's own packages need
 * compiling, so the compiler skips everything else.
 */
function skipDependenciesInStartCompiler(options: unknown[]) {
  const plugins = options.flat(Infinity).filter(Boolean) as Plugin[];
  for (const plugin of plugins) {
    if (!plugin.name.startsWith("tanstack-start-core::server-fn:")) continue;
    const transform = plugin.transform;
    if (!transform || typeof transform !== "object") continue;
    const handler = transform.handler;
    transform.handler = function (code, id, options) {
      if (DEPENDENCY.test(id)) return;
      return handler.call(this, code, id, options);
    };
  }
  return plugins;
}

export default defineConfig({
  plugins: [skipDependenciesInStartCompiler(tanstackStart()), viteReact(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // CopilotKit's React package imports its own CSS, which Node cannot load during SSR.
  ssr: { noExternal: [/^@copilotkit\/react-/] },
  server: { host: "127.0.0.1", port: 3300, strictPort: true },
});
