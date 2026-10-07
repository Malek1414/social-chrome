// Opens IG Saved in a NEW tab (leaves other tabs alone), reads the most recently saved posts from the data the page loads.
// usage: node ig-latest-saved.mjs <username> [n=3]  -> prints JSON of the newest n saved items
const [user, nArg] = process.argv.slice(2); const N = Number(nArg ?? 3);
const t = await (await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = {}; const reqs = {}; const bodies = [];
const send = (m, params = {}) => new Promise(r => { p[++id] = r; ws.send(JSON.stringify({ id, method: m, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
ws.onmessage = async e => { const m = JSON.parse(e.data); if (p[m.id]) return p[m.id](m.result ?? m.error);
  if (m.method === "Network.responseReceived" && /graphql|\/api\/v1\//.test(m.params.response.url)) reqs[m.params.requestId] = 1;
  if (m.method === "Network.loadingFinished" && reqs[m.params.requestId]) { const b = await send("Network.getResponseBody", { requestId: m.params.requestId }); if (b?.body) bodies.push(b.body); } };
await new Promise(r => (ws.onopen = r)); await send("Network.enable");
await send("Page.navigate", { url: `https://www.instagram.com/${user}/saved/all-posts/` }); await sleep(8000);
const links = (await send("Runtime.evaluate", { expression: `[...document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"]')].map(a => a.getAttribute('href')).slice(0, ${N})`, returnByValue: true })).result.value;
const items = {};
const walk = o => { if (Array.isArray(o)) return o.forEach(walk); if (!o || typeof o !== "object") return;
  if (o.code && "taken_at" in o && o.user?.username) items[o.code] = { code: o.code, url: `https://www.instagram.com/p/${o.code}/`, author: o.user.username,
    date: new Date(o.taken_at * 1000).toISOString().slice(0, 10), type: o.product_type || o.media_type, likes: o.like_count, comments: o.comment_count,
    plays: o.play_count ?? o.ig_play_count ?? null, duration: o.video_duration ?? null, caption: o.caption?.text || "" };
  Object.values(o).forEach(walk); };
for (const b of bodies) for (const line of b.split("\n")) { try { walk(JSON.parse(line)); } catch {} }
const out = links.map(h => { const c = h.match(/(?:p|reel)\/([\w-]+)/)?.[1]; return items[c] ?? { code: c, url: `https://www.instagram.com${h}` }; });
console.log(JSON.stringify({ tabId: t.id, items: out }, null, 1));
ws.close(); setTimeout(() => process.exit(0), 300);
