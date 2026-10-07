// usage: node profile-scan.mjs <user> [scrolls=6] -> profiles/<user>.json (profile info + posts the page loads, reels tab)
import fs from "fs";
const [user, sc] = process.argv.slice(2); const scrolls = Number(sc ?? 6);
fs.mkdirSync("profiles", { recursive: true });
const tabs = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = tabs.find(x => x.type === "page" && x.url.includes("instagram.com"));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = {}; const reqs = {}; const bodies = [];
const send = (m, params = {}) => new Promise(r => { p[++id] = r; ws.send(JSON.stringify({ id, method: m, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
ws.onmessage = async e => { const m = JSON.parse(e.data);
  if (p[m.id]) return p[m.id](m.result ?? m.error);
  if (m.method === "Network.responseReceived" && /graphql|\/api\/v1\//.test(m.params.response.url)) reqs[m.params.requestId] = 1;
  if (m.method === "Network.loadingFinished" && reqs[m.params.requestId]) { const b = await send("Network.getResponseBody", { requestId: m.params.requestId }); if (b?.body) bodies.push(b.body); } };
await new Promise(r => (ws.onopen = r));
await send("Network.enable");
const ev = async e => (await send("Runtime.evaluate", { expression: e, returnByValue: true }))?.result?.value;
const grabScripts = async () => (await ev(`[...document.querySelectorAll('script[type="application/json"]')].map(s=>s.textContent).filter(t=>t.includes('taken_at')||t.includes('follower'))`)) || [];
const pages = [];
for (const path of ["", "reels/"]) {
  await send("Page.navigate", { url: `https://www.instagram.com/${user}/${path}` });
  await sleep(7000 + Math.random() * 2000);
  pages.push(...await grabScripts());
  if (!path) pages.push(JSON.stringify({ __header: await ev(`(document.querySelector('header')||{}).innerText||''`) }));
  for (let i = 0; i < scrolls; i++) { await ev(`window.scrollBy(0, ${900 + Math.floor(Math.random()*500)})`); await sleep(2500 + Math.random() * 2000); }
  await sleep(3000);
}
const posts = {}; let profile = {};
const walk = o => { if (!o || typeof o !== "object") return; if (Array.isArray(o)) return o.forEach(walk);
  if (o.__header) profile.header = o.__header;
  if (o.username === user && (o.follower_count || o.edge_followed_by)) profile = { ...profile, followers: o.follower_count ?? o.edge_followed_by?.count, bio: o.biography, external: o.external_url ?? o.bio_links?.map(b => b.url), full_name: o.full_name, category: o.category_name, media_count: o.media_count };
  if (o.code && "taken_at" in o && o.user?.username === user) {
    const prev = posts[o.code] || {};
    posts[o.code] = { ...prev, code: o.code, date: new Date(o.taken_at * 1000).toISOString().slice(0, 16), type: o.product_type || o.media_type,
      likes: o.like_count ?? prev.likes, comments: o.comment_count ?? prev.comments, plays: o.play_count ?? o.ig_play_count ?? o.view_count ?? prev.plays ?? null,
      duration: o.video_duration ?? prev.duration ?? null, pinned: !!(o.timeline_pinned_user_ids?.length || o.clips_tab_pinned_user_ids?.length) || prev.pinned || false,
      paid_partnership: o.is_paid_partnership ?? prev.paid_partnership, sponsor: o.sponsor_tags?.map(s => s.sponsor?.username) ?? prev.sponsor,
      coauthors: o.coauthor_producers?.map(c => c.username) ?? prev.coauthors, music: o.clips_metadata?.music_info?.music_asset_info?.title ?? o.clips_metadata?.original_sound_info?.original_audio_title ?? prev.music,
      caption: (o.caption?.text ?? prev.caption ?? "").slice(0, 1500) };
  }
  Object.values(o).forEach(walk); };
for (const b of [...bodies, ...pages]) for (const line of b.split("\n")) { try { walk(JSON.parse(line)); } catch {} }
const list = Object.values(posts).sort((a, b) => b.date.localeCompare(a.date));
fs.writeFileSync(`profiles/${user}.json`, JSON.stringify({ user, profile, posts: list }, null, 1));
console.log(user, "followers", profile.followers, "posts", list.length);
ws.close(); setTimeout(() => process.exit(0), 500);
