import { toolDefinition } from "@tanstack/ai";
import { type } from "arktype";

/**
 * Tool definitions shared by the server and the browser. Because both sides
 * live in one app, the server route and `useChat` import the same objects:
 * the server implements `githubRepo`, the browser implements `setAccent`.
 */

export const githubRepoDef = toolDefinition({
  name: "githubRepo",
  description:
    "Facts about a public GitHub repository: stars, forks, open issues, language, license, and when it was last pushed.",
  inputSchema: type({
    repo: type(/^[\w.-]+\/[\w.-]+$/).describe("Repository as owner/name, e.g. 'TanStack/router'"),
  }),
});

export const ACCENTS = ["amber", "emerald", "sky", "rose", "violet"] as const;
export type Accent = (typeof ACCENTS)[number];

export const setAccentDef = toolDefinition({
  name: "setAccent",
  description:
    "Change the accent colour of the chat page the user is looking at. Runs in the user's browser.",
  inputSchema: type({ color: type.enumerated(...ACCENTS).describe("The new accent colour") }),
});
