// X: wall detection and the GraphQL shapes shared by the x-* scripts.
export const WALL = `(() => { const col = document.querySelector('[data-testid=primaryColumn]'); return {
  captcha: !!document.querySelector('iframe[src*=arkose],iframe[src*=captcha]'),
  rate: /Rate limit exceeded/.test(document.body.innerText)
    || (!!col && [...col.querySelectorAll('button')].some(b => b.innerText.trim() === 'Retry') && !col.querySelector('article')),
  login: location.pathname.startsWith('/i/flow/login') }; })()`;
/** The wall the page is showing ({ captcha, rate, login }), or null if it's fine. */
export const wall = async tab => { const w = await tab.eval(WALL); return w && (w.captcha || w.rate || w.login) ? w : null; };

export const opOf = url => url.split("?")[0].split("/").pop();
export const unwrap = r => (r?.__typename === "TweetWithVisibilityResults" ? r.tweet : r);
export const handleOf = u => u?.core?.screen_name ?? u?.legacy?.screen_name;
export const textOf = r => r.note_tweet?.note_tweet_results?.result?.text ?? r.legacy?.full_text;
export const mp4s = m => (m.video_info?.variants || []).filter(v => v.content_type === "video/mp4");

/** A User object as plain fields. X moved most of `legacy` into separate objects in 2026; read both. */
export const userOf = u => {
  const L = u?.legacy ?? {};
  return {
    handle: handleOf(u), name: u?.core?.name ?? L.name,
    bio: u?.profile_bio?.description ?? L.description,
    followers: u?.relationship_counts?.followers ?? L.followers_count,
    following: u?.relationship_counts?.following ?? L.friends_count,
    tweets: u?.tweet_counts?.tweets ?? L.statuses_count,
    created: u?.core?.created_at ?? L.created_at,
    location: u?.location?.location ?? L.location,
    url: (u?.profile_bio?.entities?.url ?? L.entities?.url)?.urls?.[0]?.expanded_url,
    verified: u?.is_blue_verified,
  };
};
