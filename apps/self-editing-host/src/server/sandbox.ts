import { SpriteCommand } from "@fly/sprites";
import { defineSandbox, defineWorkspace } from "@tanstack/ai-sandbox";
import type { SandboxHandle, SpawnHandle } from "@tanstack/ai-sandbox";
import { spritesSandbox } from "@tanstack/ai-sandbox-sprites";
import type { HostConfig } from "./config.ts";
import { runOnSprite } from "./exec.ts";
import { SITE_DIR } from "./sprites.ts";
import type { SpriteManager } from "./sprites.ts";

/** `/workspace` is the sandbox's virtual root; on a visitor Sprite it is the site. */
function mapCwd(cwd: string | undefined): string {
  if (!cwd) return SITE_DIR;
  return cwd === "/workspace" || cwd.startsWith("/workspace/")
    ? SITE_DIR + cwd.slice("/workspace".length)
    : cwd;
}

function fastProcess(manager: SpriteManager, spriteName: string): SandboxHandle["process"] {
  return {
    exec: (command, options) => {
      const { timeoutMs } = (options ?? {}) as { timeoutMs?: number };
      return runOnSprite(manager.client, spriteName, command, {
        cwd: mapCwd(options?.cwd),
        ...(options?.env ? { env: options.env } : {}),
        ...(options?.signal ? { signal: options.signal } : {}),
        ...(timeoutMs ? { timeoutMs } : {}),
      });
    },
    spawn: async (command, options) => {
      const process = new SpriteCommand(
        manager.client.sprite(spriteName),
        "bash",
        ["-c", command],
        {
          cwd: mapCwd(options?.cwd),
          ...(options?.env ? { env: options.env } : {}),
        },
      );
      process.stdout.setEncoding("utf8");
      process.stderr.setEncoding("utf8");
      process.on("error", (error) =>
        console.error(`exec error on ${spriteName}: ${error.message}`),
      );
      if (options?.signal) {
        options.signal.addEventListener("abort", () => process.kill("SIGTERM"), { once: true });
      }
      await process.start();
      const handle: SpawnHandle = {
        pid: -1,
        stdout: process.stdout,
        stderr: process.stderr,
        stdin: {
          write: (data) =>
            new Promise<void>((resolve, reject) =>
              process.stdin.write(data, (error) => (error ? reject(error) : resolve())),
            ),
          end: () => new Promise<void>((resolve) => process.stdin.end(resolve)),
        },
        wait: () => process.wait(),
        kill: async () => process.kill("SIGTERM"),
      };
      return handle;
    },
  };
}

const quote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;

/**
 * The provider builds `mkdir`, `remove`, `rename` and `exists` on its slow exec;
 * `read`, `write` and `list` use REST and are fast, so they stay as they are.
 */
function fastFs(
  manager: SpriteManager,
  spriteName: string,
  original: SandboxHandle["fs"],
): SandboxHandle["fs"] {
  const run = async (script: string, failure?: string) => {
    const result = await runOnSprite(manager.client, spriteName, script);
    if (failure && result.exitCode !== 0) {
      throw new Error(`${failure}: ${(result.stderr || result.stdout).trim()}`);
    }
    return result;
  };
  return {
    ...original,
    mkdir: async (path) => void (await run(`mkdir -p ${quote(mapCwd(path))}`, "mkdir failed")),
    remove: async (path) => void (await run(`rm -rf ${quote(mapCwd(path))}`, "remove failed")),
    rename: async (from, to) =>
      void (await run(`mv ${quote(mapCwd(from))} ${quote(mapCwd(to))}`, "rename failed")),
    exists: async (path) => (await run(`test -e ${quote(mapCwd(path))}`)).exitCode === 0,
  };
}

/** With HOST_DEBUG set, logs how long each call on a sandbox object takes. */
function timed<T extends object>(label: string, target: T): T {
  if (!process.env.HOST_DEBUG) return target;
  return new Proxy(target, {
    get(object, key, receiver) {
      const value = Reflect.get(object, key, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const start = Date.now();
        const done = () =>
          console.log(
            `[timing] ${label}.${String(key)} ${Date.now() - start}ms ${typeof args[0] === "string" ? args[0].slice(0, 60) : ""}`,
          );
        const result = value.apply(object, args);
        if (result && typeof (result as Promise<unknown>).then === "function") {
          return (result as Promise<unknown>).finally(done);
        }
        done();
        return result;
      };
    },
  });
}

/**
 * A sandbox on a visitor's existing Sprite. The framework names new Sprites
 * with a bare hash, which the Anthropic connector would refuse, so this never
 * creates one: it attaches to the Sprite the host already provisioned. It also
 * replaces the provider's exec and spawn, which wait ~11 s per call for the
 * exec socket to close.
 */
export function siteSandbox(config: HostConfig, manager: SpriteManager, spriteName: string) {
  const inner = spritesSandbox({
    apiKey: config.spritesToken,
    urlAuth: "sprite",
    workdir: SITE_DIR,
  });
  const attach = async () => {
    const handle = await inner.resume({ id: spriteName });
    if (!handle) throw new Error(`Sprite ${spriteName} does not exist`);
    const fast = Object.create(handle) as SandboxHandle;
    Object.defineProperty(fast, "process", {
      value: timed("process", fastProcess(manager, spriteName)),
    });
    Object.defineProperty(fast, "fs", {
      value: timed("fs", fastFs(manager, spriteName, handle.fs)),
    });
    return fast;
  };
  const provider = Object.create(inner) as typeof inner;
  provider.create = attach;
  provider.resume = attach;
  return defineSandbox({
    id: "site",
    provider,
    workspace: defineWorkspace({ source: { type: "none" } }),
    lifecycle: { reuse: "thread" },
    // Nothing here uses file events, and the watcher polls the Sprite every 300 ms.
    fileEvents: false,
  });
}
