# usage: python3 make-sheets.py <code...>  builds sheet_XX.jpg (1 fps, 6x3 per sheet, timestamped) + hook.jpg (4 fps over first 3 s)
import sys, os, glob
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from common import data
from sheets import duration, video_sheets

for code in sys.argv[1:]:
    d = data("reels", code)
    vids = [v for v in [f"{d}/video.mp4"] + sorted(glob.glob(f"{d}/slide_*.mp4")) if os.path.exists(v)]
    for v in vids:
        tag = "" if v.endswith("video.mp4") else os.path.basename(v)[:-4] + "_"
        dur = duration(v)
        fps = 1 if dur <= 72 else round(72 / dur, 4)
        for old in glob.glob(f"{d}/{tag}sheet_*.jpg"): os.remove(old)
        video_sheets(v, fps, f"{d}/{tag}sheet_{{:02d}}.jpg", cols=6, rows=3, width=240)
        video_sheets(v, 4, f"{d}/{tag}hook{{}}.jpg", cols=6, rows=2, width=270, t=3)
        print("sheets", code, tag or "video", f"dur={dur:.0f}s", f"fps={fps}")
