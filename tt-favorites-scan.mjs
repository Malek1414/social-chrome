// Exports the most recent TikTok Favorites (+ collections, + recent Liked) from the data the page itself loads.
// usage: node tt-favorites-scan.mjs <username> [maxFav=100] [maxLiked=30]  -> tt_favorites_recent.json      exit 2 = captcha
import fs from "fs";
import { open, out, die, EXIT } from "./lib/cdp.mjs";
import { captcha, stat, musicOf, stickersOf } from "./lib/tt.mjs";

const [user, maxFavArg, maxLikedArg] = process.argv.slice(2);
if (!user) die("usage: node tt-favorites-scan.mjs <your-tiktok-username> [maxFav] [maxLiked]");
const MAXF = Number(maxFavArg ?? 100), MAXL = Number(maxLikedArg ?? 30);
const tab = await open("tiktok.com");
const kindOf = u => /\/api\/user\/collect\/item_list/.test(u) ? "fav" : /\/api\/favorite\/item_list/.test(u) ? "liked"
  : /\/api\/user\/collection_list/.test(u) ? "collections" : /\/api\/collection\/item_list/.test(u) ? "collection_items" : null;
const bodies = await tab.capture(kindOf);
const clickTab = name => tab.eval(`(() => { const el = [...document.querySelectorAll('[role=tab],p,span,div')].find(e => e.children.length<=1 && e.innerText?.trim() === ${JSON.stringify(name)});
  if (!el) return false; (el.closest('[role=tab]') || el).click(); return true; })()`);
const count = k => bodies.filter(b => b.tag === k).reduce((n, b) => { try { return n + (JSON.parse(b.body).itemList?.length || 0); } catch { return n; } }, 0);
let hitCaptcha = false;
const scrollUntil = async (k, max) => { let still = 0, last = -1;
  for (let i = 0; i < 40 && count(k) < max; i++) {
    if (await captcha(tab)) { console.log("CAPTCHA while scrolling, saving what we have"); hitCaptcha = true; return; }
    const before = bodies.length;
    await tab.scroll(900 + Math.random() * 500, { min: 2200 + Math.random() * 1800, until: () => bodies.length > before });
    const c = count(k); still = c === last ? still + 1 : 0; last = c; if (still >= 4) break; } };

if (!tab.url.includes(`/@${user}`)) await tab.goto(`https://www.tiktok.com/@${user}`, { min: 4000 + Math.random() * 2000 });
if (await captcha(tab)) { console.log("CAPTCHA on profile, stopping"); await tab.done(EXIT.WALL); }
console.log("click Favorites:", await clickTab("Favorites")); await tab.settle({ min: 3500, max: 7000 });
await scrollUntil("fav", MAXF);
let collectionsUI = null;
if (await clickTab("Collections")) { await tab.settle({ min: 3000, max: 6000 }); collectionsUI = await tab.eval(`[...document.querySelectorAll('a[href*="/collection/"]')].map(a => ({ href: a.getAttribute('href'), text: a.innerText.replace(/\\n+/g,' | ') }))`); }
await tab.eval("window.scrollTo(0,0)"); await tab.settle({ min: 1500, max: 3000 });
console.log("click Liked:", await clickTab("Liked")); await tab.settle({ min: 3500, max: 7000 });
if (!hitCaptcha) await scrollUntil("liked", MAXL);

const norm = it => ({ id: it.id, url: `https://www.tiktok.com/@${it.author?.uniqueId}/video/${it.id}`,
  author: it.author?.uniqueId, authorName: it.author?.nickname, authorFollowers: it.authorStats?.followerCount ?? null,
  desc: it.desc, hashtags: (it.textExtra || []).filter(x => x.hashtagName).map(x => x.hashtagName),
  postDate: it.createTime ? new Date(it.createTime * 1000).toISOString().slice(0, 10) : null,
  plays: stat(it, "playCount"), likes: stat(it, "diggCount"), comments: stat(it, "commentCount"), shares: stat(it, "shareCount"), saves: stat(it, "collectCount"),
  duration: it.video?.duration ?? null, isPhoto: !!it.imagePost, music: musicOf(it),
  stickers: stickersOf(it), suggestedWords: it.suggestedWords || undefined, contentDesc: it.contents?.map(c => c.desc).filter(Boolean) });
const collect = k => { const seen = new Set(), res = [];
  for (const b of bodies.filter(b => b.tag === k)) { try { for (const it of JSON.parse(b.body).itemList || []) if (!seen.has(it.id)) { seen.add(it.id); res.push(norm(it)); } } catch {} }
  return res; };
const collections = bodies.filter(b => b.tag === "collections").flatMap(b => { try { return (JSON.parse(b.body).collectionList || []).map(c => ({ id: c.collectionId, name: c.name, total: c.total, state: c.state })); } catch { return []; } });
const favorites = collect("fav").slice(0, MAXF), liked = collect("liked").slice(0, MAXL);
fs.writeFileSync(out("tt_favorites_recent.json"), JSON.stringify({ scannedAt: new Date().toISOString(), user, favorites, liked, collections, collectionsUI }, null, 1));
console.log(`favorites: ${favorites.length}, liked: ${liked.length}, collections: ${collections.length}, responses: ${bodies.map(b => b.tag).join(",")}`);
await tab.done(hitCaptcha ? EXIT.WALL : EXIT.OK);
