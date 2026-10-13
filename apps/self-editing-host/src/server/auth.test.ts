import { expect, test } from "vite-plus/test";
import { SPRITE_NAME, newSpriteName, parseCookies, safeEqual, widgetToken } from "./auth.ts";

test("new Sprite names match the connector's prefix and the name pattern", () => {
  const name = newSpriteName();
  expect(name).toMatch(SPRITE_NAME);
  expect(name.startsWith("ai-tink-")).toBe(true);
  expect(newSpriteName()).not.toBe(name);
});

test("widget tokens are stable per Sprite and differ between Sprites and secrets", () => {
  const token = widgetToken("secret", "ai-tink-aaaaaaaaaaaa");
  expect(token).toMatch(/^[0-9a-f]{64}$/);
  expect(widgetToken("secret", "ai-tink-aaaaaaaaaaaa")).toBe(token);
  expect(widgetToken("secret", "ai-tink-bbbbbbbbbbbb")).not.toBe(token);
  expect(widgetToken("other", "ai-tink-aaaaaaaaaaaa")).not.toBe(token);
});

test("safeEqual compares strings of any length without throwing", () => {
  expect(safeEqual("abc", "abc")).toBe(true);
  expect(safeEqual("abc", "abd")).toBe(false);
  expect(safeEqual("abc", "abcd")).toBe(false);
  expect(safeEqual("", "")).toBe(true);
});

test("parseCookies reads names and decoded values, and tolerates a missing header", () => {
  expect(parseCookies(null)).toEqual({});
  expect(parseCookies("a=1; b=hello%20there; broken")).toEqual({ a: "1", b: "hello there" });
});

test("Sprite name pattern rejects anything that is not a host-made name", () => {
  for (const bad of [
    "",
    "ai-tink-",
    "ai-tink-AAAAAAAAAAAA",
    "ai-tink-aaaaaaaaaaaaa",
    "other-aaaaaaaaaaaa",
    "ai-tink-aaaaaaaaaaaa/x",
  ]) {
    expect(SPRITE_NAME.test(bad)).toBe(false);
  }
});
