import type { NextConfig } from "next";

/** The Hono agent server. The browser talks to it through this app, so no CORS. */
const AGENT_URL = process.env.AGENT_URL || "http://127.0.0.1:8020";

const config: NextConfig = {
  allowedDevOrigins: ["dogpawbot.taildd39d.ts.net"],
  async rewrites() {
    return [{ source: "/api/agent", destination: `${AGENT_URL}/api/agent` }];
  },
};

export default config;
