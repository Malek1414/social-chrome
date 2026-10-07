#!/bin/zsh
# usage: ./search-batch.sh queries.txt -> igdisc/search/<slug>.{json,txt}, paced 18-25 s, stops on 429
cd "${0:A:h:h}"; source lib/batch.sh
while IFS= read -r q; do
  [ -z "$q" ] && continue
  f=$DATA/igdisc/search/$(print -r -- "$q" | tr -c 'A-Za-z0-9\n' '_' | tr A-Z a-z).txt; mkdir -p ${f:h}
  node igdisc/ig-search.mjs "$q" 6 < /dev/null > $f 2>&1
  head -1 $f
  grep -q "429=[1-9]" $f && { echo "429 HIT, stopping"; break; }
  jitter 18 8
done < $1
echo SEARCHDONE
