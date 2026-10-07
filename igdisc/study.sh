#!/bin/zsh
# usage: ./study.sh codes.txt -> grab (with stats) + whisper + sheets (0.5 s if <=40 s, 1 s if <=120 s), grabs paced 7-10 s
cd "${0:A:h:h}"; source lib/batch.sh
while read c; do
  [ -z "$c" ] && continue
  ig_study $c igdisc/sheets.py
  (( FETCHED )) && jitter 7 4
done < $1
wait; echo BATCHDONE
