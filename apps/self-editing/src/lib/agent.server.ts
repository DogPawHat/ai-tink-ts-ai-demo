import "@tanstack/react-start/server-only";
import { defineSandbox, defineWorkspace, localSource } from "@tanstack/ai-sandbox";
import { localProcessSandbox } from "@tanstack/ai-sandbox-local-process";

const DEFAULT_MODEL = "anthropic/claude-haiku-5.5";
// OpenRouter's Anthropic-compatible endpoint. Claude Code appends /v1/messages.
const DEFAULT_BASE_URL = "https://openrouter.ai/api";

export function getAgentConfiguration() {
  const model = process.env.AGENT_MODEL || DEFAULT_MODEL;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const missing = [
    !process.env.DROP_ENV && "a Drop environment (start with drop run)",
    !apiKey && "OPENROUTER_API_KEY",
  ].filter((item): item is string => Boolean(item));
  if (missing.length > 0 || !apiKey) return { missing } as const;

  // The fixed working tree is safe only when the whole app runs inside Drop.
  const sandbox = defineSandbox({
    id: "self-editing-demo",
    provider: localProcessSandbox({ dir: process.cwd() }),
    workspace: defineWorkspace({ source: localSource(process.cwd()), root: "." }),
    lifecycle: { reuse: "thread" },
  });

  // Point Claude Code at OpenRouter. Every model alias maps to the one model so
  // its background calls do not ask for a Claude id that OpenRouter lacks.
  const env = {
    ANTHROPIC_BASE_URL: process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL,
    ANTHROPIC_AUTH_TOKEN: apiKey,
    ANTHROPIC_API_KEY: "",
    ANTHROPIC_MODEL: model,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: model,
    ANTHROPIC_DEFAULT_SONNET_MODEL: model,
    ANTHROPIC_DEFAULT_OPUS_MODEL: model,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  };
  return { missing: [], model, sandbox, env } as const;
}
