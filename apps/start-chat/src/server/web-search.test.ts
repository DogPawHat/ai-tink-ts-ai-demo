import {
  EventType,
  type ChatMiddlewareContext,
  type ModelMessage,
  type StreamChunk,
} from "@tanstack/ai";
import { expect, test } from "vite-plus/test";
import { restoreWebSearches, searchResultContent, webSearchMiddleware } from "./web-search";

const searchResults = [
  {
    type: "web_search_result",
    title: "Releases · TanStack/query",
    url: "https://github.com/TanStack/query/releases",
    page_age: "7 days ago",
    encrypted_content: "opaque",
  },
  { type: "web_search_result", title: "TanStack Query", url: "https://tanstack.com/query" },
];

test("keeps readable links and the raw result to replay", () => {
  expect(searchResultContent(searchResults)).toEqual({
    results: [
      {
        title: "Releases · TanStack/query",
        url: "https://github.com/TanStack/query/releases",
        pageAge: "7 days ago",
      },
      { title: "TanStack Query", url: "https://tanstack.com/query" },
    ],
    replay: searchResults,
  });
});

test("reports a failed search", () => {
  const error = { type: "web_search_tool_result_error", error_code: "max_uses_exceeded" };
  expect(searchResultContent(error)).toEqual({
    error: "Web search failed (max_uses_exceeded).",
    replay: error,
  });
});

/** Runs chunks through the middleware's onChunk, flattening expansions. */
async function pipe(chunks: StreamChunk[]) {
  const { onChunk } = webSearchMiddleware();
  const out: StreamChunk[] = [];
  for (const chunk of chunks) {
    const result = await onChunk!({} as ChatMiddlewareContext<unknown>, chunk);
    if (result === undefined) out.push(chunk);
    else if (Array.isArray(result)) out.push(...result);
    else if (result !== null) out.push(result);
  }
  return out;
}

test("completes a provider-executed search with its arguments and a result", async () => {
  const start: StreamChunk = {
    type: EventType.TOOL_CALL_START,
    toolCallId: "srvtoolu_1",
    toolCallName: "web_search",
    metadata: {
      providerExecuted: true,
      anthropic: { serverToolType: "web_search", result: searchResults },
    },
  };
  const end: StreamChunk = {
    type: EventType.TOOL_CALL_END,
    toolCallId: "srvtoolu_1",
    input: { query: "TanStack Query latest release" },
  };
  const out = await pipe([start, end]);
  expect(out.map((chunk) => chunk.type)).toEqual([
    "TOOL_CALL_START",
    "TOOL_CALL_ARGS",
    "TOOL_CALL_END",
    "TOOL_CALL_RESULT",
  ]);
  expect(out[1]).toMatchObject({ delta: '{"query":"TanStack Query latest release"}' });
  expect(JSON.parse((out[3] as { content: string }).content).replay).toEqual(searchResults);
});

test("leaves other tool calls alone", async () => {
  const chunks: StreamChunk[] = [
    { type: EventType.TOOL_CALL_START, toolCallId: "t1", toolCallName: "npmDownloads" },
    { type: EventType.TOOL_CALL_END, toolCallId: "t1" },
  ];
  expect(await pipe(chunks)).toEqual(chunks);
});

test("restores searches from history as Anthropic search blocks, before other tool calls", () => {
  const messages: ModelMessage[] = [
    { role: "user", content: "What's new in TanStack Query?" },
    {
      role: "assistant",
      content: "Here's what changed.",
      toolCalls: [
        { id: "t1", type: "function", function: { name: "githubRepo", arguments: "{}" } },
        {
          id: "s1",
          type: "function",
          function: { name: "web_search", arguments: '{"query":"q"}' },
        },
      ],
    },
    { role: "tool", toolCallId: "t1", content: '{"stars":1}' },
    {
      role: "tool",
      toolCallId: "s1",
      content: JSON.stringify(searchResultContent(searchResults)),
    },
  ];
  const restored = restoreWebSearches(messages);
  expect(restored).toHaveLength(3);
  expect(restored[1]!.toolCalls).toEqual([
    {
      id: "s1",
      type: "function",
      function: { name: "web_search", arguments: '{"query":"q"}' },
      metadata: {
        providerExecuted: true,
        anthropic: {
          serverToolType: "web_search",
          resultBlockType: "web_search_tool_result",
          result: searchResults,
        },
      },
    },
    { id: "t1", type: "function", function: { name: "githubRepo", arguments: "{}" } },
  ]);
  expect(restored[2]).toEqual(messages[2]);
});

test("leaves a history without searches alone", () => {
  const messages: ModelMessage[] = [{ role: "user", content: "hi" }];
  expect(restoreWebSearches(messages)).toBe(messages);
});
