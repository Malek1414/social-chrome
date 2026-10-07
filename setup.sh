#!/bin/zsh
# Social Chrome setup for a new Mac. Safe to rerun; each step skips what's already done.
#
#   ./setup.sh            install tools, start Social Chrome, connect Claude Code
#   ./setup.sh --check    only report what's installed and connected
#
# Expects the repo at ~/Desktop/social-chrome (the scripts write their output there).
set -uo pipefail

DIR=~/Desktop/social-chrome
PORT=9222
CHECK=false; [[ ${1:-} == --check ]] && CHECK=true
missing=()

say()  { print -P "%F{cyan}›%f $*"; }
ok()   { print -P "%F{green}✓%f $*"; }
warn() { print -P "%F{yellow}!%f $*"; }
die()  { print -P "%F{red}✗%f $*" >&2; exit 1; }

[[ ${0:A:h} == ${DIR:A} ]] || die "Clone the repo to $DIR first:\n  git clone https://github.com/Malek1414/social-chrome.git $DIR"
[[ $(uname) == Darwin ]] || die "Social Chrome is macOS-only."

need() { # name, check command, install command
  if eval "$2" >/dev/null 2>&1; then ok "$1"
  elif $CHECK; then warn "$1 missing"; missing+=$1
  else say "Installing $1"; eval "$3" && ok "$1" || { warn "Couldn't install $1. Run by hand: $3"; missing+=$1; }
  fi
}

# 1. Tools
[[ -d "/Applications/Google Chrome.app" ]] && ok "Google Chrome" || { warn "Google Chrome missing: install from https://www.google.com/chrome/"; missing+=Chrome; }
command -v brew >/dev/null || die "Homebrew is needed: https://brew.sh (then rerun)."
need "Node 22+"       '[[ $(node -p "process.versions.node.split(\".\")[0]") -ge 22 ]]' 'brew install node'
need "Python 3"       'command -v python3'                                              'brew install python'
need "Pillow"         'python3 -c "import PIL"'                                         'python3 -m pip install --user --break-system-packages Pillow'
need "ffmpeg"         'command -v ffmpeg && command -v ffprobe'                         'brew install ffmpeg'
need "yt-dlp"         'command -v yt-dlp'                                               'brew install yt-dlp'
if [[ $(uname -m) == arm64 ]]; then
  need "uv"           'command -v uv'                                                   'brew install uv'
  need "mlx_whisper"  'command -v mlx_whisper'                                          'uv tool install mlx-whisper'
else
  warn "Intel Mac: transcripts (mlx_whisper) need Apple Silicon; everything else works."
fi
need "Claude Code"    'command -v claude'                                               'npm install -g @anthropic-ai/claude-code'

chmod +x *.sh *.command igdisc/*.sh 2>/dev/null

# 2. Start the browser
if curl -s "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then ok "Social Chrome running on :$PORT"
elif $CHECK; then warn "Social Chrome not running (./launch.sh)"
else ./launch.sh && ok "Social Chrome started" || missing+="Social Chrome"
fi

# 3. Connect Claude Code (user scope: available in every project)
if command -v claude >/dev/null; then
  if claude mcp get social-chrome >/dev/null 2>&1; then ok "Claude Code MCP 'social-chrome'"
  elif $CHECK; then warn "MCP 'social-chrome' not added"
  else
    claude mcp add --scope user social-chrome -- npx -y chrome-devtools-mcp@latest --browserUrl "http://127.0.0.1:$PORT" >/dev/null \
      && ok "Added MCP 'social-chrome' (restart open Claude Code sessions to see it)" || missing+="MCP"
  fi
fi

print ""
if (( ${#missing} )); then warn "Not done: ${(j:, :)missing}"; exit 1; fi
ok "Ready. Next: log into each network in the Social Chrome window (once; it remembers)."
