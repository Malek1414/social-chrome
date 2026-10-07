# Builds one contact sheet (grid of frames with timestamps) from a reel-watch folder.
# usage: python3 contact-sheet.py <folder> <stepSec>
import sys, glob, os
from PIL import Image, ImageDraw

folder, step = sys.argv[1], float(sys.argv[2])
frames = sorted(glob.glob(os.path.join(folder, "f_*.jpg")))
if not frames:
    sys.exit(0)
thumb_w, cols = 220, 6
imgs = []
for f in frames:
    im = Image.open(f).convert("RGB")
    imgs.append(im.resize((thumb_w, int(im.height * thumb_w / im.width))))
th = max(i.height for i in imgs)
rows = (len(imgs) + cols - 1) // cols
sheet = Image.new("RGB", (cols * thumb_w, rows * (th + 18)), "black")
d = ImageDraw.Draw(sheet)
for n, im in enumerate(imgs):
    x, y = (n % cols) * thumb_w, (n // cols) * (th + 18)
    sheet.paste(im, (x, y + 18))
    d.text((x + 4, y + 3), f"{n * step:.1f}s", fill="white")
sheet.save(os.path.join(folder, "sheet.jpg"), quality=80)
