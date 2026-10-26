import { expect, test } from "vite-plus/test";
import { ExpressionsRewriter, describeSandboxTool } from "./sandbox-tool";

/** Feeds `json` to a rewriter in pieces cut at `cuts`, as a stream would. */
function rewrite(json: string, cuts: number[]) {
  const rewriter = new ExpressionsRewriter();
  const points = [0, ...cuts, json.length];
  return points
    .slice(1)
    .map((end, i) => rewriter.write(json.slice(points[i], end)))
    .join("");
}

const stringValued = JSON.stringify({
  css: 'body { content: "jsExpressions" }',
  jsFunctions: 'function init() { say("\\"hi\\""); }',
  jsExpressions: 'init("a\\"b")',
});

test("wraps a string jsExpressions in an array, wherever the stream is cut", () => {
  const expected = JSON.parse(stringValued);
  expected.jsExpressions = [expected.jsExpressions];
  for (let cut = 1; cut < stringValued.length; cut++) {
    expect(JSON.parse(rewrite(stringValued, [cut]))).toEqual(expected);
  }
  const everyChar = Array.from({ length: stringValued.length - 1 }, (_, i) => i + 1);
  expect(JSON.parse(rewrite(stringValued, everyChar))).toEqual(expected);
});

test("leaves an array jsExpressions alone", () => {
  const json = JSON.stringify({ html: "<p>", jsExpressions: ["init()", "draw()"] });
  expect(rewrite(json, [5, 20])).toBe(json);
});

test("ignores the key's name inside other strings", () => {
  const json = JSON.stringify({ jsFunctions: '"jsExpressions": "x"', jsExpressions: ["init()"] });
  expect(rewrite(json, [])).toBe(json);
});

test("adds field descriptions to generateSandboxedUi only", () => {
  const schema = { type: "object", properties: { jsExpressions: { type: "array" } } };
  const described = describeSandboxTool({ name: "generateSandboxedUi", inputSchema: schema });
  expect(
    (described.inputSchema as typeof schema & { properties: { jsExpressions: object } }).properties
      .jsExpressions,
  ).toMatchObject({ type: "array", description: expect.stringContaining("Always an array") });
  const other = { name: "callout", inputSchema: schema };
  expect(describeSandboxTool(other)).toBe(other);
});
