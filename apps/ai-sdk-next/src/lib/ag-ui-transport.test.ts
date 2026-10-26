import { afterEach, expect, test, vi } from "vite-plus/test";
import { EventType, type AGUIEvent } from "@ag-ui/core";
import { readUIMessageStream, type UIMessage } from "ai";
import { fakeText, type FakeResponseStep } from "@tanstack/ai/testing";
import { createApp } from "ai-sdk-hono/app";
import {
  AgUiChatTransport,
  agUiToUIMessageChunks,
  serverSentEvents,
  toAgUiMessages,
} from "./ag-ui-transport";

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Routes the transport's requests to the real Hono app with a scripted
 * model, and the data tools' requests to GitHub to a canned answer.
 */
function connect(responses: FakeResponseStep[]) {
  const fake = fakeText();
  fake.setResponses(responses);
  const app = createApp(() => fake);
  const requests: Request[] = [];
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://api.github.com/")) {
      return Response.json({ full_name: "TanStack/ai", stargazers_count: 5000, forks_count: 300 });
    }
    const request = new Request(new URL(url, "http://localhost"), init);
    requests.push(request.clone());
    return app.fetch(request);
  });
  return { fake, requests, transport: new AgUiChatTransport("/api/agent") };
}

async function send(transport: AgUiChatTransport, messages: UIMessage[]) {
  const stream = await transport.sendMessages({
    trigger: "submit-message",
    chatId: "chat-1",
    messageId: undefined,
    messages,
    abortSignal: undefined,
  });
  let message: UIMessage | undefined;
  for await (const update of readUIMessageStream({ stream, terminateOnError: true })) {
    message = update;
  }
  return message!;
}

const user = (id: string, text: string): UIMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
});

test("a server tool round trip becomes one assistant message", async () => {
  const { transport } = connect([
    {
      thinking: "Look it up.",
      toolCalls: [{ name: "githubRepo", input: { repo: "TanStack/ai" } }],
    },
    { text: "TanStack/ai has **5,000** stars." },
  ]);
  const message = await send(transport, [user("u1", "Stars?")]);

  expect(message.role).toBe("assistant");
  expect(message.parts.map((part) => part.type)).toEqual([
    "step-start",
    "reasoning",
    "dynamic-tool",
    "step-start",
    "text",
  ]);
  const [, reasoning, tool, , text] = message.parts;
  expect(reasoning).toMatchObject({ type: "reasoning", text: "Look it up.", state: "done" });
  expect(tool).toMatchObject({
    type: "dynamic-tool",
    toolName: "githubRepo",
    state: "output-available",
    input: { repo: "TanStack/ai" },
    output: { repo: "TanStack/ai", stars: 5000 },
  });
  expect(text).toMatchObject({
    type: "text",
    text: "TanStack/ai has **5,000** stars.",
    state: "done",
  });
});

test("the next turn sends the tool call and its result back to the model", async () => {
  let seen: unknown[] = [];
  const { transport } = connect([
    { toolCalls: [{ name: "githubRepo", input: { repo: "TanStack/ai" }, id: "call-1" }] },
    { text: "5,000 stars." },
    ({ request }) => {
      seen = request.messages;
      return { text: "300 forks." };
    },
  ]);
  const first = await send(transport, [user("u1", "Stars?")]);
  await send(transport, [user("u1", "Stars?"), first, user("u2", "And forks?")]);

  expect(seen).toMatchObject([
    { role: "user", content: "Stars?" },
    {
      role: "assistant",
      toolCalls: [
        { id: "call-1", function: { name: "githubRepo", arguments: '{"repo":"TanStack/ai"}' } },
      ],
    },
    { role: "tool", toolCallId: "call-1", content: expect.stringContaining('"stars":5000') },
    { role: "assistant", content: "5,000 stars." },
    { role: "user", content: "And forks?" },
  ]);
});

test("a failed tool call reaches the model as an error result", async () => {
  let seen: unknown[] = [];
  const { transport } = connect([
    ({ request }) => {
      seen = request.messages;
      return { text: "Sorry." };
    },
  ]);
  const failed: UIMessage = {
    id: "a1",
    role: "assistant",
    parts: [
      {
        type: "dynamic-tool",
        toolName: "githubRepo",
        toolCallId: "c1",
        state: "output-error",
        input: { repo: "x/y" },
        errorText: "No public repository x/y.",
      },
    ],
  };
  await send(transport, [user("u1", "Stars of x/y?"), failed, user("u2", "Try again?")]);

  expect(seen).toMatchObject([
    { role: "user" },
    { role: "assistant", toolCalls: [{ id: "c1" }] },
    { role: "tool", toolCallId: "c1", content: "No public repository x/y." },
    { role: "user", content: "Try again?" },
  ]);
});

test("server errors surface as a chat error", async () => {
  const { transport } = connect([{ error: "Model overloaded" }]);
  await expect(send(transport, [user("u1", "Hi")])).rejects.toThrow("Model overloaded");
});

test("a rejected request throws with the server's message", async () => {
  const { transport } = connect([]);
  vi.stubGlobal("fetch", async () => new Response("Bad request: messages", { status: 400 }));
  await expect(send(transport, [user("u1", "Hi")])).rejects.toThrow("Bad request: messages");
});

test("assistant steps split around tool calls; unfinished calls are dropped", () => {
  const assistant: UIMessage = {
    id: "a1",
    role: "assistant",
    parts: [
      { type: "step-start" },
      { type: "reasoning", text: "Hmm.", state: "done" },
      { type: "text", text: "Checking.", state: "done" },
      {
        type: "dynamic-tool",
        toolName: "npmDownloads",
        toolCallId: "c1",
        state: "output-available",
        input: { package: "zod", period: "last-week" },
        output: { total: 10 },
      },
      {
        type: "dynamic-tool",
        toolName: "githubRepo",
        toolCallId: "c2",
        state: "output-error",
        input: { repo: "x/y" },
        errorText: "Not found",
      },
      {
        type: "dynamic-tool",
        toolName: "githubRepo",
        toolCallId: "c3",
        state: "input-streaming",
        input: undefined,
      },
      { type: "step-start" },
      { type: "text", text: "Done.", state: "done" },
    ],
  };
  expect(toAgUiMessages([assistant])).toEqual([
    {
      id: "a1",
      role: "assistant",
      content: "Checking.",
      toolCalls: [
        {
          id: "c1",
          type: "function",
          function: { name: "npmDownloads", arguments: '{"package":"zod","period":"last-week"}' },
        },
        {
          id: "c2",
          type: "function",
          function: { name: "githubRepo", arguments: '{"repo":"x/y"}' },
        },
      ],
    },
    { id: "c1-result", role: "tool", toolCallId: "c1", content: '{"total":10}' },
    { id: "c2-result", role: "tool", toolCallId: "c2", content: "Not found", error: "Not found" },
    { id: "a1-1", role: "assistant", content: "Done." },
  ]);
});

/** `ReadableStream.from` without relying on the DOM lib declaring it. */
function streamOf<T>(items: T[]) {
  return new ReadableStream<T>({
    start(controller) {
      for (const item of items) controller.enqueue(item);
      controller.close();
    },
  });
}

/** The ids every run event carries. */
const run = { threadId: "t", runId: "r" };

async function collect<T>(stream: ReadableStream<T>) {
  const out: T[] = [];
  for await (const chunk of stream) out.push(chunk);
  return out;
}

test("server-sent events parse across arbitrary chunk boundaries", async () => {
  const wire =
    'data: {"type":"RUN_STARTED","threadId":"t","runId":"r"}\n\ndata: {"type":"TEXT_MESSAGE_CONTENT","messageId":"m","delta":"a\\nb"}\r\n\r\n';
  for (let split = 1; split < wire.length; split++) {
    const events = await collect(
      streamOf([wire.slice(0, split), wire.slice(split)]).pipeThrough(serverSentEvents()),
    );
    expect(events).toEqual([
      { type: EventType.RUN_STARTED, ...run },
      { type: EventType.TEXT_MESSAGE_CONTENT, messageId: "m", delta: "a\nb" },
    ]);
  }
});

test("a stream cut off mid-text still closes its parts and finishes", async () => {
  const events: AGUIEvent[] = [
    { type: EventType.RUN_STARTED, ...run },
    { type: EventType.TEXT_MESSAGE_START, messageId: "m", role: "assistant" },
    { type: EventType.TEXT_MESSAGE_CONTENT, messageId: "m", delta: "Hal" },
  ];
  const chunks = await collect(streamOf(events).pipeThrough(agUiToUIMessageChunks()));
  expect(chunks.map((chunk) => chunk.type)).toEqual([
    "start",
    "start-step",
    "text-start",
    "text-delta",
    "text-end",
    "finish-step",
    "finish",
  ]);
});

test("reused server message ids get distinct part ids", async () => {
  const events: AGUIEvent[] = [
    { type: EventType.RUN_STARTED, ...run },
    { type: EventType.TEXT_MESSAGE_START, messageId: "r-text", role: "assistant" },
    { type: EventType.TEXT_MESSAGE_END, messageId: "r-text" },
    {
      type: EventType.RUN_FINISHED,
      ...run,
      metadata: { tanstack: { finishReason: "tool_calls" } },
    },
    { type: EventType.TEXT_MESSAGE_START, messageId: "r-text", role: "assistant" },
    { type: EventType.TEXT_MESSAGE_END, messageId: "r-text" },
    { type: EventType.RUN_FINISHED, ...run, metadata: { tanstack: { finishReason: "stop" } } },
  ];
  const chunks = await collect(streamOf(events).pipeThrough(agUiToUIMessageChunks()));
  const ids = chunks.flatMap((chunk) => (chunk.type === "text-start" ? [chunk.id] : []));
  expect(new Set(ids).size).toBe(2);
  expect(chunks.at(-1)).toEqual({ type: "finish", finishReason: "stop" });
});
