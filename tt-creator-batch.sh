#!/bin/zsh
# usage: ./tt-creator-batch.sh <user> <index...>   (indices into creators/<user>.json items), paced ~15-25 s
cd ~/Desktop/social-chrome; U=$1; shift
for I in "$@"; do
  read ID PH <<< $(python3 -c "import json;x=json.load(open('creators/$U.json'))['items'][$I];print(x['id'],1 if x['isPhoto'] else 0)")
  if [ -s tiktok/$ID/sheet_1.jpg ] && [ -s tiktok/$ID/transcript.txt ] && [ -s tiktok/$ID/comments.json ]; then echo "SKIP $ID"; continue; fi
  if [ "$PH" = 1 ]; then node tt-photo.mjs $U $ID < /dev/null; else ./tt-watch.sh $U $ID < /dev/null; fi
  [ $? -eq 2 ] && { echo "CAPTCHA - stopping"; break; }
  sleep $(( 15 + RANDOM % 11 ))
done
echo CREATOR_DONE $U
