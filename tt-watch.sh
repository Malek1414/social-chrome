#!/bin/zsh
# In-page media fetch (tt-fetch.mjs) + frames + cut detection + contact sheets + transcript for one TikTok video.
# usage: ./tt-watch.sh <author> <id>   -> tiktok/<id>/{video.mp4, frames/, sheet_N.jpg, cuts.txt, transcript.txt}
set -u; setopt nullglob
A=$1; ID=$2; D=~/Desktop/social-chrome/tiktok/$ID; mkdir -p $D/frames; cd $D
if [ ! -s video.mp4 ]; then
  node ~/Desktop/social-chrome/tt-fetch.mjs $A $ID < /dev/null; RC=$?
  [ $RC -eq 2 ] && exit 2; [ $RC -ne 0 ] && { echo "DOWNLOAD_FAIL $ID"; exit 1; }
fi
V=$(ls video.* | grep -v json | head -1)
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $V); DUR=${DUR%.*}; [ -z "$DUR" ] && DUR=1
# frame interval: dense for short videos
if   (( DUR <= 30 )); then IV=0.5
elif (( DUR <= 90 )); then IV=1
elif (( DUR <= 240 )); then IV=2
elif (( DUR <= 600 )); then IV=5
else IV=$(( DUR / 120 )); fi
rm -f frames/f_*.jpg
ffmpeg -nostdin -v error -i $V -vf "fps=1/$IV,scale=360:-2" -q:v 4 frames/f_%04d.jpg
N=$(ls frames/f_*.jpg | wc -l); python3 -c "print('\n'.join(f'{i*$IV:.1f}s' for i in range($N)))" > frames/times.txt
# hard cuts via scene detection
ffmpeg -nostdin -v info -i $V -vf "select='gt(scene,0.25)',showinfo" -an -f null - 2>&1 | grep -o 'pts_time:[0-9.]*' | cut -d: -f2 > cuts.txt
python3 ~/Desktop/social-chrome/tt-sheet.py $D >/dev/null
# transcript
if [ ! -s transcript.txt ]; then
  ffmpeg -nostdin -v error -y -i $V -vn -ac 1 -ar 16000 audio.wav 2>/dev/null && \
  mlx_whisper audio.wav < /dev/null --model mlx-community/whisper-large-v3-turbo --output-format txt --output-dir . --output-name transcript >/dev/null 2>whisper.err
  rm -f audio.wav
fi
echo "OK $ID dur=${DUR}s iv=$IV frames=$N cuts=$(wc -l < cuts.txt | tr -d ' ') words=$(wc -w < transcript.txt 2>/dev/null | tr -d ' ')"
