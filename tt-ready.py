import json,os,sys
a,b=int(sys.argv[1]),int(sys.argv[2])
d=json.load(open(os.path.expanduser('~/Desktop/social-chrome/tt_favorites_recent.json')))
miss=[i for i,f in enumerate(d['favorites'][a:b],start=a) if not (os.path.exists(os.path.expanduser(f"~/Desktop/social-chrome/tiktok/{f['id']}/sheet_1.jpg")) and (f['isPhoto'] or os.path.exists(os.path.expanduser(f"~/Desktop/social-chrome/tiktok/{f['id']}/transcript.txt"))))]
print(miss); sys.exit(0 if len(miss)<=1 else 1)
