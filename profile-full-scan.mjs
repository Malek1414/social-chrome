// usage: node profile-full-scan.mjs <user> [maxScrolls=120] -> profiles/<user>_full.json
// Like profile-scan.mjs but scrolls the grid and the reels tab until no new posts appear (human pace).
import fs from "fs";
import { open, out, die, log, walkBodies } from "./lib/cdp.mjs";
import { API, codeOf, ssrJson, mergePost, scrollGrid } from "./lib/ig.mjs";

const [user, sc] = process.argv.slice(2); const maxScrolls = Number(sc ?? 120);
if (!user) die("usage: node profile-full-scan.mjs <user> [maxScrolls=120]");
fs.mkdirSync(out("profiles"), { recursive: true });
const tab = await open("instagram.com");
const bodies = await tab.capture(API);
const LINKS = `[...document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"]')].map(a => [a.getAttribute('href'), a.innerText.replace(/\\n/g,' ')])`;
const pages = []; const gridText = {}; let header = "";
for (const path of ["", "reels/"]) {
  if (tab.s429 > 2) break;
  await tab.goto(`https://www.instagram.com/${user}/${path}`);
  pages.push(...await ssrJson(tab, "taken_at", "follower"));
  if (!path) header = (await tab.eval(`(document.querySelector('header')||{}).innerText||''`)) || "";
  const links = await scrollGrid(tab, { maxScrolls, links: LINKS, px: () => 800 + Math.random() * 500,
    onLinks: ([h, txt]) => { const c = codeOf(h); if (c && txt) gridText[c] = txt; },
    every: (i, n) => i % 10 === 0 && log(user, path || "grid", "scroll", i, "links", n, "429s", tab.s429),
    stop: () => tab.s429 > 2 && (log("429 -> stop"), true) });
  log(path || "grid", "done links", links.length);
}
const posts = {}; let profile = { header };
walkBodies([...bodies, ...pages], o => {
  if (o.username === user && (o.follower_count || o.edge_followed_by)) profile = { ...profile, followers: o.follower_count ?? o.edge_followed_by?.count, following: o.following_count, bio: o.biography, external: o.external_url ?? o.bio_links?.map(b => b.url), bio_links: o.bio_links, full_name: o.full_name, category: o.category_name, media_count: o.media_count, pk: o.pk ?? o.id };
  if (o.code && "taken_at" in o && o.user?.username === user) posts[o.code] = mergePost(posts[o.code], o, { capLen: 2000, size: true });
});
for (const c of Object.keys(posts)) if (gridText[c]) posts[c].grid = gridText[c];
for (const c of Object.keys(gridText)) if (!posts[c]) posts[c] = { code: c, grid: gridText[c] };
const list = Object.values(posts).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
fs.writeFileSync(out("profiles", `${user}_full.json`), JSON.stringify({ user, profile, status429: tab.s429, posts: list }, null, 1));
log(user, "followers", profile.followers, "media", profile.media_count, "posts captured", list.length, "429s", tab.s429);
await tab.done();
