import { expect, test } from "vite-plus/test";
import { fakeText } from "@tanstack/ai/testing";
import { AGENT_PATH, createApp } from "./app.ts";

function post(body: unknown) {
  const fake = fakeText();
  fake.setResponses([{ text: "Hi there." }]);
  return createApp(() => fake).request(AGENT_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("streams a text answer as AG-UI server-sent events", async () => {
  const response = await post({
    threadId: "t1",
    runId: "r1",
    state: {},
    messages: [{ id: "u1", role: "user", content: "Hello" }],
    tools: [],
    context: [],
    forwardedProps: {},
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/event-stream");
  // Without no-transform, the Next.js rewrite gzips and buffers the whole stream.
  expect(response.headers.get("cache-control")).toContain("no-transform");
  const events = (await response.text())
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5)) as { type: string; delta?: string });
  expect(events[0]?.type).toBe("RUN_STARTED");
  expect(events.at(-1)?.type).toBe("RUN_FINISHED");
  const text = events.flatMap((e) => (e.type === "TEXT_MESSAGE_CONTENT" ? [e.delta] : [])).join("");
  expect(text).toBe("Hi there.");
});

test("rejects a body that is not an AG-UI RunAgentInput", async () => {
  const response = await post({ messages: "nope" });
  expect(response.status).toBe(400);
});
