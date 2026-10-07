#!/bin/zsh
# usage: ./similar.sh users.txt -> igdisc/similar/<u>.json + the suggestion cards, paced 18-25 s
cd "${0:A:h:h}"; source lib/batch.sh
while read u; do
  [ -z "$u" ] && continue
  jitter 18 8
  node igdisc/similar.mjs $u < /dev/null 2>&1 | tail -1
  python3 -c "import json;d=json.load(open('$DATA/igdisc/similar/$u.json'));print('  CARDS', ' '.join(dict.fromkeys(c.strip('/') for c in d['cards'] if c.strip('/')!='$u' and c!='/popular/')))"
done < $1
echo SIMDONE
