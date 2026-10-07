import subprocess, shutil, os, sys
from picks import BG, GALLERY, MONTAGE
OUT = os.path.expanduser("~/Desktop/Projects/personalwebsite/assets/candidates")
def run(a): subprocess.run(a, check=True)
for cat, picks in (("bg", BG), ("gallery", GALLERY), ("montage", MONTAGE)):
    for name, src, kind, p in picks:
        d = f"{OUT}/{cat}"
        if kind == "copy":
            shutil.copy2(src, f"{d}/{name}.jpg")
        elif kind == "frame":
            run(["ffmpeg","-v","error","-y","-ss",str(p),"-i",src,"-frames:v","1","-q:v","1",f"{d}/{name}.jpg"])
        elif kind == "loop":
            s, e = p
            run(["ffmpeg","-v","error","-y","-ss",str(s),"-i",src,"-t",f"{e-s:.2f}","-an","-c:v","libx264","-crf","20","-preset","slow","-pix_fmt","yuv420p","-movflags","+faststart",f"{d}/{name}.mp4"])
            run(["ffmpeg","-v","error","-y","-ss",str(s),"-i",src,"-frames:v","1","-q:v","1",f"{d}/{name}.jpg"])
        print(cat, name)
