import "@tanstack/react-start/server-only";
import { defineSandbox, defineWorkspace, localSource } from "@tanstack/ai-sandbox";
import { localProcessSandbox } from "@tanstack/ai-sandbox-local-process";

export function getAgentConfiguration() {
  const model = process.env.OPENCODE_MODEL || "opencode/deepseek-v4.1-flash";
  const missing = [!process.env.DROP_ENV && "a Drop environment (start with drop run)"].filter(
    (item): item is string => Boolean(item),
  );
  if (missing.length > 0) return { missing } as const;

  // The fixed working tree is safe only when the whole app runs inside Drop.
  const sandbox = defineSandbox({
    id: "self-editing-demo",
    provider: localProcessSandbox({ dir: process.cwd() }),
    workspace: defineWorkspace({ source: localSource(process.cwd()), root: "." }),
    lifecycle: { reuse: "thread" },
  });
  return { missing: [], model, sandbox } as const;
}
