// usage: node profile-full-scan.mjs <user> [maxScrolls=120] -> profiles/<user>_full.json
// Like profile-scan.mjs but scrolls the grid and the reels tab until no new posts appear (human pace).
import fs from "fs";
const [user, sc] = process.argv.slice(2); const maxScrolls = Number(sc ?? 120);
const tabs = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = tabs.find(x => x.type === "page" && x.url.includes("instagram.com"));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = {}; const reqs = {}; const bodies = []; let status429 = 0;
const send = (m, params = {}) => new Promise(r => { p[++id] = r; ws.send(JSON.stringify({ id, method: m, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11,19), ...a);
ws.onmessage = async e => { const m = JSON.parse(e.data);
  if (p[m.id]) return p[m.id](m.result ?? m.error);
  if (m.method === "Network.responseReceived") { const r = m.params.response; if (r.status === 429) status429++;
    if (/graphql|\/api\/v1\//.test(r.url)) reqs[m.params.requestId] = 1; }
  if (m.method === "Network.loadingFinished" && reqs[m.params.requestId]) { const b = await send("Network.getResponseBody", { requestId: m.params.requestId }); if (b?.body) bodies.push(b.body); } };
await new Promise(r => (ws.onopen = r));
await send("Network.enable");
const ev = async e => (await send("Runtime.evaluate", { expression: e, returnByValue: true }))?.result?.value;
const grabScripts = async () => (await ev(`[...document.querySelectorAll('script[type="application/json"]')].map(s=>s.textContent).filter(t=>t.includes('taken_at')||t.includes('follower'))`)) || [];
const LINKS = `[...document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"]')].map(a => [a.getAttribute('href'), a.innerText.replace(/\\n/g,' ')])`;
const pages = []; const gridText = {};
let header = "";
for (const path of ["", "reels/"]) {
  await send("Page.navigate", { url: `https://www.instagram.com/${user}/${path}` });
  await sleep(7000 + Math.random() * 2000);
  pages.push(...await grabScripts());
  if (!path) header = await ev(`(document.querySelector('header')||{}).innerText||''`);
  const set = new Set(); let still = 0;
  for (let i = 0; i < maxScrolls; i++) {
    const got = (await ev(LINKS)) || []; const n = set.size;
    got.forEach(([h, txt]) => { set.add(h); const c = h.match(/(?:p|reel)\/([\w-]+)/)?.[1]; if (c && txt) gridText[c] = txt; });
    still = set.size === n ? still + 1 : 0;
    if (i % 10 === 0) log(user, path || "grid", "scroll", i, "links", set.size, "429s", status429);
    if (status429 > 2) { log("429 -> stop"); break; }
    if (still >= 6) break;
    await ev(`window.scrollBy(0, ${800 + Math.floor(Math.random()*500)})`);
    await sleep(2500 + Math.random() * 2500);
    if (still >= 3) { await ev("window.scrollTo(0, document.body.scrollHeight)"); await sleep(4000); }
  }
  log(path || "grid", "done links", set.size);
  await sleep(4000);
}
const posts = {}; let profile = { header };
const walk = o => { if (!o || typeof o !== "object") return; if (Array.isArray(o)) return o.forEach(walk);
  if (o.username === user && (o.follower_count || o.edge_followed_by)) profile = { ...profile, followers: o.follower_count ?? o.edge_followed_by?.count, following: o.following_count, bio: o.biography, external: o.external_url ?? o.bio_links?.map(b => b.url), bio_links: o.bio_links, full_name: o.full_name, category: o.category_name, media_count: o.media_count, pk: o.pk ?? o.id };
  if (o.code && "taken_at" in o && o.user?.username === user) {
    const prev = posts[o.code] || {};
    posts[o.code] = { ...prev, code: o.code, date: new Date(o.taken_at * 1000).toISOString().slice(0, 16), type: o.product_type || o.media_type,
      likes: o.like_count ?? prev.likes, comments: o.comment_count ?? prev.comments, plays: o.play_count ?? o.ig_play_count ?? o.view_count ?? prev.plays ?? null,
      duration: o.video_duration ?? prev.duration ?? null, pinned: !!(o.timeline_pinned_user_ids?.length || o.clips_tab_pinned_user_ids?.length) || prev.pinned || false,
      paid_partnership: o.is_paid_partnership ?? prev.paid_partnership, sponsor: o.sponsor_tags?.map(s => s.sponsor?.username) ?? prev.sponsor,
      coauthors: o.coauthor_producers?.map(c => c.username) ?? prev.coauthors, music: o.clips_metadata?.music_info?.music_asset_info?.title ?? o.clips_metadata?.original_sound_info?.original_audio_title ?? prev.music,
      w: o.original_width ?? prev.w, h: o.original_height ?? prev.h,
      caption: (o.caption?.text ?? prev.caption ?? "").slice(0, 2000) };
  }
  Object.values(o).forEach(walk); };
for (const b of [...bodies, ...pages]) for (const line of b.split("\n")) { try { walk(JSON.parse(line)); } catch {} }
for (const c of Object.keys(posts)) if (gridText[c]) posts[c].grid = gridText[c];
for (const c of Object.keys(gridText)) if (!posts[c]) posts[c] = { code: c, grid: gridText[c] };
const list = Object.values(posts).sort((a, b) => (b.date||"").localeCompare(a.date||""));
fs.writeFileSync(`profiles/${user}_full.json`, JSON.stringify({ user, profile, status429, posts: list }, null, 1));
log(user, "followers", profile.followers, "media", profile.media_count, "posts captured", list.length, "429s", status429);
ws.close(); setTimeout(() => process.exit(0), 500);
