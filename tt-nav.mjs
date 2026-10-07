// usage: node tt-nav.mjs [url] [maxWaitMs=10000]  -> navigates the TikTok tab (if a url is given), prints title + data-e2e markers
import { open } from "./lib/cdp.mjs";
import { WALL } from "./lib/tt.mjs";

const [url, w] = process.argv.slice(2);
const tab = await open("tiktok.com");
if (url) await tab.goto(url, { max: Number(w ?? 10000) });
console.log(JSON.stringify(await tab.eval(`({ u: location.href, t: document.title,
  e2e: [...new Set([...document.querySelectorAll('[data-e2e]')].map(e => e.getAttribute('data-e2e')))].slice(0, 80),
  captcha: ${WALL}, body: document.body.innerText.slice(0, 800) })`)));
await tab.done();
