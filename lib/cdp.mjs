// Shared Chrome DevTools Protocol plumbing for the Social Chrome scripts.
// Every script does the same few things: attach to a tab of the dedicated Chrome on 127.0.0.1:9222,
// record the JSON the page itself loads, evaluate JS in the page, and copy files out of the page.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** Where scraped output goes (default: next to the scripts). Point SOCIAL_CHROME_DATA elsewhere for test runs. */
export const DATA = path.resolve(process.env.SOCIAL_CHROME_DATA || ROOT);
export const BASE = `http://127.0.0.1:${process.env.SOCIAL_CHROME_PORT || 9222}`;
/** Exit codes the batch scripts understand: 2 = captcha / rate limit / login wall, stop the batch. */
export const EXIT = { OK: 0, FAIL: 1, WALL: 2 };

export const sleep = ms => new Promise(r => setTimeout(r, ms));
/** Random pause between min and min + spread ms (human pacing). */
export const pause = (min, spread = 0) => sleep(min + Math.random() * spread);
export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
export const die = (msg, code = EXIT.FAIL) => { console.log(msg); process.exit(code); };
export const out = (...p) => path.join(DATA, ...p);
/** Merge `fields` into a JSON file (several tools write reels/<code>/meta.json; none should erase the others' fields). */
export const mergeJson = (file, fields) => {
  let prev = {}; try { prev = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  const merged = { ...prev, ...fields }; fs.writeFileSync(file, JSON.stringify(merged, null, 1)); return merged;
};
export const isoDate = (sec, len = 10) => (sec ? new Date(sec * 1000).toISOString().slice(0, len) : null);

/** Parse a captured body: one JSON document, else newline-delimited JSON (Instagram streams several). */
export function parseAll(text) {
  if (!text) return [];
  try { return [JSON.parse(text)]; } catch {}
  const docs = [];
  for (const line of text.split("\n")) { if (line.trim()) try { docs.push(JSON.parse(line)); } catch {} }
  return docs;
}

/** Visit every object in `root` in document order (iterative, so deep payloads can't overflow the stack).
 *  Return true from `visit` to skip that object's children. Arrays are walked but not visited. */
export function walk(root, visit) {
  const stack = [root];
  while (stack.length) {
    const o = stack.pop();
    if (!o || typeof o !== "object") continue;
    if (!Array.isArray(o) && visit(o) === true) continue;
    const vals = Array.isArray(o) ? o : Object.values(o);
    for (let i = vals.length - 1; i >= 0; i--) if (vals[i] && typeof vals[i] === "object") stack.push(vals[i]);
  }
}

/** walk() over every JSON document in a list of captured bodies (strings or {body}). */
export function walkBodies(bodies, visit) {
  for (const b of bodies) for (const doc of parseAll(typeof b === "string" ? b : b.body)) walk(doc, visit);
}

// "x.com" matches x.com and its subdomains (not dropbox.com); a bare word like "tiktok" matches any hostname containing it.
const onSite = (url, site) => {
  try { const h = new URL(url).hostname; return site.includes(".") ? h === site || h.endsWith("." + site) : h.includes(site); }
  catch { return false; }
};

async function devtools(pathname, init) {
  try {
    const r = await fetch(BASE + pathname, init);
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return await r.json();
  } catch (e) {
    die(`Social Chrome is not reachable on ${BASE} (${e.cause?.code ?? e.message}). Start it with ./launch.sh`);
  }
}

/**
 * Attach to a tab of Social Chrome.
 *   open("instagram.com")              reuse the first Instagram tab (opens one if there is none)
 *   open("instagram.com", { fresh })   always work in a new tab, closed again by done()
 *   open(null, { id })                 a specific tab id from /json/list
 */
export async function open(site, { fresh = false, id = null } = {}) {
  const tabs = await devtools("/json/list");
  let info = id ? tabs.find(t => t.id === id) : !fresh && tabs.find(t => t.type === "page" && onSite(t.url, site));
  if (id && !info) die(`No tab with id ${id} in Social Chrome.`);
  let owned = false;
  if (!info) { info = await devtools("/json/new?about:blank", { method: "PUT" }); owned = true; }
  const tab = new Tab(info, owned);
  await tab.ready;
  // A crash mid-run still closes a tab we opened, instead of leaving it behind in the user's browser.
  const bail = e => { console.error(e?.stack ?? e); tab.done(EXIT.FAIL); };
  process.once("uncaughtException", bail); process.once("unhandledRejection", bail);
  return tab;
}

class Tab {
  #seq = 0; #calls = new Map(); #listeners = new Map(); #netOn = false; #pageOn = false;
  inflight = new Map(); pendingBodies = 0; lastActivity = Date.now(); s429 = 0; challenge = 0;

  constructor(info, owned) {
    this.id = info.id; this.url = info.url; this.owned = owned;
    this.ws = new WebSocket(info.webSocketDebuggerUrl);
    this.ready = new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = () => rej(new Error(`Could not open DevTools socket for tab ${info.id} (is another debugger attached?)`));
    });
    this.ws.onmessage = e => this.#dispatch(JSON.parse(e.data));
    this.ws.onclose = () => { for (const c of this.#calls.values()) { clearTimeout(c.timer); c.reject(new Error("DevTools connection closed")); } this.#calls.clear(); };
  }

  #dispatch(m) {
    if (m.id) {
      const c = this.#calls.get(m.id); if (!c) return;
      this.#calls.delete(m.id); clearTimeout(c.timer);
      return m.error ? c.reject(new Error(`${c.method}: ${m.error.message}`)) : c.resolve(m.result);
    }
    for (const fn of this.#listeners.get(m.method) ?? []) fn(m.params);
  }

  /** Raw CDP call. Rejects on protocol errors and after `timeout` ms instead of hanging forever. */
  send(method, params = {}, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const id = ++this.#seq;
      const timer = setTimeout(() => { this.#calls.delete(id); reject(new Error(`${method} timed out after ${timeout} ms`)); }, timeout);
      this.#calls.set(id, { resolve, reject, timer, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, fn) {
    if (!this.#listeners.has(method)) this.#listeners.set(method, new Set());
    this.#listeners.get(method).add(fn);
    return () => this.#listeners.get(method).delete(fn);
  }

  /** Resolve with the next `method` event's params, or null after `timeout` ms. */
  once(method, timeout) {
    return new Promise(res => {
      const timer = setTimeout(() => { off(); res(null); }, timeout);
      const off = this.on(method, p => { clearTimeout(timer); off(); res(p); });
    });
  }

  /** Evaluate JS in the page (promises awaited) and return the value; undefined if it threw. */
  async eval(expression, timeout = 30000) {
    const r = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, timeout);
    if (r.exceptionDetails && process.env.DEBUG) console.error("eval:", r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result?.value;
  }

  async #network() {
    if (this.#netOn) return;
    this.#netOn = true;
    // Big buffers so large timeline / video-list responses are still retrievable when the page is done with them.
    await this.send("Network.enable", { maxTotalBufferSize: 200e6, maxResourceBufferSize: 50e6 });
    this.on("Network.responseReceived", ({ response: r }) => {
      if (r.status === 429) this.s429++;
      if (/\/challenge\/|\/checkpoint\//.test(r.url)) this.challenge++;
    });
  }

  /**
   * Record the bodies of responses the page loads whose URL matches `filter`
   * (a RegExp, or a function url -> tag/falsy). Returns a live array of { url, status, tag, body }.
   */
  async capture(filter) {
    await this.#network();
    const test = typeof filter === "function" ? filter : u => filter.test(u);
    const bodies = []; const meta = new Map();
    const finish = id => { if (this.inflight.delete(id)) this.lastActivity = Date.now(); };
    this.on("Network.requestWillBeSent", ({ requestId, request }) => {
      if (test(request.url)) { this.inflight.set(requestId, Date.now()); this.lastActivity = Date.now(); }
    });
    this.on("Network.responseReceived", ({ requestId, response: r }) => {
      const tag = test(r.url); if (tag) meta.set(requestId, { url: r.url, status: r.status, tag });
    });
    this.on("Network.loadingFinished", async ({ requestId }) => {
      const m = meta.get(requestId);
      if (!m) return finish(requestId);
      meta.delete(requestId);
      this.pendingBodies++;
      try {
        const { body, base64Encoded } = await this.send("Network.getResponseBody", { requestId });
        if (body) bodies.push({ ...m, body: base64Encoded ? Buffer.from(body, "base64").toString() : body });
      } catch {} // evicted or cancelled: the page has moved on
      this.pendingBodies--;
      finish(requestId);
    });
    this.on("Network.loadingFailed", ({ requestId }) => { meta.delete(requestId); finish(requestId); });
    return bodies;
  }

  /** Wait until captured traffic is quiet (no matching request open, started or finished for `quiet` ms), or until
   *  `until()` returns truthy. Never shorter than `min` (human pacing) nor longer than `max`. */
  async settle({ min = 0, max = 8000, quiet = 1200, until = null } = {}) {
    const t0 = Date.now();
    for (;;) {
      const now = Date.now();
      if (now - t0 >= max) return;
      if (now - t0 >= min) {
        // A request open for more than 5 s is a long-poll or stream, not data we're waiting for.
        const open = [...this.inflight.values()].some(t => now - t < 5000);
        if (!open && now - this.lastActivity >= quiet) return;
        if (until && await until()) return;
      }
      await sleep(150);
    }
  }

  /** Navigate and wait for the page plus the data it fetches, instead of a fixed sleep. */
  async goto(url, { min = 2500 + Math.random() * 1500, max = 10000, quiet = 1500, until = null } = {}) {
    if (!this.#pageOn) { this.#pageOn = true; await this.send("Page.enable"); }
    const t0 = Date.now();
    const loaded = this.once("Page.loadEventFired", max);
    this.lastActivity = t0;
    await this.send("Page.navigate", { url });
    await loaded;
    this.url = url;
    await this.settle({ min: min - (Date.now() - t0), max: max - (Date.now() - t0), quiet, until });
  }

  /** Scroll by `px` (or run a custom scroll expression) and wait for the data it triggers.
   *  Sites that never go quiet (Instagram polls constantly) end at `max`, which stays close to `min`. */
  async scroll(px, { min = 1800 + Math.random() * 1500, max = min + 2000, quiet = 1000, until = null } = {}) {
    this.lastActivity = Date.now();
    await this.eval(typeof px === "number" ? `window.scrollBy(0, ${Math.round(px)})` : px);
    await this.settle({ min, max, quiet, until });
  }

  /** fetch() each candidate URL inside the page (its cookies never leave the browser) until one
   *  returns at least `minBytes`; returns { buf, url } or null. Bytes come out in base64 chunks. */
  async fetchInPage(urls, { minBytes = 0, credentials = "same-origin", chunk = 8 << 20 } = {}) {
    const info = await this.eval(`(async () => {
      for (const u of ${JSON.stringify([...new Set(urls.filter(Boolean))])}) {
        try { const r = await fetch(u, { credentials: ${JSON.stringify(credentials)} }); if (!r.ok) continue;
          const b = await r.arrayBuffer(); if (b.byteLength < ${minBytes}) continue;
          window.__scbuf = new Uint8Array(b); return { size: b.byteLength, url: u };
        } catch {}
      }
      return null; })()`, 180000);
    if (!info) return null;
    const parts = [];
    for (let off = 0; off < info.size; off += chunk) {
      parts.push(Buffer.from(await this.eval(`(() => { const a = window.__scbuf.subarray(${off}, ${off + chunk}); let s = '';
        for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); })()`, 120000), "base64"));
    }
    await this.eval("delete window.__scbuf");
    return { buf: Buffer.concat(parts), url: info.url };
  }

  /** Detach (closing the tab if we opened it) and exit with `code`. */
  async done(code = EXIT.OK) {
    for (let i = 0; this.pendingBodies > 0 && i < 20; i++) await sleep(100); // let in-flight body reads land
    if (this.owned) await fetch(`${BASE}/json/close/${this.id}`).catch(() => {});
    this.ws.close();
    process.exit(code);
  }
}
