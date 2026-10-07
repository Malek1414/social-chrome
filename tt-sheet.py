# Contact sheets from a TikTok/X work folder: frames/f_*.jpg with times in frames/times.txt
# usage: python3 tt-sheet.py <folder>   -> sheet_1.jpg, sheet_2.jpg ... (30 frames per sheet, 6 cols)
import sys, glob, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from sheets import grid

folder = sys.argv[1]
frames = sorted(glob.glob(os.path.join(folder, "frames", "f_*.jpg")))
tf = os.path.join(folder, "frames", "times.txt")
times = [l.strip() for l in open(tf)] if os.path.exists(tf) else []
for old in glob.glob(os.path.join(folder, "sheet_*.jpg")): os.remove(old)
grid(frames, times, os.path.join(folder, "sheet_{}.jpg"), cols=6, width=230, per=30, style="strip", size=16, quality=82)
print(len(frames))
