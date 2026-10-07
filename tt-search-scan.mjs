// Runs a TikTok search in the TikTok tab (like a viewer typing it) and records what the page itself loads.
// usage: node tt-search-scan.mjs "<query>" [tab=video|top|user|tag] [maxItems=40]  -> search/<slug>_<tab>.json
// exit 2 = captcha (stop everything)
import fs from "fs";
const [q, tab = "video", maxArg] = process.argv.slice(2); const MAX = Number(maxArg ?? 40);
const outDir = `${process.env.HOME}/Desktop/social-chrome/tt-search`; fs.mkdirSync(outDir, { recursive: true });
const slug = q.replace(/[^a-z0-9äöü]+/gi, "_").toLowerCase();
const tabs = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = tabs.find(x => x.type === "page" && x.url.includes("tiktok.com"));
if (!t) { console.error("no tiktok tab"); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = {}; const reqs = {}; const bodies = [];
const send = (m, params = {}) => new Promise(r => { p[++id] = r; ws.send(JSON.stringify({ id, method: m, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = async x => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }))?.result?.value;
ws.onmessage = async e => { const m = JSON.parse(e.data); if (p[m.id]) return p[m.id](m.result ?? m.error);
  if (m.method === "Network.responseReceived" && /\/api\/(search|challenge\/item_list|challenge\/detail)/.test(m.params.response.url)) reqs[m.params.requestId] = m.params.response.url;
  if (m.method === "Network.loadingFinished" && reqs[m.params.requestId]) { const b = await send("Network.getResponseBody", { requestId: m.params.requestId }); if (b?.body) bodies.push({ url: reqs[m.params.requestId], body: b.body }); } };
await new Promise(r => (ws.onopen = r)); await send("Network.enable");
const captcha = () => ev(`!!document.querySelector('[id*=captcha],[class*=captcha-],[class*=Captcha]') || /verify to continue|drag the slider|Drag the puzzle/i.test(document.body.innerText)`);
const url = tab === "tag" ? `https://www.tiktok.com/tag/${encodeURIComponent(q)}`
  : `https://www.tiktok.com/search${tab === "top" ? "" : "/" + tab}?q=${encodeURIComponent(q)}`;
await send("Page.navigate", { url }); await sleep(7000 + Math.random() * 2000);
if (await captcha()) { console.log("CAPTCHA"); process.exit(2); }
const items = new Map(); const users = new Map(); const related = new Set();
const harvest = () => { for (const { body } of bodies) { let j; try { j = JSON.parse(body); } catch { continue; }
  const list = [...(j.item_list || []), ...(j.itemList || []), ...((j.data || []).map(d => d.item).filter(Boolean))];
  for (const it of list) if (it?.id && !items.has(it.id)) { const a = it.author?.uniqueId; items.set(it.id, {
    id: it.id, author: a, authorFollowers: +(it.authorStats?.followerCount ?? it.authorStatsV2?.followerCount ?? 0) || null,
    url: `https://www.tiktok.com/@${a}/${it.imagePost ? "photo" : "video"}/${it.id}`, isPhoto: !!it.imagePost,
    created: new Date(it.createTime * 1000).toISOString().slice(0, 10), desc: it.desc, duration: it.video?.duration,
    plays: +(it.stats?.playCount ?? it.statsV2?.playCount), likes: +(it.stats?.diggCount ?? it.statsV2?.diggCount),
    comments: +(it.stats?.commentCount ?? it.statsV2?.commentCount), shares: +(it.stats?.shareCount ?? it.statsV2?.shareCount),
    saves: +(it.stats?.collectCount ?? it.statsV2?.collectCount), music: it.music ? `${it.music.title} - ${it.music.authorName}` : null,
    ad: !!it.isAd }); }
  for (const u of [...(j.user_list || []), ...((j.data || []).map(d => d.user_list).flat().filter(Boolean))]) { const ui = u.user_info || u.user || u; const h = ui.unique_id || ui.uniqueId;
    if (h && !users.has(h)) users.set(h, { handle: h, nickname: ui.nickname, followers: ui.follower_count ?? u.stats?.followerCount, bio: ui.signature, verified: !!(ui.custom_verify || ui.verified) }); }
  const walkRel = o => { if (!o || typeof o !== "object") return; for (const [k, v] of Object.entries(o)) {
      if (/related|suggest|rs_|word_list|sug/i.test(k) && Array.isArray(v)) v.forEach(x => { const w = typeof x === "string" ? x : x?.word || x?.content || x?.keyword || x?.query; if (w) related.add(w); });
      else if (typeof v === "object") walkRel(v); } };
  walkRel(j); } };
let still = 0, last = -1;
for (let i = 0; i < 14; i++) { harvest(); if ((tab === "user" ? users.size : items.size) >= MAX) break;
  if (await captcha()) { console.log("CAPTCHA"); harvest(); break; }
  await ev(`(() => { const c = [...document.querySelectorAll('[data-e2e=search_video-item],[data-e2e=search_top-item],[data-e2e=challenge-item],[id^=column-item-video-container],[data-e2e=search-user-container]')]; const l = c[c.length-1]; if (l) l.scrollIntoView({behavior:'smooth', block:'end'}); window.scrollBy(0, 400 + Math.random()*400); })()`); await sleep(2500 + Math.random() * 1700);
  const c = items.size + users.size; still = c === last ? still + 1 : 0; last = c; if (still >= 3) break; }
harvest();
// "Others searched for" / related terms rendered in the DOM
const domRel = await ev(`(() => { const out = []; const hs = [...document.querySelectorAll('h2,h3,p,span,div')].filter(e => e.children.length <= 1 && /others searched for|related searches|people also search/i.test(e.innerText || ''));
  for (const h of hs) { const box = h.parentElement?.parentElement || h.parentElement; if (!box) continue; box.querySelectorAll('a,span,p').forEach(x => { const s = x.innerText?.trim(); if (s && s.length < 60 && !/others searched|related/i.test(s)) out.push(s); }); }
  document.querySelectorAll('a[href*="/search?q="],a[href*="search/video?q="]').forEach(a => { const s = a.innerText?.trim(); if (s && s.length < 60) out.push(s); });
  return [...new Set(out)].slice(0, 40); })()`);
(domRel || []).forEach(x => related.add(x));
const cap = await captcha();
const res = { query: q, tab, scannedAt: new Date().toISOString(), captchaAtEnd: cap, related: [...related], users: [...users.values()], items: [...items.values()] };
fs.writeFileSync(`${outDir}/${slug}_${tab}.json`, JSON.stringify(res, null, 1));
console.log(`${q} [${tab}]: ${items.size} items, ${users.size} users, ${related.size} related${cap ? " CAPTCHA" : ""}`);
ws.close(); setTimeout(() => process.exit(cap ? 2 : 0), 300);
