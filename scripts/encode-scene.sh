#!/usr/bin/env bash
#
# Turns a raw scene plate into the renditions the site ships.
#
#   scripts/encode-scene.sh <source.mp4> <slug> [crossfade-seconds]
#   scripts/encode-scene.sh ~/hunter-dawn-raw.mp4 hunter-dawn 1
#
# Writes into public/scene/:
#   <slug>-1080.mp4   H.264   — universal
#   <slug>-1080.webm  VP9     — smaller, preferred where supported
#   <slug>-720.mp4    H.264   — compact frames
#   <slug>-720.webm   VP9
#   <slug>-poster.jpg         — first paint, and the still shown under
#                               prefers-reduced-motion
#
# The crossfade is the point of this script. A plate that opens and closes on
# different content cuts hard every time it loops. Passing a fade length dissolves
# the head back over the tail, so the last frame lands on the first and the loop
# has no seam. The clip gets shorter by exactly that many seconds. Pass 0 to
# skip it when a plate already loops cleanly.

set -euo pipefail

SRC=${1:?usage: encode-scene.sh <source> <slug> [crossfade-seconds]}
SLUG=${2:?usage: encode-scene.sh <source> <slug> [crossfade-seconds]}
FADE=${3:-1}

OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/public/scene"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$OUT"

DUR=$(ffprobe -v error -select_streams v:0 -show_entries format=duration -of csv=p=0 "$SRC")
echo "source: ${DUR}s  ·  crossfade: ${FADE}s"

# Lossless master, so every rendition encodes from the same seamless source.
if [ "$FADE" = "0" ]; then
  ffmpeg -v error -y -i "$SRC" -an -c:v libx264 -preset ultrafast -qp 0 "$WORK/master.mp4"
else
  HOLD=$(awk -v d="$DUR" -v f="$FADE" 'BEGIN{printf "%.6f", d-2*f}')
  ffmpeg -v error -y -i "$SRC" -filter_complex "
    [0:v]split[body][pre];
    [pre]trim=duration=$FADE,format=yuva420p,fade=t=in:st=0:d=$FADE:alpha=1,setpts=PTS+$HOLD/TB[head];
    [body]trim=start=$FADE,setpts=PTS-STARTPTS[main];
    [main][head]overlay=eof_action=pass,format=yuv420p[v]" \
    -map "[v]" -an -c:v libx264 -preset ultrafast -qp 0 "$WORK/master.mp4"
fi

# Audio is always dropped: a background plate is muted, and `muted` is what
# makes autoplay legal in the first place.
enc() { # width  crf-h264  crf-vp9  label
  ffmpeg -v error -y -i "$WORK/master.mp4" -an -vf "scale=$1:-2:flags=lanczos" \
    -c:v libx264 -preset slow -crf "$2" -profile:v high -pix_fmt yuv420p -g 48 \
    -movflags +faststart "$OUT/$SLUG-$4.mp4"
  ffmpeg -v error -y -i "$WORK/master.mp4" -an -vf "scale=$1:-2:flags=lanczos" \
    -c:v libvpx-vp9 -crf "$3" -b:v 0 -row-mt 1 -cpu-used 3 -pix_fmt yuv420p -g 48 \
    "$OUT/$SLUG-$4.webm"
}

enc 1920 23 34 1080
enc 1280 25 37 720

# Poster: a frame with the subject in it, not the plate's opening frame — this
# is the permanent image for anyone who asked for reduced motion.
POSTER_FRAME=${POSTER_FRAME:-66}
ffmpeg -v error -y -i "$WORK/master.mp4" \
  -vf "select=eq(n\,$POSTER_FRAME),scale=1280:-2:flags=lanczos" \
  -frames:v 1 -q:v 6 "$OUT/$SLUG-poster.jpg"

echo
ls -la "$OUT" | grep "$SLUG"
