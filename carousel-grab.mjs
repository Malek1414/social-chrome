// usage: node carousel-grab.mjs <code>  -> reels/<code>/slide_XX.jpg|mp4 + meta.json
import fs from "fs";
const code = process.argv[2]; const dir = `reels/${code}`; fs.mkdirSync(dir, { recursive: true });
const tabs = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = tabs.find(x => x.type === "page" && x.url.includes("instagram.com"));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = {}; const reqs = {}; const bodies = [];
const send = (m, params = {}) => new Promise(r => { p[++id] = r; ws.send(JSON.stringify({ id, method: m, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
ws.onmessage = async e => { const m = JSON.parse(e.data);
  if (p[m.id]) return p[m.id](m.result ?? m.error);
  if (m.method === "Network.responseReceived" && /graphql|\/api\/v1\//.test(m.params.response.url)) reqs[m.params.requestId] = 1;
  if (m.method === "Network.loadingFinished" && reqs[m.params.requestId]) { const b = await send("Network.getResponseBody", { requestId: m.params.requestId }); if (b?.body) bodies.push(b.body); } };
await new Promise(r => (ws.onopen = r));
await send("Network.enable");
await send("Page.navigate", { url: `https://www.instagram.com/p/${code}/` });
await sleep(7000);
const scripts = (await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('script[type="application/json"]')].map(s=>s.textContent).filter(t=>t.includes('${code}'))`, returnByValue: true }))?.result?.value || [];
let media = null;
const walk = o => { if (media || !o || typeof o !== "object") return; if (Array.isArray(o)) return o.forEach(walk);
  if (o.code === code && (o.carousel_media || o.image_versions2)) { media = o; return; } Object.values(o).forEach(walk); };
for (const b of [...bodies, ...scripts]) for (const line of b.split("\n")) { try { walk(JSON.parse(line)); } catch {} }
if (!media) { console.log("NOMEDIA", code); process.exit(0); }
const items = media.carousel_media || [media];
const out = [];
for (const [i, it] of items.entries()) {
  const vid = it.video_versions?.[0]?.url; const img = it.image_versions2?.candidates?.[0]?.url;
  const url = vid || img; if (!url) continue;
  const fn = `${dir}/slide_${String(i + 1).padStart(2, "0")}.${vid ? "mp4" : "jpg"}`;
  const r = await fetch(url); fs.writeFileSync(fn, Buffer.from(await r.arrayBuffer()));
  out.push({ fn, type: vid ? "video" : "image", accessibility: it.accessibility_caption || null });
  await sleep(800 + Math.random() * 700);
}
fs.writeFileSync(`${dir}/meta.json`, JSON.stringify({ code, author: media.user?.username, caption: media.caption?.text, slides: out }, null, 1));
console.log("OK", code, out.length, "slides");
ws.close(); setTimeout(() => process.exit(0), 500);
