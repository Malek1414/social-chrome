// Checks whether IG handles resolve to a profile, by visiting each page in ONE new tab (paced 12-20 s), then closes the tab.
// usage: node ig-handle-check.mjs h1 h2 ...   prints TAKEN/FREE? per handle (FREE? = page not available; verify on signup)
const handles = process.argv.slice(2);
const t = await (await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = {};
const send = (m, params = {}) => new Promise(r => { p[++id] = r; ws.send(JSON.stringify({ id, method: m, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (p[m.id]) p[m.id](m.result ?? m.error); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
await new Promise(r => (ws.onopen = r));
for (const h of handles) {
  await send("Page.navigate", { url: `https://www.instagram.com/${h}/` }); await sleep(7000);
  const r = (await send("Runtime.evaluate", { expression: `JSON.stringify({ t: document.title, body: document.body.innerText.slice(0, 600) })`, returnByValue: true })).result.value;
  const { t: title, body } = JSON.parse(r);
  const gone = /isn.t available|page may have been removed|Sorry, this page/i.test(body + title);
  const followers = body.match(/([\d.,KM]+)\s+followers/i)?.[1] ?? "";
  const posts = body.match(/([\d.,KM]+)\s+posts/i)?.[1] ?? "";
  const login = /log in|sign up/i.test(title) && !gone && !followers;
  console.log(`${gone ? "FREE?" : login ? "UNCLEAR" : "TAKEN"}\t@${h}\t${followers ? followers + " followers" : ""} ${posts ? posts + " posts" : ""}\t${gone ? "" : title.slice(0, 60)}`);
  await sleep(5000 + Math.random() * 8000);
}
await fetch(`http://127.0.0.1:9222/json/close/${t.id}`); process.exit(0);
