import { afterEach, expect, test, vi } from "vite-plus/test";

vi.mock("@tanstack/react-start/server-only", () => ({}));

import { getAgentConfiguration } from "./agent.server";

afterEach(() => vi.unstubAllEnvs());

test("refuses to run an agent outside Drop", () => {
  vi.stubEnv("DROP_ENV", "");
  expect(getAgentConfiguration()).toEqual({
    missing: ["a Drop environment (start with drop run)"],
  });
});

test("inside Drop it defaults to the Zen model and sandboxes the working tree", () => {
  vi.stubEnv("DROP_ENV", "1");
  vi.stubEnv("OPENCODE_MODEL", "");
  const config = getAgentConfiguration();
  expect(config.missing).toEqual([]);
  expect(config.model).toBe("opencode/deepseek-v4.1-flash");
  expect(config.sandbox?.id).toBe("self-editing-demo");
});

test("inside Drop it uses the configured model", () => {
  vi.stubEnv("DROP_ENV", "1");
  vi.stubEnv("OPENCODE_MODEL", "opencode/other-model");
  expect(getAgentConfiguration().model).toBe("opencode/other-model");
});
