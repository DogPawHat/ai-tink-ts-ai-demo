import { createAccessGate } from "./lib/access-gate.ts";

const gate = createAccessGate(process.env.ACCESS_KEY || undefined);

/** Runs before the `/api/agent` rewrite, so the gate covers the agent too. */
export function proxy(request: Request) {
  return gate(request);
}
