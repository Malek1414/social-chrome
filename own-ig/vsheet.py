# usage: python3 vsheet.py video.mp4 out_prefix  -> frames every 0.5 s, 10 cols x 6 rows per page, timestamped
import sys, glob, subprocess, tempfile, os
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 16)
v, out = sys.argv[1], sys.argv[2]; w = 160; cols, rows = 10, 6
td = tempfile.mkdtemp(); subprocess.run(["ffmpeg","-v","error","-i",v,"-vf",f"fps=2,scale={w}:-2","-q:v","5",f"{td}/f_%04d.jpg"])
fs = sorted(glob.glob(f"{td}/f_*.jpg")); per = cols*rows
for pn in range(0, len(fs), per):
    ims = [Image.open(f).convert("RGB") for f in fs[pn:pn+per]]; h = max(i.height for i in ims)
    S = Image.new("RGB", (cols*w, ((len(ims)+cols-1)//cols)*h), "black"); d = ImageDraw.Draw(S)
    for n, im in enumerate(ims):
        x, y = (n%cols)*w, (n//cols)*h; S.paste(im, (x, y)); k = pn+n
        d.rectangle([x, y, x+48, y+18], fill="black"); d.text((x+2, y+1), f"{k*0.5:.1f}", font=F, fill="yellow")
    S.save(f"{out}_{pn//per+1:02d}.jpg", quality=78)
print(v, len(fs), "frames")
