// Visit a profile like a normal user and record the API responses the page itself receives.
import fs from "fs";
const user = process.argv[2];
const tabs = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const t = tabs.find(x => x.type==="page" && x.url.includes("instagram.com"));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id=0; const p={}; const reqs={}; const out=[];
const send=(m,params={})=>new Promise(r=>{p[++id]=r;ws.send(JSON.stringify({id,method:m,params}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
ws.onmessage=async e=>{const m=JSON.parse(e.data);
  if(p[m.id]) return p[m.id](m.result ?? m.error);
  if(m.method==="Network.responseReceived"){const u=m.params.response.url; if(/graphql|\/api\/v1\//.test(u)) reqs[m.params.requestId]={url:u,status:m.params.response.status};}
  if(m.method==="Network.loadingFinished" && reqs[m.params.requestId]){const b=await send("Network.getResponseBody",{requestId:m.params.requestId}); out.push({...reqs[m.params.requestId], body:b?.body});}
};
await new Promise(r=>ws.onopen=r);
await send("Network.enable");
await send("Page.navigate",{url:`https://www.instagram.com/${user}/`});
await sleep(7000);
for (let i=0;i<2;i++){ await send("Runtime.evaluate",{expression:"window.scrollBy(0,1500)"}); await sleep(3500); }
fs.writeFileSync(`cap_${user}.json`, JSON.stringify(out));
console.log(out.map(o=>`${o.status} ${o.url.slice(0,110)} ${(o.body||"").length}b`).join("\n"));
ws.close();
