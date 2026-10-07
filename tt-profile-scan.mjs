// Reads a TikTok creator's profile (user info + recent posts) from the data the page itself loads, scrolling slowly.
// usage: node tt-profile-scan.mjs <user> [maxItems=30]  -> creators/<user>.json
import fs from "fs";
const [user, maxArg] = process.argv.slice(2); const MAX = Number(maxArg ?? 30);
fs.mkdirSync(`${process.env.HOME}/Desktop/social-chrome/creators`, { recursive: true });
const tabs = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = tabs.find(x => x.type === "page" && x.url.includes("tiktok.com"));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = {}; const reqs = {}; const bodies = [];
const send = (m, params = {}) => new Promise(r => { p[++id] = r; ws.send(JSON.stringify({ id, method: m, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = async x => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }))?.result?.value;
ws.onmessage = async e => { const m = JSON.parse(e.data); if (p[m.id]) return p[m.id](m.result ?? m.error);
  if (m.method === "Network.responseReceived" && /\/api\/(post\/item_list|creator\/item_list)/.test(m.params.response.url)) reqs[m.params.requestId] = 1;
  if (m.method === "Network.loadingFinished" && reqs[m.params.requestId]) { const b = await send("Network.getResponseBody", { requestId: m.params.requestId }); if (b?.body) bodies.push(b.body); } };
await new Promise(r => (ws.onopen = r)); await send("Network.enable");
await send("Page.navigate", { url: `https://www.tiktok.com/@${user}` }); await sleep(8000);
if (await ev(`!!document.querySelector('[id*=captcha],[class*=captcha-]') || /verify to continue|drag the slider/i.test(document.body.innerText)`)) { console.log("CAPTCHA"); process.exit(2); }
const ssr = await ev(`document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__')?.textContent || ''`);
let userInfo = null; try { const u = JSON.parse(ssr).__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo; userInfo = { ...u?.user && { uniqueId: u.user.uniqueId, nickname: u.user.nickname, signature: u.user.signature, bioLink: u.user.bioLink?.link, verified: u.user.verified, createTime: u.user.createTime, commerce: u.user.commerceUserInfo }, stats: u?.stats ?? u?.statsV2 }; } catch {}
const count = () => bodies.reduce((n, b) => { try { return n + (JSON.parse(b).itemList?.length || 0); } catch { return n; } }, 0);
let still = 0, last = -1;
for (let i = 0; i < 12 && count() < MAX; i++) { await ev("window.scrollBy(0, 700 + Math.random()*400)"); await sleep(2500 + Math.random() * 1500);
  const c = count(); still = c === last ? still + 1 : 0; last = c; if (still >= 3) break; }
const seen = new Set(); const items = [];
for (const b of bodies) { try { for (const it of JSON.parse(b).itemList || []) if (!seen.has(it.id)) { seen.add(it.id); items.push({
  id: it.id, url: `https://www.tiktok.com/@${user}/${it.imagePost ? "photo" : "video"}/${it.id}`, pinned: !!it.isPinnedItem, isPhoto: !!it.imagePost,
  created: new Date(it.createTime * 1000).toISOString(), desc: it.desc, duration: it.video?.duration,
  plays: +it.stats?.playCount || +it.statsV2?.playCount, likes: +it.stats?.diggCount || +it.statsV2?.diggCount, comments: +it.stats?.commentCount || +it.statsV2?.commentCount,
  shares: +it.stats?.shareCount || +it.statsV2?.shareCount, saves: +(it.stats?.collectCount ?? it.statsV2?.collectCount),
  music: it.music ? `${it.music.title} - ${it.music.authorName}${it.music.original ? " (original)" : ""}` : null,
  ad: !!it.isAd, brandedContent: it.brandOrganicType ?? null, commerce: it.anchors?.map(a => a.keyword) ?? null, stickers: (it.stickersOnItem || []).flatMap(s => s.stickerText || []) }); } } catch {} }
fs.writeFileSync(`creators/${user}.json`, JSON.stringify({ scannedAt: new Date().toISOString(), userInfo, items }, null, 1));
console.log(`${user}: ${items.length} items, pinned ${items.filter(x => x.pinned).length}`, JSON.stringify(userInfo?.stats));
ws.close(); setTimeout(() => process.exit(0), 300);
