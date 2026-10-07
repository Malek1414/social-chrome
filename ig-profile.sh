#!/bin/zsh
# usage: ./ig-profile.sh <username> [username...]   (Social Chrome must be running, logged into Instagram)
cd "${0:A:h}"
for u in "$@"; do
  node igcapture.mjs "$u" >/dev/null && python3 igparse.py "cap_$u.json" "$u"; echo
  [[ "$u" != "${@[-1]}" ]] && sleep 20
done
