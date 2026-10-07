// Fetches an IG reel's media from INSIDE a page (cookies never leave the browser), in the given tab.
// usage: node ig-fetch.mjs <tabId> <code>  -> reels/<code>/video.mp4
import fs from "fs";
const [tabId, code] = process.argv.slice(2);
const dir = `${process.env.HOME}/Desktop/social-chrome/reels/${code}`; fs.mkdirSync(dir, { recursive: true });
const tabs = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = tabs.find(x => x.id === tabId);
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = {}; const reqs = {}; const bodies = [];
const send = (m, params = {}) => new Promise(r => { p[++id] = r; ws.send(JSON.stringify({ id, method: m, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = async x => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }))?.result?.value;
ws.onmessage = async e => { const m = JSON.parse(e.data); if (p[m.id]) return p[m.id](m.result ?? m.error);
  if (m.method === "Network.responseReceived" && /graphql|\/api\/v1\//.test(m.params.response.url)) reqs[m.params.requestId] = 1;
  if (m.method === "Network.loadingFinished" && reqs[m.params.requestId]) { const b = await send("Network.getResponseBody", { requestId: m.params.requestId }); if (b?.body) bodies.push(b.body); } };
await new Promise(r => (ws.onopen = r)); await send("Network.enable");
await send("Page.navigate", { url: `https://www.instagram.com/reel/${code}/` }); await sleep(8000);
let urls = [];
const walk = o => { if (Array.isArray(o)) return o.forEach(walk); if (!o || typeof o !== "object") return;
  if (o.code === code && o.video_versions) urls.push(...o.video_versions.map(v => v.url)); Object.values(o).forEach(walk); };
for (const b of bodies) for (const line of b.split("\n")) { try { walk(JSON.parse(line)); } catch {} }
if (!urls.length) { const html = await ev("document.documentElement.innerHTML"); for (const m of html.matchAll(/"video_versions":(\[.*?\])/g)) { try { urls.push(...JSON.parse(m[1]).map(v => v.url)); } catch {} } }
const info = await ev(`(async () => { for (const u of ${JSON.stringify(urls)}) { try { const r = await fetch(u); if (!r.ok) continue; const b = await r.arrayBuffer(); if (b.byteLength < 20000) continue; window.__igbuf = new Uint8Array(b); return { ok: true, size: b.byteLength }; } catch {} } return { ok: false, n: ${urls.length} }; })()`);
if (!info?.ok) { console.log("FETCH_FAIL", JSON.stringify(info)); process.exit(1); }
const chunks = []; const CH = 3 * 1024 * 1024;
for (let off = 0; off < info.size; off += CH) chunks.push(Buffer.from(await ev(`(() => { const a = window.__igbuf.subarray(${off}, ${off + CH}); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); })()`), "base64"));
await ev("delete window.__igbuf");
fs.writeFileSync(`${dir}/video.mp4`, Buffer.concat(chunks)); console.log(`FETCHED ${code} ${(info.size / 1e6).toFixed(1)}MB`);
ws.close(); setTimeout(() => process.exit(0), 300);
