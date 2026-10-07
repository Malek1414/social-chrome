// Photo (carousel) posts: open the post in the TikTok tab, read image URLs from the data the page loaded, save slides + sheet.
// usage: node tt-photo.mjs <author> <id>  -> tiktok/<id>/frames/f_*.jpg, sheet_1.jpg, meta.json
import fs from "fs"; import { execFileSync } from "child_process";
const [author, vid] = process.argv.slice(2);
const dir = `${process.env.HOME}/Desktop/social-chrome/tiktok/${vid}`; fs.mkdirSync(`${dir}/frames`, { recursive: true });
const tabs = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = tabs.find(x => x.type === "page" && x.url.includes("tiktok.com"));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = {}; const reqs = {}; const bodies = [];
const send = (m, params = {}) => new Promise(r => { p[++id] = r; ws.send(JSON.stringify({ id, method: m, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
ws.onmessage = async e => { const m = JSON.parse(e.data); if (p[m.id]) return p[m.id](m.result ?? m.error);
  if (m.method === "Network.responseReceived" && /\/api\/(item\/detail|related|post)/.test(m.params.response.url)) reqs[m.params.requestId] = 1;
  if (m.method === "Network.loadingFinished" && reqs[m.params.requestId]) { const b = await send("Network.getResponseBody", { requestId: m.params.requestId }); if (b?.body) bodies.push(b.body); } };
await new Promise(r => (ws.onopen = r)); await send("Network.enable");
await send("Page.navigate", { url: `https://www.tiktok.com/@${author}/photo/${vid}` }); await sleep(7000);
const captcha = (await send("Runtime.evaluate", { expression: `!!document.querySelector('[id*=captcha],[class*=captcha-]') || /verify to continue|drag the slider/i.test(document.body.innerText)`, returnByValue: true })).result.value;
if (captcha) { console.log("CAPTCHA"); process.exit(2); }
const ssr = (await send("Runtime.evaluate", { expression: `document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__')?.textContent || ''`, returnByValue: true })).result.value;
let item = null;
const walk = o => { if (item || !o || typeof o !== "object") return; if (o.id === vid && o.imagePost) { item = o; return; } Object.values(o).forEach(walk); };
for (const b of [ssr, ...bodies]) { try { walk(JSON.parse(b)); } catch {} }
if (!item) { console.log("NO_ITEM " + vid); process.exit(1); }
const imgs = item.imagePost.images.map(i => i.imageURL?.urlList?.[0]).filter(Boolean);
let n = 0; const times = [];
for (const u of imgs) { const r = await fetch(u); const buf = Buffer.from(await r.arrayBuffer());
  const f = `${dir}/frames/raw_${n}`; fs.writeFileSync(f, buf);
  execFileSync("sips", ["-s", "format", "jpeg", "-Z", "720", f, "--out", `${dir}/frames/f_${String(n).padStart(4, "0")}.jpg`], { stdio: "ignore" }); fs.unlinkSync(f);
  times.push(`slide ${n + 1}`); n++; await sleep(400); }
fs.writeFileSync(`${dir}/frames/times.txt`, times.join("\n"));
fs.writeFileSync(`${dir}/meta.json`, JSON.stringify({ id: vid, author, desc: item.desc, title: item.imagePost.title, slides: n, music: item.music?.title + " - " + item.music?.authorName }, null, 1));
execFileSync("python3", [`${process.env.HOME}/Desktop/social-chrome/tt-sheet.py`, dir]);
console.log(`OK photo ${vid} slides=${n}`); ws.close(); setTimeout(() => process.exit(0), 300);
