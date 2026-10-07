#!/bin/zsh
cd ~/Desktop/social-chrome
while read u; do [ -z "$u" ] && continue; sleep $((18 + RANDOM % 8)); node igdisc/similar.mjs $u < /dev/null 2>&1 | tail -1; python3 -c "import json;d=json.load(open('igdisc/similar/$u.json'));print('  CARDS', ' '.join(dict.fromkeys(c.strip('/') for c in d['cards'] if c.strip('/')!='$u' and c!='/popular/')))"; done < $1
echo SIMDONE
