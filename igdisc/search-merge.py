# merge search/*.json -> ranked posts & creators, excluding known handles
import json, glob, sys, collections
known = set(l.strip().lstrip('@') for l in open(sys.argv[1])) if len(sys.argv)>1 else set()
seen = {}; qs = collections.defaultdict(set)
for f in glob.glob('search/*.json'):
    d = json.load(open(f))
    for p in d['posts']:
        if not p.get('user'): continue
        seen.setdefault(p['code'], p); qs[p['code']].add(d['q'])
cre = collections.defaultdict(lambda: {'n':0,'max':0,'qs':set(),'codes':[]})
for c,p in seen.items():
    u=p['user']; k=cre[u]; k['n']+=1; k['max']=max(k['max'],p.get('likes') or 0); k['qs']|=qs[c]; k['codes'].append(c)
mode = sys.argv[2] if len(sys.argv)>2 else 'posts'
if mode=='creators':
    for u,k in sorted(cre.items(), key=lambda x:-x[1]['max']):
        flag = 'KNOWN' if u.lower() in known else ''
        print(f"{u}\t{flag}\tn={k['n']}\tmax={k['max']}\t{'|'.join(sorted(k['qs']))[:80]}")
else:
    for c,p in sorted(seen.items(), key=lambda x:-(x[1].get('likes') or 0)):
        if p['user'].lower() in known: continue
        print(f"{c}\t@{p['user']}\t{p.get('date')}\tL{p.get('likes')}\tC{p.get('comments')}\t{round(p['dur']) if p.get('dur') else ''}\t[{','.join(sorted(qs[c]))[:40]}]\t{p.get('cap','')[:160]}")
