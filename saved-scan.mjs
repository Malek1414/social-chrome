// Lists everything in your Instagram "Saved" (all posts) using the data the page itself loads.
// usage: node saved-scan.mjs <your-username> [scrolls=15]   -> saved.json
import fs from "fs";
const [user, scrollsArg] = process.argv.slice(2);
const scrolls = Number(scrollsArg ?? 15);
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
await send("Page.navigate", { url: `https://www.instagram.com/${user}/saved/all-posts/` });
await sleep(7000);
const LINKS = `[...document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"]')].map(a => a.getAttribute('href'))`;
const seen = new Set(); let still = 0;
for (let i = 0; i < scrolls; i++) {
  const got = (await send("Runtime.evaluate", { expression: LINKS, returnByValue: true })).result.value;
  const n = seen.size; got.forEach(h => seen.add(h));
  still = seen.size === n ? still + 1 : 0;
  if (still >= 4) break;
  await send("Runtime.evaluate", { expression: "window.scrollBy(0, 1800)" });
  await sleep(2200 + Math.random() * 1500);
}
const links = [...seen];
const items = {};
const walk = o => { if (Array.isArray(o)) return o.forEach(walk); if (!o || typeof o !== "object") return;
  if (o.code && "taken_at" in o && o.user?.username) items[o.code] = { code: o.code, author: o.user.username,
    date: new Date(o.taken_at * 1000).toISOString().slice(0, 10), type: o.product_type || o.media_type,
    likes: o.like_count, comments: o.comment_count, plays: o.play_count ?? o.ig_play_count ?? null,
    caption: (o.caption?.text || "").slice(0, 600) };
  Object.values(o).forEach(walk); };
for (const b of bodies) for (const line of b.split("\n")) { try { walk(JSON.parse(line)); } catch {} }
const codes = links.map(h => h.match(/(?:p|reel)\/([\w-]+)/)?.[1]).filter(Boolean);
const out = codes.map(c => items[c] ?? { code: c });
fs.writeFileSync("saved.json", JSON.stringify(out, null, 1));
console.log(`saved posts found: ${codes.length}, with metadata: ${out.filter(x => x.author).length}`);
ws.close(); setTimeout(() => process.exit(0), 1000);
