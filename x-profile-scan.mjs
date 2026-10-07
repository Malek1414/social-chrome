// X profile scanner: opens x.com/<handle> in the x.com tab, scrolls slowly, and reads the UserTweets / UserByScreenName
// JSON the page itself loads (CDP Network.getResponseBody). Read-only, no direct API calls.
// usage: node x-profile-scan.mjs <handle> [maxTweets=15] [maxScrolls=10]  -> x_profiles/<handle>.json      exit 2 = wall
import fs from "fs";
import { open, out, die, EXIT } from "./lib/cdp.mjs";
import { wall, opOf, unwrap, handleOf, textOf, userOf } from "./lib/x.mjs";

const [handle, mt, ms] = process.argv.slice(2); const MAXT = Number(mt ?? 15), MAXS = Number(ms ?? 10);
if (!handle) die("usage: node x-profile-scan.mjs <handle> [maxTweets=15] [maxScrolls=10]");
const OUT = out("x_profiles"); fs.mkdirSync(OUT, { recursive: true });
const me = handle.toLowerCase();

const tab = await open("x.com");
const bodies = await tab.capture(u => /graphql\/[^/]+\/(UserTweets|UserOriginalsTimeline|UserByScreenName|UserMedia|UserArticles|UserTweetsAndReplies)/.test(u) && opOf(u));
await tab.goto(`https://x.com/${handle}`);
const w = await wall(tab);
if (w) { console.log("WALL " + JSON.stringify(w)); await tab.done(EXIT.WALL); }

let user = null; const tw = new Map();
const harvest = () => { for (const b of bodies.splice(0)) { let j; try { j = JSON.parse(b.body); } catch { continue; }
  const walk = (o, pinned) => { if (Array.isArray(o)) return o.forEach(x => walk(x, pinned)); if (!o || typeof o !== "object") return;
    if (!user && o.__typename === "User" && handleOf(o)?.toLowerCase() === me && (o.relationship_counts || o.legacy)) user = { ...userOf(o), handle };
    const isPin = pinned || o.type === "TimelinePinEntry";
    const r = unwrap(o.tweet_results?.result ?? o.itemContent?.tweet_results?.result);
    if (r?.legacy && r.rest_id && !tw.has(r.rest_id)) { const L = r.legacy;
      tw.set(r.rest_id, { id: r.rest_id, author: handleOf(r.core?.user_results?.result), pinned: isPin, date: L.created_at ? new Date(L.created_at).toISOString().slice(0, 16) : null,
        kind: L.retweeted_status_result?.result ? "repost" : (L.in_reply_to_status_id_str ? "reply" : (L.is_quote_status ? "quote" : "post")),
        text: (textOf(r) ?? "").slice(0, 1200), views: r.views?.count ? Number(r.views.count) : null,
        likes: L.favorite_count, reposts: L.retweet_count, replies: L.reply_count, bookmarks: L.bookmark_count,
        media: [...new Set((L.extended_entities?.media || []).map(m => m.type))].join("+") || (r.article ? "article" : ""),
        article: r.article?.article_results?.result?.title ?? null, paid: !!r.content_disclosure?.advertising_disclosure?.is_paid_promotion,
        quoted: r.quoted_status_result?.result ? (handleOf(unwrap(r.quoted_status_result.result)?.core?.user_results?.result) ?? "?") : null,
        urls: (L.entities?.urls || []).map(x => x.expanded_url) }); }
    for (const [k, v] of Object.entries(o)) walk(v, isPin || k === "pinned"); };
  walk(j, false); } };
const ownPosts = () => [...tw.values()].filter(x => x.author?.toLowerCase() === me && x.kind !== "reply").length;

for (let i = 0; i < MAXS; i++) {
  harvest(); if (ownPosts() >= MAXT + 3) break;
  await tab.scroll(`window.scrollBy({ top: ${800 + Math.floor(Math.random() * 500)}, behavior: 'smooth' })`);
}
harvest();
const domHead = await tab.eval(`(document.querySelector('[data-testid=primaryColumn]')?.innerText || '').split('Posts')[0].slice(0, 600)`);
user = { ...(user ?? { handle }), dom: domHead };
const own = [...tw.values()].filter(x => x.author?.toLowerCase() === me);
fs.writeFileSync(`${OUT}/${handle}.json`, JSON.stringify({ scanned_at: new Date().toISOString(), user, tweets: own,
  others: [...tw.values()].filter(x => x.author?.toLowerCase() !== me).map(x => ({ id: x.id, author: x.author, kind: x.kind, text: x.text.slice(0, 200) })) }, null, 1));
console.log(`OK @${handle} followers=${user.followers} own=${own.length}`);
await tab.done();
