#!/bin/zsh
# usage: ./study-batch.sh codes.txt -> in-page media fetch (carousel-grab) + whisper + study sheets (ss_XX.jpg), grabs paced 12-19 s
cd "${0:A:h}"; source lib/batch.sh
while read c; do
  [ -z "$c" ] && continue
  ig_study $c study-sheets.py
  (( FETCHED )) && jitter 12 8
done < $1
wait; echo BATCHDONE
