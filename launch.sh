#!/bin/zsh
# Social Chrome: a dedicated, persistent Chrome instance for Claude.
# - Its own profile, so logins survive restarts and stay out of your normal Chrome
# - Remote debugging on 127.0.0.1:9222 so the "social-chrome" MCP can drive it
#   without per-site permission prompts

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="$HOME/Library/Application Support/SocialChrome"
PORT=9222

if curl -s "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then
  echo "Social Chrome is already running on port $PORT."
  exit 0
fi

mkdir -p "$PROFILE"

URLS=(
  "https://accounts.google.com/AddSession"
  "https://www.instagram.com/"
  "https://www.tiktok.com/"
  "https://x.com/"
  "https://www.facebook.com/"
  "https://adsmanager.facebook.com/"
  "https://www.threads.net/"
  "https://www.linkedin.com/"
  "https://www.youtube.com/"
  "https://www.reddit.com/"
  "https://www.pinterest.com/"
  "https://www.snapchat.com/"
  "https://bsky.app/"
)

# Only open the login tabs on first run
[[ -f "$PROFILE/.initialized" ]] && URLS=()

"$CHROME" \
  --user-data-dir="$PROFILE" \
  --remote-debugging-port=$PORT \
  --remote-debugging-address=127.0.0.1 \
  --no-first-run \
  --no-default-browser-check \
  --restore-last-session \
  "${URLS[@]}" >/dev/null 2>&1 &!

for i in {1..20}; do
  if curl -s "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then
    touch "$PROFILE/.initialized"  # only once Chrome is really up, so a failed first start reopens the login tabs
    echo "Social Chrome is ready on port $PORT."; exit 0
  fi
  sleep 0.5
done
echo "Chrome started, but port $PORT never responded." >&2
exit 1
