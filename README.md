<p align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/banner-dark.svg">
  <img alt="Social Chrome: a pixel chameleon on a branch, its eye darting toward a fly" src="assets/readme/banner-light.svg" width="100%">
</picture>
</p>

<p align="center">
  <img alt="macOS" src="https://img.shields.io/badge/platform-macOS-1f2328?style=flat-square&logo=apple&logoColor=white">
  <img alt="Google Chrome" src="https://img.shields.io/badge/Chrome-DevTools_Protocol-4285f4?style=flat-square&logo=googlechrome&logoColor=white">
  <img alt="Claude Code MCP" src="https://img.shields.io/badge/Claude_Code-MCP-d97757?style=flat-square">
  <img alt="Node 22+" src="https://img.shields.io/badge/node-22+-5fa04e?style=flat-square&logo=nodedotjs&logoColor=white">
  <img alt="Python 3" src="https://img.shields.io/badge/python-3-3776ab?style=flat-square&logo=python&logoColor=white">
  <img alt="ffmpeg and Whisper" src="https://img.shields.io/badge/ffmpeg_+_whisper-transcripts-007808?style=flat-square">
</p>

**A dedicated, persistent Chrome that Claude can drive, plus the scripts that use it to study short-form video.** Instagram reels and saved posts, TikTok favorites, search and creators, and X bookmarks and threads.

Scripts read only what a logged-in page loads for itself, and media is fetched from inside the page, so cookies never leave the browser. Batch scripts pace themselves (seconds to tens of seconds between items) and stop on a captcha. Like the chameleon on the banner, it blends in: it is your own logged-in session in a normal Chrome window.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/divider-dark.svg">
  <img alt="" src="assets/readme/divider-light.svg" width="100%">
</picture>

## What it does

- **One browser for Claude.** A separate Chrome with its own profile and remote debugging on `127.0.0.1:9222`. Claude Code reaches it through the `social-chrome` MCP server (`chrome-devtools-mcp`), with no per-site permission prompts.
- **Scans from the page's own data.** Saved posts, profiles, favorites, search results, bookmarks and threads are read from the JSON responses the page loads, not from direct API calls.
- **Videos Claude can watch.** `lib/watch.sh` turns a downloaded video into timestamped frames, hard cuts, contact sheets and a transcript.
- **Sheets and digests.** Python scripts build contact sheets, study sheets and digests of TikTok creators and searches.

## Setup on a new Mac

Easiest: open Claude Code anywhere and say

> Set up Social Chrome from https://github.com/Malek1414/social-chrome

Claude clones it, reads `CLAUDE.md` and runs the setup. By hand:

```bash
git clone https://github.com/Malek1414/social-chrome.git ~/Desktop/social-chrome
cd ~/Desktop/social-chrome
./setup.sh          # tools + browser + Claude Code MCP; rerun anytime
./setup.sh --check  # just report status
```

You need macOS, [Homebrew](https://brew.sh) and Google Chrome. The script
installs the rest: Node 22+, Python with Pillow, ffmpeg, yt-dlp, and
`mlx_whisper` for transcripts (Apple Silicon only). It also registers the MCP
server with Claude Code:

```bash
claude mcp add --scope user social-chrome -- npx -y chrome-devtools-mcp@latest --browserUrl http://127.0.0.1:9222
```

Then sign in to each network once in the Social Chrome window and restart
Claude Code. On its first start the window opens login tabs for Google,
Instagram, TikTok, X, Facebook, Ads Manager, Threads, LinkedIn, YouTube,
Reddit, Pinterest, Snapchat and Bluesky; sessions persist in the profile after
that.

To check it worked: `claude mcp list` should show `social-chrome … ✔ Connected`,
and `node cdp-eval.mjs instagram.com "document.title"` should print the page title.

Social Chrome is a separate Chrome with its own profile
(`~/Library/Application Support/SocialChrome`) and remote debugging on
`127.0.0.1:9222`, local only. Start it again later with `./launch.sh` or by
double-clicking `Social Chrome.command`. `setup.sh` expects the repo at
`~/Desktop/social-chrome`; the scripts themselves write next to wherever they
live (set `SOCIAL_CHROME_DATA=/some/dir` to send output elsewhere, e.g. for a
test run).

## What's here

| Area | Scripts |
| --- | --- |
| Browser | `launch.sh`, `cdp-eval.mjs` (evaluate JS in a tab) |
| Shared | `lib/cdp.mjs` (tabs, captured responses, waits, in-page fetch), `lib/ig.mjs`, `lib/tt.mjs`, `lib/x.mjs`, `lib/watch.sh` (frames + cuts + transcript), `lib/batch.sh`, `lib/sheets.py` |
| Instagram | `saved-scan*.mjs`, `ig-latest-saved.mjs`, `profile-scan.mjs`, `profile-full-scan.mjs`, `igcapture.mjs`, `ig-handle-check.mjs`, `ig-fetch.mjs`, `carousel-grab.mjs`, `reel-watch.mjs`, `ig-profile.sh` |
| Instagram batches | `recent-batch.sh`, `study-batch.sh`, `tmi-batch.sh`, `igdisc/` (discovery), `own-ig/` (own account) |
| TikTok | `tt-favorites-scan.mjs`, `tt-profile-scan.mjs`, `tt-search-scan.mjs`, `tt-fetch.mjs`, `tt-photo.mjs`, `tt-nav.mjs`, `tt-watch.sh`, `tt-*-batch.sh` |
| X | `x-bookmarks-scan.mjs`, `x-profile-scan.mjs`, `x-thread.mjs`, `x-media.py`, `x-artimg.py`, `x-watch.sh` |
| Analysis | `make-sheets.py`, `study-sheets.py`, `contact-sheet.py`, `tt-sheet.py`, `tt-*digest.py`, `tt-creator-summary.py`, `igparse.py` |

Every script starts with a usage line. Exit code 2 means a captcha, rate limit
or login wall: the batch scripts stop on it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/divider-dark.svg">
  <img alt="" src="assets/readme/divider-light.svg" width="100%">
</picture>

## How the scripts work

All Node scripts go through `lib/cdp.mjs`. It attaches to the right tab, records
the JSON responses the page itself loads, and waits for that data instead of
sleeping a fixed time. A page counts as ready once its data has arrived (or the
traffic has gone quiet), with a human-paced minimum. Every DevTools call has a
timeout, so a crashed tab fails the script instead of hanging a batch.

Batch scripts keep the network part (fetching) paced in the foreground and run
the local part (ffmpeg, whisper, contact sheets) in the background during the
pause before the next item. `lib/watch.sh` decodes each video once for frames,
cut detection and the transcript audio.

## What's not in git

Everything the scripts produce: videos, frames, contact sheets, transcripts,
scraped JSON, queues and logs. The `.gitignore` is a whitelist, so new output
folders stay out of the repo unless you add them on purpose.

## Nutcracker

`nutcracker.yaml` is the adapter that lets the [Nutcracker](https://github.com/Malek1414/nutcracker)
hub reach Social Chrome. The hub runs its own DevTools MCP against the same
Chrome on `127.0.0.1:9222`. Read-only calls and navigation run right away;
clicks, typing and scripts can like, follow or post on your accounts, so they
wait for approval. It also turns new files in `profiles/` and
`x_bookmarks_raw/` into events.

## Use responsibly

Use it only with your own accounts, at a human pace, and within each
platform's terms. It's for studying content, not for mass scraping or
redistributing other people's media.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/divider-dark.svg">
  <img alt="" src="assets/readme/divider-light.svg" width="100%">
</picture>

<p align="center">
  <img alt="" src="assets/readme/logo.svg" width="72"><br>
  <sub>Built by <a href="https://github.com/Malek1414">Malek Hassan</a> in Berlin.</sub>
</p>
