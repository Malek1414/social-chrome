# usage: python3 vsheet.py video.mp4 out_prefix  -> frames every 0.5 s, 10 cols x 6 rows per page, timestamped
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lib"))
from sheets import frames, grid

v, out = sys.argv[1], sys.argv[2]
with frames(v, 2, 160, q=5) as fs:
    grid(fs, [f"{k * 0.5:.1f}" for k in range(len(fs))], f"{out}_{{:02d}}.jpg", cols=10, width=160, per=60, size=16, quality=78)
print(v, len(fs), "frames")
