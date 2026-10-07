#!/bin/zsh
# usage: ./study.sh codes.txt -> grab (with stats) + whisper + sheets (0.5 s if <=40 s, 1 s if <=120 s)
cd ~/Desktop/social-chrome
while read c; do
  [ -z "$c" ] && continue
  d=reels/$c; mkdir -p $d
  if [ ! -s $d/video.mp4 ]; then
    node igdisc/grab.mjs $c < /dev/null
    [ -s $d/slide_01.mp4 ] && cp $d/slide_01.mp4 $d/video.mp4
    sleep $((7 + RANDOM % 4))
  fi
  [ ! -s $d/video.mp4 ] && { echo "NOVIDEO $c"; continue; }
  [ ! -s $d/video.txt ] && mlx_whisper $d/video.mp4 < /dev/null --model mlx-community/whisper-large-v3-turbo --output-format all --output-dir $d > /dev/null 2>&1
  python3 igdisc/sheets.py $c < /dev/null
  echo "DONE $c words=$(wc -w < $d/video.txt 2>/dev/null)"
done < $1
echo BATCHDONE
