# Prints a per-video digest (metadata, cut stats, transcript, sheet paths) for items in tt_favorites_recent.json.
# usage: python3 tt-digest.py <list: favorites|liked> <start> <end>
import json, sys, os, glob
lst, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
d = json.load(open(os.path.expanduser("~/Desktop/social-chrome/tt_favorites_recent.json")))
for i, f in enumerate(d[lst][a:b], start=a):
    D = os.path.expanduser(f"~/Desktop/social-chrome/tiktok/{f['id']}")
    print(f"\n=== #{i} {f['url']}\n@{f['author']} ({f['authorName']}, {f['authorFollowers']} followers) | posted {f['postDate']} | {'PHOTO' if f['isPhoto'] else str(f['duration'])+'s'} | plays {f['plays']} likes {f['likes']} saves {f['saves']} shares {f['shares']} comments {f['comments']}")
    print("music:", f['music']); print("desc:", (f['desc'] or '').replace('\n', ' '))
    if f.get('stickers'): print("stickers:", f['stickers'])
    if f.get('contentDesc'): print("slide text:", f['contentDesc'])
    if os.path.exists(D + "/cuts.txt"):
        cuts = [float(x) for x in open(D + "/cuts.txt") if x.strip()]
        dur = f['duration'] or 1
        print(f"hard cuts (scene>0.25): {len(cuts)} -> avg shot {dur/(len(cuts)+1):.1f}s; first cuts: {[round(c,1) for c in cuts[:15]]}")
    t = D + "/transcript.txt"
    print("transcript:", open(t).read().strip().replace('\n', ' ')[:6000] if os.path.exists(t) else "NO TRANSCRIPT")
    print("sheets:", sorted(glob.glob(D + "/sheet_*.jpg")))
