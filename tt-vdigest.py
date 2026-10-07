# Per-video digest for discovery videos: meta from search/*.json or creators/*.json, cuts, transcript, top comments, sheets.
# usage: python3 tt-vdigest.py <id> [<id>...]
import sys, os; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib")); from common import data
import json, sys, os, glob
meta = {}
for f in glob.glob(data('tt-search', '*.json')):
    for i in json.load(open(f))['items']: meta.setdefault(i['id'], i)
for f in glob.glob(data('creators', '*.json')):
    for i in json.load(open(f))['items']: meta.setdefault(i['id'], {**i, 'author': os.path.basename(f)[:-5]})
for vid in sys.argv[1:]:
    m = meta.get(vid, {}); D = data('tiktok', vid)
    print(f"\n=== {m.get('url')} | @{m.get('author')} ({m.get('authorFollowers')} fol) | {m.get('created')} | {m.get('duration')}s | plays {m.get('plays')} likes {m.get('likes')} saves {m.get('saves')} shares {m.get('shares')} comments {m.get('comments')}")
    print('music:', m.get('music')); print('desc:', (m.get('desc') or '').replace('\n', ' '))
    if os.path.exists(D + '/cuts.txt'):
        cuts = [float(x) for x in open(D + '/cuts.txt') if x.strip()]; dur = m.get('duration') or 1
        print(f"cuts: {len(cuts)} -> avg shot {dur/(len(cuts)+1):.1f}s; {[round(c,1) for c in cuts[:40]]}")
    t = D + '/transcript.txt'
    print('transcript:', open(t).read().strip().replace('\n', ' ')[:5000] if os.path.exists(t) else 'NONE')
    c = D + '/comments.json'
    if os.path.exists(c): print('top comments:', [(x['text'][:90], x['likes']) for x in json.load(open(c))[:10]])
    print('sheets:', sorted(glob.glob(D + '/sheet_*.jpg')))
