// usage: node profile-scan.mjs <user> [scrolls=6] -> profiles/<user>.json (profile info + posts the page loads, reels tab)
import fs from "fs";
import { open, out, die, walkBodies } from "./lib/cdp.mjs";
import { API, ssrJson, mergePost } from "./lib/ig.mjs";

const [user, sc] = process.argv.slice(2); const scrolls = Number(sc ?? 6);
if (!user) die("usage: node profile-scan.mjs <user> [scrolls=6]");
fs.mkdirSync(out("profiles"), { recursive: true });
const tab = await open("instagram.com");
const bodies = await tab.capture(API);
const pages = []; let header = "";
for (const path of ["", "reels/"]) {
  await tab.goto(`https://www.instagram.com/${user}/${path}`);
  pages.push(...await ssrJson(tab, "taken_at", "follower"));
  if (!path) header = (await tab.eval(`(document.querySelector('header')||{}).innerText||''`)) || "";
  for (let i = 0; i < scrolls; i++) await tab.scroll(900 + Math.random() * 500, { min: 2500 + Math.random() * 2000 });
}
const posts = {}; let profile = { header };
walkBodies([...bodies, ...pages], o => {
  if (o.username === user && (o.follower_count || o.edge_followed_by)) profile = { ...profile, followers: o.follower_count ?? o.edge_followed_by?.count, bio: o.biography, external: o.external_url ?? o.bio_links?.map(b => b.url), full_name: o.full_name, category: o.category_name, media_count: o.media_count };
  if (o.code && "taken_at" in o && o.user?.username === user) posts[o.code] = mergePost(posts[o.code], o);
});
const list = Object.values(posts).sort((a, b) => b.date.localeCompare(a.date));
fs.writeFileSync(out("profiles", `${user}.json`), JSON.stringify({ user, profile, posts: list }, null, 1));
console.log(user, "followers", profile.followers, "posts", list.length);
await tab.done();
