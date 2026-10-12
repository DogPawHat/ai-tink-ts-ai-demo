import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { fakeText } from "@tanstack/ai/testing";
import { createHarnessHost, defineHarness } from "@tanstack/ai-harness";
import { workspaceTools } from "@tanstack/ai-harness/plugins";
import { memoryPersistence } from "@tanstack/ai-persistence";

test("harness edits its workspace, streams tool activity, and retains the conversation", async () => {
  const root = await mkdtemp(join(tmpdir(), "demo-harness-"));
  const host = createHarnessHost({ persistence: memoryPersistence() });
  const adapter = fakeText();
  adapter.setResponses([
    {
      toolCalls: [
        { name: "write_file", input: { path: "site.css", content: "body { color: purple; }" } },
      ],
    },
    { text: "Made the site purple." },
    ({ request }) => {
      expect(JSON.stringify(request.messages)).toContain("Made the site purple.");
      return { text: "The site is purple." };
    },
  ]);
  try {
    const harness = defineHarness({
      name: "test-coder",
      adapter,
      plugins: () => [workspaceTools({ root })],
    });
    const session = await host.open(harness, { threadId: "demo" });
    const operation = session.prompt("Make the site purple");
    const types: string[] = [];
    for await (const chunk of operation.stream()) types.push(chunk.type);
    expect((await operation).text).toBe("Made the site purple.");
    expect(types).toContain("TOOL_CALL_START");
    expect(types).toContain("TOOL_CALL_END");
    expect(await readFile(join(root, "site.css"), "utf8")).toBe("body { color: purple; }");
    expect(await host.open(harness, { threadId: "demo" })).toBe(session);
    expect((await session.prompt("What color is it?")).text).toBe("The site is purple.");
  } finally {
    await host.close();
    await rm(root, { recursive: true, force: true });
  }
});
