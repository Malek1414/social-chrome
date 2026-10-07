import json,os
d=json.load(open(os.path.expanduser('~/Desktop/social-chrome/tt_favorites_recent.json')))
for k in ('favorites','liked'):
  done=[]
  for i,f in enumerate(d[k]):
    D=os.path.expanduser(f"~/Desktop/social-chrome/tiktok/{f['id']}")
    ok=os.path.exists(D+'/sheet_1.jpg') and (f['isPhoto'] or os.path.exists(D+'/transcript.txt'))
    done.append(ok)
  first_missing = done.index(False) if False in done else len(done)
  print(k, sum(done), '/', len(done), 'contiguous_done_upto', first_missing, 'missing', [i for i,x in enumerate(done) if not x][:40])
