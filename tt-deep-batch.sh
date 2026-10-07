#!/bin/zsh
# usage: ./tt-deep-batch.sh list.txt   (lines "author id") -> tt-watch.sh each, paced 20-32 s, stops on captcha
cd ~/Desktop/social-chrome
while read A ID; do
  [ -z "$ID" ] && continue
  if [ -s tiktok/$ID/sheet_1.jpg ] && [ -s tiktok/$ID/transcript.txt ]; then echo "SKIP $ID"; continue; fi
  ./tt-watch.sh $A $ID < /dev/null; RC=$?
  [ $RC -eq 2 ] && { echo "CAPTCHA - stopping"; break; }
  sleep $(( 20 + RANDOM % 13 ))
done < $1
echo DEEP_DONE
