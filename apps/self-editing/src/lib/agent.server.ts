import "@tanstack/react-start/server-only";
import { createHarnessHost, defineHarness } from "@tanstack/ai-harness";
import { projectInstructions, workspaceTools } from "@tanstack/ai-harness/plugins";
import { memoryPersistence } from "@tanstack/ai-persistence";
import { OpenAIBaseChatCompletionsTextAdapter } from "@tanstack/openai-base";
import OpenAI from "openai";

class ZenTextAdapter extends OpenAIBaseChatCompletionsTextAdapter<string> {
  override readonly inputModalities = ["text"] as const;
}

const host = createHarnessHost({ persistence: memoryPersistence() });
let harness: ReturnType<typeof defineHarness> | undefined;

export function getAgentConfiguration() {
  const apiKey = process.env.OPENCODE_API_KEY;
  const model = (process.env.OPENCODE_MODEL || "opencode/deepseek-v4.1-flash").replace(
    /^opencode\//,
    "",
  );
  const missing = [
    !process.env.DROP_ENV && "a Drop environment (start with drop run)",
    !apiKey && "OPENCODE_API_KEY",
  ].filter((item): item is string => Boolean(item));
  if (missing.length > 0 || !apiKey) return { missing } as const;

  // Tools edit the live working tree; the whole app must run inside Drop.
  harness ??= defineHarness({
    name: "self-editing-demo",
    adapter: new ZenTextAdapter(
      model,
      "opencode-zen",
      new OpenAI({ apiKey, baseURL: "https://opencode.ai/zen/v1" }),
    ),
    systemPrompts: [
      "You are editing the Vite app that hosts this conversation. Read before editing, then make the requested change directly in this project's files. The page at / is the live site. Keep the chat working and give a concise summary of edits. Vite will hot reload the browser. Use vp for package management and validation.",
    ],
    // Drop supplies process isolation. These tools run autonomously inside it.
    plugins: () => [
      workspaceTools({ root: process.cwd() }),
      projectInstructions({ root: process.cwd() }),
    ],
  });
  return { missing: [], host, harness } as const;
}
