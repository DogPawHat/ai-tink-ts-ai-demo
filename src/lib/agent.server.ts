import "@tanstack/react-start/server-only";
import { createSecrets, defineSandbox, defineWorkspace, gitSource } from "@tanstack/ai-sandbox";
import { vercelSandbox } from "@tanstack/ai-sandbox-vercel";

const providerKeyNames = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "OPENROUTER_API_KEY",
] as const;

const defaultRepositoryUrl = "https://github.com/DogPawHat/ai-tink-ts-ai-demo.git";

function createAgentConfiguration() {
  const repositoryUrl = process.env.DEMO_REPOSITORY_URL || defaultRepositoryUrl;
  const model = process.env.OPENCODE_MODEL;
  const hasVercelAuth = Boolean(process.env.VERCEL_TOKEN || process.env.VERCEL_OIDC_TOKEN);
  const hasVercelScope = Boolean(process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID);
  const providerKeys = Object.fromEntries(
    providerKeyNames.flatMap((name) => (process.env[name] ? [[name, process.env[name]]] : [])),
  ) as Record<string, string>;

  const missing = [
    !model && "OPENCODE_MODEL",
    !hasVercelAuth && "VERCEL_TOKEN or VERCEL_OIDC_TOKEN",
    !hasVercelScope && "VERCEL_TEAM_ID and VERCEL_PROJECT_ID",
    Object.keys(providerKeys).length === 0 && "a supported model provider API key",
  ].filter((item): item is string => Boolean(item));

  if (missing.length > 0 || !model) return { missing } as const;

  const sandbox = defineSandbox({
    id: "self-editing-demo",
    provider: vercelSandbox({ runtime: "node24", ports: [5173], persistent: true }),
    workspace: defineWorkspace({
      source: gitSource({ url: repositoryUrl }),
      setup: ["sudo npm install -g opencode-ai pnpm@12.6.0", "pnpm install --frozen-lockfile"],
      secrets: createSecrets(providerKeys),
    }),
    lifecycle: { reuse: "thread", keepAlive: "1h" },
  });

  return { missing: [], model, sandbox } as const;
}

let cachedConfiguration: ReturnType<typeof createAgentConfiguration> | undefined;

export function getAgentConfiguration() {
  cachedConfiguration ??= createAgentConfiguration();
  return cachedConfiguration;
}
