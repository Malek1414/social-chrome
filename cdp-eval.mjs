// Evaluate JS in a Social Chrome tab and print the result.
// usage: node cdp-eval.mjs <url-substring> "<js expression>"     e.g. node cdp-eval.mjs tiktok.com "document.title"
import { open, die, BASE } from "./lib/cdp.mjs";

const [match, expr] = process.argv.slice(2);
if (!expr) die('usage: node cdp-eval.mjs <url-substring> "<js expression>"');
const tabs = await (await fetch(`${BASE}/json/list`).catch(() => die(`Social Chrome is not reachable on ${BASE}. Start it with ./launch.sh`))).json();
const t = tabs.find(x => x.type === "page" && x.url.includes(match));
if (!t) die("no tab");
const tab = await open(null, { id: t.id });
console.log(JSON.stringify(await tab.eval(expr), null, 1));
await tab.done();
