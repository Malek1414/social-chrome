"""Contact sheets: grids of timestamped frames, the main way Claude "watches" a clip."""
import glob, os, subprocess, tempfile
from contextlib import contextmanager
from PIL import Image, ImageDraw, ImageFont

ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"


def font(size):
    try:
        return ImageFont.truetype(ARIAL, size)
    except OSError:
        return ImageFont.load_default()


def duration(video):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video], capture_output=True, text=True).stdout
    return float(out.strip() or 0)


@contextmanager
def frames(video, fps, width, t=None, q=4):
    """Frames at `fps`, scaled to `width`, in a temp dir that is deleted afterwards. Yields the sorted paths."""
    with tempfile.TemporaryDirectory() as td:
        cmd = ["ffmpeg", "-v", "error"] + (["-t", str(t)] if t else []) + ["-i", video, "-vf", f"fps={fps},scale={width}:-2", "-q:v", str(q), f"{td}/f_%04d.jpg"]
        subprocess.run(cmd, check=False)
        yield sorted(glob.glob(f"{td}/f_*.jpg"))


def grid(paths, labels, out, cols, width, per=None, style="badge", size=18, quality=80, color="yellow"):
    """Lay images out `cols` wide at `width` px, `per` to a page (None = one page).
    `out` is a path; with paging it holds a {} placeholder for the 1-based page number (e.g. "sheet_{:02d}.jpg").
    style "badge" puts the label on a black box over the frame's corner; "strip" puts it on a bar above the frame.
    Returns the list of files written."""
    f = font(size) if style == "badge" else ImageFont.load_default()
    per = per or max(len(paths), 1)
    written = []
    for start in range(0, len(paths), per):
        ims = []
        for p in paths[start:start + per]:
            with Image.open(p) as im:
                im = im.convert("RGB")
                ims.append(im if im.width == width else im.resize((width, int(im.height * width / im.width))))
        h = max(i.height for i in ims)
        bar = 0 if style == "badge" else size
        S = Image.new("RGB", (cols * width, ((len(ims) + cols - 1) // cols) * (h + bar)), "black")
        d = ImageDraw.Draw(S)
        for n, im in enumerate(ims):
            x, y = (n % cols) * width, (n // cols) * (h + bar)
            S.paste(im, (x, y + bar))
            label = labels[start + n] if start + n < len(labels) else str(start + n)
            if style == "badge":
                l, t, r, b = d.textbbox((x + 3, y + 2), label, font=f)
                d.rectangle([x, y, r + 3, b + 3], fill="black")
            d.text((x + 3, y + 2), label, font=f, fill=color)
        path = out.format(start // per + 1) if "{" in out else out
        S.save(path, quality=quality)
        written.append(path)
    return written


def video_sheets(video, fps, out, cols, rows, width, size=18, quality=80, t=None):
    """Frames at `fps` -> paged badge-style sheets labelled with seconds. Returns (frame count, files)."""
    with frames(video, fps, width, t=t) as fs:
        labels = [f"{k / fps:.1f}s" for k in range(len(fs))]
        return len(fs), grid(fs, labels, out, cols, width, per=cols * rows, size=size, quality=quality)


def study(code, long_cap):
    """reels/<code>/ss_XX.jpg: 2 fps up to 40 s, 1 fps up to `long_cap` s, then ~`long_cap` frames spread over the video."""
    from common import data
    d = data("reels", code); v = f"{d}/video.mp4"
    if not os.path.exists(v):
        print("NOVIDEO", code); return
    dur = duration(v)
    fps = 2 if dur <= 40 else (1 if dur <= long_cap else round(long_cap / dur, 3))
    for o in glob.glob(f"{d}/ss_*.jpg"): os.remove(o)
    n, _ = video_sheets(v, fps, f"{d}/ss_{{:02d}}.jpg", cols=5, rows=3, width=320, size=20, quality=78)
    print("OK", code, f"dur={dur:.1f}", f"fps={fps}", f"frames={n}")
