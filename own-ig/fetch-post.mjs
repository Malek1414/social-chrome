// usage: node fetch-post.mjs <code> <kind p|reel> -> own-ig/raw/<code>_NN.jpg, raw-video/<code>[_NN].mp4, meta/<code>.json
// Navigates the IG tab to the post (like a human), reads the media object from the page's own data, fetches files IN-PAGE.
// exit 2 = rate limited / challenge (back off)
import fs from "fs";
import { open, out, die, pause, isoDate, EXIT } from "../lib/cdp.mjs";
import { API, ssrJson, mediaFor, largest, blocked, postReady } from "../lib/ig.mjs";

const [code, kind] = process.argv.slice(2);
if (!kind) die("usage: node fetch-post.mjs <code> <kind p|reel>");
const OWN = out("own-ig"); for (const d of ["meta", "raw", "raw-video"]) fs.mkdirSync(`${OWN}/${d}`, { recursive: true });
const tab = await open("instagram.com");
const bodies = await tab.capture(API);
const sources = async () => [...bodies, ...await ssrJson(tab, code)];
await tab.goto(`https://www.instagram.com/${kind}/${code}/`, { until: postReady(tab, bodies, code, "image_versions2") });
if (await blocked(tab)) { console.log("BLOCKED", code, tab.s429, tab.challenge); await tab.done(EXIT.WALL); }
// Prefer the copy with the most slides, then one with a DASH manifest (it can carry a higher-res rendition).
const media = mediaFor(code, await sources()).filter(o => o.carousel_media || o.image_versions2)
  .sort((a, b) => (b.carousel_media?.length ?? 0) - (a.carousel_media?.length ?? 0) || !!b.video_dash_manifest - !!a.video_dash_manifest)[0];
if (!media) { console.log("NOMEDIA", code); await tab.done(EXIT.FAIL); }
const dashBest = xml => { if (!xml) return null; let top = null;
  for (const m of xml.matchAll(/<Representation([^>]*)>([\s\S]*?)<\/Representation>/g)) { const a = m[1]; if (!/mimeType="video/.test(a) && !/width=/.test(a)) continue;
    const w = +(a.match(/\swidth="(\d+)"/)?.[1] || 0), h = +(a.match(/\sheight="(\d+)"/)?.[1] || 0); const u = m[2].match(/<BaseURL>(.*?)<\/BaseURL>/)?.[1]?.replace(/&amp;/g, "&");
    if (u && (!top || w * h > top.w * top.h)) top = { w, h, url: u }; } return top; };
// Already on disk counts as fetched; otherwise fetch inside the page and pause like a person flicking through slides.
const save = async (url, rel) => {
  if (fs.existsSync(`${OWN}/${rel}`)) return true;
  const got = await tab.fetchInPage([url]);
  if (got) fs.writeFileSync(`${OWN}/${rel}`, got.buf); else console.log("FETCH_FAIL", rel);
  await pause(5000, 3000);
  return !!got;
};
const files = [];
for (const [i, it] of (media.carousel_media || [media]).entries()) {
  const nn = String(i + 1).padStart(2, "0"); const rec = { n: i + 1, media_type: it.media_type, w: it.original_width, h: it.original_height, acc: it.accessibility_caption ?? null, usertags: (it.usertags?.in || []).map(u => u.user?.username) };
  const img = largest(it.image_versions2?.candidates);
  if (img && await save(img.url, `raw/${code}_${nn}.jpg`)) Object.assign(rec, { img: `raw/${code}_${nn}.jpg`, img_w: img.width, img_h: img.height });
  const vv = largest(it.video_versions);
  if (vv) {
    if (await save(vv.url, `raw-video/${code}_${nn}.mp4`)) Object.assign(rec, { vid: `raw-video/${code}_${nn}.mp4`, vid_w: vv.width, vid_h: vv.height });
    const d = dashBest(it.video_dash_manifest);
    if (d && d.w * d.h > vv.width * vv.height && await save(d.url, `raw-video/${code}_${nn}_dash${d.h}.mp4`)) Object.assign(rec, { vid_hi: `raw-video/${code}_${nn}_dash${d.h}.mp4`, vid_hi_w: d.w, vid_hi_h: d.h });
  }
  files.push(rec);
}
const meta = { code, url: `https://www.instagram.com/${kind}/${code}/`, owner: media.user?.username || media.owner?.username, coauthors: media.coauthor_producers?.map(c => c.username) ?? [],
  date: isoDate(media.taken_at), product_type: media.product_type, caption: media.caption?.text ?? null,
  location: media.location?.name ?? null, usertags: (media.usertags?.in || []).map(u => u.user?.username), duration: media.video_duration ?? null, files };
fs.writeFileSync(`${OWN}/meta/${code}.json`, JSON.stringify(meta, null, 1));
console.log("OK", code, meta.owner, meta.date, files.length, "items", tab.s429 ? "429!" : "");
await tab.done(tab.s429 || tab.challenge ? EXIT.WALL : EXIT.OK);
