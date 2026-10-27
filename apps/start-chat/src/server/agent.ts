import {
  chat,
  chatParamsFromRequestBody,
  maxIterations,
  toServerSentEventsResponse,
  type ModelMessage,
} from "@tanstack/ai";
import { anthropicText, type AnthropicChatModel } from "@tanstack/ai-anthropic";
import { githubRepoDef, setAccentDef } from "../tools";
import { restoreWebSearches, webSearch, webSearchMiddleware } from "./web-search";

const SYSTEM_PROMPT = `You are a concise assistant in a demo chat built with TanStack Start and TanStack AI.
Use githubRepo for real numbers about GitHub repositories instead of guessing.
Use web_search for recent events or facts you aren't sure of, and name the sources you used.
When the user asks to change how the page looks, use setAccent.
Answer in plain text: the page does not render Markdown.`;

interface RepoResponse {
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  license: { spdx_id: string } | null;
  pushed_at: string;
}

export const githubRepo = githubRepoDef.server(async ({ repo }) => {
  const response = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "ai-tink-start-chat" },
  });
  if (response.status === 404) return { error: `No public repository ${repo}.` };
  if (response.status === 403) return { error: "GitHub's rate limit was hit; try again later." };
  if (!response.ok) return { error: `GitHub returned ${response.status}.` };
  const data = (await response.json()) as RepoResponse;
  return {
    repo: data.full_name,
    description: data.description,
    url: data.html_url,
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
    language: data.language,
    license: data.license?.spdx_id ?? null,
    pushedAt: data.pushed_at,
  };
});

type ChatAdapter = Parameters<typeof chat>[0]["adapter"];

/** The model adapter; tests pass a scripted one so they need no API key. */
export type AdapterFactory = () => ChatAdapter;

const anthropicAdapter: AdapterFactory = () =>
  anthropicText((process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5") as AnthropicChatModel);

/** Handles one AG-UI run from `useChat` and streams the answer back as SSE. */
export async function handleChat(request: Request, adapter: AdapterFactory = anthropicAdapter) {
  let params;
  try {
    params = await chatParamsFromRequestBody(await request.json());
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Bad request", { status: 400 });
  }

  const abortController = new AbortController();
  request.signal.addEventListener("abort", () => abortController.abort());

  const stream = chat({
    adapter: adapter(),
    messages: restoreWebSearches(params.messages as ModelMessage[]),
    threadId: params.threadId,
    runId: params.runId,
    systemPrompts: [SYSTEM_PROMPT],
    // The server knows every tool, so it doesn't need the browser's
    // declarations. setAccent has no server implementation: the stream asks
    // the browser to run it, and useChat sends the result back.
    tools: [githubRepo, setAccentDef, webSearch],
    abortController,
    agentLoopStrategy: maxIterations(6),
    // Low effort keeps Sonnet quick; the summary streams so the UI can show it.
    reasoning: { level: "low", summary: true },
    middleware: [webSearchMiddleware()],
  });

  return toServerSentEventsResponse(stream, { abortController });
}
