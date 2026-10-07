# usage: python3 sheet.py out.jpg cols thumbw file...  (labels = basename)
import sys, os
from PIL import Image, ImageDraw, ImageFont, ImageOps
out, cols, tw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); files = sys.argv[4:]
F = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", max(12, tw//14))
th = int(tw*1.25); lab = max(16, tw//10)
rows = (len(files)+cols-1)//cols
S = Image.new("RGB", (cols*tw, rows*(th+lab)), "black"); d = ImageDraw.Draw(S)
for n, f in enumerate(files):
    try: im = ImageOps.exif_transpose(Image.open(f)).convert("RGB")
    except Exception as e: continue
    im.thumbnail((tw, th)); x, y = (n%cols)*tw, (n//cols)*(th+lab)
    S.paste(im, (x+(tw-im.width)//2, y+lab+(th-im.height)//2))
    d.text((x+3, y+1), os.path.splitext(os.path.basename(f))[0][:28], font=F, fill="#ff6a2b")
S.save(out, quality=82); print(out, S.size)
