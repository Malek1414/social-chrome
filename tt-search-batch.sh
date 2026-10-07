#!/bin/zsh
# usage: ./tt-search-batch.sh queries.txt   (lines: "<query>|<tab>") paced 25-40 s, stops on captcha
cd "${0:A:h}"; source lib/batch.sh
while IFS='|' read Q T; do
  [ -z "$Q" ] && continue
  S=$(print -r -- "$Q" | python3 -c "import re,sys;print(re.sub(r'[^a-z0-9äöü]+','_',sys.stdin.read().strip(),flags=re.I).lower())")
  [ -s $DATA/tt-search/${S}_${T}.json ] && { echo "SKIP $Q $T"; continue; }
  node tt-search-scan.mjs "$Q" "$T" 40 < /dev/null; [ $? -eq 2 ] && { echo "CAPTCHA - stopping"; break; }
  jitter 25 16
done < $1
echo SEARCH_BATCH_DONE
