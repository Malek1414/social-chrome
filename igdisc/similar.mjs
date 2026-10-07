// usage: node similar.mjs <user> -> igdisc/similar/<user>.json : accounts IG suggests as similar (click "Similar accounts" chevron like a human)
import fs from "fs";
import { open, out, die, walkBodies } from "../lib/cdp.mjs";
import { API } from "../lib/ig.mjs";

const user = process.argv[2];
if (!user) die("usage: node similar.mjs <user>");
const dir = out("igdisc", "similar"); fs.mkdirSync(dir, { recursive: true });
const tab = await open("instagram.com");
const bodies = await tab.capture(API);
await tab.goto(`https://www.instagram.com/${user}/`);
const n0 = bodies.length;
const clicked = await tab.eval(`(() => { const svg = [...document.querySelectorAll('header svg')].find(s => /similar|suggested|ähnliche|vorgeschlagen/i.test(s.getAttribute('aria-label')||''));
  const b = svg?.closest('div[role=button],button'); if (b) { b.click(); return true; } return false; })()`);
await tab.settle({ min: 4000 + Math.random() * 2000, max: 8000 });
// read visible suggestion cards too
const cards = await tab.eval(`[...document.querySelectorAll('header ~ * a[href^="/"], section a[href^="/"]')].map(a=>a.getAttribute('href')).filter(h=>/^\\/[\\w.]+\\/$/.test(h)).slice(0,80)`);
const users = {};
walkBodies(bodies.slice(n0), o => {
  if (o.username && o.username !== user && o.full_name !== undefined && (o.pk || o.id))
    users[o.username] = { username: o.username, full_name: o.full_name, followers: o.follower_count ?? users[o.username]?.followers ?? null, verified: o.is_verified, social_context: o.social_context ?? null };
});
fs.writeFileSync(`${dir}/${user}.json`, JSON.stringify({ user, clicked, s429: tab.s429, users: Object.values(users), cards }, null, 1));
console.log(user, "clicked", clicked, "suggested", Object.keys(users).length, "429", tab.s429, "|", Object.keys(users).join(" "));
await tab.done();
