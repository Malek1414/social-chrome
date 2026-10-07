#!/bin/zsh
# usage: ./profiles.sh users.txt -> profiles/<u>_full.json (SCROLLS=8 per tab), ~20-25 s between profiles, stops on 429
cd "${0:A:h:h}"; source lib/batch.sh
while read u; do
  [ -z "$u" ] && continue
  [ -s $DATA/profiles/${u}_full.json ] && { echo "SKIP $u"; continue; }
  node profile-full-scan.mjs $u ${SCROLLS:-8} < /dev/null 2>&1 | tail -1
  grep -q '"status429": [1-9]' $DATA/profiles/${u}_full.json 2>/dev/null && { echo "429 HIT $u"; break; }
  jitter 20 6
done < $1
echo PROFDONE
