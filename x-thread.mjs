// Opens a tweet page in the x.com tab like a reader, scrolls slowly, and captures the TweetDetail JSON the page loads.
// Extracts: main tweet, the author's own replies (thread), X Article body (if any), top replies by others.
// usage: node x-thread.mjs <tweet_url> [scrolls=6]  -> x/<id>/thread.json + thread.md     exit 2 = wall
import fs from "fs";
import { open, out, die, walkBodies, EXIT } from "./lib/cdp.mjs";
import { wall, opOf, unwrap, handleOf, textOf, mp4s } from "./lib/x.mjs";

const [url, sc] = process.argv.slice(2); const SC = Number(sc ?? 6);
const tid = url?.match(/status\/(\d+)/)?.[1];
if (!tid) die("usage: node x-thread.mjs <tweet_url> [scrolls=6]");
const dir = out("x", tid); fs.mkdirSync(dir, { recursive: true });

const tab = await open("x.com");
const bodies = await tab.capture(u => /graphql\/[^/]+\/(TweetDetail|TweetResultByRestId|ArticleEntity|.*Article.*)/.test(u) && opOf(u));
await tab.goto(url);
const w = await wall(tab);
if (w) { console.log("WALL " + JSON.stringify(w)); await tab.done(EXIT.WALL); }
let domText = "";
for (let i = 0; i < SC; i++) {
  const txt = (await tab.eval(`document.querySelector('[data-testid=primaryColumn]')?.innerText || ''`)) || ""; if (txt.length > domText.length) domText = txt;
  await tab.scroll(`window.scrollBy({ top: ${800 + Math.floor(Math.random() * 500)}, behavior: 'smooth' })`);
}

const tw = new Map(); let article = null;
const blocksToMd = (cs) => { if (!cs?.blocks) return null; const ents = cs.entityMap || {};
  return cs.blocks.map(b => { const tx = b.text || ""; switch (b.type) { case "header-one": return "# " + tx; case "header-two": return "## " + tx; case "header-three": return "### " + tx;
    case "unordered-list-item": return "- " + tx; case "ordered-list-item": return "1. " + tx; case "blockquote": return "> " + tx; case "code-block": return "```\n" + tx + "\n```";
    case "atomic": { const ek = b.entityRanges?.[0]?.key; const en = Array.isArray(ents) ? ents.find(x => String(x.key) === String(ek))?.value : ents[ek]; if (en?.type === "MARKDOWN") return en.data?.markdown ?? ""; if (en?.type === "MEDIA") return `[image ${(en.data?.mediaItems || []).map(m => m.mediaId).join(",")}]`; return `[atomic:${en?.type ?? "?"} ${JSON.stringify(en?.data ?? {}).slice(0, 600)}]`; }
    default: return tx; } }).join("\n\n"); };
walkBodies(bodies, o => {
  const r = unwrap(o); if (r?.legacy?.full_text !== undefined && r.rest_id && !tw.has(r.rest_id)) { const L = r.legacy; const media = L.extended_entities?.media || [];
    tw.set(r.rest_id, { id: r.rest_id, author: handleOf(r.core?.user_results?.result), date: L.created_at, text: textOf(r),
      reply_to: L.in_reply_to_status_id_str, likes: L.favorite_count, views: r.views?.count, urls: (L.entities?.urls || []).map(x => x.expanded_url), media: media.map(m => m.media_url_https + (m.type !== "photo" ? ` (${m.type})` : "")),
      mp4: media.map(m => mp4s(m).sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0)).map(v => v.url).filter(u => /720|1280|1080/.test(u))[0] ?? mp4s(m).map(v => v.url).pop()).filter(Boolean) }); }
  const ar = o.article_results?.result; if (ar && (ar.content_state || ar.title) && (!article || (ar.content_state && !article.body))) article = { title: ar.title, preview: ar.preview_text, cover: ar.cover_media?.media_info?.original_img_url, body: blocksToMd(ar.content_state), media: (ar.media_entities || []).map(m => (m.media_id ?? m.media_key) + "=" + (m.media_info?.original_img_url ?? "")).filter(Boolean) };
});
const main = tw.get(tid); const author = main?.author;
const thread = [...tw.values()].filter(x => x.author === author && x.id !== tid);
const others = [...tw.values()].filter(x => x.author !== author).sort((a, b) => b.likes - a.likes).slice(0, 15);
const res = { url, main, article, thread, top_replies: others, ops: bodies.map(b => b.tag) };
fs.writeFileSync(`${dir}/thread.json`, JSON.stringify(res, null, 1));
let md = `# ${url}\n\n## Main (@${author}, ${main?.date})\n${main?.text}\n\nurls: ${main?.urls?.join(" ")}\n`;
if (article) md += `\n## ARTICLE: ${article.title}\n\n${article.body ?? "(no body in JSON: see dom.txt)\n" + article.preview}\n\nimages: ${article.media.join(" ")}\n`;
md += `\n## Author's thread replies (${thread.length})\n` + thread.map(x => `- [${x.date}] ${x.text}  ${x.urls.join(" ")}`).join("\n");
md += `\n\n## Top replies by others\n` + others.map(x => `- @${x.author} (${x.likes}♥): ${x.text.replace(/\n/g, " ").slice(0, 300)}`).join("\n");
fs.writeFileSync(`${dir}/thread.md`, md); fs.writeFileSync(`${dir}/dom.txt`, domText);
console.log(`OK ${tid} ops=${res.ops.join(",")} article=${!!article}${article?.body ? "(" + article.body.length + " chars)" : ""} thread=${thread.length} replies=${others.length}`);
await tab.done(main ? EXIT.OK : EXIT.FAIL);
