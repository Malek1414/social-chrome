# Downloads media for x_bookmarks_recent.json items (and quoted-post media) from public twimg URLs, paced 5-10 s.
# usage: python3 x-media.py   -> x/<tweet_id>/{video.mp4 | photo_N.jpg, meta.json}
import sys, os; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib")); from common import data
import json, os, random, subprocess, time
H = data()
d = json.load(open(f"{H}/x_bookmarks_recent.json"))
def pick(m):
    v = m["variants"]; dur = (m.get("duration_ms") or 0) / 1000
    want = 2176000 if dur <= 300 else (832000 if dur <= 4000 else 256000)
    return min(v, key=lambda x: abs((x["bitrate"] or 0) - want))["url"]
jobs = []
for it in d["items"]:
    jobs.append((it["id"], it["media"], it))
    if it["quoted"] and it["quoted"]["media"] and it["quoted"]["id"] not in [x["id"] for x in d["items"]]:
        jobs.append((it["quoted"]["id"], it["quoted"]["media"], it["quoted"]))
for tid, media, it in jobs:
    out = f"{H}/x/{tid}"; os.makedirs(out, exist_ok=True)
    json.dump(it, open(f"{out}/meta.json", "w"), indent=1)
    for n, m in enumerate(media):
        if m["type"] in ("video", "animated_gif") and m["variants"]:
            f = f"{out}/video.mp4" if n == 0 else f"{out}/video_{n}.mp4"; url = pick(m)
        else:
            f = f"{out}/photo_{n}.jpg"; url = m["url"] + "?name=large"
        if os.path.exists(f) and os.path.getsize(f) > 10000: print("SKIP", f); continue
        print("GET", tid, url[:90], flush=True)
        subprocess.run(["curl", "--http1.1", "-sSL", "--retry", "3", "-o", f, url])
        print("  ->", round(os.path.getsize(f) / 1e6, 2) if os.path.exists(f) else "FAIL", "MB", flush=True)
        time.sleep(5 + random.random() * 5)
print("MEDIA_DONE")
