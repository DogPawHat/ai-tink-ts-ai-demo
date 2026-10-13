import { chat, chatParamsFromRequest, toServerSentEventsResponse } from "@tanstack/ai";
import { claudeCodeText } from "@tanstack/ai-claude-code";
import { withSandbox } from "@tanstack/ai-sandbox";
import { SPRITE_NAME, safeEqual, widgetToken } from "./auth.ts";
import type { HostConfig } from "./config.ts";
import { siteSandbox } from "./sandbox.ts";
import type { SpriteManager } from "./sprites.ts";

const ORIGIN = /^https:\/\/(ai-tink-[a-f0-9]{12})-[a-z0-9]+\.sprites\.app$/;
const MAX_PROMPT_CHARS = 4000;
const MAX_RUNS_PER_HOUR = 40;
const MAX_TURNS = 30;

const SYSTEM_PROMPT =
  "You are editing the Vite app that hosts this conversation. Read AGENTS.md first, then read before editing and make the requested change directly in this project's files. The page at / is the live site. Keep the site working and give a concise summary of edits. Vite will hot reload the browser. Use vp for package management and validation.";

/**
 * CORS headers for a request from one of this host's Sprite pages, else none.
 * A preflight lists the headers the chat client wants to send (it adds some of
 * its own, such as x-run-id), so those are allowed as asked; the origin check
 * above is what restricts who may call.
 */
export function corsHeaders(
  origin: string | null,
  requestedHeaders?: string | null,
): Record<string, string> {
  if (!origin || !ORIGIN.test(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": requestedHeaders || "authorization, content-type, x-sprite",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "600",
    vary: "Origin, Access-Control-Request-Headers",
  };
}

/**
 * The Sprite a widget request is for, or a failure response. The widget token
 * binds a browser to one Sprite, and the page's origin must be that Sprite's.
 */
export function authorizeWidget(
  request: Request,
  config: HostConfig,
): { spriteName: string } | { response: Response } {
  const deny = (status: number, message: string) => ({
    response: new Response(message, {
      status,
      headers: corsHeaders(request.headers.get("origin")),
    }),
  });
  const spriteName = request.headers.get("x-sprite") ?? "";
  const token = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  if (
    !SPRITE_NAME.test(spriteName) ||
    !safeEqual(token, widgetToken(config.tokenSecret, spriteName))
  ) {
    return deny(401, "Invalid token");
  }
  const origin = ORIGIN.exec(request.headers.get("origin") ?? "")?.[1];
  if (origin !== spriteName) return deny(403, "Origin does not match the Sprite");
  return { spriteName };
}

export function createChatHandler(config: HostConfig, manager: SpriteManager) {
  const busy = new Set<string>();
  const runs = new Map<string, number[]>();

  function overLimit(spriteName: string): boolean {
    const now = Date.now();
    const recent = (runs.get(spriteName) ?? []).filter((time) => now - time < 3_600_000);
    if (recent.length >= MAX_RUNS_PER_HOUR) return true;
    runs.set(spriteName, [...recent, now]);
    return false;
  }

  return async function handleChat(request: Request): Promise<Response> {
    const cors = corsHeaders(request.headers.get("origin"));
    const auth = authorizeWidget(request, config);
    if ("response" in auth) return auth.response;
    const { spriteName } = auth;

    const status = await manager.status(spriteName);
    if (status.phase !== "ready")
      return new Response("The Sprite is not ready", { status: 409, headers: cors });
    if (busy.has(spriteName))
      return new Response("The agent is still working", { status: 409, headers: cors });
    if (overLimit(spriteName))
      return new Response("Hourly limit reached", { status: 429, headers: cors });

    const params = await chatParamsFromRequest(request);
    const last = params.messages.findLast((message) => message.role === "user");
    const text = !last
      ? ""
      : "content" in last && typeof last.content === "string"
        ? last.content
        : "parts" in last
          ? last.parts.map((part) => (part.type === "text" ? part.content : "")).join("")
          : "";
    if (text.length > MAX_PROMPT_CHARS)
      return new Response("Prompt too long", { status: 413, headers: cors });

    const sessionId =
      typeof params.forwardedProps.sessionId === "string"
        ? params.forwardedProps.sessionId
        : undefined;
    const gatewayEnv = {
      ANTHROPIC_BASE_URL: config.gatewayUrl,
      // The Sprites gateway adds the real key; the Sprite never holds it.
      ANTHROPIC_AUTH_TOKEN: "sprites-gateway",
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_MODEL: config.model,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: config.model,
      ANTHROPIC_DEFAULT_SONNET_MODEL: config.model,
      ANTHROPIC_DEFAULT_OPUS_MODEL: config.model,
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    };

    busy.add(spriteName);
    const stream = chat({
      adapter: claudeCodeText(config.model, {
        authMode: "host",
        permissionMode: "bypassPermissions",
        maxTurns: MAX_TURNS,
        env: gatewayEnv,
      }),
      messages: params.messages,
      systemPrompts: [SYSTEM_PROMPT],
      threadId: spriteName,
      runId: params.runId,
      modelOptions: { sessionId },
      stream: true,
      middleware: [withSandbox(siteSandbox(config, manager, spriteName))],
    });
    async function* tracked() {
      try {
        yield* stream;
      } finally {
        busy.delete(spriteName);
      }
    }
    const response = toServerSentEventsResponse(tracked());
    for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
    return response;
  };
}
