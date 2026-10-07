// usage: node ig-search.mjs "<query>" [scrolls=6]  -> igdisc/search/<slug>.json  (keyword search page, human pace; "#tag" opens the tag page)
import fs from "fs";
import { open, out, die, walkBodies } from "../lib/cdp.mjs";
import { API, GRID_LINKS, codeOf, ssrJson, playsOf } from "../lib/ig.mjs";

const [q, sc] = process.argv.slice(2); const scrolls = Number(sc ?? 6);
if (!q) die('usage: node ig-search.mjs "<query>" [scrolls=6]');
const slug = q.replace(/[^\w]+/g, "_").toLowerCase();
const dir = out("igdisc", "search"); fs.mkdirSync(dir, { recursive: true });
const tab = await open("instagram.com");
const bodies = await tab.capture(API);
const url = q.startsWith("#") ? `https://www.instagram.com/explore/tags/${encodeURIComponent(q.slice(1))}/` : `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(q)}`;
await tab.goto(url);
const pages = await ssrJson(tab, "taken_at");
const links = new Set();
for (let i = 0; i < scrolls; i++) {
  ((await tab.eval(GRID_LINKS)) || []).forEach(h => links.add(h));
  if (tab.s429) break;
  await tab.scroll(700 + Math.random() * 600, { min: 2000 + Math.random() * 2000 });
}
const posts = {};
walkBodies([...bodies, ...pages], o => {
  if (!(o.code && "taken_at" in o && o.user?.username)) return;
  const pv = posts[o.code] || {};
  posts[o.code] = { code: o.code, user: o.user.username, fol: o.user.follower_count ?? pv.fol, date: new Date(o.taken_at * 1000).toISOString().slice(0, 10),
    type: o.product_type || o.media_type, likes: o.like_count ?? pv.likes, comments: o.comment_count ?? pv.comments,
    plays: playsOf(o) ?? pv.plays ?? null, dur: o.video_duration ?? pv.dur ?? null,
    cap: (o.caption?.text ?? pv.cap ?? "").replace(/\s+/g, " ").slice(0, 300) };
});
for (const h of links) { const c = codeOf(h); if (c && !posts[c]) posts[c] = { code: c, href: h }; }
const list = Object.values(posts);
fs.writeFileSync(`${dir}/${slug}.json`, JSON.stringify({ q, url, s429: tab.s429, n: list.length, posts: list }, null, 1));
console.log(`q="${q}" posts=${list.length} 429=${tab.s429}`);
for (const x of list.sort((a, b) => (b.likes || 0) - (a.likes || 0))) console.log(`${x.code}\t@${x.user || "?"}\t${x.date || ""}\tL${x.likes ?? "?"}\tP${x.plays ?? "?"}\t${x.dur ? Math.round(x.dur) + "s" : ""}\t${(x.cap || x.href || "").slice(0, 140)}`);
await tab.done();
