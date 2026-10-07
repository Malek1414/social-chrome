// Visit a profile like a normal user and record the API responses the page itself receives.
// usage: node igcapture.mjs <username>   -> cap_<username>.json (parsed by igparse.py, see ig-profile.sh)
import fs from "fs";
import { open, out, die } from "./lib/cdp.mjs";
import { API } from "./lib/ig.mjs";

const user = process.argv[2];
if (!user) die("usage: node igcapture.mjs <username>");
const tab = await open("instagram.com");
const bodies = await tab.capture(API);
await tab.goto(`https://www.instagram.com/${user}/`);
for (let i = 0; i < 2; i++) await tab.scroll(1500, { min: 3500 });
fs.writeFileSync(out(`cap_${user}.json`), JSON.stringify(bodies.map(({ url, status, body }) => ({ url, status, body }))));
console.log(bodies.map(o => `${o.status} ${o.url.slice(0, 110)} ${(o.body || "").length}b`).join("\n"));
await tab.done();
