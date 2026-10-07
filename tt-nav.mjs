// usage: node tt-nav.mjs <url> [waitMs]  -> navigates the TikTok tab, prints title + data-e2e tabs
const [url, w] = process.argv.slice(2);
const tabs = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = tabs.find(x => x.type === "page" && x.url.includes("tiktok.com"));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = {};
const send = (m, params = {}) => new Promise(r => { p[++id] = r; ws.send(JSON.stringify({ id, method: m, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (p[m.id]) p[m.id](m.result ?? m.error); };
await new Promise(r => (ws.onopen = r));
if (url) { await send("Page.navigate", { url }); await new Promise(r => setTimeout(r, Number(w ?? 7000))); }
const v = (await send("Runtime.evaluate", { expression: `JSON.stringify({u:location.href,t:document.title,
 e2e:[...new Set([...document.querySelectorAll('[data-e2e]')].map(e=>e.getAttribute('data-e2e')))].slice(0,80),
 captcha: !!document.querySelector('[id*=captcha],[class*=captcha],[class*=Captcha]'),
 body: document.body.innerText.slice(0,800)})`, returnByValue: true })).result.value;
console.log(v); ws.close(); process.exit(0);
