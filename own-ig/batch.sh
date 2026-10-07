#!/bin/zsh
# usage: ./batch.sh   (reads own-ig/queue.txt: "<code> <p|reel>" lines) -> fetch-post.mjs each, paced 6-10 s
# On a block (exit 2) it backs off 10 min and retries once; a second block stops the batch.
cd "${0:A:h}"
blocked=0
while read code kind; do
  [ -z "$code" ] && continue
  [ -f ${SOCIAL_CHROME_DATA:-..}/own-ig/meta/$code.json ] && continue
  node fetch-post.mjs $code $kind < /dev/null; rc=$?
  if [ $rc -eq 2 ]; then
    blocked=$((blocked+1)); echo "BACKOFF 600s ($blocked)"; [ $blocked -ge 2 ] && { echo STOPPED; exit 2; }
    sleep 600; node fetch-post.mjs $code $kind < /dev/null || { echo STOPPED; exit 2; }
  fi
  sleep $((6 + RANDOM % 5))
done < queue.txt
echo BATCH_DONE
