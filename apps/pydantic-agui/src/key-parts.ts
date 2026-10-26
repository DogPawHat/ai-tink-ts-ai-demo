import type { UIMessage } from "@tanstack/ai-react";

/**
 * Pairs each part with a React key. Tool calls have ids; text parts do not, so a
 * text part is keyed by the tool call before it, which stays stable as parts stream in.
 */
export function keyParts(parts: UIMessage["parts"]) {
  let after = "start";
  let count = 0;
  return parts.map((part) => {
    if (part.type === "tool-call") {
      after = part.id;
      count = 0;
      return { key: part.id, part };
    }
    return { key: `${after}:${part.type}:${count++}`, part };
  });
}
