import { createHash, timingSafeEqual } from "node:crypto";

const ACCESS_COOKIE = "generative_ui_access";

/**
 * The deployed app pays for every run, so it is gated by a shared key, the
 * same way as `apps/pydantic-agui`: a visit to `/?key=<access key>` sets a
 * cookie, and every other path except /health needs that cookie.
 *
 * Returns a response that ends the request, or `undefined` to let it through.
 */
export function createAccessGate(accessKey: string | undefined) {
  if (!accessKey) return (): Response | undefined => undefined;
  const cookieValue = createHash("sha256").update(`access:${accessKey}`).digest("hex");

  return (request: Request): Response | undefined => {
    const url = new URL(request.url);
    if (url.pathname === "/health") return undefined;

    const key = url.searchParams.get("key");
    if (key !== null && equal(key, accessKey)) {
      const cookie = `${ACCESS_COOKIE}=${cookieValue}; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax`;
      // Behind Fly's proxy the request arrives over http; send the browser back to https.
      const location = new URL(url.pathname, url);
      const proto = request.headers.get("x-forwarded-proto");
      if (proto) location.protocol = `${proto}:`;
      return new Response(null, {
        status: 303,
        headers: { Location: location.href, "Set-Cookie": cookie },
      });
    }
    if (equal(readCookie(request, ACCESS_COOKIE) ?? "", cookieValue)) return undefined;
    return new Response("Open this page with ?key=<access key>.", { status: 401 });
  };
}

function readCookie(request: Request, name: string) {
  for (const pair of request.headers.get("cookie")?.split(";") ?? []) {
    const [key, ...value] = pair.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
