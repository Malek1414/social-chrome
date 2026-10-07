# Digest for creator videos: python3 tt-cdigest.py <user> <idx...>
import sys, os; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib")); from common import data
import json,sys,os,glob,statistics
u=sys.argv[1]; d=json.load(open(data('creators', f'{u}.json'))); it=d['items']
med=statistics.median([x['plays'] for x in it])
for i in map(int,sys.argv[2:]):
  x=it[i]; D=data('tiktok', x['id'])
  print(f"\n=== [{i}] {x['url']} {'PINNED' if x['pinned'] else ''}\nposted {x['created'][:16]}Z | {x['duration']}s | plays {x['plays']} ({x['plays']/med:.1f}x median) likes {x['likes']} comments {x['comments']} saves {x['saves']} shares {x['shares']} | music: {x['music']}\ndesc: {x['desc']}")
  if x['stickers']: print('stickers:',x['stickers'])
  if os.path.exists(D+'/cuts.txt'):
    c=[float(l) for l in open(D+'/cuts.txt') if l.strip()]; print(f"cuts: {len(c)} {[round(v,1) for v in c[:20]]}")
  print('transcript:', open(D+'/transcript.txt').read().strip().replace('\n',' ')[:3000] if os.path.exists(D+'/transcript.txt') else 'NONE')
  if os.path.exists(D+'/comments.json'):
    cm=json.load(open(D+'/comments.json')); print('top comments:', ' || '.join(f"{c['likes']}: {c['text'][:90]}" for c in cm[:10]))
  print('sheets:', sorted(glob.glob(D+'/sheet_*.jpg')))
