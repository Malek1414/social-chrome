#!/bin/zsh
# usage: ./tt-deep-batch.sh list.txt   (lines "author id") -> tt-watch each, paced 20-32 s, stops on captcha
cd "${0:A:h}"; source lib/batch.sh
while read A ID; do
  [ -z "$ID" ] && continue
  tt_done $ID && { echo "SKIP $ID"; continue; }
  tt_item $A $ID; [ $? -eq 2 ] && { echo "CAPTCHA - stopping"; break; }
  jitter 20 13
done < $1
wait; echo DEEP_DONE
