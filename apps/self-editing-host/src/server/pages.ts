const escape = (value: string) =>
  value.replace(
    /[&<>"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!,
  );

function page(title: string, body: string, script = ""): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:18vh auto;padding:0 1rem;color:#1c1c1c}
h1{font-size:1.4rem}progress{width:100%}code{background:#f2f2f2;padding:.1rem .3rem;border-radius:4px}
a{color:#0b57d0}.muted{color:#666}</style></head><body>${body}${script ? `<script>${script}</script>` : ""}</body></html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export function deniedPage(): Response {
  const response = page(
    "Access required",
    '<h1>Access required</h1><p class="muted">This demo is private.</p>',
  );
  return new Response(response.body, { status: 401, headers: response.headers });
}

export function progressPage(): Response {
  return page(
    "Preparing your site",
    `<h1>Preparing your site</h1>
<p id="phase" class="muted">Starting…</p><progress></progress>
<p class="muted">The first visit sets up a private workspace and takes a minute or two.</p>`,
    `const label={missing:"Starting…",creating:"Creating your workspace…",uploading:"Uploading the site…",installing:"Installing dependencies…",starting:"Starting the site…"};
async function poll(){try{const r=await fetch("/api/status");const s=await r.json();
if(s.phase==="ready"){location.href=s.url;return}
if(s.phase==="error"){location.href="/?retry=1";return}
document.getElementById("phase").textContent=label[s.phase]||"Working…"}catch{}
setTimeout(poll,2000)}poll();`,
  );
}

export function errorPage(message: string): Response {
  return page(
    "Setup failed",
    `<h1>Setup failed</h1><p><code>${escape(message)}</code></p><p><a href="/?retry=1">Try again</a></p>`,
  );
}
