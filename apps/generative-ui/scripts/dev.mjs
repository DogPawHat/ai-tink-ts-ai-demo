// Runs the dev server and starts a fresh process whenever it asks to restart.
//
// Vite 8 / Rolldown leak every dev server that Vite restarts in place (see
// docs/generative-ui-demo.md), and Varlock only decrypts env values when the
// process starts. So the restartInNewProcess plugin in vite.config.ts makes
// the server exit with RESTART_CODE instead, and this script starts it again.
import { spawn } from "node:child_process";

/** Must match RESTART_CODE in vite.config.ts. */
const RESTART_CODE = 75;

let child;
let stopping = false;

function start() {
  child = spawn("varlock", ["run", "--", "vp", "dev"], {
    stdio: "inherit",
    env: { ...process.env, GENUI_DEV_SUPERVISED: "1" },
  });
  child.on("exit", (code, signal) => {
    if (!stopping && code === RESTART_CODE) {
      console.log("\nRestarting the dev server in a new process…\n");
      start();
      return;
    }
    process.exit(code ?? (signal ? 1 : 0));
  });
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    stopping = true;
    child?.kill(signal);
  });
}

start();
