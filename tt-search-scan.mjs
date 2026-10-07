// Runs a TikTok search in the TikTok tab (like a viewer typing it) and records what the page itself loads.
// usage: node tt-search-scan.mjs "<query>" [tab=video|top|user|tag] [maxItems=40]  -> tt-search/<slug>_<tab>.json
// exit 2 = captcha (stop everything)
import fs from "fs";
import { open, out, die, walk, EXIT } from "./lib/cdp.mjs";
import { captcha, stat, musicOf, itemUrl } from "./lib/tt.mjs";

const [q, kind = "video", maxArg] = process.argv.slice(2); const MAX = Number(maxArg ?? 40);
if (!q) die('usage: node tt-search-scan.mjs "<query>" [tab=video|top|user|tag] [maxItems=40]');
const outDir = out("tt-search"); fs.mkdirSync(outDir, { recursive: true });
const slug = q.replace(/[^a-z0-9äöü]+/gi, "_").toLowerCase();
const tab = await open("tiktok.com");
const bodies = await tab.capture(/\/api\/(search|challenge\/item_list|challenge\/detail)/);
const url = kind === "tag" ? `https://www.tiktok.com/tag/${encodeURIComponent(q)}`
  : `https://www.tiktok.com/search${kind === "top" ? "" : "/" + kind}?q=${encodeURIComponent(q)}`;
await tab.goto(url, { min: 4000 + Math.random() * 2000 });
if (await captcha(tab)) { console.log("CAPTCHA"); await tab.done(EXIT.WALL); }
const items = new Map(); const users = new Map(); const related = new Set();
const harvest = () => { for (const { body } of bodies.splice(0)) { let j; try { j = JSON.parse(body); } catch { continue; }
  const list = [...(j.item_list || []), ...(j.itemList || []), ...((j.data || []).map(d => d.item).filter(Boolean))];
  for (const it of list) if (it?.id && !items.has(it.id)) { const a = it.author?.uniqueId; items.set(it.id, {
    id: it.id, author: a, authorFollowers: +(it.authorStats?.followerCount ?? it.authorStatsV2?.followerCount ?? 0) || null,
    url: itemUrl(a, it), isPhoto: !!it.imagePost,
    created: new Date(it.createTime * 1000).toISOString().slice(0, 10), desc: it.desc, duration: it.video?.duration,
    plays: stat(it, "playCount"), likes: stat(it, "diggCount"), comments: stat(it, "commentCount"), shares: stat(it, "shareCount"), saves: stat(it, "collectCount"),
    music: musicOf(it, false), ad: !!it.isAd }); }
  for (const u of [...(j.user_list || []), ...((j.data || []).map(d => d.user_list).flat().filter(Boolean))]) { const ui = u.user_info || u.user || u; const h = ui.unique_id || ui.uniqueId;
    if (h && !users.has(h)) users.set(h, { handle: h, nickname: ui.nickname, followers: ui.follower_count ?? u.stats?.followerCount, bio: ui.signature, verified: !!(ui.custom_verify || ui.verified) }); }
  walk(j, o => { for (const [k, v] of Object.entries(o)) if (/related|suggest|rs_|word_list|sug/i.test(k) && Array.isArray(v))
    v.forEach(x => { const w = typeof x === "string" ? x : x?.word || x?.content || x?.keyword || x?.query; if (w) related.add(w); }); });
} };
const SCROLL = `(() => { const c = [...document.querySelectorAll('[data-e2e=search_video-item],[data-e2e=search_top-item],[data-e2e=challenge-item],[id^=column-item-video-container],[data-e2e=search-user-container]')];
  const l = c[c.length - 1]; if (l) l.scrollIntoView({ behavior: 'smooth', block: 'end' }); window.scrollBy(0, 400 + Math.random() * 400); })()`;
let still = 0, last = -1;
for (let i = 0; i < 14; i++) { harvest(); if ((kind === "user" ? users.size : items.size) >= MAX) break;
  if (await captcha(tab)) { console.log("CAPTCHA"); break; }
  const before = bodies.length;
  await tab.scroll(SCROLL, { min: 2500 + Math.random() * 1700, until: () => bodies.length > before });
  harvest(); const c = items.size + users.size; still = c === last ? still + 1 : 0; last = c; if (still >= 3) break; }
harvest();
// "Others searched for" / related terms rendered in the DOM
const domRel = await tab.eval(`(() => { const out = []; const hs = [...document.querySelectorAll('h2,h3,p,span,div')].filter(e => e.children.length <= 1 && /others searched for|related searches|people also search/i.test(e.innerText || ''));
  for (const h of hs) { const box = h.parentElement?.parentElement || h.parentElement; if (!box) continue; box.querySelectorAll('a,span,p').forEach(x => { const s = x.innerText?.trim(); if (s && s.length < 60 && !/others searched|related/i.test(s)) out.push(s); }); }
  document.querySelectorAll('a[href*="/search?q="],a[href*="search/video?q="]').forEach(a => { const s = a.innerText?.trim(); if (s && s.length < 60) out.push(s); });
  return [...new Set(out)].slice(0, 40); })()`);
(domRel || []).forEach(x => related.add(x));
const cap = await captcha(tab);
fs.writeFileSync(`${outDir}/${slug}_${kind}.json`, JSON.stringify({ query: q, tab: kind, scannedAt: new Date().toISOString(), captchaAtEnd: cap, related: [...related], users: [...users.values()], items: [...items.values()] }, null, 1));
console.log(`${q} [${kind}]: ${items.size} items, ${users.size} users, ${related.size} related${cap ? " CAPTCHA" : ""}`);
await tab.done(cap ? EXIT.WALL : EXIT.OK);
