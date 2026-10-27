import { expect, test } from "vite-plus/test";
import { fakeText, type FakeResponseStep } from "@tanstack/ai/testing";
import { handleChat } from "./agent";

function post(body: unknown, responses: FakeResponseStep[]) {
  const fake = fakeText();
  fake.setResponses(responses);
  const request = new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleChat(request, () => fake);
}

const runInput = (content: string) => ({
  threadId: "t1",
  runId: "r1",
  state: {},
  messages: [{ id: "u1", role: "user", content }],
  tools: [],
  context: [],
  forwardedProps: {},
});

async function events(response: Response) {
  return (await response.text())
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map(
      (line) =>
        JSON.parse(line.slice(5)) as { type: string; delta?: string; toolCallName?: string },
    );
}

test("streams a text answer as AG-UI server-sent events", async () => {
  const response = await post(runInput("Hello"), [{ text: "Hi there." }]);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/event-stream");
  const all = await events(response);
  expect(all[0]?.type).toBe("RUN_STARTED");
  expect(all.at(-1)?.type).toBe("RUN_FINISHED");
  const text = all.flatMap((e) => (e.type === "TEXT_MESSAGE_CONTENT" ? [e.delta] : [])).join("");
  expect(text).toBe("Hi there.");
});

test("hands setAccent to the browser instead of running it", async () => {
  const response = await post(runInput("Make it violet"), [
    { toolCalls: [{ name: "setAccent", input: { color: "violet" } }] },
  ]);
  const all = await events(response);
  expect(all.some((e) => e.type === "TOOL_CALL_START" && e.toolCallName === "setAccent")).toBe(
    true,
  );
  // A server tool would produce a result here; a client tool waits for the browser.
  expect(all.some((e) => e.type === "TOOL_CALL_RESULT")).toBe(false);
});

test("rejects a body that is not an AG-UI RunAgentInput", async () => {
  const response = await post({ messages: "nope" }, []);
  expect(response.status).toBe(400);
});
