# usage: python3 study-sheets.py <code...> -> reels/<code>/ss_XX.jpg (2 fps if <=40 s, 1 fps if <=90 s, else 90 frames; 5x3, timestamped, 320 px)
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from sheets import study

for code in sys.argv[1:]:
    study(code, long_cap=90)
