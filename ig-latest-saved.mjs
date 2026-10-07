// Opens IG Saved in a NEW tab (leaves other tabs alone), reads the most recently saved posts from the data the page loads.
// usage: node ig-latest-saved.mjs <username> [n=3]  -> prints JSON of the newest n saved items
import { open, die, walkBodies, isoDate } from "./lib/cdp.mjs";
import { API, codeOf, GRID_LINKS } from "./lib/ig.mjs";

const [user, nArg] = process.argv.slice(2); const N = Number(nArg ?? 3);
if (!user) die("usage: node ig-latest-saved.mjs <username> [n=3]");
const tab = await open("instagram.com", { fresh: true });
const bodies = await tab.capture(API);
await tab.goto(`https://www.instagram.com/${user}/saved/all-posts/`, { min: 4000 });
const links = ((await tab.eval(GRID_LINKS)) || []).slice(0, N);
const items = {};
walkBodies(bodies, o => { if (o.code && "taken_at" in o && o.user?.username) items[o.code] = { code: o.code, url: `https://www.instagram.com/p/${o.code}/`, author: o.user.username,
  date: isoDate(o.taken_at), type: o.product_type || o.media_type, likes: o.like_count, comments: o.comment_count,
  plays: o.play_count ?? o.ig_play_count ?? null, duration: o.video_duration ?? null, caption: o.caption?.text || "" }; });
const res = links.map(h => items[codeOf(h)] ?? { code: codeOf(h), url: `https://www.instagram.com${h}` });
console.log(JSON.stringify({ tabId: tab.id, items: res }, null, 1));
tab.owned = false; // leave the tab open: its id is for `node ig-fetch.mjs <tabId> <code>`
await tab.done();
