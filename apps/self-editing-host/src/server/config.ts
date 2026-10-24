import { fileURLToPath } from "node:url";

export interface HostConfig {
  port: number;
  /** Token for the Sprites API. Lets the host create Sprites and run commands in them. */
  spritesToken: string;
  /** Shared key that gates the landing page. */
  accessKey: string;
  /** Secret that signs the per-Sprite widget tokens. */
  tokenSecret: string;
  /** Sprites gateway URL for the Anthropic connector, without a trailing slash. */
  gatewayUrl: string;
  model: string;
  /** Public origin of this host. The widget script is loaded from it. */
  publicUrl: string;
  /** Directory with widget.js, site.tgz and proxy.mjs. */
  assetDir: string;
}

const REQUIRED = [
  "SPRITES_API_KEY",
  "ACCESS_KEY",
  "TOKEN_SECRET",
  "GATEWAY_URL",
  "PUBLIC_URL",
] as const;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): HostConfig {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length > 0) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  return {
    port: Number(env.PORT ?? 8080),
    spritesToken: env.SPRITES_API_KEY!,
    accessKey: env.ACCESS_KEY!,
    tokenSecret: env.TOKEN_SECRET!,
    gatewayUrl: env.GATEWAY_URL!.replace(/\/+$/, ""),
    model: env.AGENT_MODEL || "claude-haiku-5-5",
    publicUrl: env.PUBLIC_URL!.replace(/\/+$/, ""),
    assetDir: env.ASSET_DIR || fileURLToPath(new URL("./", import.meta.url)),
  };
}
