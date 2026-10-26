import { afterEach, expect, test, vi } from "vite-plus/test";
import { fakeText, type FakeResponseStep } from "@tanstack/ai/testing";
import { BASE_PATH, createHandler } from "./runtime";

interface AgUiEvent {
  type: string;
  [key: string]: unknown;
}

const sandboxTool = {
  name: "generateSandboxedUi",
  description: "Generate sandboxed UI.",
  parameters: {
    type: "object",
    properties: {
      initialHeight: { type: "number" },
      placeholderMessages: { type: "array", items: { type: "string" } },
      css: { type: "string" },
      html: { type: "string" },
      jsFunctions: { type: "string" },
      jsExpressions: { type: "array", items: { type: "string" } },
    },
  },
};

/** Runs one agent turn through the route with a scripted model. */
async function run(responses: FakeResponseStep[], content = "Hello") {
  const fake = fakeText();
  fake.setResponses(responses);
  const handler = createHandler(() => fake);
  const response = await handler(
    new Request(`http://localhost${BASE_PATH}/agent/default/run`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({
        threadId: crypto.randomUUID(),
        runId: crypto.randomUUID(),
        state: {},
        messages: [{ id: crypto.randomUUID(), role: "user", content }],
        tools: [sandboxTool],
        context: [],
        forwardedProps: {},
      }),
    }),
  );
  expect(response.status).toBe(200);
  const events = (await response.text())
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5)) as AgUiEvent);
  return { events, fake };
}

function toolArgs(events: AgUiEvent[], name: string) {
  const start = events.find((e) => e.type === "TOOL_CALL_START" && e.toolCallName === name);
  const id = start?.toolCallId;
  return events
    .filter((e) => e.type === "TOOL_CALL_ARGS" && e.toolCallId === id)
    .map((e) => e.delta)
    .join("");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("streams a text answer as AG-UI events", async () => {
  const { events } = await run([{ text: "Hi there." }]);
  const types = events.map((e) => e.type);
  expect(types[0]).toBe("RUN_STARTED");
  expect(types).toContain("TEXT_MESSAGE_CONTENT");
  expect(types.at(-1)).toBe("RUN_FINISHED");
  const text = events
    .filter((e) => e.type === "TEXT_MESSAGE_CONTENT")
    .map((e) => e.delta)
    .join("");
  expect(text).toBe("Hi there.");
});

test("runs a server data tool and streams its result", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            package: "swr",
            start: "2026-01-05",
            end: "2026-01-05",
            downloads: [{ day: "2026-01-05", downloads: 7 }],
          }),
        ),
    ),
  );
  const { events, fake } = await run([
    { toolCalls: [{ name: "npmDownloads", input: { package: "swr", period: "last-week" } }] },
    { text: "Done." },
  ]);
  const result = events.find((e) => e.type === "TOOL_CALL_RESULT");
  expect(JSON.parse(String(result?.content))).toMatchObject({ package: "swr", total: 7 });
  expect(fake.state.callCount).toBe(2);
});

test("repairs a string jsExpressions before the client and validation see it", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const { events } = await run([
    {
      toolCalls: [
        {
          name: "generateSandboxedUi",
          input: {
            initialHeight: 300,
            placeholderMessages: ["Building…"],
            css: "body { margin: 0 }",
            html: "<p id='out'></p>",
            jsFunctions: "function init() { out.textContent = 'ok' }",
            jsExpressions: "init()",
          },
        },
      ],
    },
  ]);
  const args = JSON.parse(toolArgs(events, "generateSandboxedUi"));
  expect(args.jsExpressions).toEqual(["init()"]);
  // No validation error went back to the model.
  expect(events.some((e) => e.type === "TOOL_CALL_RESULT")).toBe(false);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("wrapped a string jsExpressions"));
});
