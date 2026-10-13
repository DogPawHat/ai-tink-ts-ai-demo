import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Sprites created by this host. The OpenRouter connector admits only this prefix. */
export const SPRITE_PREFIX = "ai-tink-";
export const SPRITE_NAME = /^ai-tink-[a-f0-9]{12}$/;

export function newSpriteName(): string {
  return `${SPRITE_PREFIX}${randomBytes(6).toString("hex")}`;
}

/** The token the widget on a Sprite's pages sends to this host. */
export function widgetToken(secret: string, spriteName: string): string {
  return createHmac("sha256", secret).update(`widget:${spriteName}`).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0)
      cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}
