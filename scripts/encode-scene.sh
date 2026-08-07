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
#   <slug>-first.jpg          — opening frame; stands in before the video
#                               decodes, so there is no pop when it starts
#   <slug>-last.jpg           — closing frame; the resting image, and what a
#                               viewer on prefers-reduced-motion sees instead
#
# Crossfade (optional, off by default). A plate that opens and closes on
# different content cuts hard every time it loops. Passing a fade length
# dissolves the head back over the tail so the last frame lands on the first and
# the loop has no seam; the clip gets shorter by exactly that many seconds. Use
# it only for plates that are meant to loop — a plate that plays once and holds
# its final frame must keep that frame, so leave the fade at 0.

set -euo pipefail

SRC=${1:?usage: encode-scene.sh <source> <slug> [crossfade-seconds]}
SLUG=${2:?usage: encode-scene.sh <source> <slug> [crossfade-seconds]}
FADE=${3:-0}

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
# Renditions are pinned to exactly 16:9 rather than the plate's own 1.774. The
# 0.2% horizontal stretch is invisible, and it makes the letterboxing on a
# `object-fit: contain` layer predictable instead of almost-but-not-quite.
enc() { # width  height  crf-h264  crf-vp9  label
  ffmpeg -v error -y -i "$WORK/master.mp4" -an -vf "scale=$1:$2:flags=lanczos" \
    -c:v libx264 -preset slow -crf "$3" -profile:v high -pix_fmt yuv420p -g 48 \
    -movflags +faststart "$OUT/$SLUG-$5.mp4"
  ffmpeg -v error -y -i "$WORK/master.mp4" -an -vf "scale=$1:$2:flags=lanczos" \
    -c:v libvpx-vp9 -crf "$4" -b:v 0 -row-mt 1 -cpu-used 3 -pix_fmt yuv420p -g 48 \
    "$OUT/$SLUG-$5.webm"
}

enc 1920 1080 23 34 1080
enc 1280 720  25 37 720

# Two stills, because they do different jobs. The first frame stands in while
# the video decodes, so playback starts without a visible jump. The last frame
# is the resting image the clip holds — and the only image a viewer on
# prefers-reduced-motion ever sees, so it has to be the composed final shot.
LAST=$(ffprobe -v error -select_streams v:0 -count_frames \
  -show_entries stream=nb_read_frames -of csv=p=0 "$WORK/master.mp4")
ffmpeg -v error -y -i "$WORK/master.mp4" \
  -vf "select=eq(n\,0),scale=1920:1080:flags=lanczos" \
  -frames:v 1 -q:v 5 "$OUT/$SLUG-first.jpg"
ffmpeg -v error -y -i "$WORK/master.mp4" \
  -vf "select=eq(n\,$((LAST - 1))),scale=1920:1080:flags=lanczos" \
  -frames:v 1 -q:v 5 "$OUT/$SLUG-last.jpg"

echo
ls -la "$OUT" | grep "$SLUG"
