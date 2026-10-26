import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT || 8020);
const hostname = process.env.HOST || "127.0.0.1";

serve({ fetch: createApp().fetch, port, hostname }, (info) => {
  console.log(`AG-UI agent on http://${info.address}:${info.port}/api/agent`);
});
