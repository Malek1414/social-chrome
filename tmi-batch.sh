#!/bin/zsh
# usage: ./tmi-batch.sh codes.txt  -> same as recent-batch.sh, plus yt-dlp's video.info.json per reel
INFO_JSON=1 exec "${0:A:h}/recent-batch.sh" "$@"
