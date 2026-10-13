// Packs apps/self-editing into dist/site.tgz: the template every visitor Sprite starts from.
// The site is a workspace member, so it gets a standalone pnpm config with the root's
// catalog and overrides, and the proxy script is copied next to it.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL("..", import.meta.url));
const site = join(here, "../self-editing");
const root = join(here, "../..");
const dist = join(here, "dist");
mkdirSync(dist, { recursive: true });

const staging = mkdtempSync(join(tmpdir(), "site-pack-"));
try {
  for (const entry of [
    "src",
    "public",
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "components.json",
    "AGENTS.md",
  ]) {
    cpSync(join(site, entry), join(staging, entry), { recursive: true });
  }
  // Drop the workspace member list; keep the catalog, overrides and peer rules.
  const workspace = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8").replace(
    /^packages:\n(?: {2}- .*\n)+\n?/m,
    "",
  );
  writeFileSync(join(staging, "pnpm-workspace.yaml"), workspace);
  execFileSync("tar", ["czf", join(dist, "site.tgz"), "-C", staging, "."]);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
cpSync(join(here, "src/sprite/proxy.mjs"), join(dist, "proxy.mjs"));
console.log("packed dist/site.tgz and dist/proxy.mjs");
