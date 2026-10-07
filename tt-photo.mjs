// Photo (carousel) posts: open the post in the TikTok tab, read image URLs from the data the page loaded, save slides + sheet.
// usage: node tt-photo.mjs <author> <id>  -> tiktok/<id>/frames/f_*.jpg, sheet_1.jpg, meta.json      exit 2 = captcha
import fs from "fs"; import path from "path"; import { execFileSync } from "child_process";
import { open, out, die, pause, walkBodies, EXIT, ROOT } from "./lib/cdp.mjs";
import { captcha, ssr } from "./lib/tt.mjs";

const [author, vid] = process.argv.slice(2);
if (!vid) die("usage: node tt-photo.mjs <author> <id>");
const dir = out("tiktok", vid); fs.mkdirSync(`${dir}/frames`, { recursive: true });
const tab = await open("tiktok.com");
const bodies = await tab.capture(/\/api\/(item\/detail|related|post)/);
await tab.goto(`https://www.tiktok.com/@${author}/photo/${vid}`);
if (await captcha(tab)) { console.log("CAPTCHA"); await tab.done(EXIT.WALL); }
let item = null;
walkBodies([await ssr(tab), ...bodies], o => { if (item) return true; if (o.id === vid && o.imagePost) { item = o; return true; } });
if (!item) { console.log("NO_ITEM " + vid); await tab.done(EXIT.FAIL); }
const imgs = item.imagePost.images.map(i => i.imageURL?.urlList?.[0]).filter(Boolean);
let n = 0; const times = [];
for (const u of imgs) {
  const r = await fetch(u); if (!r.ok) continue;
  const f = `${dir}/frames/raw_${n}`; fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  execFileSync("sips", ["-s", "format", "jpeg", "-Z", "720", f, "--out", `${dir}/frames/f_${String(n).padStart(4, "0")}.jpg`], { stdio: "ignore" }); fs.unlinkSync(f);
  times.push(`slide ${n + 1}`); n++; await pause(400);
}
fs.writeFileSync(`${dir}/frames/times.txt`, times.join("\n"));
fs.writeFileSync(`${dir}/meta.json`, JSON.stringify({ id: vid, author, desc: item.desc, title: item.imagePost.title, slides: n, music: item.music?.title + " - " + item.music?.authorName }, null, 1));
execFileSync("python3", [path.join(ROOT, "tt-sheet.py"), dir]);
console.log(`OK photo ${vid} slides=${n}`);
await tab.done();
