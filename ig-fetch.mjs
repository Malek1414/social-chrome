// Fetches an IG reel's media from INSIDE a page (cookies never leave the browser), in the given tab.
// usage: node ig-fetch.mjs <tabId> <code>  -> reels/<code>/video.mp4
import fs from "fs";
import { open, out, die, EXIT } from "./lib/cdp.mjs";
import { API, ssrJson, mediaFor, postReady } from "./lib/ig.mjs";

const [tabId, code] = process.argv.slice(2);
if (!code) die("usage: node ig-fetch.mjs <tabId> <code>");
const dir = out("reels", code); fs.mkdirSync(dir, { recursive: true });
const tab = await open(null, { id: tabId });
const bodies = await tab.capture(API);
const sources = async () => [...bodies, ...await ssrJson(tab, code)];
const urlsOf = async () => mediaFor(code, await sources()).flatMap(o => (o.video_versions || []).map(v => v.url));
await tab.goto(`https://www.instagram.com/reel/${code}/`, { until: postReady(tab, bodies, code, "video_versions") });
const urls = await urlsOf();
const got = await tab.fetchInPage(urls, { minBytes: 20000 });
if (!got) { console.log("FETCH_FAIL", JSON.stringify({ ok: false, n: urls.length })); await tab.done(EXIT.FAIL); }
fs.writeFileSync(`${dir}/video.mp4`, got.buf); console.log(`FETCHED ${code} ${(got.buf.length / 1e6).toFixed(1)}MB`);
await tab.done();
