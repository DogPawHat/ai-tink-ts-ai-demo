import { chat, maxIterations, type AnyClientTool, type ModelMessage } from "@tanstack/ai";
import { anthropicText, type AnthropicChatModel } from "@tanstack/ai-anthropic";
import {
  BuiltInAgent,
  CopilotRuntime,
  InMemoryAgentRunner,
  convertInputToTanStackAI,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { dataTools } from "./data-tools";
import { describeSandboxTool, sandboxToolMiddleware } from "./sandbox-tool";
import { restoreWebSearches, webSearch, webSearchMiddleware } from "./web-search";

export const BASE_PATH = "/api/copilotkit";

const SYSTEM_PROMPT = `You answer with UI as well as text.
Prefer the registered UI components when one fits the answer.
Use generateSandboxedUi only when no registered component can express what the user wants, such as a calculator, an interactive diagram, or a small simulation.
Use web_search for recent events or facts you aren't sure of, and name the sources you used. Fetch data before you draw a component that shows it.
Keep prose short; let the UI carry the answer. Don't restate in text what a component already shows.`;

type ChatAdapter = Parameters<typeof chat>[0]["adapter"];

/** The model adapter; tests pass a stub so they need no API key. */
export type AdapterFactory = () => ChatAdapter;

const anthropicAdapter: AdapterFactory = () =>
  anthropicText((process.env.ANTHROPIC_MODEL || "claude-haiku-5-5") as AnthropicChatModel);

export function createAgent(adapter: AdapterFactory = anthropicAdapter) {
  return new BuiltInAgent({
    type: "tanstack",
    factory: ({ input, abortController }) => {
      // Tools registered in the browser arrive here as client tools; the
      // browser runs them and CopilotKit sends the results back next turn.
      const { messages, systemPrompts, tools } = convertInputToTanStackAI(input);
      return chat({
        adapter: adapter(),
        threadId: input.threadId,
        runId: input.runId,
        messages: restoreWebSearches(messages as ModelMessage[]),
        systemPrompts: [SYSTEM_PROMPT, ...systemPrompts],
        tools: [...dataTools, webSearch, ...(tools.map(describeSandboxTool) as AnyClientTool[])],
        abortController,
        agentLoopStrategy: maxIterations(8),
        middleware: [sandboxToolMiddleware(), webSearchMiddleware()],
      });
    },
  });
}

export function createHandler(adapter?: AdapterFactory) {
  const runtime = new CopilotRuntime({
    agents: { default: createAgent(adapter) },
    runner: new InMemoryAgentRunner(),
    openGenerativeUI: true,
  });
  return createCopilotRuntimeHandler({ runtime, basePath: BASE_PATH });
}
