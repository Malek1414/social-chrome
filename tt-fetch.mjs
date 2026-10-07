// Opens a TikTok video page in the TikTok tab (like a viewer) and fetches its media from INSIDE the page,
// so cookies never leave the browser. Writes tiktok/<id>/video.mp4 and meta.json.
// usage: node tt-fetch.mjs <author> <id>    exit 2 = captcha, 1 = failed
import fs from "fs";
const [author, vid] = process.argv.slice(2);
const dir = `${process.env.HOME}/Desktop/social-chrome/tiktok/${vid}`; fs.mkdirSync(dir, { recursive: true });
const tabs = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = tabs.find(x => x.type === "page" && x.url.includes("tiktok.com"));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = {};
const send = (m, params = {}) => new Promise(r => { p[++id] = r; ws.send(JSON.stringify({ id, method: m, params })); });
const creqs = {}; const comments = [];
ws.onmessage = async e => { const m = JSON.parse(e.data); if (p[m.id]) return p[m.id](m.result ?? m.error);
  if (m.method === "Network.responseReceived" && /\/api\/comment\/list/.test(m.params.response.url)) creqs[m.params.requestId] = 1;
  if (m.method === "Network.loadingFinished" && creqs[m.params.requestId]) { const b = await send("Network.getResponseBody", { requestId: m.params.requestId });
    try { for (const c of JSON.parse(b.body).comments || []) comments.push({ text: c.text, likes: c.digg_count, replies: c.reply_comment_total, byAuthor: c.is_author_digged }); } catch {} } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = async x => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }))?.result?.value;
await new Promise(r => (ws.onopen = r)); await send("Network.enable");
await send("Page.navigate", { url: `https://www.tiktok.com/@${author}/video/${vid}` }); await sleep(6000 + Math.random() * 2000);
await ev(`document.querySelector("[data-e2e=comment-icon]")?.closest("button")?.click() ?? document.querySelector("[data-e2e=comment-icon]")?.click()`); await sleep(3500 + Math.random() * 1500);
if (await ev(`!!document.querySelector('[id*=captcha],[class*=captcha-]') || /verify to continue|drag the slider/i.test(document.body.innerText)`)) { console.log("CAPTCHA"); process.exit(2); }
const GET = `(async () => {
  let item = null; const walk = o => { if (item || !o || typeof o !== 'object') return; if (o.id === '${vid}' && o.video) { item = o; return; } for (const v of Object.values(o)) walk(v); };
  try { walk(JSON.parse(document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__')?.textContent || '{}')); } catch {}
  const cands = [];
  if (item) { const v = item.video; (v.bitrateInfo || []).sort((a,b)=>Math.abs(a.Bitrate-1200000)-Math.abs(b.Bitrate-1200000)).forEach(b => (b.PlayAddr?.UrlList||[]).forEach(u => cands.push(u)));
    if (v.playAddr) cands.unshift(v.playAddr); if (v.downloadAddr) cands.push(v.downloadAddr); }
  const vel = [...document.querySelectorAll('video')].map(v => v.currentSrc || v.src).filter(s => s && !s.startsWith('blob:'));
  cands.unshift(...vel);
  for (const u of cands) { try { const r = await fetch(u, { credentials: 'include' }); if (!r.ok) continue;
      const buf = await r.arrayBuffer(); if (buf.byteLength < 20000) continue; window.__ttbuf = new Uint8Array(buf);
      return { ok: true, size: buf.byteLength, from: u.slice(0, 60) }; } catch (e) { } }
  return { ok: false, n: cands.length, haveItem: !!item };
})()`;
let info = await ev(GET);
if (!info?.ok) { await sleep(3000); await send("Page.reload", {}); await sleep(8000 + Math.random() * 2000); info = await ev(GET); }
if (!info?.ok) { console.log("FETCH_FAIL " + vid + " " + JSON.stringify(info)); process.exit(1); }
const chunks = []; const CH = 3 * 1024 * 1024;
for (let off = 0; off < info.size; off += CH) {
  const b64 = await ev(`(() => { const a = window.__ttbuf.subarray(${off}, ${off + CH}); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); })()`);
  chunks.push(Buffer.from(b64, "base64")); }
await ev("delete window.__ttbuf");
fs.writeFileSync(`${dir}/video.mp4`, Buffer.concat(chunks));
if (comments.length) fs.writeFileSync(`${dir}/comments.json`, JSON.stringify(comments.sort((a, b) => b.likes - a.likes), null, 1));
console.log(`FETCHED ${vid} ${(info.size / 1e6).toFixed(1)}MB`); ws.close(); setTimeout(() => process.exit(0), 300);
