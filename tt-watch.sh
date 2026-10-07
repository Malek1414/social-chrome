#!/bin/zsh
# In-page media fetch (tt-fetch.mjs) + frames + cut detection + contact sheets + transcript for one TikTok video.
# usage: ./tt-watch.sh <author> <id>   -> tiktok/<id>/{video.mp4, frames/, sheet_N.jpg, cuts.txt, transcript.txt}   exit 2 = captcha
set -u
H=${0:A:h}; A=$1; ID=$2; D=${SOCIAL_CHROME_DATA:-$H}/tiktok/$ID; mkdir -p $D
if [ ! -s $D/video.mp4 ]; then
  node $H/tt-fetch.mjs $A $ID < /dev/null; RC=$?
  [ $RC -eq 2 ] && exit 2; [ $RC -ne 0 ] && { echo "DOWNLOAD_FAIL $ID"; exit 1; }
fi
exec $H/lib/watch.sh tiktok $D
