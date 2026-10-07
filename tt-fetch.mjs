// Opens a TikTok video page in the TikTok tab (like a viewer) and fetches its media from INSIDE the page,
// so cookies never leave the browser. Writes tiktok/<id>/video.mp4 and comments.json.
// usage: node tt-fetch.mjs <author> <id>    exit 2 = captcha, 1 = failed
import fs from "fs";
import { open, out, die, pause, EXIT } from "./lib/cdp.mjs";
import { captcha } from "./lib/tt.mjs";

const [author, vid] = process.argv.slice(2);
if (!vid) die("usage: node tt-fetch.mjs <author> <id>");
const dir = out("tiktok", vid); fs.mkdirSync(dir, { recursive: true });
const tab = await open("tiktok.com");
const commentBodies = await tab.capture(/\/api\/comment\/list/);
await tab.goto(`https://www.tiktok.com/@${author}/video/${vid}`, { min: 4000 + Math.random() * 2000 });
await tab.eval(`document.querySelector("[data-e2e=comment-icon]")?.closest("button")?.click() ?? document.querySelector("[data-e2e=comment-icon]")?.click()`);
await tab.settle({ min: 2500 + Math.random() * 1500, max: 7000, until: () => commentBodies.length > 0 });
if (await captcha(tab)) { console.log("CAPTCHA"); await tab.done(EXIT.WALL); }
// Candidate media URLs: the <video> element's source, then the item's renditions (~1.2 Mbps first), then the download URL.
const CANDIDATES = `(() => {
  let item = null; const walk = o => { if (item || !o || typeof o !== 'object') return; if (o.id === '${vid}' && o.video) { item = o; return; } for (const v of Object.values(o)) walk(v); };
  try { walk(JSON.parse(document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__')?.textContent || '{}')); } catch {}
  const cands = [...document.querySelectorAll('video')].map(v => v.currentSrc || v.src).filter(s => s && !s.startsWith('blob:'));
  if (item) { const v = item.video; if (v.playAddr) cands.push(v.playAddr);
    (v.bitrateInfo || []).sort((a, b) => Math.abs(a.Bitrate - 1200000) - Math.abs(b.Bitrate - 1200000)).forEach(b => cands.push(...(b.PlayAddr?.UrlList || [])));
    if (v.downloadAddr) cands.push(v.downloadAddr); }
  return cands; })()`;
const grab = async () => tab.fetchInPage((await tab.eval(CANDIDATES)) || [], { minBytes: 20000, credentials: "include" });
let got = await grab();
if (!got) { await pause(3000); await tab.send("Page.reload"); await tab.settle({ min: 7000 + Math.random() * 2000, max: 12000 }); got = await grab(); }
if (!got) { console.log("FETCH_FAIL " + vid); await tab.done(EXIT.FAIL); }
fs.writeFileSync(`${dir}/video.mp4`, got.buf);
const comments = commentBodies.flatMap(b => { try { return JSON.parse(b.body).comments || []; } catch { return []; } })
  .map(c => ({ text: c.text, likes: c.digg_count, replies: c.reply_comment_total, byAuthor: c.is_author_digged }));
if (comments.length) fs.writeFileSync(`${dir}/comments.json`, JSON.stringify(comments.sort((a, b) => b.likes - a.likes), null, 1));
console.log(`FETCHED ${vid} ${(got.buf.length / 1e6).toFixed(1)}MB`);
await tab.done();
