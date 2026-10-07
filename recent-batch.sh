#!/bin/zsh
# usage: ./recent-batch.sh codes.txt  -> reels/<code>/{video.mp4, video.txt, video.srt, sheet_XX.jpg, hook.jpg}
cd ~/Desktop/social-chrome
FONT=/System/Library/Fonts/Supplemental/Arial.ttf
while read c; do
  d=reels/$c; mkdir -p $d
  if ! ls $d/video.* >/dev/null 2>&1 || [ ! -s $d/video.mp4 ]; then
    yt-dlp -q --no-warnings -f "b" -o "$d/video.%(ext)s" "https://www.instagram.com/p/$c/" > $d/dl.log 2>&1 || echo "DLFAIL $c $(tail -1 $d/dl.log)"
    sleep $((6 + RANDOM % 5))
  fi
  v=$(ls $d/video.mp4 2>/dev/null)
  [ -z "$v" ] && { echo "NOVIDEO $c"; continue; }
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $v | cut -d. -f1)
  [ ! -s $d/video.txt ] && mlx_whisper $v --model mlx-community/whisper-large-v3-turbo --output-format all --output-dir $d > /dev/null 2>&1
  echo "OK $c dur=${dur}s words=$(wc -w < $d/video.txt 2>/dev/null)"
done < $1
echo BATCHDONE
