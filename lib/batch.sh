# Shared by the batch scripts; source it after `cd` to the repo root.
# Network steps stay in the foreground and keep their human pacing. Local work (frames, whisper, sheets) runs in the
# background during the pause before the next item, one job at a time, so a batch finishes sooner without fetching faster.
DATA=${SOCIAL_CHROME_DATA:-.}
WHISPER=(mlx_whisper --model mlx-community/whisper-large-v3-turbo)

# jitter MIN SPREAD: sleep MIN..MIN+SPREAD-1 seconds
jitter() { sleep $(( $1 + RANDOM % $2 )); }

# tt_done ID [isPhoto]: has a contact sheet and, for videos, a transcript
tt_done() { [ -s $DATA/tiktok/$1/sheet_1.jpg ] && { [ "${2:-0}" = 1 ] || [ -s $DATA/tiktok/$1/transcript.txt ]; }; }

# tt_item AUTHOR ID [isPhoto]: fetch in the foreground, process in the background. Returns 2 on captcha.
tt_item() {
  local A=$1 ID=$2 rc
  if [ "${3:-0}" = 1 ]; then node tt-photo.mjs $A $ID < /dev/null; return $?; fi
  if [ ! -s $DATA/tiktok/$ID/video.mp4 ]; then
    node tt-fetch.mjs $A $ID < /dev/null; rc=$?
    [ $rc -eq 2 ] && return 2; [ $rc -ne 0 ] && { echo "DOWNLOAD_FAIL $ID"; return 1; }
  fi
  wait; lib/watch.sh tiktok $DATA/tiktok/$ID < /dev/null &
}

# ig_study CODE SHEETS_SCRIPT: in-page grab if there's no video yet (sets FETCHED=1), then whisper + sheets in the background.
ig_study() {
  local c=$1 sheets=$2 d=$DATA/reels/$1; FETCHED=0; mkdir -p $d
  if [ ! -s $d/video.mp4 ]; then
    node carousel-grab.mjs $c < /dev/null; FETCHED=1
    [ -s $d/slide_01.mp4 ] && ln -f $d/slide_01.mp4 $d/video.mp4  # same bytes: a hard link, not a second copy
  fi
  [ ! -s $d/video.mp4 ] && { echo "NOVIDEO $c"; return 1; }
  wait
  { [ ! -s $d/video.txt ] && $WHISPER $d/video.mp4 --output-format all --output-dir $d > /dev/null 2>&1
    python3 $sheets $c < /dev/null; echo "DONE $c words=$(wc -w < $d/video.txt 2>/dev/null)"; } < /dev/null &
}
