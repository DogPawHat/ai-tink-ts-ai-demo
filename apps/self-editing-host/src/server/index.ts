import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { Readable } from "node:stream";
import { SPRITE_NAME, newSpriteName, parseCookies, safeEqual, widgetToken } from "./auth.ts";
import { authorizeWidget, corsHeaders, createChatHandler } from "./chat.ts";
import { loadConfig } from "./config.ts";
import type { HostConfig } from "./config.ts";
import { deniedPage, errorPage, progressPage } from "./pages.ts";
import { SpriteManager } from "./sprites.ts";

const config = loadConfig();
const manager = new SpriteManager(config);
const handleChat = createChatHandler(config, manager);
const cookieAttrs = "Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000";

/** The cookie that proves the visitor entered the access key. */
const accessCookie = (c: HostConfig) => widgetToken(c.tokenSecret, "access-cookie");

function visitor(request: Request, url: URL) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const key = url.searchParams.get("key");
  const authorized =
    (key !== null && safeEqual(key, config.accessKey)) ||
    safeEqual(cookies.aitink_access ?? "", accessCookie(config));
  const existing = cookies.aitink_sprite;
  const spriteName = existing && SPRITE_NAME.test(existing) ? existing : newSpriteName();
  return { authorized, spriteName, setCookies: existing === spriteName ? [] : [spriteName] };
}

async function route(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const cors = corsHeaders(request.headers.get("origin"));

  if (request.method === "OPTIONS") {
    const preflight = corsHeaders(
      request.headers.get("origin"),
      request.headers.get("access-control-request-headers"),
    );
    return new Response(null, { status: 204, headers: preflight });
  }
  if (url.pathname === "/healthz") return new Response("ok");

  if (url.pathname === "/widget.js") {
    const file = join(config.assetDir, "widget.js");
    const size = (await stat(file)).size;
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "content-length": String(size),
        "cache-control": "no-cache",
      },
    });
  }

  if (url.pathname === "/api/chat" && request.method === "POST") return handleChat(request);

  // The widget's "reset" button: restore the site and the proxy from the template.
  if (url.pathname === "/api/reset" && request.method === "POST") {
    const auth = authorizeWidget(request, config);
    if ("response" in auth) return auth.response;
    manager.ensure(auth.spriteName, { fresh: true });
    return new Response(null, { status: 202, headers: cors });
  }

  const who = visitor(request, url);
  if (url.pathname === "/api/status") {
    if (!who.authorized) return new Response("Unauthorized", { status: 401 });
    return Response.json(await manager.status(who.spriteName));
  }

  if (url.pathname === "/" && request.method === "GET") {
    if (!who.authorized) return deniedPage();
    if (url.searchParams.has("retry")) manager.clearError(who.spriteName);
    const status = await manager.status(who.spriteName);
    let response: Response;
    if (status.phase === "ready") {
      response = new Response(null, { status: 302, headers: { location: status.url } });
    } else if (status.phase === "error") {
      response = errorPage(status.message);
    } else {
      if (status.phase === "missing") manager.ensure(who.spriteName);
      response = progressPage();
    }
    const headers = new Headers(response.headers);
    headers.append("set-cookie", `aitink_access=${accessCookie(config)}; ${cookieAttrs}`);
    for (const name of who.setCookies)
      headers.append("set-cookie", `aitink_sprite=${name}; ${cookieAttrs}`);
    return new Response(response.body, { status: response.status, headers });
  }

  return new Response("Not found", { status: 404 });
}

function toRequest(req: IncomingMessage, abort: AbortController): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(new URL(req.url ?? "/", config.publicUrl), {
    method: req.method,
    headers,
    signal: abort.signal,
    ...(hasBody ? { body: Readable.toWeb(req) as ReadableStream, duplex: "half" } : {}),
  } as RequestInit);
}

async function send(response: Response, res: ServerResponse) {
  const headers: Record<string, string | string[]> = {};
  response.headers.forEach((value, name) => {
    if (name !== "set-cookie") headers[name] = value;
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) headers["set-cookie"] = cookies;
  res.writeHead(response.status, headers);
  if (!response.body) return res.end();
  const reader = response.body.getReader();
  res.on("close", () => void reader.cancel().catch(() => undefined));
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

createServer((req, res) => {
  const abort = new AbortController();
  // A closed connection before the response ends (a stopped chat) cancels the run.
  res.on("close", () => {
    if (!res.writableEnded) abort.abort();
  });
  route(toRequest(req, abort))
    .then((response) => send(response, res))
    .catch((error: unknown) => {
      console.error(error);
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      res.end("Internal error");
    });
}).listen(config.port, () => console.log(`host listening on :${config.port}`));
