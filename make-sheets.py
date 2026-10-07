# usage: python3 make-sheets.py <code...>  builds sheet_XX.jpg (1 fps, 6x3 per sheet, timestamped) + hook.jpg (4 fps over first 3 s)
import sys, os, glob, subprocess, tempfile, json
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 18)
def frames(v, fps, t=None, w=240):
    td = tempfile.mkdtemp(); args = ["ffmpeg", "-v", "error"] + (["-t", str(t)] if t else []) + ["-i", v, "-vf", f"fps={fps},scale={w}:-2", "-q:v", "4", f"{td}/f_%04d.jpg"]
    subprocess.run(args, check=False); return sorted(glob.glob(f"{td}/f_*.jpg"))
def sheet(fs, step, out, cols=6, rows=3, w=240):
    pages = [fs[i:i+cols*rows] for i in range(0, len(fs), cols*rows)]
    for pn, pg in enumerate(pages):
        ims = [Image.open(f).convert("RGB") for f in pg]; h = max(i.height for i in ims)
        S = Image.new("RGB", (cols*w, ((len(ims)+cols-1)//cols)*h), "black"); d = ImageDraw.Draw(S)
        for n, im in enumerate(ims):
            x, y = (n % cols)*w, (n//cols)*h; S.paste(im, (x, y)); k = pn*cols*rows + n
            d.rectangle([x, y, x+64, y+22], fill="black"); d.text((x+3, y+2), f"{k*step:.1f}s", font=F, fill="yellow")
        S.save(out.format(pn+1), quality=80)
for code in sys.argv[1:]:
    d = f"reels/{code}"
    vids = [v for v in [f"{d}/video.mp4"] + sorted(glob.glob(f"{d}/slide_*.mp4")) if os.path.exists(v)]
    for v in vids:
        tag = "" if v.endswith("video.mp4") else os.path.basename(v)[:-4] + "_"
        dur = float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",v],capture_output=True,text=True).stdout.strip() or 0)
        fps = 1 if dur <= 72 else round(72/dur, 4)
        for old in glob.glob(f"{d}/{tag}sheet_*.jpg"): os.remove(old)
        sheet(frames(v, fps), 1/fps, f"{d}/{tag}sheet_{{:02d}}.jpg")
        sheet(frames(v, 4, t=3, w=270), 0.25, f"{d}/{tag}hook{{}}.jpg", cols=6, rows=2, w=270)
        print("sheets", code, tag or "video", f"dur={dur:.0f}s", f"fps={fps}")
