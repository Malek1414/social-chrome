#!/bin/zsh
# usage: ./tt-paced-batch.sh list.txt ("author id" lines) -> tt-watch each, one video started every 45-60 s (min 20 s gap), stops on captcha
cd "${0:A:h}"; source lib/batch.sh
while read A ID; do
  [ -z "$ID" ] && continue
  tt_done $ID && { echo "SKIP $ID"; continue; }
  T0=$SECONDS
  tt_item $A $ID; [ $? -eq 2 ] && { echo "CAPTCHA - stopping"; wait; exit 2; }
  W=$(( 45 + RANDOM % 16 - (SECONDS - T0) )); (( W < 20 )) && W=20
  sleep $W
done < $1
wait; echo DEEP_DONE
