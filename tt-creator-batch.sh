#!/bin/zsh
# usage: ./tt-creator-batch.sh <user> <index...>   (indices into creators/<user>.json items), paced ~15-25 s, stops on captcha
cd "${0:A:h}"; source lib/batch.sh; U=$1; shift
python3 -c "
import json,sys;it=json.load(open('$DATA/creators/$U.json'))['items']
for i in sys.argv[1:]: x=it[int(i)]; print(x['id'], 1 if x['isPhoto'] else 0)
" "$@" | while read ID PH; do
  tt_done $ID $PH && { echo "SKIP $ID"; continue; }
  tt_item $U $ID $PH; [ $? -eq 2 ] && { echo "CAPTCHA - stopping"; break; }
  jitter 15 11
done
wait; echo CREATOR_DONE $U
