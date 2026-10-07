// Like saved-scan.mjs but: high scroll cap, writes saved_full.json, then scans named collections -> collections.json
// usage: node saved-scan-full.mjs <user> [scrolls=200]
import fs from "fs";
import { open, out, die, log, pause, walkBodies } from "./lib/cdp.mjs";
import { API, codeOf, scrollGrid, savedRecord } from "./lib/ig.mjs";

const [user, scrollsArg] = process.argv.slice(2);
if (!user) die("usage: node saved-scan-full.mjs <user> [scrolls=200]");
const tab = await open("instagram.com");
const bodies = await tab.capture(API);
async function scrollCollect(url, maxScrolls) {
  await tab.goto(url);
  const name = url.split("/saved/")[1];
  const links = await scrollGrid(tab, { maxScrolls, every: (i, n) => i % 10 === 0 && log(name, "scroll", i, "found", n) });
  return links.map(codeOf).filter(Boolean);
}
// 1) all posts
const allCodes = await scrollCollect(`https://www.instagram.com/${user}/saved/all-posts/`, Number(scrollsArg ?? 200));
log("all-posts codes", allCodes.length);
// 2) collections
await tab.goto(`https://www.instagram.com/${user}/saved/`);
const cols = await tab.eval(`[...document.querySelectorAll('a[href*="/saved/"]')].map(a => ({href: a.getAttribute('href'), text: a.innerText.trim()})).filter(x => !/all-posts|audio/.test(x.href) && /\\/saved\\/[^/]+\\/\\d+/.test(x.href))`);
log("collections", JSON.stringify(cols));
const collections = [];
for (const c of cols || []) {
  await pause(3000, 2000);
  const codes = await scrollCollect("https://www.instagram.com" + c.href, 60);
  collections.push({ name: c.text || c.href.split("/")[3], href: c.href, count: codes.length, codes });
  log("collection", c.text, codes.length);
}
const items = {};
walkBodies(bodies, o => { if (o.code && "taken_at" in o && o.user?.username) items[o.code] = savedRecord(o, 1500); });
const res = allCodes.map(c => items[c] ?? { code: c });
fs.writeFileSync(out("saved_full.json"), JSON.stringify(res, null, 1));
fs.writeFileSync(out("collections.json"), JSON.stringify(collections.map(c => ({ ...c, posts: c.codes.map(k => items[k] ?? { code: k }) })), null, 1));
log(`saved posts found: ${res.length}, with metadata: ${res.filter(x => x.author).length}; collections: ${collections.length}`);
await tab.done();
