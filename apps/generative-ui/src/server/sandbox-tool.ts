import type { ChatMiddleware, StreamChunk } from "@tanstack/ai";

/**
 * Claude sometimes sends `generateSandboxedUi`'s `jsExpressions` as one
 * string instead of an array. Without a fix, `chat()` rejects the call and
 * Claude retries, but CopilotKit has already streamed the first attempt into
 * the page, and its parser only reads `jsExpressions` as an array, so that
 * widget never initialises and stays on screen next to the retry.
 *
 * Two layers: field descriptions make the mistake rarer, and the middleware
 * repairs it when it happens, both in the streamed argument deltas (what
 * CopilotKit renders) and in the parsed arguments (what `chat()` validates).
 */
const TOOL_NAME = "generateSandboxedUi";

const FIELD_DESCRIPTIONS: Record<string, string> = {
  initialHeight: "Height of the sandbox in pixels while it generates, e.g. 480.",
  placeholderMessages:
    'Array of short status strings shown while generating, e.g. ["Laying out inputs…"].',
  css: "All styles for the widget, as one string.",
  html: "The widget's markup, as one string. No <script> tags for setup; use jsFunctions and jsExpressions.",
  jsFunctions: "Reusable function definitions, as one string of JavaScript.",
  jsExpressions:
    'Array of JavaScript expression strings, run in order. Always an array, even for one expression: ["init()"], never "init()". The first entry initialises the widget.',
};

interface JsonSchemaObject {
  properties?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

export function describeSandboxTool<T extends { name: string; inputSchema: unknown }>(tool: T): T {
  if (tool.name !== TOOL_NAME) return tool;
  const schema = tool.inputSchema as JsonSchemaObject;
  const properties = Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([key, value]) => [
      key,
      FIELD_DESCRIPTIONS[key] ? { ...value, description: FIELD_DESCRIPTIONS[key] } : value,
    ]),
  );
  return { ...tool, inputSchema: { ...schema, properties } };
}

function wrapExpressions<T>(args: T): T {
  if (args && typeof args === "object" && "jsExpressions" in args) {
    const { jsExpressions } = args as { jsExpressions: unknown };
    if (typeof jsExpressions === "string") return { ...args, jsExpressions: [jsExpressions] };
  }
  return args;
}

const KEY_BEFORE_VALUE = /"jsExpressions"\s*:\s*$/;

/**
 * Rewrites a streamed JSON argument string so a string-valued `jsExpressions`
 * becomes a one-element array. It works on the stream as it arrives: it adds
 * `[` before the value's opening quote and `]` after its closing quote.
 */
export class ExpressionsRewriter {
  private seen = "";
  private mode: "scan" | "string" | "done" = "scan";
  private escaped = false;

  write(delta: string): string {
    if (this.mode === "done") return delta;
    let out = "";
    for (const char of delta) {
      if (this.mode === "scan") {
        if ((char === '"' || char === "[") && KEY_BEFORE_VALUE.test(this.seen.slice(-40))) {
          if (char === "[") {
            this.mode = "done";
          } else {
            this.mode = "string";
            out += "[";
          }
        }
        this.seen += char;
        out += char;
      } else if (this.mode === "string") {
        out += char;
        if (this.escaped) this.escaped = false;
        else if (char === "\\") this.escaped = true;
        else if (char === '"') {
          out += "]";
          this.mode = "done";
        }
      } else {
        out += char;
      }
    }
    return out;
  }
}

export function sandboxToolMiddleware(): ChatMiddleware {
  const rewriters = new Map<string, ExpressionsRewriter>();
  return {
    name: "sandbox-tool-arguments",
    onChunk(_ctx, chunk: StreamChunk) {
      if (chunk.type === "TOOL_CALL_START" && chunk.toolCallName === TOOL_NAME) {
        rewriters.set(chunk.toolCallId, new ExpressionsRewriter());
      } else if (chunk.type === "TOOL_CALL_ARGS") {
        const rewriter = rewriters.get(chunk.toolCallId);
        if (rewriter) return { ...chunk, delta: rewriter.write(chunk.delta) };
      } else if (chunk.type === "TOOL_CALL_END" && rewriters.delete(chunk.toolCallId)) {
        return { ...chunk, input: wrapExpressions(chunk.input) };
      }
    },
    onBeforeToolCall(_ctx, { toolName, args }) {
      if (toolName !== TOOL_NAME) return;
      const fixed = wrapExpressions(args);
      if (fixed === args) return;
      console.warn(`[${TOOL_NAME}] wrapped a string jsExpressions in an array`);
      return { type: "transformArgs", args: fixed };
    },
  };
}
