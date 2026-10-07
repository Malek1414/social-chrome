#!/bin/zsh
# Frames + cut detection + contact sheets + transcript for x/<id>/video.mp4 (downloaded by x-media.py)
# usage: ./x-watch.sh <tweet_id>
H=${0:A:h}
exec $H/lib/watch.sh x ${SOCIAL_CHROME_DATA:-$H}/x/$1
