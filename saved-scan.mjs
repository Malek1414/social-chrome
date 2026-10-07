// Lists everything in your Instagram "Saved" (all posts) using the data the page itself loads.
// usage: node saved-scan.mjs <your-username> [scrolls=15]   -> saved.json
import fs from "fs";
import { open, out, die, walkBodies } from "./lib/cdp.mjs";
import { API, codeOf, scrollGrid, savedRecord } from "./lib/ig.mjs";

const [user, scrollsArg] = process.argv.slice(2);
if (!user) die("usage: node saved-scan.mjs <your-username> [scrolls=15]");
const tab = await open("instagram.com");
const bodies = await tab.capture(API);
await tab.goto(`https://www.instagram.com/${user}/saved/all-posts/`);
const links = await scrollGrid(tab, { maxScrolls: Number(scrollsArg ?? 15), patience: 4, px: () => 1800 });
const items = {};
walkBodies(bodies, o => { if (o.code && "taken_at" in o && o.user?.username) items[o.code] = savedRecord(o); });
const codes = links.map(codeOf).filter(Boolean);
const res = codes.map(c => items[c] ?? { code: c });
fs.writeFileSync(out("saved.json"), JSON.stringify(res, null, 1));
console.log(`saved posts found: ${codes.length}, with metadata: ${res.filter(x => x.author).length}`);
await tab.done();
