# Downloads X Article cover + inline images for every x/<id>/thread.json (deduped by article title), paced 5-8 s.
import sys, os; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib")); from common import data
import json, os, glob, random, subprocess, time
H = data("x"); seen = set()
for f in sorted(glob.glob(f"{H}/*/thread.json")):
    a = json.load(open(f)).get("article")
    if not a or a["title"] in seen: continue
    seen.add(a["title"]); d = os.path.join(os.path.dirname(f), "article_img"); os.makedirs(d, exist_ok=True)
    urls = ([("cover", a["cover"])] if a.get("cover") else []) + [tuple(m.split("=", 1)) for m in a["media"] if "=" in m and m.split("=", 1)[1]]
    for name, u in urls:
        out = f"{d}/{name}{os.path.splitext(u.split('?')[0])[1] or '.jpg'}"
        if os.path.exists(out): continue
        subprocess.run(["curl", "--http1.1", "--retry", "3", "--retry-delay", "5", "-sSL", "-o", out, u + "?name=large"]); print(a["title"][:40], name, os.path.getsize(out) if os.path.exists(out) else "FAIL", flush=True)
        time.sleep(5 + random.random() * 3)
print("ARTIMG_DONE")
