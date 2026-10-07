# Summarise creators/<user>.json: followers, cadence, median plays, outliers, top/flop posts, bio.
import json, sys, statistics as st, datetime as dt
for u in sys.argv[1:]:
    d = json.load(open(f'creators/{u}.json')); ui = d['userInfo'] or {}; s = ui.get('stats') or {}
    its = [i for i in d['items'] if i.get('plays')]
    nonpin = [i for i in its if not i['pinned']]
    print(f"\n##### @{u} | {ui.get('nickname')} | fol {s.get('followerCount')} | likes {s.get('heartCount')} | videos {s.get('videoCount')} | verified {ui.get('verified')}")
    print('bio:', (ui.get('signature') or '').replace('\n', ' / '), '| link:', ui.get('bioLink'), '| created', dt.datetime.fromtimestamp(ui['createTime']).date() if ui.get('createTime') else None)
    if not nonpin: print('no items'); continue
    dates = sorted(dt.date.fromisoformat(i['created'][:10]) for i in nonpin)
    span = max((dates[-1] - dates[0]).days, 1)
    med = st.median(i['plays'] for i in nonpin)
    print(f"scanned {len(nonpin)} posts {dates[0]}..{dates[-1]} -> {len(nonpin)/span*7:.1f}/week | median plays {med:,.0f} | median likes {st.median(i['likes'] for i in nonpin):,.0f} | mean {st.mean(i['plays'] for i in nonpin):,.0f}")
    out = [i for i in nonpin if i['plays'] >= 3 * med]; flop = [i for i in nonpin if i['plays'] <= 0.33 * med]
    print(f"outliers >=3x: {len(out)} | flops <=0.33x: {len(flop)} | branded/ad flags: {sum(1 for i in nonpin if i['ad'] or i['brandedContent'])} | photo posts: {sum(1 for i in nonpin if i['isPhoto'])}")
    for i in sorted(its, key=lambda x: -x['plays'])[:5]:
        print(f"  TOP {i['plays']:>9,} ({i['plays']/med:4.1f}x) {i['created'][:10]} {i['duration']}s {'PIN ' if i['pinned'] else ''}{i['url'].split('/')[-1]} | {(i['desc'] or '')[:100]!r}")
    for i in sorted(nonpin, key=lambda x: x['plays'])[:2]:
        print(f"  LOW {i['plays']:>9,} ({i['plays']/med:4.2f}x) {i['created'][:10]} | {(i['desc'] or '')[:90]!r}")
    print('  recent:', [ (i['created'][5:10], i['plays']) for i in sorted(nonpin, key=lambda x: x['created'], reverse=True)[:8]])
