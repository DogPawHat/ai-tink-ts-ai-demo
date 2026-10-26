import { EventType, type ChatMiddleware, type ModelMessage, type StreamChunk } from "@tanstack/ai";
import { webSearchTool } from "@tanstack/ai-anthropic/tools";

/**
 * Anthropic's own web search. It runs inside Anthropic's API, needs no other
 * key, and is billed per search.
 *
 * CopilotKit doesn't know about provider-run tools. The adapter reports a
 * finished search as a tool call start and end marked provider-executed, with
 * no arguments or result; CopilotKit drops the mark and keeps a call with
 * neither. CopilotKit also starts a new run after every component the agent
 * draws, rebuilding the conversation from that history, so the model lost the
 * pages it had read partway through its own answer and disowned what it wrote
 * from them. So the middleware below sends the arguments and the full result
 * to the browser, and restoreWebSearches turns them back into Anthropic's
 * search blocks on the next run. The result includes the pages' text, which
 * Anthropic encrypts so that it can be sent back like this.
 */
export const webSearch = webSearchTool({
  name: "web_search",
  type: "web_search_20250305",
  max_uses: 5,
});

const TOOL_NAME = "web_search";

interface SearchResult {
  type: "web_search_result";
  title: string;
  url: string;
  page_age?: string | null;
}

/** The tool result the browser keeps: readable links, plus the raw result to replay. */
export function searchResultContent(result: unknown) {
  if (!Array.isArray(result)) {
    const code = (result as { error_code?: unknown } | null)?.error_code;
    return {
      error: `Web search failed${typeof code === "string" ? ` (${code})` : ""}.`,
      replay: result,
    };
  }
  return {
    results: (result as SearchResult[])
      .filter((item) => item.type === "web_search_result")
      .map(({ title, url, page_age }) => ({
        title,
        url,
        ...(page_age ? { pageAge: page_age } : {}),
      })),
    replay: result,
  };
}

/** Adds the arguments and the result to each finished search, for CopilotKit. */
export function webSearchMiddleware(): ChatMiddleware {
  const results = new Map<string, unknown>();
  return {
    name: "web-search-results",
    onChunk(_ctx, chunk: StreamChunk) {
      if (chunk.type === "TOOL_CALL_START" && chunk.toolCallName === TOOL_NAME) {
        if (chunk.metadata?.providerExecuted === true)
          results.set(chunk.toolCallId, chunk.metadata.anthropic?.result);
      } else if (chunk.type === "TOOL_CALL_END" && results.has(chunk.toolCallId)) {
        const result = results.get(chunk.toolCallId);
        results.delete(chunk.toolCallId);
        const { toolCallId, timestamp } = chunk;
        const chunks: StreamChunk[] = [
          {
            type: EventType.TOOL_CALL_ARGS,
            toolCallId,
            delta: JSON.stringify(chunk.input ?? {}),
            timestamp,
          },
          chunk,
          {
            type: EventType.TOOL_CALL_RESULT,
            toolCallId,
            messageId: `${toolCallId}-result`,
            content: JSON.stringify(searchResultContent(result)),
            timestamp,
          },
        ];
        return chunks;
      }
    },
  };
}

function replayOf(message: ModelMessage) {
  if (typeof message.content !== "string") return undefined;
  try {
    const parsed: unknown = JSON.parse(message.content);
    if (parsed && typeof parsed === "object" && "replay" in parsed) return parsed.replay;
  } catch {
    // Not one of ours.
  }
  return undefined;
}

/**
 * Turns each search in the history back into the provider-executed tool call
 * the adapter sends as Anthropic's search blocks, and drops its tool message.
 * Searches go before the message's other tool calls: Anthropic wants the
 * results of those right after them, so nothing can follow them.
 */
export function restoreWebSearches(messages: ModelMessage[]): ModelMessage[] {
  const searchIds = new Set(
    messages.flatMap((message) =>
      (message.toolCalls ?? [])
        .filter((call) => call.function.name === TOOL_NAME)
        .map((call) => call.id),
    ),
  );
  const replays = new Map<string, unknown>();
  for (const message of messages) {
    if (message.role !== "tool" || !message.toolCallId || !searchIds.has(message.toolCallId))
      continue;
    const replay = replayOf(message);
    if (replay !== undefined) replays.set(message.toolCallId, replay);
  }
  if (replays.size === 0) return messages;
  return messages
    .filter((message) => !(message.role === "tool" && replays.has(message.toolCallId ?? "")))
    .map((message) =>
      message.toolCalls?.some((call) => replays.has(call.id))
        ? {
            ...message,
            toolCalls: [
              ...message.toolCalls
                .filter((call) => replays.has(call.id))
                .map((call) => ({
                  ...call,
                  metadata: {
                    providerExecuted: true,
                    anthropic: {
                      serverToolType: TOOL_NAME,
                      resultBlockType: "web_search_tool_result",
                      result: replays.get(call.id),
                    },
                  },
                })),
              ...message.toolCalls.filter((call) => !replays.has(call.id)),
            ],
          }
        : message,
    );
}
