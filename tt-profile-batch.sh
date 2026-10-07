#!/bin/zsh
# usage: ./tt-profile-batch.sh users.txt  -> creators/<user>.json, paced 22-35 s, stops on captcha
cd ~/Desktop/social-chrome
while read U; do
  [ -z "$U" ] && continue
  [ -s creators/$U.json ] && { echo "SKIP $U"; continue; }
  node tt-profile-scan.mjs $U 35 < /dev/null; RC=$?
  [ $RC -eq 2 ] && { echo "CAPTCHA - stopping"; exit 2; }
  sleep $(( 22 + RANDOM % 14 ))
done < $1
echo PROFILES_DONE
