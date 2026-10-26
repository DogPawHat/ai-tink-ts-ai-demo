import { expect, test } from "vite-plus/test";
import type { UIMessage } from "@tanstack/ai-react";
import { keyParts } from "./key-parts";

const text = (content: string) => ({ type: "text" as const, content });
const toolCall = (id: string) => ({
  type: "tool-call" as const,
  id,
  name: "roll_dice",
  arguments: "{}",
  state: "input-complete" as const,
});

test("keys tool calls by id and text by the tool call before it", () => {
  const parts = [text("a"), toolCall("call-1"), text("b"), text("c")] as UIMessage["parts"];
  expect(keyParts(parts).map((p) => p.key)).toEqual([
    "start:text:0",
    "call-1",
    "call-1:text:0",
    "call-1:text:1",
  ]);
});

test("keeps earlier keys as text streams and parts are added", () => {
  const before = keyParts([text("Hel")] as UIMessage["parts"]).map((p) => p.key);
  const after = keyParts([text("Hello"), toolCall("call-1")] as UIMessage["parts"]).map(
    (p) => p.key,
  );
  expect(after.slice(0, before.length)).toEqual(before);
});
