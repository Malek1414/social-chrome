// Checks whether IG handles resolve to a profile, by visiting each page in ONE new tab (paced 12-20 s), then closes the tab.
// usage: node ig-handle-check.mjs h1 h2 ...   prints TAKEN/FREE? per handle (FREE? = page not available; verify on signup)
import { open, die, pause } from "./lib/cdp.mjs";

const handles = process.argv.slice(2);
if (!handles.length) die("usage: node ig-handle-check.mjs h1 h2 ...");
const tab = await open("instagram.com", { fresh: true });
for (const [i, h] of handles.entries()) {
  await tab.goto(`https://www.instagram.com/${h}/`, { min: 5000 + Math.random() * 2000 });
  const { t: title, body } = (await tab.eval(`({ t: document.title, body: document.body.innerText.slice(0, 600) })`)) ?? { t: "", body: "" };
  const gone = /isn.t available|page may have been removed|Sorry, this page/i.test(body + title);
  const followers = body.match(/([\d.,KM]+)\s+followers/i)?.[1] ?? "";
  const posts = body.match(/([\d.,KM]+)\s+posts/i)?.[1] ?? "";
  const login = /log in|sign up/i.test(title) && !gone && !followers;
  console.log(`${gone ? "FREE?" : login ? "UNCLEAR" : "TAKEN"}\t@${h}\t${followers ? followers + " followers" : ""} ${posts ? posts + " posts" : ""}\t${gone ? "" : title.slice(0, 60)}`);
  if (i < handles.length - 1) await pause(5000, 8000);
}
await tab.done();
