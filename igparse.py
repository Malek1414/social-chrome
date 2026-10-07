import json,sys,datetime
cap=json.load(open(sys.argv[1])); owner=sys.argv[2]; posts={}; prof={}
def walk(o):
    if isinstance(o,dict):
        if o.get("username")==owner and "follower_count" in o: prof.update({k:o.get(k) for k in ("full_name","follower_count","following_count","media_count")})
        code=o.get("code")
        if code and "taken_at" in o and (o.get("user") or {}).get("username")==owner:
            cap_=(o.get("caption") or {}).get("text","") if isinstance(o.get("caption"),dict) else ""
            posts[code]={"date":datetime.date.fromtimestamp(o["taken_at"]).isoformat(),"plays":o.get("play_count") or o.get("ig_play_count") or o.get("view_count"),"likes":o.get("like_count"),"comments":o.get("comment_count"),"caption":cap_[:70].replace("\n"," ")}
        for v in o.values(): walk(v)
    elif isinstance(o,list):
        for v in o: walk(v)
for r in cap:
    for line in (r.get("body") or "").splitlines():
        try: walk(json.loads(line))
        except Exception: pass
print(owner, prof)
for c,p in sorted(posts.items(),key=lambda x:x[1]["date"],reverse=True): print(p["date"],c,"plays",p["plays"],"likes",p["likes"],"comments",p["comments"],"|",p["caption"])
