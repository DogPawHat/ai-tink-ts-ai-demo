import { renderToString } from "react-dom/server";
import { expect, test } from "vite-plus/test";
import { ChatSlot } from "./chat-slot";

test("leaves the slot marker out of the server-rendered markup", () => {
  // The widget must not find the slot until React has hydrated it.
  const html = renderToString(<ChatSlot className="slot" />);
  expect(html).toMatch(/^<div class="slot">/);
  expect(html).not.toContain("data-aitink-slot");
});

test("renders a placeholder until the widget arrives", () => {
  const html = renderToString(<ChatSlot />);
  expect(html).toContain("Loading the chat…");
});
