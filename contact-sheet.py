# Builds one contact sheet (grid of frames with timestamps) from a reel-watch folder.
# usage: python3 contact-sheet.py <folder> <stepSec>
import sys, glob, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from sheets import grid

folder, step = sys.argv[1], float(sys.argv[2])
frames = sorted(glob.glob(os.path.join(folder, "f_*.jpg")))
if frames:
    grid(frames, [f"{n * step:.1f}s" for n in range(len(frames))], os.path.join(folder, "sheet.jpg"), cols=6, width=220, style="strip", color="white")
