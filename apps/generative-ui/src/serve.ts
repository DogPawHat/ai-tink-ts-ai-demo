/**
 * The production server: `vp build`, then `node src/serve.ts`. Start's build
 * is a fetch handler with no static file serving, so srvx serves
 * `dist/client` in front of it, behind the access gate.
 */
import { serve } from "srvx";
import { staticMiddleware } from "srvx/static";
import { createAccessGate } from "./server/access-gate.ts";

const dist = new URL("../dist/", import.meta.url);
// The build output is not bundled with this file, and a static import would
// fail the type check before the first build.
// react-doctor-disable-next-line react-doctor/no-dynamic-import-path
const { default: app } = (await import(new URL("server/server.js", dist).href)) as {
  default: { fetch: (request: Request) => Response | Promise<Response> };
};
const gate = createAccessGate(process.env.ACCESS_KEY || undefined);

serve({
  port: Number(process.env.PORT || 8080),
  hostname: process.env.HOST || "0.0.0.0",
  middleware: [
    (request, next) => gate(request) ?? next(),
    (request, next) => (new URL(request.url).pathname === "/health" ? new Response("ok") : next()),
    staticMiddleware({ dir: new URL("client", dist).pathname }),
  ],
  fetch: (request) => app.fetch(request),
});
