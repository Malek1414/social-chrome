// Reads a TikTok creator's profile (user info + recent posts) from the data the page itself loads, scrolling slowly.
// usage: node tt-profile-scan.mjs <user> [maxItems=30]  -> creators/<user>.json      exit 2 = captcha
import fs from "fs";
import { open, out, die, EXIT } from "./lib/cdp.mjs";
import { captcha, ssr, stat, musicOf, itemUrl, stickersOf } from "./lib/tt.mjs";

const [user, maxArg] = process.argv.slice(2); const MAX = Number(maxArg ?? 30);
if (!user) die("usage: node tt-profile-scan.mjs <user> [maxItems=30]");
fs.mkdirSync(out("creators"), { recursive: true });
const tab = await open("tiktok.com");
const bodies = await tab.capture(/\/api\/(post\/item_list|creator\/item_list)/);
await tab.goto(`https://www.tiktok.com/@${user}`, { min: 4000 + Math.random() * 2000 });
if (await captcha(tab)) { console.log("CAPTCHA"); await tab.done(EXIT.WALL); }
let userInfo = null;
try { const u = JSON.parse(await ssr(tab)).__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo;
  userInfo = { ...u?.user && { uniqueId: u.user.uniqueId, nickname: u.user.nickname, signature: u.user.signature, bioLink: u.user.bioLink?.link, verified: u.user.verified, createTime: u.user.createTime, commerce: u.user.commerceUserInfo }, stats: u?.stats ?? u?.statsV2 }; } catch {}
const count = () => bodies.reduce((n, b) => { try { return n + (JSON.parse(b.body).itemList?.length || 0); } catch { return n; } }, 0);
let still = 0, last = -1;
for (let i = 0; i < 12 && count() < MAX; i++) {
  const before = bodies.length;
  await tab.scroll(700 + Math.random() * 400, { min: 2000 + Math.random() * 1500, until: () => bodies.length > before });
  const c = count(); still = c === last ? still + 1 : 0; last = c; if (still >= 3) break;
}
const seen = new Set(); const items = [];
for (const b of bodies) { let list; try { list = JSON.parse(b.body).itemList || []; } catch { continue; }
  for (const it of list) if (!seen.has(it.id)) { seen.add(it.id); items.push({
    id: it.id, url: itemUrl(user, it), pinned: !!it.isPinnedItem, isPhoto: !!it.imagePost,
    created: new Date(it.createTime * 1000).toISOString(), desc: it.desc, duration: it.video?.duration,
    plays: stat(it, "playCount"), likes: stat(it, "diggCount"), comments: stat(it, "commentCount"), shares: stat(it, "shareCount"), saves: stat(it, "collectCount"),
    music: musicOf(it), ad: !!it.isAd, brandedContent: it.brandOrganicType ?? null, commerce: it.anchors?.map(a => a.keyword) ?? null, stickers: stickersOf(it) }); } }
fs.writeFileSync(out("creators", `${user}.json`), JSON.stringify({ scannedAt: new Date().toISOString(), userInfo, items }, null, 1));
console.log(`${user}: ${items.length} items, pinned ${items.filter(x => x.pinned).length}`, JSON.stringify(userInfo?.stats));
await tab.done();
