#!/bin/zsh
# Frames + cut detection + contact sheets + transcript for x/<id>/video.mp4 (adapted from tt-watch.sh)
# usage: ./x-watch.sh <tweet_id>
set -u; setopt nullglob
D=~/Desktop/social-chrome/x/$1; cd $D || exit 1; mkdir -p frames
V=video.mp4; DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $V); DUR=${DUR%.*}; [ -z "$DUR" ] && DUR=1
if   (( DUR <= 60 )); then IV=0.5
elif (( DUR <= 120 )); then IV=1
elif (( DUR <= 900 )); then IV=5
elif (( DUR <= 2400 )); then IV=15
elif (( DUR <= 4000 )); then IV=20
else IV=90; fi
rm -f frames/f_*.jpg
ffmpeg -nostdin -v error -i $V -vf "fps=1/$IV,scale=480:-2" -q:v 4 frames/f_%04d.jpg
N=$(ls frames/f_*.jpg | wc -l); python3 -c "print('\n'.join(f'{int(i*$IV//60)}:{i*$IV%60:04.1f}' for i in range($N)))" > frames/times.txt
ffmpeg -nostdin -v info -i $V -vf "select='gt(scene,0.25)',showinfo" -an -f null - 2>&1 | grep -o 'pts_time:[0-9.]*' | cut -d: -f2 > cuts.txt
python3 ~/Desktop/social-chrome/tt-sheet.py $D >/dev/null
if [ ! -s transcript.txt ]; then
  ffmpeg -nostdin -v error -y -i $V -vn -ac 1 -ar 16000 audio.wav 2>/dev/null && \
  mlx_whisper audio.wav < /dev/null --model mlx-community/whisper-large-v3-turbo --output-format all --output-dir . --output-name transcript >/dev/null 2>whisper.err
  rm -f audio.wav
fi
echo "OK $1 dur=${DUR}s iv=$IV frames=$N cuts=$(wc -l < cuts.txt | tr -d ' ') words=$(wc -w < transcript.txt 2>/dev/null | tr -d ' ')"
