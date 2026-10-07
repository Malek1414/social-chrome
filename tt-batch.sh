#!/bin/zsh
# Runs tt-watch / tt-photo over everything in tt_favorites_recent.json, paced 10-20 s apart, stops on captcha.
cd "${0:A:h}"; source lib/batch.sh
python3 -c "
import json;d=json.load(open('$DATA/tt_favorites_recent.json'))
for k in ('favorites','liked'):
  for f in d[k]: print(f['author'], f['id'], 1 if f['isPhoto'] else 0)
" | while read A ID PH; do
  tt_done $ID $PH && { echo "SKIP $ID"; continue; }
  tt_item $A $ID $PH; [ $? -eq 2 ] && { echo "CAPTCHA - stopping"; break; }
  jitter 10 11
done
wait; echo BATCH_DONE
