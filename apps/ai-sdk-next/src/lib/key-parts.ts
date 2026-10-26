import type { UIMessage } from "ai";

/**
 * Pairs each message part with a React key. Tool parts have ids; text and
 * reasoning parts don't, so they're keyed by the tool call before them, which
 * stays stable as parts stream in.
 */
export function keyParts(parts: UIMessage["parts"]) {
  let after = "start";
  let count = 0;
  return parts.map((part) => {
    if ("toolCallId" in part) {
      after = part.toolCallId;
      count = 0;
      return { key: part.toolCallId, part };
    }
    return { key: `${after}:${part.type}:${count++}`, part };
  });
}
