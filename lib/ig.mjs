// Instagram: where post data lives in the page and how to read it.
import { walkBodies } from "./cdp.mjs";

export const API = /graphql|\/api\/v1\//;
export const GRID_LINKS = `[...document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"]')].map(a => a.getAttribute('href'))`;
export const codeOf = href => href?.match(/(?:p|reels?)\/([\w-]+)/)?.[1];
export const playsOf = o => o.play_count ?? o.ig_play_count ?? o.view_count ?? null;
export const musicOf = o => o.clips_metadata?.music_info?.music_asset_info?.title ?? o.clips_metadata?.original_sound_info?.original_audio_title ?? null;
/** Largest rendition of image_versions2.candidates / video_versions. */
export const largest = list => list?.slice().sort((a, b) => b.width * b.height - a.width * a.height)[0];

/** JSON the server embedded in the page (<script type="application/json">), only blobs containing one of `needles`. */
export const ssrJson = async (tab, ...needles) => (await tab.eval(`[...document.querySelectorAll('script[type="application/json"]')]
  .map(s => s.textContent).filter(t => ${JSON.stringify(needles)}.some(n => t.includes(n)))`)) || [];

/** Rate limited, or bounced to a challenge / login page: stop and back off. */
export const blocked = async tab => tab.s429 > 0 || tab.challenge > 0
  || /\/challenge\/|\/checkpoint\/|\/accounts\/login/.test((await tab.eval("location.href")) || "");

/** Every media object for `code` in the captured bodies and SSR blobs, richest first
 *  (Instagram sends the same post several times, some copies without stats or video URLs). */
export function mediaFor(code, sources) {
  const found = [];
  walkBodies(sources, o => { if (o.code === code && (o.taken_at || o.image_versions2 || o.video_versions || o.carousel_media)) found.push(o); });
  const score = o => (o.video_versions?.length ? 4 : 0) + (o.carousel_media ? 4 : 0) + (o.like_count != null ? 2 : 0) + (o.taken_at ? 1 : 0) + (o.user?.username ? 1 : 0);
  return found.sort((a, b) => score(b) - score(a));
}

/** First non-null value of `key` across copies of the same post. */
export const pick = (copies, f) => { for (const c of copies) { const v = f(c); if (v != null) return v; } return null; };

/** Merge one more copy of a post into its profile-scan record (later copies fill gaps, never erase). */
export const mergePost = (prev = {}, o, { dateLen = 16, capLen = 1500, size = false } = {}) => ({
  ...prev, code: o.code, date: new Date(o.taken_at * 1000).toISOString().slice(0, dateLen), type: o.product_type || o.media_type,
  likes: o.like_count ?? prev.likes, comments: o.comment_count ?? prev.comments, plays: playsOf(o) ?? prev.plays ?? null,
  duration: o.video_duration ?? prev.duration ?? null, pinned: !!(o.timeline_pinned_user_ids?.length || o.clips_tab_pinned_user_ids?.length) || prev.pinned || false,
  paid_partnership: o.is_paid_partnership ?? prev.paid_partnership, sponsor: o.sponsor_tags?.map(s => s.sponsor?.username) ?? prev.sponsor,
  coauthors: o.coauthor_producers?.map(c => c.username) ?? prev.coauthors, music: musicOf(o) ?? prev.music,
  ...(size && { w: o.original_width ?? prev.w, h: o.original_height ?? prev.h }),
  caption: (o.caption?.text ?? prev.caption ?? "").slice(0, capLen) });

/** A saved-posts / search record for a post. */
export const savedRecord = (o, capLen = 600) => ({ code: o.code, author: o.user.username, date: new Date(o.taken_at * 1000).toISOString().slice(0, 10),
  type: o.product_type || o.media_type, likes: o.like_count, comments: o.comment_count, plays: o.play_count ?? o.ig_play_count ?? null,
  caption: (o.caption?.text || "").slice(0, capLen) });

/** Scroll a grid until no new post links show up for `patience` scrolls; returns links in first-seen order. */
export async function scrollGrid(tab, { maxScrolls, patience = 6, px = () => 1400 + Math.random() * 600, links = GRID_LINKS, onLinks = null, stop = null, every = null } = {}) {
  const seen = new Set(); let still = 0;
  for (let i = 0; i < maxScrolls; i++) {
    const got = (await tab.eval(links)) || []; const n = seen.size;
    for (const h of got) { const href = Array.isArray(h) ? h[0] : h; seen.add(href); onLinks?.(h); }
    still = seen.size === n ? still + 1 : 0;
    every?.(i, seen.size);
    if (stop && await stop()) break;
    if (still >= patience) break;
    await tab.scroll(px());
    if (still >= 3) await tab.scroll("window.scrollTo(0, document.body.scrollHeight)", { min: 3500, max: 5000 });
  }
  return [...seen];
}

/** An `until` check for tab.goto(): true once the post `code` with field `key` is in a newly captured body or
 *  in the page's embedded JSON. The embedded check runs inside the page, so nothing big crosses the socket per tick. */
export const postReady = (tab, bodies, code, key) => {
  let seen = 0;
  return async () => {
    if (bodies.length > seen) { const fresh = bodies.slice(seen); seen = bodies.length; if (mediaFor(code, fresh).some(o => o[key] != null)) return true; }
    return !!await tab.eval(`[...document.querySelectorAll('script[type="application/json"]')]
      .some(s => s.textContent.includes(${JSON.stringify(code)}) && s.textContent.includes(${JSON.stringify(`"${key}"`)}))`);
  };
};
