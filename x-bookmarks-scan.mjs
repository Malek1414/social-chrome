// X Bookmarks scanner: opens https://x.com/i/bookmarks in the x.com tab, scrolls slowly like a human,
// and captures the timeline JSON the page itself loads (CDP Network.getResponseBody). No direct API calls.
// usage: node x-bookmarks-scan.mjs [max=100] [maxScrolls=80]  -> x_bookmarks_recent.json (+ x_bookmarks_raw/*.json)
import fs from "fs";
const MAX = Number(process.argv[2] ?? 100), MAXS = Number(process.argv[3] ?? 80);
const HERE = `${process.env.HOME}/Desktop/social-chrome`;
const tabs = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = tabs.find(x => x.type === "page" && x.url.includes("x.com"));
if (!t) { console.log("no x.com tab"); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = {}; const reqs = {}; const bodies = []; const allUrls = [];
const send = (m, params = {}) => new Promise(r => { p[++id] = r; ws.send(JSON.stringify({ id, method: m, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
ws.onmessage = async e => { const m = JSON.parse(e.data);
  if (p[m.id]) return p[m.id](m.result ?? m.error);
  if (m.method === "Network.responseReceived") { const u = m.params.response.url;
    if (/\/graphql\//.test(u)) { allUrls.push(u.split("?")[0]); if (/Bookmark/i.test(u)) reqs[m.params.requestId] = { u: u.split("?")[0], status: m.params.response.status }; } }
  if (m.method === "Network.loadingFinished" && reqs[m.params.requestId]) {
    const b = await send("Network.getResponseBody", { requestId: m.params.requestId });
    if (b?.body) bodies.push({ url: reqs[m.params.requestId].u, status: reqs[m.params.requestId].status, body: b.body }); } };
await new Promise(r => (ws.onopen = r));
await send("Network.enable");
const ev = async x => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }))?.result?.value;

await send("Page.navigate", { url: "https://x.com/i/bookmarks" });
await sleep(7000 + Math.random() * 2000);
const wall = await ev(`(() => { const t = document.body.innerText; return { login: /Sign in to X|Log in|Sign up/.test(t) && !document.querySelector('[data-testid=primaryColumn] article'), captcha: !!document.querySelector('iframe[src*=arkose],iframe[src*=captcha]'), rate: /Rate limit|Something went wrong. Try reloading/i.test(t), url: location.href }; })()`);
log("page state", JSON.stringify(wall));
if (wall?.captcha || wall?.login || wall?.rate) { console.log("STOP: wall " + JSON.stringify(wall)); process.exit(2); }

// parse helper
const tweets = new Map(); const order = [];
const userOf = r => { const u = r?.core?.user_results?.result; return { handle: u?.core?.screen_name ?? u?.legacy?.screen_name, name: u?.core?.name ?? u?.legacy?.name, followers: u?.legacy?.followers_count ?? u?.relationship_counts?.followers, verified: u?.is_blue_verified }; };
const unwrap = r => r?.__typename === "TweetWithVisibilityResults" ? r.tweet : r;
function parseTweet(r) {
  r = unwrap(r); if (!r?.legacy) return null; const L = r.legacy; const u = userOf(r);
  const media = (L.extended_entities?.media || L.entities?.media || []).map(m => ({ type: m.type, url: m.media_url_https, expanded: m.expanded_url,
    duration_ms: m.video_info?.duration_millis, variants: (m.video_info?.variants || []).filter(v => v.content_type === "video/mp4").sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0)).map(v => ({ bitrate: v.bitrate, url: v.url })) }));
  const q = r.quoted_status_result?.result ? parseTweet(r.quoted_status_result.result) : null;
  const card = r.card?.legacy ? Object.fromEntries((r.card.legacy.binding_values || []).filter(b => b.value?.string_value).map(b => [b.key, b.value.string_value])) : null;
  return { id: L.id_str ?? r.rest_id, url: `https://x.com/${u.handle}/status/${L.id_str ?? r.rest_id}`, author: u.handle, author_name: u.name, author_followers: u.followers, verified: u.verified,
    created_at: L.created_at, date: L.created_at ? new Date(L.created_at).toISOString().slice(0, 10) : null,
    text: r.note_tweet?.note_tweet_results?.result?.text ?? L.full_text, lang: L.lang,
    views: r.views?.count ? Number(r.views.count) : null, likes: L.favorite_count, reposts: L.retweet_count, replies: L.reply_count, quotes: L.quote_count, bookmarks: L.bookmark_count,
    conversation_id: L.conversation_id_str, is_reply: !!L.in_reply_to_status_id_str, self_thread: L.in_reply_to_screen_name === u.handle,
    urls: (L.entities?.urls || []).map(x => x.expanded_url), media, media_type: media.length ? [...new Set(media.map(m => m.type))].join("+") : (r.article ? "article" : (card ? "card" : "text")),
    article: r.article?.article_results?.result ? { title: r.article.article_results.result.title, preview: r.article.article_results.result.preview_text, id: r.article.article_results.result.rest_id } : null,
    card: card ? { title: card.title, description: card.description, url: card.card_url, domain: card.domain ?? card.vanity_url } : null,
    quoted: q ? { id: q.id, url: q.url, author: q.author, text: q.text, media: q.media, media_type: q.media_type, views: q.views, likes: q.likes } : null };
}
function harvest() {
  for (const b of bodies.splice(0)) {
    let j; try { j = JSON.parse(b.body); } catch { continue; }
    fs.mkdirSync(`${HERE}/x_bookmarks_raw`, { recursive: true });
    fs.writeFileSync(`${HERE}/x_bookmarks_raw/${Date.now()}_${b.url.split("/").pop()}.json`, b.body);
    if (b.url.includes("Folder") && !/timeline/i.test(b.url)) { folders.push(j); continue; }
    const walk = o => { if (Array.isArray(o)) return o.forEach(walk); if (!o || typeof o !== "object") return;
      if (o.entryId?.startsWith("tweet-") && o.content?.itemContent?.tweet_results?.result) { const tw = parseTweet(o.content.itemContent.tweet_results.result);
        if (tw && !tweets.has(tw.id)) { tw.sortIndex = o.sortIndex; tweets.set(tw.id, tw); order.push(tw.id); } return; }
      Object.values(o).forEach(walk); };
    walk(j);
  }
}
const folders = [];
let still = 0;
for (let i = 0; i < MAXS && tweets.size < MAX; i++) {
  await sleep(500); harvest();
  const n0 = tweets.size;
  await ev(`window.scrollBy({ top: ${700 + Math.floor(Math.random() * 500)}, behavior: 'smooth' })`);
  await sleep(2000 + Math.random() * 2000);
  harvest();
  still = tweets.size === n0 ? still + 1 : 0;
  if (i % 3 === 0) log("scroll", i, "tweets", tweets.size);
  const st = await ev(`(() => ({ rate: /Rate limit|Something went wrong/i.test(document.querySelector('[data-testid=primaryColumn]')?.innerText || ''), captcha: !!document.querySelector('iframe[src*=arkose]') }))()`);
  if (st?.captcha || st?.rate) { log("STOP wall", JSON.stringify(st)); break; }
  if (still >= 8) { log("no new tweets for 8 scrolls, end"); break; }
}
harvest();
// folders: open the folder picker list? X exposes folders as tabs on the bookmarks page (Premium). Read them from DOM.
const domFolders = await ev(`[...document.querySelectorAll('a[href*="/i/bookmarks/"]')].map(a => ({ href: a.getAttribute('href'), text: a.innerText.trim() }))`);
const list = order.map(k => tweets.get(k)).slice(0, MAX).map((t, i) => ({ rank: i + 1, ...t }));
fs.writeFileSync(`${HERE}/x_bookmarks_recent.json`, JSON.stringify({ scanned_at: new Date().toISOString(), count: list.length, folders_dom: domFolders, folders_json: folders, graphql_seen: [...new Set(allUrls)].map(u => u.split("/").pop()), items: list }, null, 1));
log(`saved ${list.length} bookmarks; folders in DOM: ${JSON.stringify(domFolders)}`);
ws.close(); setTimeout(() => process.exit(0), 500);
