#!/bin/zsh
# Turn a downloaded video into what Claude reads: timestamped frames, hard cuts, contact sheets, transcript.
# One ffmpeg pass decodes the video once for the frames, the scene-cut detection and the whisper audio.
# usage: lib/watch.sh <tiktok|x> <dir with video.*>   -> frames/{f_*.jpg,times.txt}, cuts.txt, sheet_N.jpg, transcript.*
set -u; setopt nullglob
ROOT=${0:A:h:h}; KIND=$1; D=${2:A}
cd $D || exit 1
V=(video.*); V=(${V:#*.json}); (( $#V )) || { echo "NOVIDEO $D"; exit 1; }; V=$V[1]
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $V); DUR=${DUR%.*}; [ -z "$DUR" ] && DUR=1
# Frame interval: dense for short videos. X videos run longer (talks, podcasts), so they get bigger frames and a longer scale.
if [[ $KIND == x ]]; then
  W=480; WFMT=all
  if   (( DUR <= 60 ));   then IV=0.5
  elif (( DUR <= 120 ));  then IV=1
  elif (( DUR <= 900 ));  then IV=5
  elif (( DUR <= 2400 )); then IV=15
  elif (( DUR <= 4000 )); then IV=20
  else IV=90; fi
  TIMES='f"{int(i*IV//60)}:{i*IV%60:04.1f}"'
else
  W=360; WFMT=txt
  if   (( DUR <= 30 ));  then IV=0.5
  elif (( DUR <= 90 ));  then IV=1
  elif (( DUR <= 240 )); then IV=2
  elif (( DUR <= 600 )); then IV=5
  else IV=$(( DUR / 120 )); fi
  TIMES='f"{i*IV:.1f}s"'
fi
mkdir -p frames; rm -f frames/f_*.jpg
# Pull the 16 kHz mono track for whisper in the same pass, if there is audio and no transcript yet.
AUDIO=()
[ ! -s transcript.txt ] && [ -n "$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 $V)" ] \
  && AUDIO=(-map 0:a:0 -vn -ac 1 -ar 16000 -y audio.wav)
ffmpeg -nostdin -v info -i $V \
  -filter_complex "[0:v]split=2[a][b];[a]fps=1/$IV,scale=$W:-2[f];[b]select='gt(scene,0.25)',showinfo[s]" \
  -map "[f]" -q:v 4 frames/f_%04d.jpg -map "[s]" -f null - $AUDIO 2>&1 | grep -o 'pts_time:[0-9.]*' | cut -d: -f2 > cuts.txt
N=$(ls frames/f_*.jpg | wc -l | tr -d ' ')
python3 -c "IV=$IV; print('\n'.join($TIMES for i in range($N)))" > frames/times.txt
python3 $ROOT/tt-sheet.py $D >/dev/null
if [ -s audio.wav ]; then
  mlx_whisper audio.wav < /dev/null --model mlx-community/whisper-large-v3-turbo --output-format $WFMT --output-dir . --output-name transcript >/dev/null 2>whisper.err
  rm -f audio.wav
fi
echo "OK ${D:t} dur=${DUR}s iv=$IV frames=$N cuts=$(wc -l < cuts.txt | tr -d ' ') words=$(wc -w < transcript.txt 2>/dev/null | tr -d ' ')"
