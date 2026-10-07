#!/bin/zsh
# usage: ./recent-batch.sh codes.txt  -> reels/<code>/{video.mp4, video.txt, video.srt, ...} via yt-dlp + whisper
#        INFO_JSON=1 ./recent-batch.sh codes.txt   also saves yt-dlp's video.info.json (what tmi-batch.sh does)
# Downloads are paced 6-10 s; transcription runs in the background during the pause.
cd "${0:A:h}"; source lib/batch.sh
while read c; do
  [ -z "$c" ] && continue
  d=$DATA/reels/$c; mkdir -p $d
  if [ ! -s $d/video.mp4 ]; then
    yt-dlp -q --no-warnings ${INFO_JSON:+--write-info-json} -f "b" -o "$d/video.%(ext)s" "https://www.instagram.com/p/$c/" < /dev/null > $d/dl.log 2>&1 || echo "DLFAIL $c $(tail -1 $d/dl.log)"
    jitter 6 5
  fi
  [ ! -s $d/video.mp4 ] && { echo "NOVIDEO $c"; continue; }
  wait
  { dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $d/video.mp4 | cut -d. -f1)
    [ ! -s $d/video.txt ] && $WHISPER $d/video.mp4 --output-format all --output-dir $d > /dev/null 2>&1
    echo "OK $c dur=${dur}s words=$(wc -w < $d/video.txt 2>/dev/null)"; } < /dev/null &
done < $1
wait; echo BATCHDONE
