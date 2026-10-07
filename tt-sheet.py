# Contact sheets from a TikTok work folder: frames/f_*.jpg with times in frames/times.txt
# usage: python3 tt-sheet.py <folder>   -> sheet_1.jpg, sheet_2.jpg ... (30 frames per sheet, 6 cols)
import sys, glob, os
from PIL import Image, ImageDraw
folder = sys.argv[1]
frames = sorted(glob.glob(os.path.join(folder, "frames", "f_*.jpg")))
times = [l.strip() for l in open(os.path.join(folder, "frames", "times.txt"))] if os.path.exists(os.path.join(folder, "frames", "times.txt")) else []
for old in glob.glob(os.path.join(folder, "sheet_*.jpg")): os.remove(old)
tw, cols, per = 230, 6, 30
for s in range(0, len(frames), per):
    chunk = frames[s:s+per]
    imgs = [Image.open(f).convert("RGB") for f in chunk]
    imgs = [im.resize((tw, int(im.height * tw / im.width))) for im in imgs]
    th = max(i.height for i in imgs); rows = (len(imgs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, rows * (th + 16)), "black"); d = ImageDraw.Draw(sheet)
    for n, im in enumerate(imgs):
        x, y = (n % cols) * tw, (n // cols) * (th + 16)
        sheet.paste(im, (x, y + 16)); d.text((x + 4, y + 2), times[s+n] if s+n < len(times) else str(s+n), fill="yellow")
    sheet.save(os.path.join(folder, f"sheet_{s//per+1}.jpg"), quality=82)
print(len(frames))
