// Opens a tweet page in the x.com tab like a reader, scrolls slowly, and captures the TweetDetail JSON the page loads.
// Extracts: main tweet, the author's own replies (thread), X Article body (if any), top replies by others.
// usage: node x-thread.mjs <tweet_url> [scrolls=6]  -> x/<id>/thread.json + thread.md     exit 2 = wall
import fs from "fs";
const [url, sc] = process.argv.slice(2); const SC = Number(sc ?? 6);
const tid = url.match(/status\/(\d+)/)[1];
const out = `${process.env.HOME}/Desktop/social-chrome/x/${tid}`; fs.mkdirSync(out, { recursive: true });
const tabs = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = tabs.find(x => x.type === "page" && x.url.includes("x.com"));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = {}; const reqs = {}; const bodies = [];
const send = (m, params = {}) => new Promise(r => { p[++id] = r; ws.send(JSON.stringify({ id, method: m, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
ws.onmessage = async e => { const m = JSON.parse(e.data); if (p[m.id]) return p[m.id](m.result ?? m.error);
  if (m.method === "Network.responseReceived" && /graphql\/[^/]+\/(TweetDetail|TweetResultByRestId|ArticleEntity|.*Article.*)/.test(m.params.response.url)) reqs[m.params.requestId] = m.params.response.url.split("?")[0].split("/").pop();
  if (m.method === "Network.loadingFinished" && reqs[m.params.requestId]) { const b = await send("Network.getResponseBody", { requestId: m.params.requestId }); if (b?.body) bodies.push({ op: reqs[m.params.requestId], body: b.body }); } };
await new Promise(r => (ws.onopen = r)); await send("Network.enable");
const ev = async x => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true }))?.result?.value;
await send("Page.navigate", { url }); await sleep(6000 + Math.random() * 2000);
const wall = await ev(`({ captcha: !!document.querySelector('iframe[src*=arkose]'), rate: /Rate limit exceeded/.test(document.body.innerText) || ([...document.querySelectorAll('[data-testid=primaryColumn] button')].some(b => b.innerText.trim() === 'Retry') && !document.querySelector('[data-testid=primaryColumn] article')), login: location.pathname.startsWith('/i/flow/login') })`);
if (wall?.captcha || wall?.rate || wall?.login) { console.log("WALL " + JSON.stringify(wall)); process.exit(2); }
let domText = "";
for (let i = 0; i < SC; i++) {
  const txt = await ev(`document.querySelector('[data-testid=primaryColumn]')?.innerText || ''`); if (txt.length > domText.length) domText = txt;
  await ev(`window.scrollBy({ top: ${800 + Math.floor(Math.random() * 500)}, behavior: 'smooth' })`); await sleep(2200 + Math.random() * 1800);
}
const unwrap = r => r?.__typename === "TweetWithVisibilityResults" ? r.tweet : r;
const tw = new Map(); let article = null;
const blocksToMd = (cs) => { if (!cs?.blocks) return null; const ents = cs.entityMap || {};
  return cs.blocks.map(b => { const tx = b.text || ""; switch (b.type) { case "header-one": return "# " + tx; case "header-two": return "## " + tx; case "header-three": return "### " + tx;
    case "unordered-list-item": return "- " + tx; case "ordered-list-item": return "1. " + tx; case "blockquote": return "> " + tx; case "code-block": return "```\n" + tx + "\n```";
    case "atomic": { const ek = b.entityRanges?.[0]?.key; const en = Array.isArray(ents) ? ents.find(x => String(x.key) === String(ek))?.value : ents[ek]; if (en?.type === "MARKDOWN") return en.data?.markdown ?? ""; if (en?.type === "MEDIA") return `[image ${(en.data?.mediaItems || []).map(m => m.mediaId).join(",")}]`; return `[atomic:${en?.type ?? "?"} ${JSON.stringify(en?.data ?? {}).slice(0, 600)}]`; }
    default: return tx; } }).join("\n\n"); };
const walk = o => { if (Array.isArray(o)) return o.forEach(walk); if (!o || typeof o !== "object") return;
  const r = unwrap(o); if (r?.legacy?.full_text !== undefined && r.rest_id) { const L = r.legacy; const u = r.core?.user_results?.result;
    if (!tw.has(r.rest_id)) tw.set(r.rest_id, { id: r.rest_id, author: u?.core?.screen_name ?? u?.legacy?.screen_name, date: L.created_at, text: r.note_tweet?.note_tweet_results?.result?.text ?? L.full_text,
      reply_to: L.in_reply_to_status_id_str, likes: L.favorite_count, views: r.views?.count, urls: (L.entities?.urls || []).map(x => x.expanded_url), media: (L.extended_entities?.media || []).map(m => m.media_url_https + (m.type !== "photo" ? ` (${m.type})` : "")),
      mp4: (L.extended_entities?.media || []).map(m => (m.video_info?.variants || []).filter(v => v.content_type === "video/mp4").sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0)).map(v => v.url).filter(u => /720|1280|1080/.test(u))[0] ?? (m.video_info?.variants || []).filter(v => v.content_type === "video/mp4").map(v => v.url).pop()).filter(Boolean) }); }
  const ar = o.article_results?.result; if (ar && (ar.content_state || ar.title) && (!article || (ar.content_state && !article.body))) article = { title: ar.title, preview: ar.preview_text, cover: ar.cover_media?.media_info?.original_img_url, body: blocksToMd(ar.content_state), media: (ar.media_entities || []).map(m => (m.media_id ?? m.media_key) + "=" + (m.media_info?.original_img_url ?? "")).filter(Boolean) };
  Object.values(o).forEach(walk); };
for (const b of bodies) { try { walk(JSON.parse(b.body)); } catch {} }
const main = tw.get(tid); const author = main?.author;
const thread = [...tw.values()].filter(x => x.author === author && x.id !== tid);
const others = [...tw.values()].filter(x => x.author !== author).sort((a, b) => b.likes - a.likes).slice(0, 15);
const res = { url, main, article, thread, top_replies: others, ops: bodies.map(b => b.op) };
fs.writeFileSync(`${out}/thread.json`, JSON.stringify(res, null, 1));
let md = `# ${url}\n\n## Main (@${author}, ${main?.date})\n${main?.text}\n\nurls: ${main?.urls?.join(" ")}\n`;
if (article) md += `\n## ARTICLE: ${article.title}\n\n${article.body ?? "(no body in JSON: see dom.txt)\n" + article.preview}\n\nimages: ${article.media.join(" ")}\n`;
md += `\n## Author's thread replies (${thread.length})\n` + thread.map(x => `- [${x.date}] ${x.text}  ${x.urls.join(" ")}`).join("\n");
md += `\n\n## Top replies by others\n` + others.map(x => `- @${x.author} (${x.likes}♥): ${x.text.replace(/\n/g, " ").slice(0, 300)}`).join("\n");
fs.writeFileSync(`${out}/thread.md`, md); fs.writeFileSync(`${out}/dom.txt`, domText);
console.log(`OK ${tid} ops=${res.ops.join(",")} article=${!!article}${article?.body ? "(" + article.body.length + " chars)" : ""} thread=${thread.length} replies=${others.length}`);
ws.close(); setTimeout(() => process.exit(0), 300);
