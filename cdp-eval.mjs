// usage: node cdp-eval.mjs <url-substring> "<js expression>"
const [match, expr] = process.argv.slice(2);
const tabs = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = tabs.find(x => x.type === "page" && x.url.includes(match));
if (!t) { console.log("no tab"); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => (ws.onopen = r));
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id === 1) { console.log(JSON.stringify(m.result?.result?.value ?? m.result, null, 1)); process.exit(0); } };
ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: expr, returnByValue: true, awaitPromise: true } }));
