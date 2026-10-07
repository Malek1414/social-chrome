#!/bin/zsh
# Runs tt-watch.sh / tt-photo.mjs over everything in tt_favorites_recent.json, paced 5-10 s apart.
cd ~/Desktop/social-chrome
python3 -c "
import json;d=json.load(open('tt_favorites_recent.json'))
for k in ('favorites','liked'):
  for f in d[k]: print(f['author'], f['id'], 1 if f['isPhoto'] else 0)
" | while read A ID PH; do
  if [ -s tiktok/$ID/sheet_1.jpg ] && { [ "$PH" = 1 ] || [ -s tiktok/$ID/transcript.txt ]; }; then echo "SKIP $ID"; continue; fi
  if [ "$PH" = 1 ]; then node tt-photo.mjs $A $ID < /dev/null; else ./tt-watch.sh $A $ID < /dev/null; fi
  [ $? -eq 2 ] && { echo "CAPTCHA - stopping"; break; }
  sleep $(( 10 + RANDOM % 11 ))
done
echo BATCH_DONE
