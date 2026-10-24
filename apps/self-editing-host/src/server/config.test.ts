import { expect, test } from "vite-plus/test";
import { loadConfig } from "./config.ts";

const env = {
  SPRITES_API_KEY: "token",
  ACCESS_KEY: "key",
  TOKEN_SECRET: "secret",
  GATEWAY_URL: "https://gateway.example/anthropic/",
  PUBLIC_URL: "https://host.example/",
};

test("lists every missing variable", () => {
  expect(() => loadConfig({})).toThrow(
    "Missing environment variables: SPRITES_API_KEY, ACCESS_KEY, TOKEN_SECRET, GATEWAY_URL, PUBLIC_URL",
  );
});

test("applies defaults and trims trailing slashes from URLs", () => {
  const config = loadConfig(env);
  expect(config.port).toBe(8080);
  expect(config.model).toBe("claude-haiku-5-5");
  expect(config.gatewayUrl).toBe("https://gateway.example/anthropic");
  expect(config.publicUrl).toBe("https://host.example");
});

test("takes the port, model and asset directory from the environment", () => {
  const config = loadConfig({
    ...env,
    PORT: "3000",
    AGENT_MODEL: "claude-other",
    ASSET_DIR: "/srv/assets",
  });
  expect(config.port).toBe(3000);
  expect(config.model).toBe("claude-other");
  expect(config.assetDir).toBe("/srv/assets");
});
