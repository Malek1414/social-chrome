# Merge all search/*.json, dedupe, drop already-covered creators, print candidates ranked.
import json, glob, sys
COVERED = set(json.load(open('covered_authors.json')))
items, users, rel = {}, {}, {}
for f in sorted([g for g in glob.glob('tt-search/*.json') if 'query' in open(g).read(200)]):
    d = json.load(open(f)); q = d['query']
    rel[q] = d.get('related', [])
    for i in d['items']:
        x = items.setdefault(i['id'], {**i, 'queries': []}); x['queries'].append(q)
    for u in d['users']:
        users.setdefault(u['handle'], {**u, 'queries': []})['queries'].append(q)
mode = sys.argv[1] if len(sys.argv) > 1 else 'items'
if mode == 'rel':
    for q, r in rel.items(): print(q, '->', r)
elif mode == 'users':
    for u in sorted(users.values(), key=lambda u: -(u['followers'] or 0)): print(u['handle'], u['followers'], u['queries'], (u['bio'] or '')[:90].replace('\n', ' '))
else:
    by = {}
    for i in items.values():
        if i['author'] in COVERED: continue
        by.setdefault(i['author'], []).append(i)
    rows = sorted(by.items(), key=lambda kv: -max(x['plays'] or 0 for x in kv[1]))
    for a, its in rows:
        print(f"@{a} ({its[0]['authorFollowers']} fol)")
        for i in sorted(its, key=lambda x: -(x['plays'] or 0)):
            sr = (i['saves'] or 0) / max(i['plays'] or 1, 1) * 100
            print(f"   {i['id']} {i['created']} {i['plays']:>9} pl {i['likes']:>7} lk {sr:4.1f}%sv {i['duration']}s | {','.join(set(i['queries']))[:40]} | {(i['desc'] or '')[:110]!r}")
