#!/bin/zsh
# usage: deep.sh list.txt ("author id" lines) -> tt-watch.sh each, paced so each video takes >=45-60 s, comments via tt-fetch
cd ~/Desktop/social-chrome
while read A ID; do
  [ -z "$ID" ] && continue
  if [ -s tiktok/$ID/sheet_1.jpg ] && [ -s tiktok/$ID/transcript.txt ] && [ -s tiktok/$ID/comments.json ]; then echo "SKIP $ID"; continue; fi
  T0=$(date +%s)
  ./tt-watch.sh $A $ID < /dev/null; RC=$?
  [ $RC -eq 2 ] && { echo "CAPTCHA - stopping"; exit 2; }
  EL=$(( $(date +%s) - T0 )); W=$(( 45 + RANDOM % 16 - EL )); [ $W -lt 20 ] && W=20
  sleep $W
done < $1
echo DEEP_DONE
