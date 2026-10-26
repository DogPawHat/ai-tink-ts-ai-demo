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

/**
 * Vite 8 / Rolldown keep every dev server that Vite restarts in place alive
 * (see docs/generative-ui-demo.md). When scripts/dev.mjs runs the server, a
 * restart (config or .env change, or the `r` shortcut) exits instead, and the
 * script starts a fresh process, which also lets Varlock decrypt new values.
 */
/** Must match RESTART_CODE in scripts/dev.mjs. */
const RESTART_CODE = 75;

function restartInNewProcess(): Plugin {
  return {
    name: "generative-ui:restart-in-new-process",
    apply: "serve",
    configureServer(server) {
      if (process.env.GENUI_DEV_SUPERVISED !== "1") return;
      server.restart = async () => {
        await server.close();
        process.exit(RESTART_CODE);
      };
    },
  };
}

export default defineConfig({
  plugins: [
    skipDependenciesInStartCompiler(tanstackStart()),
    viteReact(),
    tailwindcss(),
    restartInNewProcess(),
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // CopilotKit's React package imports its own CSS, which Node cannot load during SSR.
  ssr: { noExternal: [/^@copilotkit\/react-/] },
  test: {
    env: { COPILOTKIT_TELEMETRY_DISABLED: "true" },
    server: { deps: { inline: [/@copilotkit\/react-/] } },
  },
  server: {
    host: "127.0.0.1",
    port: 3300,
    strictPort: true,
    allowedHosts: ["dogpawbot.taildd39d.ts.net"],
  },
});
