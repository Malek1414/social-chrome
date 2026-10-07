// Like saved-scan.mjs but: high scroll cap, writes saved_full.json, then scans named collections -> collections.json
// usage: node saved-scan-full.mjs <user> [scrolls=200]
import fs from "fs";
const [user, scrollsArg] = process.argv.slice(2);
const scrolls = Number(scrollsArg ?? 200);
const tabs = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = tabs.find(x => x.type === "page" && x.url.includes("instagram.com"));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = {}; const reqs = {}; const bodies = [];
const send = (m, params = {}) => new Promise(r => { p[++id] = r; ws.send(JSON.stringify({ id, method: m, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11,19), ...a);
ws.onmessage = async e => { const m = JSON.parse(e.data);
  if (p[m.id]) return p[m.id](m.result ?? m.error);
  if (m.method === "Network.responseReceived" && /graphql|\/api\/v1\//.test(m.params.response.url)) reqs[m.params.requestId] = 1;
  if (m.method === "Network.loadingFinished" && reqs[m.params.requestId]) { const b = await send("Network.getResponseBody", { requestId: m.params.requestId }); if (b?.body) bodies.push(b.body); } };
await new Promise(r => (ws.onopen = r));
await send("Network.enable");
const ev = async expr => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
const LINKS = `[...document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"]')].map(a => a.getAttribute('href'))`;
async function scrollCollect(url, maxScrolls) {
  await send("Page.navigate", { url });
  await sleep(7000);
  const seen = []; const set = new Set(); let still = 0;
  for (let i = 0; i < maxScrolls; i++) {
    const got = (await ev(LINKS)) || [];
    const n = set.size; got.forEach(h => { if (!set.has(h)) { set.add(h); seen.push(h); } });
    still = set.size === n ? still + 1 : 0;
    if (i % 10 === 0) log(url.split("/saved/")[1], "scroll", i, "found", set.size);
    if (still >= 6) break;
    await ev(`window.scrollBy(0, ${1400 + Math.floor(Math.random()*600)})`);
    await sleep(2200 + Math.random() * 1800);
    if (still >= 3) { await ev("window.scrollTo(0, document.body.scrollHeight)"); await sleep(3500); }
  }
  return seen.map(h => h.match(/(?:p|reel)\/([\w-]+)/)?.[1]).filter(Boolean);
}
// 1) all posts
const allCodes = await scrollCollect(`https://www.instagram.com/${user}/saved/all-posts/`, scrolls);
log("all-posts codes", allCodes.length);
// 2) collections
await send("Page.navigate", { url: `https://www.instagram.com/${user}/saved/` });
await sleep(6000);
const cols = await ev(`[...document.querySelectorAll('a[href*="/saved/"]')].map(a => ({href: a.getAttribute('href'), text: a.innerText.trim()})).filter(x => !/all-posts|audio/.test(x.href) && /\\/saved\\/[^/]+\\/\\d+/.test(x.href))`);
log("collections", JSON.stringify(cols));
const collections = [];
for (const c of cols || []) {
  await sleep(3000 + Math.random()*2000);
  const codes = await scrollCollect("https://www.instagram.com" + c.href, 60);
  collections.push({ name: c.text || c.href.split("/")[3], href: c.href, count: codes.length, codes });
  log("collection", c.text, codes.length);
}
const items = {};
const walk = o => { if (Array.isArray(o)) return o.forEach(walk); if (!o || typeof o !== "object") return;
  if (o.code && "taken_at" in o && o.user?.username) items[o.code] = { code: o.code, author: o.user.username,
    date: new Date(o.taken_at * 1000).toISOString().slice(0, 10), type: o.product_type || o.media_type,
    likes: o.like_count, comments: o.comment_count, plays: o.play_count ?? o.ig_play_count ?? null,
    caption: (o.caption?.text || "").slice(0, 1500) };
  Object.values(o).forEach(walk); };
for (const b of bodies) for (const line of b.split("\n")) { try { walk(JSON.parse(line)); } catch {} }
const out = allCodes.map(c => items[c] ?? { code: c });
fs.writeFileSync("saved_full.json", JSON.stringify(out, null, 1));
fs.writeFileSync("collections.json", JSON.stringify(collections.map(c => ({...c, posts: c.codes.map(k => items[k] ?? {code:k})})), null, 1));
log(`saved posts found: ${out.length}, with metadata: ${out.filter(x => x.author).length}; collections: ${collections.length}`);
ws.close(); setTimeout(() => process.exit(0), 1000);
