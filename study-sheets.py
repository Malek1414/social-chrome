# usage: python3 study-sheets.py <code...> -> reels/<code>/ss_XX.jpg (2 fps if <=40 s else 1 fps; 5x3, timestamped, 320 px)
import sys, os, glob, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 20)
def frames(v, fps, w):
    td = tempfile.mkdtemp(); subprocess.run(["ffmpeg","-v","error","-i",v,"-vf",f"fps={fps},scale={w}:-2","-q:v","4",f"{td}/f_%04d.jpg"]); return sorted(glob.glob(f"{td}/f_*.jpg"))
for code in sys.argv[1:]:
    d=f"reels/{code}"; v=f"{d}/video.mp4"
    if not os.path.exists(v): print("NOVIDEO",code); continue
    dur=float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",v],capture_output=True,text=True).stdout.strip() or 0)
    fps = 2 if dur<=40 else (1 if dur<=90 else round(90/dur,3))
    for o in glob.glob(f"{d}/ss_*.jpg"): os.remove(o)
    fs=frames(v,fps,320); cols,rows,w=5,3,320
    for pn in range(0,len(fs),cols*rows):
        ims=[Image.open(f).convert("RGB") for f in fs[pn:pn+cols*rows]]; h=max(i.height for i in ims)
        S=Image.new("RGB",(cols*w,((len(ims)+cols-1)//cols)*h),"black"); dr=ImageDraw.Draw(S)
        for n,im in enumerate(ims):
            x,y=(n%cols)*w,(n//cols)*h; S.paste(im,(x,y)); k=pn+n
            dr.rectangle([x,y,x+70,y+24],fill="black"); dr.text((x+3,y+2),f"{k/fps:.1f}s",font=F,fill="yellow")
        S.save(f"{d}/ss_{pn//(cols*rows)+1:02d}.jpg",quality=78)
    print("OK",code,f"dur={dur:.1f}",f"fps={fps}",f"frames={len(fs)}")
