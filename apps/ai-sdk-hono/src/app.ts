import { Hono } from "hono";
import {
  chat,
  chatParamsFromRequestBody,
  maxIterations,
  mergeAgentTools,
  toServerSentEventsResponse,
  type ModelMessage,
} from "@tanstack/ai";
import { anthropicText, type AnthropicChatModel } from "@tanstack/ai-anthropic";
import { dataTools } from "./data-tools.ts";
import { restoreWebSearches, webSearch, webSearchMiddleware } from "./web-search.ts";

export const AGENT_PATH = "/api/agent";

const SYSTEM_PROMPT = `You are a concise assistant for questions about JavaScript libraries.
Use npmDownloads and githubRepo for real numbers instead of guessing, and say where numbers came from.
Use web_search for recent events or facts you aren't sure of, and name the sources you used.
Answer in Markdown. Use tables to compare libraries.`;

type ChatAdapter = Parameters<typeof chat>[0]["adapter"];

/** The model adapter; tests pass a scripted one so they need no API key. */
export type AdapterFactory = () => ChatAdapter;

const anthropicAdapter: AdapterFactory = () =>
  anthropicText((process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5") as AnthropicChatModel);

/**
 * A plain TanStack AI agent served over AG-UI. Nothing here knows about the
 * AI SDK: the Next.js client translates on its side, so any AG-UI client
 * (TanStack AI's, CopilotKit's) can use this endpoint too.
 */
export function createApp(adapter: AdapterFactory = anthropicAdapter) {
  const app = new Hono();

  app.get("/health", (c) => c.text("ok"));

  app.post(AGENT_PATH, async (c) => {
    let params;
    try {
      params = await chatParamsFromRequestBody(await c.req.json());
    } catch (error) {
      return c.text(error instanceof Error ? error.message : "Bad request", 400);
    }

    const abortController = new AbortController();
    c.req.raw.signal.addEventListener("abort", () => abortController.abort());

    const stream = chat({
      adapter: adapter(),
      messages: restoreWebSearches(params.messages as ModelMessage[]),
      threadId: params.threadId,
      runId: params.runId,
      systemPrompts: [SYSTEM_PROMPT],
      // Tools the browser declares become stubs; the browser runs them and
      // sends the results back with the next request.
      tools: mergeAgentTools([...dataTools, webSearch], params.tools),
      abortController,
      agentLoopStrategy: maxIterations(6),
      // Low effort keeps Sonnet quick; the summary streams so the UI can show it.
      reasoning: { level: "low", summary: true },
      middleware: [webSearchMiddleware()],
    });

    return toServerSentEventsResponse(stream, {
      abortController,
      // Proxies that compress (Next.js rewrites gzip by default) would buffer
      // the whole stream; no-transform tells them to pass it through.
      headers: { "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
    });
  });

  return app;
}
