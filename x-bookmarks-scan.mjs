// X Bookmarks scanner: opens https://x.com/i/bookmarks in the x.com tab, scrolls slowly like a human,
// and captures the timeline JSON the page itself loads (CDP Network.getResponseBody). No direct API calls.
// usage: node x-bookmarks-scan.mjs [max=100] [maxScrolls=80]  -> x_bookmarks_recent.json (+ x_bookmarks_raw/*.json)
import fs from "fs";
import { open, out, log, walk, EXIT } from "./lib/cdp.mjs";
import { wall, opOf, unwrap, textOf, userOf, mp4s } from "./lib/x.mjs";

const MAX = Number(process.argv[2] ?? 100), MAXS = Number(process.argv[3] ?? 80);
const RAW = out("x_bookmarks_raw"); fs.mkdirSync(RAW, { recursive: true });

const tab = await open("x.com");
const allOps = new Set();
const bodies = await tab.capture(u => { if (!/\/graphql\//.test(u)) return false; allOps.add(opOf(u)); return /Bookmark/i.test(u) && opOf(u); });
await tab.goto("https://x.com/i/bookmarks");
const w = await wall(tab);
log("page state", JSON.stringify(w ?? "ok"));
if (w) { console.log("STOP: wall " + JSON.stringify(w)); await tab.done(EXIT.WALL); }

const tweets = new Map(); const order = []; const folders = [];
function parseTweet(r) {
  r = unwrap(r); if (!r?.legacy) return null; const L = r.legacy; const u = userOf(r.core?.user_results?.result);
  const media = (L.extended_entities?.media || L.entities?.media || []).map(m => ({ type: m.type, url: m.media_url_https, expanded: m.expanded_url,
    duration_ms: m.video_info?.duration_millis, variants: mp4s(m).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0)).map(v => ({ bitrate: v.bitrate, url: v.url })) }));
  const q = r.quoted_status_result?.result ? parseTweet(r.quoted_status_result.result) : null;
  const card = r.card?.legacy ? Object.fromEntries((r.card.legacy.binding_values || []).filter(b => b.value?.string_value).map(b => [b.key, b.value.string_value])) : null;
  const id = L.id_str ?? r.rest_id; const art = r.article?.article_results?.result;
  return { id, url: `https://x.com/${u.handle}/status/${id}`, author: u.handle, author_name: u.name, author_followers: u.followers, verified: u.verified,
    created_at: L.created_at, date: L.created_at ? new Date(L.created_at).toISOString().slice(0, 10) : null,
    text: textOf(r), lang: L.lang,
    views: r.views?.count ? Number(r.views.count) : null, likes: L.favorite_count, reposts: L.retweet_count, replies: L.reply_count, quotes: L.quote_count, bookmarks: L.bookmark_count,
    conversation_id: L.conversation_id_str, is_reply: !!L.in_reply_to_status_id_str, self_thread: L.in_reply_to_screen_name === u.handle,
    urls: (L.entities?.urls || []).map(x => x.expanded_url), media, media_type: media.length ? [...new Set(media.map(m => m.type))].join("+") : (r.article ? "article" : (card ? "card" : "text")),
    article: art ? { title: art.title, preview: art.preview_text, id: art.rest_id } : null,
    card: card ? { title: card.title, description: card.description, url: card.card_url, domain: card.domain ?? card.vanity_url } : null,
    quoted: q ? { id: q.id, url: q.url, author: q.author, text: q.text, media: q.media, media_type: q.media_type, views: q.views, likes: q.likes } : null };
}
function harvest() {
  for (const b of bodies.splice(0)) {
    let j; try { j = JSON.parse(b.body); } catch { continue; }
    fs.writeFileSync(`${RAW}/${Date.now()}_${b.tag}.json`, b.body);
    if (b.tag.includes("Folder") && !/timeline/i.test(b.tag)) { folders.push(j); continue; }
    walk(j, o => {
      if (!(o.entryId?.startsWith("tweet-") && o.content?.itemContent?.tweet_results?.result)) return;
      const tw = parseTweet(o.content.itemContent.tweet_results.result);
      if (tw && !tweets.has(tw.id)) { tw.sortIndex = o.sortIndex; tweets.set(tw.id, tw); order.push(tw.id); }
      return true;
    });
  }
}

let still = 0;
for (let i = 0; i < MAXS && tweets.size < MAX; i++) {
  harvest(); const n0 = tweets.size;
  await tab.scroll(`window.scrollBy({ top: ${700 + Math.floor(Math.random() * 500)}, behavior: 'smooth' })`);
  harvest();
  still = tweets.size === n0 ? still + 1 : 0;
  if (i % 3 === 0) log("scroll", i, "tweets", tweets.size);
  const st = await wall(tab);
  if (st) { log("STOP wall", JSON.stringify(st)); break; }
  if (still >= 8) { log("no new tweets for 8 scrolls, end"); break; }
}
harvest();
// Folders (Premium) show up as links on the bookmarks page.
const domFolders = await tab.eval(`[...document.querySelectorAll('a[href*="/i/bookmarks/"]')].map(a => ({ href: a.getAttribute('href'), text: a.innerText.trim() }))`);
const list = order.map(k => tweets.get(k)).slice(0, MAX).map((t, i) => ({ rank: i + 1, ...t }));
fs.writeFileSync(out("x_bookmarks_recent.json"), JSON.stringify({ scanned_at: new Date().toISOString(), count: list.length, folders_dom: domFolders, folders_json: folders, graphql_seen: [...allOps], items: list }, null, 1));
log(`saved ${list.length} bookmarks; folders in DOM: ${JSON.stringify(domFolders)}`);
await tab.done();
