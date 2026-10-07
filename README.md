# Social Chrome

A dedicated, persistent Chrome instance that Claude can drive, plus the scripts
that use it to study short-form video: Instagram reels and saved posts, TikTok
favorites, search and creators, and X bookmarks and threads.

Scripts read only what a logged-in page loads for itself, and media is fetched
from inside the page, so cookies never leave the browser. Batch scripts pace
themselves (seconds to tens of seconds between items) and stop on a captcha.

## Setup

```bash
./launch.sh            # or double-click "Social Chrome.command"
```

It starts Chrome with its own profile (`~/Library/Application Support/SocialChrome`)
and remote debugging on `127.0.0.1:9222`. The first run opens login tabs for each
network; sign in once and the sessions persist.

Connect Claude Code to it:

```bash
claude mcp add social-chrome -- npx chrome-devtools-mcp@latest --browserUrl http://127.0.0.1:9222
```

Requirements: Google Chrome, Node 22+ (for the built-in `WebSocket`), Python 3
with Pillow, `ffmpeg`/`ffprobe`, ImageMagick (`convert`), `whisper` for
transcripts, and `yt-dlp` for a few fallbacks.

Paths are hard-coded to `~/Desktop/social-chrome`. Clone it there, or change the
paths.

## What's here

| Area | Scripts |
| --- | --- |
| Browser | `launch.sh`, `cdp-eval.mjs` (evaluate JS in a tab) |
| Instagram | `saved-scan*.mjs`, `ig-latest-saved.mjs`, `profile-scan.mjs`, `profile-full-scan.mjs`, `igcapture.mjs`, `ig-handle-check.mjs`, `ig-fetch.mjs`, `carousel-grab.mjs`, `reel-watch.mjs`, `ig-profile.sh` |
| Instagram batches | `recent-batch.sh`, `study-batch.sh`, `tmi-batch.sh`, `igdisc/` (discovery), `own-ig/` (own account) |
| TikTok | `tt-favorites-scan.mjs`, `tt-profile-scan.mjs`, `tt-search-scan.mjs`, `tt-fetch.mjs`, `tt-photo.mjs`, `tt-nav.mjs`, `tt-watch.sh`, `tt-*-batch.sh` |
| X | `x-bookmarks-scan.mjs`, `x-profile-scan.mjs`, `x-thread.mjs`, `x-media.py`, `x-artimg.py`, `x-watch.sh` |
| Analysis | `make-sheets.py`, `study-sheets.py`, `contact-sheet.py`, `tt-sheet.py`, `tt-*digest.py`, `tt-creator-summary.py`, `igparse.py` |

Every script starts with a usage line.

## What's not in git

Everything the scripts produce: videos, frames, contact sheets, transcripts,
scraped JSON, queues and logs. The `.gitignore` is a whitelist, so new output
folders stay out of the repo unless you add them on purpose.
