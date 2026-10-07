#!/bin/zsh
cd ~/Desktop/social-chrome/igdisc
while IFS= read -r q; do
  [ -z "$q" ] && continue
  node ~/Desktop/social-chrome/igdisc/ig-search.mjs "$q" 6 > "search/$(echo $q | tr -c 'A-Za-z0-9\n' '_' | tr A-Z a-z).txt" 2>&1
  head -1 "search/$(echo $q | tr -c 'A-Za-z0-9\n' '_' | tr A-Z a-z).txt"
  grep -q "429=[1-9]" "search/$(echo $q | tr -c 'A-Za-z0-9\n' '_' | tr A-Z a-z).txt" && { echo "429 HIT, stopping"; break; }
  sleep $((18 + RANDOM % 8))
done < $1
echo SEARCHDONE
