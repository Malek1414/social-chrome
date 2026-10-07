// Reel watcher: opens an Instagram reel/post in Social Chrome, steps through the video
// frame by frame, and saves frames + a contact sheet + metadata so Claude can "watch" it.
//
// usage: node reel-watch.mjs <reel-url-or-code> [intervalSec=1] [maxFrames=30]
// output: ~/Desktop/social-chrome/reels/<code>/{f_000.jpg..., sheet.jpg, meta.json}
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const [arg, intervalArg, maxArg] = process.argv.slice(2);
if (!arg) { console.error("usage: node reel-watch.mjs <reel-url-or-code> [intervalSec] [maxFrames]"); process.exit(1); }
const code = arg.match(/(?:reels?|p)\/([\w-]+)/)?.[1] ?? arg;
const url = `https://www.instagram.com/reel/${code}/`;
const interval = Number(intervalArg ?? 1);
const maxFrames = Number(maxArg ?? 30);
const outDir = path.join(path.dirname(new URL(import.meta.url).pathname), "reels", code);
fs.mkdirSync(outDir, { recursive: true });

const tabs = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const tab = tabs.find(t => t.type === "page" && t.url.includes("instagram.com"));
if (!tab) { console.error("No Instagram tab open in Social Chrome."); process.exit(1); }

const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0; const pending = {}; const reqs = {}; const bodies = [];
const send = (method, params = {}) => new Promise(r => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evaluate = async expr => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }))?.result?.value;

ws.onmessage = async e => {
  const m = JSON.parse(e.data);
  if (pending[m.id]) return pending[m.id](m.result ?? m.error);
  if (m.method === "Network.responseReceived" && /graphql|\/api\/v1\//.test(m.params.response.url)) reqs[m.params.requestId] = true;
  if (m.method === "Network.loadingFinished" && reqs[m.params.requestId]) {
    const b = await send("Network.getResponseBody", { requestId: m.params.requestId });
    if (b?.body) bodies.push(b.body);
  }
};
await new Promise(r => (ws.onopen = r));
await send("Network.enable");
await send("Page.navigate", { url });
await sleep(6000);

// Metadata from the responses the page itself received
let meta = { code, url };
const walk = o => {
  if (Array.isArray(o)) return o.forEach(walk);
  if (!o || typeof o !== "object") return;
  if (o.code === code && "taken_at" in o) {
    meta = { ...meta,
      author: o.user?.username, date: new Date(o.taken_at * 1000).toISOString().slice(0, 10),
      likes: o.like_count, comments: o.comment_count, plays: o.play_count ?? o.ig_play_count ?? o.view_count ?? null,
      duration: o.video_duration ?? null, caption: o.caption?.text ?? "", music: o.clips_metadata?.music_info?.music_asset_info?.title ?? o.clips_metadata?.original_sound_info?.original_audio_title ?? null };
  }
  Object.values(o).forEach(walk);
};
for (const b of bodies) for (const line of b.split("\n")) { try { walk(JSON.parse(line)); } catch {} }
if (!meta.author) {
  // Fallback: read what the page shows (author, caption, counts)
  meta.pageText = await evaluate(`(() => { const a = document.querySelector('article') || document.querySelector('main');
    return (a?.innerText || '').replace(/\\n+/g, ' | ').slice(0, 1200); })()`);
}

// Pick the main video, pause it, step through it
const setup = await evaluate(`(() => {
  const vids = [...document.querySelectorAll('video')].map(v => ({ v, r: v.getBoundingClientRect() }))
    .filter(x => x.r.width > 100 && x.r.bottom > 0 && x.r.top < innerHeight)
    .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height);
  if (!vids.length) return null;
  window.__rw = vids[0].v; __rw.muted = true; __rw.pause();
  const r = vids[0].r; return { x: r.x, y: r.y, w: r.width, h: r.height, duration: __rw.duration };
})()`);

if (!setup) {
  // Photo / carousel post: just screenshot what's visible
  const s = await send("Page.captureScreenshot", { format: "jpeg", quality: 70 });
  fs.writeFileSync(path.join(outDir, "f_000.jpg"), Buffer.from(s.data, "base64"));
  meta.type = "image";
} else {
  meta.type = "video"; meta.duration ??= setup.duration;
  const dur = Number.isFinite(setup.duration) ? setup.duration : (meta.duration || 30);
  const step = Math.max(interval, dur / maxFrames);
  let i = 0;
  for (let t = 0.05; t < dur && i < maxFrames; t += step, i++) {
    await evaluate(`new Promise(res => { const v = window.__rw; const done = () => res(true);
      v.addEventListener('seeked', done, { once: true }); v.currentTime = ${t}; setTimeout(done, 1200); })`);
    await sleep(150);
    const s = await send("Page.captureScreenshot", { format: "jpeg", quality: 70,
      clip: { x: setup.x, y: setup.y, width: setup.w, height: setup.h, scale: 0.6 } });
    fs.writeFileSync(path.join(outDir, `f_${String(i).padStart(3, "0")}.jpg`), Buffer.from(s.data, "base64"));
  }
  meta.frames = i; meta.stepSec = Number(step.toFixed(2));
  await send("Runtime.evaluate", { expression: "void window.__rw.play()" });
}
ws.close();
setTimeout(() => process.exit(0), 3000).unref?.();

fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2));
execFileSync("python3", [path.join(path.dirname(outDir), "..", "contact-sheet.py"), outDir, String(meta.stepSec ?? 0)]);
console.log(JSON.stringify({ ...meta, caption: meta.caption?.slice(0, 300), sheet: path.join(outDir, "sheet.jpg") }, null, 2));
