#!/bin/zsh
# Slow paced batch: usage ./tt-slow-batch.sh list.txt ("author id" lines)
# >=60-80 s gap after each video, 3-5 min pause after every 5 videos (global counter in .slow_count), stops on captcha (exit 2)
cd "${0:A:h}"; source lib/batch.sh
CNT=$(cat .slow_count 2>/dev/null || echo 0)
while read A ID; do
  [ -z "$ID" ] && continue
  tt_done $ID && { echo "SKIP $ID"; continue; }
  tt_item $A $ID; [ $? -eq 2 ] && { echo "CAPTCHA - stopping"; wait; exit 2; }
  CNT=$((CNT+1)); echo $CNT > .slow_count
  if (( CNT % 5 == 0 )); then W=$(( 180 + RANDOM % 121 )); echo "pause ${W}s after $CNT videos"; else W=$(( 60 + RANDOM % 21 )); fi
  sleep $W
done < $1
wait; echo SLOW_DONE
