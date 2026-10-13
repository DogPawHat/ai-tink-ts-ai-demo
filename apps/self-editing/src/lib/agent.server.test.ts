import { afterEach, expect, test, vi } from "vite-plus/test";

vi.mock("@tanstack/react-start/server-only", () => ({}));

import { getAgentConfiguration } from "./agent.server";

afterEach(() => vi.unstubAllEnvs());

test("refuses to run an agent outside Drop and without a key", () => {
  vi.stubEnv("DROP_ENV", "");
  vi.stubEnv("OPENROUTER_API_KEY", "");
  expect(getAgentConfiguration()).toEqual({
    missing: ["a Drop environment (start with drop run)", "OPENROUTER_API_KEY"],
  });
});

test("inside Drop without a key it asks for OPENROUTER_API_KEY", () => {
  vi.stubEnv("DROP_ENV", "1");
  vi.stubEnv("OPENROUTER_API_KEY", "");
  expect(getAgentConfiguration()).toEqual({ missing: ["OPENROUTER_API_KEY"] });
});

test("defaults to Haiku 5.5 on OpenRouter and maps every Claude alias to it", () => {
  vi.stubEnv("DROP_ENV", "1");
  vi.stubEnv("OPENROUTER_API_KEY", "sk-or-test");
  vi.stubEnv("AGENT_MODEL", "");
  vi.stubEnv("OPENROUTER_BASE_URL", "");
  const config = getAgentConfiguration();
  expect(config.missing).toEqual([]);
  expect(config.model).toBe("anthropic/claude-haiku-5.5");
  expect(config.sandbox?.id).toBe("self-editing-demo");
  expect(config.env).toMatchObject({
    ANTHROPIC_BASE_URL: "https://openrouter.ai/api",
    ANTHROPIC_AUTH_TOKEN: "sk-or-test",
    ANTHROPIC_API_KEY: "",
    ANTHROPIC_MODEL: "anthropic/claude-haiku-5.5",
    ANTHROPIC_DEFAULT_HAIKU_MODEL: "anthropic/claude-haiku-5.5",
    ANTHROPIC_DEFAULT_SONNET_MODEL: "anthropic/claude-haiku-5.5",
    ANTHROPIC_DEFAULT_OPUS_MODEL: "anthropic/claude-haiku-5.5",
  });
});

test("uses the configured model and base URL", () => {
  vi.stubEnv("DROP_ENV", "1");
  vi.stubEnv("OPENROUTER_API_KEY", "placeholder");
  vi.stubEnv("AGENT_MODEL", "anthropic/other-model");
  vi.stubEnv("OPENROUTER_BASE_URL", "https://gateway.example/openrouter");
  const config = getAgentConfiguration();
  expect(config.model).toBe("anthropic/other-model");
  expect(config.env?.ANTHROPIC_BASE_URL).toBe("https://gateway.example/openrouter");
  expect(config.env?.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe("anthropic/other-model");
});
