// Exports the most recent TikTok Favorites (+ collections, + recent Liked) from the data the page itself loads.
// usage: node tt-favorites-scan.mjs <username> [maxFav=100] [maxLiked=30]  -> tt_favorites_recent.json
import fs from "fs";
const [user = "malekhassann", maxFavArg, maxLikedArg] = process.argv.slice(2);
const MAXF = Number(maxFavArg ?? 100), MAXL = Number(maxLikedArg ?? 30);
const tabs = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = tabs.find(x => x.type === "page" && x.url.includes("tiktok.com"));
if (!t) { console.error("no tiktok tab"); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = {}; const reqs = {}; const bodies = []; // {kind,url,body}
const send = (m, params = {}) => new Promise(r => { p[++id] = r; ws.send(JSON.stringify({ id, method: m, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const human = () => sleep(2200 + Math.random() * 1800);
const ev = async x => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }))?.result?.value;
const kindOf = u => /\/api\/user\/collect\/item_list/.test(u) ? "fav" : /\/api\/favorite\/item_list/.test(u) ? "liked"
  : /\/api\/user\/collection_list/.test(u) ? "collections" : /\/api\/collection\/item_list/.test(u) ? "collection_items" : null;
ws.onmessage = async e => { const m = JSON.parse(e.data);
  if (p[m.id]) return p[m.id](m.result ?? m.error);
  if (m.method === "Network.responseReceived") { const k = kindOf(m.params.response.url); if (k) reqs[m.params.requestId] = { k, url: m.params.response.url }; }
  if (m.method === "Network.loadingFinished" && reqs[m.params.requestId]) { const r = reqs[m.params.requestId];
    const b = await send("Network.getResponseBody", { requestId: m.params.requestId });
    if (b?.body) bodies.push({ kind: r.k, url: r.url, body: b.body }); } };
await new Promise(r => (ws.onopen = r));
await send("Network.enable");
const captcha = () => ev(`!!document.querySelector('[id*=captcha],[class*=captcha-],[class*=Captcha]') || /verify to continue|drag the slider/i.test(document.body.innerText)`);
const clickTab = name => ev(`(() => { const el = [...document.querySelectorAll('[role=tab],p,span,div')].find(e => e.children.length<=1 && e.innerText?.trim() === '${name}');
  if (!el) return false; (el.closest('[role=tab]') || el).click(); return true; })()`);
const count = k => bodies.filter(b => b.kind === k).reduce((n, b) => { try { return n + (JSON.parse(b.body).itemList?.length || 0); } catch { return n; } }, 0);
const scrollUntil = async (k, max) => { let still = 0, last = -1;
  for (let i = 0; i < 40 && count(k) < max; i++) {
    if (await captcha()) throw new Error("CAPTCHA");
    await ev("window.scrollBy(0, 900 + Math.random()*500)"); await human();
    const c = count(k); still = c === last ? still + 1 : 0; last = c; if (still >= 4) break; } };

if (!t.url.includes(`/@${user}`)) { await send("Page.navigate", { url: `https://www.tiktok.com/@${user}` }); await sleep(7000); }
if (await captcha()) { console.log("CAPTCHA on profile, stopping"); process.exit(2); }
console.log("click Favorites:", await clickTab("Favorites")); await sleep(5000);
// collection names visible on the favorites tab (sub-tabs "Posts / Collections")
await scrollUntil("fav", MAXF);
let collectionsUI = null;
if (await clickTab("Collections")) { await sleep(4000); collectionsUI = await ev(`[...document.querySelectorAll('a[href*="/collection/"]')].map(a => ({ href: a.getAttribute('href'), text: a.innerText.replace(/\\n+/g,' | ') }))`); }
await ev("window.scrollTo(0,0)"); await sleep(2000);
console.log("click Liked:", await clickTab("Liked")); await sleep(5000);
await scrollUntil("liked", MAXL);

const norm = it => ({ id: it.id, url: `https://www.tiktok.com/@${it.author?.uniqueId}/video/${it.id}`,
  author: it.author?.uniqueId, authorName: it.author?.nickname, authorFollowers: it.authorStats?.followerCount ?? null,
  desc: it.desc, hashtags: (it.textExtra || []).filter(x => x.hashtagName).map(x => x.hashtagName),
  postDate: it.createTime ? new Date(it.createTime * 1000).toISOString().slice(0, 10) : null,
  plays: +it.stats?.playCount || +it.statsV2?.playCount || null, likes: +it.stats?.diggCount || +it.statsV2?.diggCount || null,
  comments: +it.stats?.commentCount || null, shares: +it.stats?.shareCount || null,
  saves: +(it.stats?.collectCount ?? it.statsV2?.collectCount) || null,
  duration: it.video?.duration ?? null, isPhoto: !!it.imagePost,
  music: it.music ? `${it.music.title} - ${it.music.authorName}${it.music.original ? " (original)" : ""}` : null,
  stickers: (it.stickersOnItem || []).flatMap(s => s.stickerText || []), suggestedWords: it.suggestedWords || undefined,
  contentDesc: it.contents?.map(c => c.desc).filter(Boolean) });
const collect = k => { const seen = new Set(), out = [];
  for (const b of bodies.filter(b => b.kind === k)) { try { for (const it of JSON.parse(b.body).itemList || []) if (!seen.has(it.id)) { seen.add(it.id); out.push(norm(it)); } } catch {} }
  return out; };
const collections = bodies.filter(b => b.kind === "collections").flatMap(b => { try { return (JSON.parse(b.body).collectionList || []).map(c => ({ id: c.collectionId, name: c.name, total: c.total, state: c.state })); } catch { return []; } });
const favorites = collect("fav").slice(0, MAXF), liked = collect("liked").slice(0, MAXL);
fs.writeFileSync("tt_favorites_recent.json", JSON.stringify({ scannedAt: new Date().toISOString(), user, favorites, liked, collections, collectionsUI }, null, 1));
console.log(`favorites: ${favorites.length}, liked: ${liked.length}, collections: ${collections.length}, responses: ${bodies.map(b=>b.kind).join(",")}`);
ws.close(); setTimeout(() => process.exit(0), 500);
