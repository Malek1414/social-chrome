import json, sys, statistics, datetime, collections
for u in sys.argv[1:]:
    try: d = json.load(open(f"/Users/malekhassan/Desktop/social-chrome/profiles/{u}_full.json"))
    except Exception as e: print("NOFILE", u); continue
    p = d['profile']; posts = [x for x in d['posts'] if x.get('date')]
    posts.sort(key=lambda x: x['date'], reverse=True)
    likes = [x['likes'] for x in posts if (x.get('likes') or 0) > 3]
    rec = [x['likes'] for x in posts[:30] if (x.get('likes') or 0) > 3]
    dates = [datetime.datetime.fromisoformat(x['date']) for x in posts]
    span = (dates[0]-dates[-1]).days if len(dates)>1 else 0
    last60 = [x for x in dates if (dates[0]-x).days <= 60]
    print(f"=== @{u} | {p.get('full_name')} | followers {p.get('followers')} | media {p.get('media_count')} | cat {p.get('category')}")
    print("bio:", (p.get('bio') or '').replace('\n',' / ')[:300])
    print("links:", [b.get('url') for b in (p.get('bio_links') or [])] or p.get('external'))
    print(f"captured {len(posts)} posts {posts[-1]['date'][:10] if posts else ''}..{posts[0]['date'][:10] if posts else ''} | last60d posts {len(last60)} (~{len(last60)/8.6:.1f}/wk) | median likes last30 {statistics.median(rec) if rec else None} | all-median {statistics.median(likes) if likes else None}")
    types = collections.Counter(x.get('type') for x in posts); print("types:", dict(types), "| paid:", sum(1 for x in posts if x.get('paid_partnership')), "| coauthors:", collections.Counter(c for x in posts for c in (x.get('coauthors') or [])).most_common(5))
    for x in sorted([x for x in posts if x.get('likes') is not None], key=lambda x: -x['likes'])[:6]:
        print(f"  TOP {x['code']} {x['date'][:10]} L{x['likes']} C{x.get('comments')} {round(x['duration']) if x.get('duration') else ''}s | {(x.get('caption') or '').replace(chr(10),' ')[:150]}")
    for x in posts[:6]:
        print(f"  NEW {x['code']} {x['date'][:10]} L{x.get('likes')} | {(x.get('caption') or '').replace(chr(10),' ')[:110]}")
