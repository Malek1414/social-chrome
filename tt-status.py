import sys, os; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib")); from common import data
import json,os
d=json.load(open(data('tt_favorites_recent.json')))
for k in ('favorites','liked'):
  done=[]
  for i,f in enumerate(d[k]):
    D=data("tiktok", f["id"])
    ok=os.path.exists(D+'/sheet_1.jpg') and (f['isPhoto'] or os.path.exists(D+'/transcript.txt'))
    done.append(ok)
  first_missing = done.index(False) if False in done else len(done)
  print(k, sum(done), '/', len(done), 'contiguous_done_upto', first_missing, 'missing', [i for i,x in enumerate(done) if not x][:40])
