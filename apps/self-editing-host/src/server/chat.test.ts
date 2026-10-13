import { expect, test } from "vite-plus/test";
import { widgetToken } from "./auth.ts";
import { authorizeWidget, corsHeaders } from "./chat.ts";
import type { HostConfig } from "./config.ts";

const config: HostConfig = {
  port: 8080,
  spritesToken: "t",
  accessKey: "k",
  tokenSecret: "secret",
  gatewayUrl: "https://gateway.example",
  model: "m",
  publicUrl: "https://host.example",
  assetDir: ".",
};
const sprite = "ai-tink-0123456789ab";
const origin = `https://${sprite}-abc12.sprites.app`;

function widgetRequest(overrides: {
  token?: string;
  sprite?: string;
  origin?: string | null;
}): Request {
  const headers = new Headers();
  headers.set(
    "authorization",
    `Bearer ${overrides.token ?? widgetToken(config.tokenSecret, sprite)}`,
  );
  headers.set("x-sprite", overrides.sprite ?? sprite);
  if (overrides.origin !== null) headers.set("origin", overrides.origin ?? origin);
  return new Request("https://host.example/api/chat", { method: "POST", headers });
}

test("CORS allows only Sprite page origins and echoes the exact origin", () => {
  expect(corsHeaders(origin)["access-control-allow-origin"]).toBe(origin);
  for (const other of [
    null,
    "https://evil.example",
    "http://ai-tink-0123456789ab-abc12.sprites.app",
    "https://ai-tink-xyz-abc12.sprites.app",
    "https://x.sprites.app",
  ]) {
    expect(corsHeaders(other)).toEqual({});
  }
});

test("a preflight may ask for extra headers the chat client adds, such as x-run-id", () => {
  const headers = corsHeaders(origin, "authorization, content-type, x-run-id, x-sprite");
  expect(headers["access-control-allow-headers"]).toBe(
    "authorization, content-type, x-run-id, x-sprite",
  );
  expect(corsHeaders("https://evil.example", "x-run-id")).toEqual({});
});

test("a request with the right token from the Sprite's own origin is authorized", () => {
  expect(authorizeWidget(widgetRequest({}), config)).toEqual({ spriteName: sprite });
});

test("a wrong or missing token is refused with 401", async () => {
  for (const token of ["", "nope", widgetToken("other", sprite)]) {
    const result = authorizeWidget(widgetRequest({ token }), config);
    expect("response" in result && result.response.status).toBe(401);
  }
});

test("a token for one Sprite does not work for another", () => {
  const other = "ai-tink-ffffffffffff";
  const result = authorizeWidget(widgetRequest({ sprite: other }), config);
  expect("response" in result && result.response.status).toBe(401);
});

test("a valid token from another Sprite's origin is refused with 403", () => {
  const result = authorizeWidget(
    widgetRequest({ origin: "https://ai-tink-ffffffffffff-abc12.sprites.app" }),
    config,
  );
  expect("response" in result && result.response.status).toBe(403);
});

test("a valid token without an Origin header is refused with 403", () => {
  const result = authorizeWidget(widgetRequest({ origin: null }), config);
  expect("response" in result && result.response.status).toBe(403);
});
