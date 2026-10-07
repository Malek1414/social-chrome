// TikTok: captcha check, SSR data and item normalisation shared by the tt-* scripts.
export const WALL = `!!document.querySelector('[id*=captcha],[class*=captcha-],[class*=Captcha]') || /verify to continue|drag the slider|Drag the puzzle/i.test(document.body.innerText)`;
export const captcha = tab => tab.eval(WALL);
/** The page's server-rendered state (__UNIVERSAL_DATA_FOR_REHYDRATION__) as text. */
export const ssr = async tab => (await tab.eval(`document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__')?.textContent || ''`)) || "";
/** A stats counter from `stats` (numbers) or `statsV2` (strings); null if missing. */
export const stat = (it, k) => { const v = +(it.stats?.[k] || it.statsV2?.[k]); return Number.isFinite(v) ? v : null; };
export const musicOf = (it, markOriginal = true) => (it.music ? `${it.music.title} - ${it.music.authorName}${markOriginal && it.music.original ? " (original)" : ""}` : null);
export const itemUrl = (author, it) => `https://www.tiktok.com/@${author}/${it.imagePost ? "photo" : "video"}/${it.id}`;
export const stickersOf = it => (it.stickersOnItem || []).flatMap(s => s.stickerText || []);
