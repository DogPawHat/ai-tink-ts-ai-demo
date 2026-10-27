import { expect, test } from "vite-plus/test";
import { createAccessGate } from "./access-gate.ts";

const gate = createAccessGate("secret");

test("lets everything through without a key", () => {
  expect(createAccessGate(undefined)(new Request("http://app/api/agent"))).toBeUndefined();
});

test("gates every path but /health", () => {
  expect(gate(new Request("http://app/health"))).toBeUndefined();
  expect(gate(new Request("http://app/"))?.status).toBe(401);
  expect(gate(new Request("http://app/api/agent", { method: "POST" }))?.status).toBe(401);
  expect(gate(new Request("http://app/?key=wrong"))?.status).toBe(401);
});

test("the key sets a cookie that opens the app", () => {
  const response = gate(new Request("http://app/?key=secret"));
  expect(response?.status).toBe(303);
  expect(response?.headers.get("location")).toBe("http://app/");
  const cookie = response?.headers.get("set-cookie")?.split(";")[0] ?? "";
  expect(cookie).toMatch(/^ai_sdk_access=/);
  expect(gate(new Request("http://app/api/agent", { headers: { cookie } }))).toBeUndefined();
  expect(gate(new Request("http://app/", { headers: { cookie: `${cookie}x` } }))?.status).toBe(401);
});

test("the redirect keeps the forwarded protocol", () => {
  const headers = { "x-forwarded-proto": "https" };
  const response = gate(new Request("http://app/?key=secret", { headers }));
  expect(response?.headers.get("location")).toBe("https://app/");
});
