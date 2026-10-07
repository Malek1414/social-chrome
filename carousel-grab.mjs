// Saves every slide (image or video) of an IG post plus its stats, reading the media object from the page's own data.
// usage: node carousel-grab.mjs <code>  -> reels/<code>/slide_XX.jpg|mp4 + meta.json
import fs from "fs";
import { open, out, die, pause, isoDate, mergeJson } from "./lib/cdp.mjs";
import { API, ssrJson, mediaFor, pick, playsOf, musicOf, postReady } from "./lib/ig.mjs";

const code = process.argv[2];
if (!code) die("usage: node carousel-grab.mjs <code>");
const dir = out("reels", code); fs.mkdirSync(dir, { recursive: true });
const tab = await open("instagram.com");
const bodies = await tab.capture(API);
const sources = async () => [...bodies, ...await ssrJson(tab, code)];
await tab.goto(`https://www.instagram.com/p/${code}/`, { until: postReady(tab, bodies, code, "like_count") });
const cands = mediaFor(code, await sources()).filter(o => o.carousel_media || o.image_versions2 || o.video_versions);
const media = cands[0];
if (!media) { console.log("NOMEDIA", code); await tab.done(); }
const res = [];
for (const [i, it] of (media.carousel_media || [media]).entries()) {
  const vid = it.video_versions?.[0]?.url; const img = it.image_versions2?.candidates?.[0]?.url;
  const url = vid || img; if (!url) continue;
  const fn = `${dir}/slide_${String(i + 1).padStart(2, "0")}.${vid ? "mp4" : "jpg"}`;
  const r = await fetch(url);
  if (!r.ok) { console.log("SLIDE_FAIL", fn, r.status); continue; }
  fs.writeFileSync(fn, Buffer.from(await r.arrayBuffer()));
  res.push({ fn, type: vid ? "video" : "image", accessibility: it.accessibility_caption || null });
  await pause(800, 700);
}
mergeJson(`${dir}/meta.json`, { code, author: media.user?.username, followers: pick(cands, c => c.user?.follower_count),
  date: isoDate(pick(cands, c => c.taken_at)), likes: pick(cands, c => c.like_count), comments: pick(cands, c => c.comment_count),
  plays: pick(cands, playsOf), duration: pick(cands, c => c.video_duration), music: musicOf(media),
  coauthors: media.coauthor_producers?.map(c => c.username), caption: media.caption?.text, slides: res });
console.log("OK", code, res.length, "slides");
await tab.done();
