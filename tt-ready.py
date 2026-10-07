import sys, os; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib")); from common import data
import json,os,sys
a,b=int(sys.argv[1]),int(sys.argv[2])
d=json.load(open(data('tt_favorites_recent.json')))
miss=[i for i,f in enumerate(d['favorites'][a:b],start=a) if not (os.path.exists(data("tiktok", f["id"], "sheet_1.jpg")) and (f['isPhoto'] or os.path.exists(data("tiktok", f["id"], "transcript.txt"))))]
print(miss); sys.exit(0 if len(miss)<=1 else 1)
