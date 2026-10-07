// X profile scanner: opens x.com/<handle> in the x.com tab, scrolls slowly, and reads the UserTweets / UserByScreenName
// JSON the page itself loads (CDP Network.getResponseBody). Read-only, no direct API calls.
// usage: node x-profile-scan.mjs <handle> [maxTweets=15] [maxScrolls=10]  -> x_profiles/<handle>.json      exit 2 = wall
import fs from "fs";
const [handle, mt, ms] = process.argv.slice(2); const MAXT = Number(mt ?? 15), MAXS = Number(ms ?? 10);
const OUT = `${process.env.HOME}/Desktop/social-chrome/x_profiles`; fs.mkdirSync(OUT, { recursive: true });
const tabs = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = tabs.find(x => x.type === "page" && x.url.includes("x.com"));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = {}; const reqs = {}; const bodies = [];
const send = (m, params = {}) => new Promise(r => { p[++id] = r; ws.send(JSON.stringify({ id, method: m, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
ws.onmessage = async e => { const m = JSON.parse(e.data); if (p[m.id]) return p[m.id](m.result ?? m.error);
  if (m.method === "Network.responseReceived" && /graphql\/[^/]+\/(UserTweets|UserOriginalsTimeline|UserByScreenName|UserMedia|UserArticles|UserTweetsAndReplies)/.test(m.params.response.url)) reqs[m.params.requestId] = m.params.response.url.split("?")[0].split("/").pop();
  if (m.method === "Network.loadingFinished" && reqs[m.params.requestId]) { const b = await send("Network.getResponseBody", { requestId: m.params.requestId }); if (b?.body) bodies.push({ op: reqs[m.params.requestId], body: b.body }); } };
await new Promise(r => (ws.onopen = r)); await send("Network.enable");
const ev = async x => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }))?.result?.value;
await send("Page.navigate", { url: `https://x.com/${handle}` }); await sleep(6500 + Math.random() * 2000);
const wall = await ev(`({ captcha: !!document.querySelector('iframe[src*=arkose]'), rate: /Rate limit exceeded/.test(document.body.innerText), login: location.pathname.startsWith('/i/flow/login') })`);
if (wall?.captcha || wall?.rate || wall?.login) { console.log("WALL " + JSON.stringify(wall)); process.exit(2); }
const unwrap = r => r?.__typename === "TweetWithVisibilityResults" ? r.tweet : r;
let user = null; const tw = new Map();
const harvest = () => { for (const b of bodies.splice(0)) { let j; try { j = JSON.parse(b.body); } catch { continue; }
  const walk = (o, pinned) => { if (Array.isArray(o)) return o.forEach(x => walk(x, pinned)); if (!o || typeof o !== "object") return;
    if (o.__typename === "User" && (o.core?.screen_name ?? o.legacy?.screen_name)?.toLowerCase() === handle.toLowerCase() && o.legacy && !user)
      user = { handle, name: o.core?.name ?? o.legacy.name, bio: o.legacy.description, followers: o.legacy.followers_count, following: o.legacy.friends_count, tweets: o.legacy.statuses_count,
        created: o.core?.created_at ?? o.legacy.created_at, location: o.location?.location ?? o.legacy.location, url: o.legacy.entities?.url?.urls?.[0]?.expanded_url, verified: o.is_blue_verified };
    const isPin = pinned || o.type === "TimelinePinEntry";
    const r = unwrap(o.tweet_results?.result ?? (o.itemContent?.tweet_results?.result));
    if (r?.legacy && r.rest_id) { const L = r.legacy; const u = r.core?.user_results?.result; const a = (u?.core?.screen_name ?? u?.legacy?.screen_name);
      const rt = L.retweeted_status_result?.result;
      if (!tw.has(r.rest_id)) tw.set(r.rest_id, { id: r.rest_id, author: a, pinned: isPin, date: L.created_at ? new Date(L.created_at).toISOString().slice(0, 16) : null,
        kind: rt ? "repost" : (L.in_reply_to_status_id_str ? "reply" : (L.is_quote_status ? "quote" : "post")),
        text: (r.note_tweet?.note_tweet_results?.result?.text ?? L.full_text ?? "").slice(0, 1200), views: r.views?.count ? Number(r.views.count) : null,
        likes: L.favorite_count, reposts: L.retweet_count, replies: L.reply_count, bookmarks: L.bookmark_count,
        media: [...new Set((L.extended_entities?.media || []).map(m => m.type))].join("+") || (r.article ? "article" : ""),
        article: r.article?.article_results?.result?.title ?? null, paid: !!r.content_disclosure?.advertising_disclosure?.is_paid_promotion,
        quoted: r.quoted_status_result?.result ? (unwrap(r.quoted_status_result.result)?.core?.user_results?.result?.core?.screen_name ?? "?") : null,
        urls: (L.entities?.urls || []).map(x => x.expanded_url) }); }
    for (const [k, v] of Object.entries(o)) walk(v, isPin || k === "pinned"); };
  walk(j, false); } };
for (let i = 0; i < MAXS; i++) {
  await sleep(600); harvest();
  if ([...tw.values()].filter(x => x.author?.toLowerCase() === handle.toLowerCase() && x.kind !== "reply").length >= MAXT + 3) break;
  await ev(`window.scrollBy({ top: ${800 + Math.floor(Math.random() * 500)}, behavior: 'smooth' })`); await sleep(2300 + Math.random() * 1700);
}
harvest();
const domHead = await ev(`(document.querySelector('[data-testid=primaryColumn]')?.innerText || '').split('Posts')[0].slice(0, 600)`);
if (!user || user.followers == null) user = { ...(user || { handle }), dom: domHead }; else user.dom = domHead;
const own = [...tw.values()].filter(x => x.author?.toLowerCase() === handle.toLowerCase());
fs.writeFileSync(`${OUT}/${handle}.json`, JSON.stringify({ scanned_at: new Date().toISOString(), user, tweets: own, others: [...tw.values()].filter(x => x.author?.toLowerCase() !== handle.toLowerCase()).map(x => ({ id: x.id, author: x.author, kind: x.kind, text: x.text.slice(0, 200) })) }, null, 1));
console.log(`OK @${handle} followers=${user?.followers} own=${own.length}`);
ws.close(); setTimeout(() => process.exit(0), 300);
