// usage: node own-scan.mjs <user> <path: ""|reels/|tagged/> <outName> [maxScrolls]   -> <outName>.json
// Scrolls a profile tab at human pace, keeps every graphql / api/v1 body + embedded JSON, extracts media objects.
import fs from "fs";
import { open, die, log, walkBodies } from "../lib/cdp.mjs";
import { API, GRID_LINKS, ssrJson, largest, scrollGrid } from "../lib/ig.mjs";

const [user, path, outName, sc] = process.argv.slice(2); const maxScrolls = Number(sc ?? 150);
if (!outName) die('usage: node own-scan.mjs <user> <path: ""|reels/|tagged/> <outName> [maxScrolls]');
const tab = await open("instagram.com");
const bodies = await tab.capture(API);
await tab.goto(`https://www.instagram.com/${user}/${path}`);
const scripts = await ssrJson(tab, "taken_at", "image_versions2");
const links = new Set(await scrollGrid(tab, { maxScrolls, px: () => 700 + Math.random() * 500,
  every: (i, n) => i % 5 === 0 && log(path || "grid", "scroll", i, "links", n, "429s", tab.s429, "bodies", bodies.length),
  stop: () => (tab.s429 > 0 || tab.challenge > 0) && (log("429/challenge -> stop", tab.s429, tab.challenge), true) }));
((await tab.eval(GRID_LINKS)) || []).forEach(h => links.add(h));
const media = {};
const norm = o => ({ code: o.code, pk: o.pk, owner: o.user?.username || o.owner?.username, taken_at: o.taken_at,
  date: o.taken_at ? new Date(o.taken_at * 1000).toISOString().slice(0, 10) : null, product_type: o.product_type, media_type: o.media_type,
  caption: o.caption?.text ?? null, w: o.original_width, h: o.original_height, duration: o.video_duration ?? null,
  img: largest(o.image_versions2?.candidates)?.url ?? null, vid: largest(o.video_versions)?.url ?? o.video_versions?.[0]?.url ?? null,
  vw: largest(o.video_versions)?.width ?? null, vh: largest(o.video_versions)?.height ?? null,
  acc: o.accessibility_caption ?? null, location: o.location?.name ?? null,
  usertags: (o.usertags?.in || []).map(u => u.user?.username),
  slides: o.carousel_media ? o.carousel_media.map(s => ({ pk: s.pk, media_type: s.media_type, w: s.original_width, h: s.original_height,
    img: largest(s.image_versions2?.candidates)?.url ?? null, vid: largest(s.video_versions)?.url ?? null, acc: s.accessibility_caption ?? null,
    usertags: (s.usertags?.in || []).map(u => u.user?.username) })) : null, carousel_count: o.carousel_media_count ?? null });
walkBodies([...bodies, ...scripts], o => {
  if (!(o.code && "taken_at" in o && (o.image_versions2 || o.carousel_media))) return;
  const n = norm(o); const prev = media[o.code];
  if (!prev || (n.slides?.length ?? 0) >= (prev.slides?.length ?? 0)) media[o.code] = { ...prev, ...Object.fromEntries(Object.entries(n).filter(([, v]) => v !== null && v !== undefined)) };
});
fs.writeFileSync(`${outName}.json`, JSON.stringify({ user, path, status429: tab.s429, challenge: tab.challenge, links: [...links], media: Object.values(media) }, null, 1));
log(path || "grid", "links", links.size, "media objects", Object.keys(media).length, "429s", tab.s429);
await tab.done();
