#!/bin/zsh
# usage: ./profiles.sh users.txt -> profiles/<u>_full.json (8 scrolls per tab), ~20-25 s between profiles
cd ~/Desktop/social-chrome
while read u; do
  [ -z "$u" ] && continue
  [ -s profiles/${u}_full.json ] && { echo "SKIP $u"; continue; }
  node profile-full-scan.mjs $u ${SCROLLS:-8} < /dev/null 2>&1 | tail -1
  grep -q '"status429": [1-9]' profiles/${u}_full.json 2>/dev/null && { echo "429 HIT $u"; break; }
  sleep $((20 + RANDOM % 6))
done < $1
echo PROFDONE
