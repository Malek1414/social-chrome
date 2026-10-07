# Social Chrome: notes for Claude

## If you were asked to set this up on someone's Mac

1. Make sure the repo sits at `~/Desktop/social-chrome`, because every script
   writes there. If it was cloned elsewhere, move it:
   `git clone https://github.com/Malek1414/social-chrome.git ~/Desktop/social-chrome`
2. Run `./setup.sh`. It installs Node 22+, Python with Pillow, ffmpeg, yt-dlp
   and mlx_whisper through Homebrew/uv, starts Social Chrome, and adds the
   `social-chrome` MCP server to Claude Code at user scope. It is safe to run
   again. If Homebrew or Google Chrome is missing, it says so and stops. Ask the
   person to install those two themselves.
3. Ask the person to sign in, in the Social Chrome window, to each network
   they'll use (Instagram, TikTok, X, …). You can't do this for them, and you
   must never ask for or type their passwords. Sessions persist in the
   dedicated profile (`~/Library/Application Support/SocialChrome`).
4. Tell them to restart Claude Code. Then check with `./setup.sh --check`, and
   check that `claude mcp list` shows `social-chrome … ✔ Connected`.
5. Do a smoke test: `node cdp-eval.mjs instagram.com "document.title"` should
   print the page title.

## When using it

- Social Chrome must be running (`./launch.sh`). It only listens on 127.0.0.1:9222.
- Prefer the `mcp__social-chrome__*` tools for one-off browsing. Use the
  scripts for bulk work. Each script's first lines give its usage.
- Act like a person browsing. Keep the batch scripts' pacing and never remove
  their captcha stop. Read only what the page itself loads, and never export
  cookies or tokens out of the browser.
- Output (videos, frames, JSON, logs) stays out of git. The `.gitignore` is a
  whitelist, so new scripts must be added to it on purpose.
