import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SpritesClient } from "@fly/sprites";
import { widgetToken } from "./auth.ts";
import type { HostConfig } from "./config.ts";
import { runOnSprite } from "./exec.ts";
import type { RunOptions } from "./exec.ts";

/** Where the site lives on a Sprite; the agent edits it. */
export const SITE_DIR = "/home/sprite/site";
/** Owned by root, outside the site, so an edit to the site cannot remove the chat. */
const PROXY_DIR = "/opt/ai-tink";
const READY_FILE = "/home/sprite/.ai-tink-ready";
const PNPM_VERSION = "12.6.0";

export type Phase = "creating" | "uploading" | "installing" | "starting";
export type SpriteStatus =
  | { phase: "missing" }
  | { phase: Phase }
  | { phase: "ready"; url: string }
  | { phase: "error"; message: string };

interface Job {
  phase: Phase | "error";
  error?: string;
}

export class SpriteManager {
  readonly client: SpritesClient;
  private readonly jobs = new Map<string, Job>();
  private readonly running = new Map<string, Promise<void>>();
  private readonly config: HostConfig;

  constructor(config: HostConfig) {
    this.config = config;
    this.client = new SpritesClient(config.spritesToken);
  }

  /** Runs a script on a Sprite and fails with its stderr when it exits non-zero. */
  async sh(name: string, script: string, options?: RunOptions): Promise<string> {
    const result = await runOnSprite(this.client, name, script, options);
    if (result.exitCode !== 0) {
      const detail = (result.stderr || result.stdout).trim().split("\n").slice(-6).join("\n");
      throw new Error(`Command failed on ${name} (exit ${result.exitCode}): ${detail}`);
    }
    return result.stdout;
  }

  async status(name: string): Promise<SpriteStatus> {
    const job = this.jobs.get(name);
    if (job?.phase === "error") return { phase: "error", message: job.error ?? "Unknown error" };
    if (job) return { phase: job.phase };
    const sprite = await this.client.getSprite(name).catch(() => undefined);
    if (!sprite?.url) return { phase: "missing" };
    const ready = await runOnSprite(this.client, name, `test -f ${READY_FILE}`)
      .then((result) => result.exitCode === 0)
      .catch(() => false);
    return ready ? { phase: "ready", url: sprite.url } : { phase: "missing" };
  }

  /** Creates and sets up the Sprite, or repairs it. One run per Sprite at a time. */
  ensure(name: string, options: { fresh?: boolean } = {}): void {
    if (this.running.has(name)) return;
    this.jobs.set(name, { phase: "creating" });
    const setPhase = (phase: Phase) => this.jobs.set(name, { phase });
    const run = this.provision(name, options.fresh ?? false, setPhase)
      .then(() => void this.jobs.delete(name))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`provision ${name} failed: ${message}`);
        this.jobs.set(name, { phase: "error", error: message });
      })
      .finally(() => void this.running.delete(name));
    this.running.set(name, run);
  }

  /** Forget a failed attempt so the next visit tries again. */
  clearError(name: string): void {
    if (this.jobs.get(name)?.phase === "error") this.jobs.delete(name);
  }

  private async provision(name: string, fresh: boolean, setPhase: (phase: Phase) => void) {
    const { assetDir, publicUrl } = this.config;
    const existing = await this.client.getSprite(name).catch(() => undefined);
    // The Sprite's URL stays private to your Fly org.
    if (!existing) await this.client.createSprite(name, { urlSettings: { auth: "sprite" } });

    if (fresh) {
      await this.sh(
        name,
        `rm -f ${READY_FILE}; sprite-env services stop proxy; sprite-env services stop site; rm -rf ${SITE_DIR}`,
      ).catch(() => undefined);
    }

    setPhase("uploading");
    const archive = await readFile(join(assetDir, "site.tgz"));
    await this.sh(name, `mkdir -p ${SITE_DIR} && tar xzf - -C ${SITE_DIR}`, { input: archive });
    const proxy = await readFile(join(assetDir, "proxy.mjs"));
    await this.sh(
      name,
      `sudo install -d -m 755 ${PROXY_DIR} && sudo tee ${PROXY_DIR}/proxy.mjs >/dev/null && sudo chmod 644 ${PROXY_DIR}/proxy.mjs`,
      { input: proxy },
    );

    setPhase("installing");
    await this.sh(
      name,
      `command -v pnpm >/dev/null || npm install --prefix "$HOME/.local" -g pnpm@${PNPM_VERSION}`,
      {
        timeoutMs: 180_000,
      },
    );
    await this.sh(name, "pnpm install", { cwd: SITE_DIR, timeoutMs: 300_000 });
    // The agent is told to use `vp`, which only exists in the site's node_modules.
    await this.sh(
      name,
      `mkdir -p "$HOME/.local/bin" && ln -sf ${SITE_DIR}/node_modules/.bin/vp "$HOME/.local/bin/vp"`,
    );

    setPhase("starting");
    const env = [
      `HOST_URL=${publicUrl}`,
      `SPRITE_NAME=${name}`,
      `WIDGET_TOKEN=${widgetToken(this.config.tokenSecret, name)}`,
    ].join(",");
    await this.sh(
      name,
      [
        "sprite-env services delete site >/dev/null 2>&1 || true",
        "sprite-env services delete proxy >/dev/null 2>&1 || true",
        `sprite-env services create site --cmd ${SITE_DIR}/node_modules/.bin/vp --args dev --dir ${SITE_DIR} --no-stream`,
        `sprite-env services create proxy --cmd node --args ${PROXY_DIR}/proxy.mjs --env '${env}' --http-port 8080 --no-stream`,
        // The proxy answers 503 until Vite is up, so this waits for both.
        "for i in $(seq 1 60); do curl -sf -o /dev/null http://127.0.0.1:8080/ && exit 0; sleep 2; done",
        "echo 'The site did not come up in 120 s' >&2; exit 1",
      ].join("\n"),
      { timeoutMs: 180_000 },
    );
    await this.sh(name, `date -u +%FT%TZ > ${READY_FILE}`);
  }
}
