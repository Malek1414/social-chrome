// Reel watcher: opens an Instagram reel/post in Social Chrome, steps through the video
// frame by frame, and saves frames + a contact sheet + metadata so Claude can "watch" it.
//
// usage: node reel-watch.mjs <reel-url-or-code> [intervalSec=1] [maxFrames=30]
// output: ~/Desktop/social-chrome/reels/<code>/{f_000.jpg..., sheet.jpg, meta.json (merged into any existing one)}
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { open, out, die, sleep, isoDate, mergeJson, ROOT } from "./lib/cdp.mjs";
import { API, codeOf, ssrJson, mediaFor, pick, playsOf, musicOf, postReady } from "./lib/ig.mjs";

const [arg, intervalArg, maxArg] = process.argv.slice(2);
if (!arg) die("usage: node reel-watch.mjs <reel-url-or-code> [intervalSec] [maxFrames]");
const code = codeOf(arg) ?? arg;
const url = `https://www.instagram.com/reel/${code}/`;
const interval = Number(intervalArg ?? 1);
const maxFrames = Number(maxArg ?? 30);
const outDir = out("reels", code);
fs.mkdirSync(outDir, { recursive: true });

const tab = await open("instagram.com");
const bodies = await tab.capture(API);
// The post is in the server-rendered JSON once the page has loaded, or in a later GraphQL response; stop waiting at the first.
const sources = async () => [...bodies, ...await ssrJson(tab, code)];
const ready = postReady(tab, bodies, code, "taken_at");
await tab.goto(url, { until: async () => await ready() && await tab.eval("[...document.querySelectorAll('video')].some(v => v.getBoundingClientRect().width > 100)") });

// Metadata from the responses the page received plus the JSON it was server-rendered with
const copies = mediaFor(code, await sources()).filter(o => o.taken_at);
let meta = { code, url };
if (copies.length) {
  const o = copies[0];
  meta = { ...meta, author: pick(copies, c => c.user?.username), date: isoDate(o.taken_at),
    likes: pick(copies, c => c.like_count), comments: pick(copies, c => c.comment_count), plays: pick(copies, playsOf),
    duration: pick(copies, c => c.video_duration), caption: pick(copies, c => c.caption?.text) ?? "", music: pick(copies, musicOf) };
} else {
  // Fallback: read what the page shows (author, caption, counts)
  meta.pageText = await tab.eval(`(() => { const a = document.querySelector('article') || document.querySelector('main');
    return (a?.innerText || '').replace(/\\n+/g, ' | ').slice(0, 1200); })()`);
}

// Pick the main video, pause it, step through it
const setup = await tab.eval(`(() => {
  const vids = [...document.querySelectorAll('video')].map(v => ({ v, r: v.getBoundingClientRect() }))
    .filter(x => x.r.width > 100 && x.r.bottom > 0 && x.r.top < innerHeight)
    .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height);
  if (!vids.length) return null;
  window.__rw = vids[0].v; __rw.muted = true; __rw.pause();
  const r = vids[0].r; return { x: r.x, y: r.y, w: r.width, h: r.height, duration: __rw.duration };
})()`);

if (!setup) {
  // Photo / carousel post: just screenshot what's visible
  const s = await tab.send("Page.captureScreenshot", { format: "jpeg", quality: 70 });
  fs.writeFileSync(path.join(outDir, "f_000.jpg"), Buffer.from(s.data, "base64"));
  meta.type = "image";
} else {
  meta.type = "video"; meta.duration ??= setup.duration;
  for (const f of fs.readdirSync(outDir)) if (/^f_\d+\.jpg$/.test(f)) fs.unlinkSync(path.join(outDir, f)); // no stale frames from a longer earlier run
  const dur = Number.isFinite(setup.duration) ? setup.duration : (meta.duration || 30);
  const step = Math.max(interval, dur / maxFrames);
  let i = 0;
  for (let t = 0.05; t < dur && i < maxFrames; t += step, i++) {
    await tab.eval(`new Promise(res => { const v = window.__rw; const done = () => res(true);
      v.addEventListener('seeked', done, { once: true }); v.currentTime = ${t}; setTimeout(done, 1200); })`);
    await sleep(150);
    const s = await tab.send("Page.captureScreenshot", { format: "jpeg", quality: 70,
      clip: { x: setup.x, y: setup.y, width: setup.w, height: setup.h, scale: 0.6 } });
    fs.writeFileSync(path.join(outDir, `f_${String(i).padStart(3, "0")}.jpg`), Buffer.from(s.data, "base64"));
  }
  meta.frames = i; meta.stepSec = Number(step.toFixed(2));
  await tab.eval("void window.__rw.play()");
}

mergeJson(path.join(outDir, "meta.json"), meta); // carousel-grab / study batches keep their fields (slides, ...)
execFileSync("python3", [path.join(ROOT, "contact-sheet.py"), outDir, String(meta.stepSec ?? 0)]);
console.log(JSON.stringify({ ...meta, caption: meta.caption?.slice(0, 300), sheet: path.join(outDir, "sheet.jpg") }, null, 2));
await tab.done();
