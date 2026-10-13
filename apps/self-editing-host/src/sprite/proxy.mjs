// Runs on every visitor Sprite as the service behind the Sprite's one public port.
// It forwards to the site's Vite dev server (including Vite's HMR WebSocket) and
// adds the chat widget's <script> tag to every HTML response. It lives outside the
// site directory so an edit to the site cannot remove the chat.
import http from "node:http";
import net from "node:net";

const SITE = { host: "127.0.0.1", port: 5173 };
const { HOST_URL, SPRITE_NAME, WIDGET_TOKEN } = process.env;
if (!HOST_URL || !SPRITE_NAME || !WIDGET_TOKEN) {
  console.error("proxy: HOST_URL, SPRITE_NAME and WIDGET_TOKEN are required");
  process.exit(1);
}

const attr = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const WIDGET_TAG =
  `<script defer src="${attr(HOST_URL)}/widget.js" data-host="${attr(HOST_URL)}" ` +
  `data-sprite="${attr(SPRITE_NAME)}" data-token="${attr(WIDGET_TOKEN)}"></script>`;

const FALLBACK_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Site is down</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:34rem;margin:15vh auto;padding:0 1rem;color:#222}</style></head>
<body><h1>The site is not running</h1>
<p>The change that was just made may have broken it. Open the chat panel and ask the agent
to fix or undo the last change. This page reloads on its own.</p>
<script>setTimeout(() => location.reload(), 4000)</script>${WIDGET_TAG}</body></html>`;

function injectWidget(html) {
  const index = html.search(/<\/body>/i);
  return index === -1 ? html + WIDGET_TAG : html.slice(0, index) + WIDGET_TAG + html.slice(index);
}

const server = http.createServer((req, res) => {
  if (req.url === "/__aitink/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("ok");
  }
  // Ask Vite for an uncompressed response so the HTML can be rewritten.
  const headers = { ...req.headers, "accept-encoding": "identity" };
  const upstream = http.request(
    { ...SITE, path: req.url, method: req.method, headers },
    (siteResponse) => {
      const type = String(siteResponse.headers["content-type"] ?? "");
      if (!type.includes("text/html")) {
        res.writeHead(siteResponse.statusCode ?? 502, siteResponse.headers);
        return siteResponse.pipe(res);
      }
      const chunks = [];
      siteResponse.on("data", (chunk) => chunks.push(chunk));
      siteResponse.on("end", () => {
        const body = injectWidget(Buffer.concat(chunks).toString("utf8"));
        const responseHeaders = {
          ...siteResponse.headers,
          "content-length": Buffer.byteLength(body),
        };
        delete responseHeaders.etag; // the body changed
        res.writeHead(siteResponse.statusCode ?? 200, responseHeaders);
        res.end(body);
      });
    },
  );
  upstream.on("error", () => {
    if (res.headersSent) return res.destroy();
    res.writeHead(503, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(FALLBACK_PAGE);
  });
  req.on("aborted", () => upstream.destroy());
  req.pipe(upstream);
});

// Vite's HMR connects with a WebSocket; pass the upgrade through as raw TCP.
server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(SITE.port, SITE.host, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (let i = 0; i < req.rawHeaders.length; i += 2)
      lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    upstream.write(lines.join("\r\n") + "\r\n\r\n");
    if (head?.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(8080, "0.0.0.0", () => console.log("proxy listening on :8080"));
