#!/usr/bin/env bash
#
# Turns a raw scene plate into the renditions the site ships.
#
#   scripts/encode-scene.sh <source.mp4> <slug> [mode]
#
#   mode = play   (default) the plate is played, not scrubbed. Long GOP, and a
#                 WebM alongside the MP4 because VP9 wins on this content.
#   mode = scrub  the plate is driven by scroll position. Keyframes every 6
#                 frames so a seek never has far to decode — the single thing
#                 that decides whether scrubbing feels attached to the wheel or
#                 laggy behind it. MP4 only: all-intra VP9 comes out *larger*
#                 than H.264 here, and H.264 plays everywhere.
#
# Writes into public/scene/:
#   <slug>-1080.mp4  ·  <slug>-720.mp4   (+ .webm in play mode)
#   <slug>-first.jpg  the opening frame — stands in before the video decodes
#   <slug>-last.jpg   the closing frame — the resting image, and the only image
#                     a prefers-reduced-motion viewer ever sees
#
# Audio is always dropped: a background plate is muted, and `muted` is what
# makes autoplay legal in the first place. Renditions are pinned to exactly 16:9
# rather than the plates' own 1.774, so letterboxing on the `object-fit:
# contain` layer is predictable instead of almost-but-not-quite. The 0.2%
# horizontal stretch is invisible.

set -euo pipefail

SRC=${1:?usage: encode-scene.sh <source> <slug> [play|scrub]}
SLUG=${2:?usage: encode-scene.sh <source> <slug> [play|scrub]}
MODE=${3:-play}

OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/public/scene"
mkdir -p "$OUT"

case "$MODE" in
  play)  GOP=48; H_1080=23; H_720=25; V_1080=34; V_720=37 ;;
  scrub) GOP=6;  H_1080=27; H_720=28; V_1080=36; V_720=38 ;;
  *) echo "unknown mode: $MODE (want play or scrub)" >&2; exit 1 ;;
esac

DUR=$(ffprobe -v error -select_streams v:0 -show_entries format=duration -of csv=p=0 "$SRC")
FRAMES=$(ffprobe -v error -select_streams v:0 -count_frames \
  -show_entries stream=nb_read_frames -of csv=p=0 "$SRC")
echo "$SLUG · ${DUR}s · ${FRAMES} frames · mode=$MODE (gop=$GOP)"

# Both codecs, always. VP9 is the smaller file when the GOP is long, H.264 wins
# when it is short — but the browser only ever downloads one, so shipping the
# pair costs repository size, not bandwidth, and it is what lets a Firefox or a
# Safari each get a plate they can decode.
enc() { # width  height  h264-crf  vp9-crf  label
  ffmpeg -v error -y -i "$SRC" -an -vf "scale=$1:$2:flags=lanczos" \
    -c:v libx264 -preset slow -crf "$3" -g "$GOP" -keyint_min "$GOP" \
    -profile:v high -pix_fmt yuv420p -movflags +faststart "$OUT/$SLUG-$5.mp4"
  ffmpeg -v error -y -i "$SRC" -an -vf "scale=$1:$2:flags=lanczos" \
    -c:v libvpx-vp9 -crf "$4" -b:v 0 -row-mt 1 -cpu-used 3 -g "$GOP" -keyint_min "$GOP" \
    -pix_fmt yuv420p "$OUT/$SLUG-$5.webm"
}

enc 1920 1080 "$H_1080" "$V_1080" 1080
enc 1280 720  "$H_720"  "$V_720"  720

ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,0),scale=1920:1080:flags=lanczos" \
  -frames:v 1 -q:v 5 "$OUT/$SLUG-first.jpg"
ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,$((FRAMES - 1))),scale=1920:1080:flags=lanczos" \
  -frames:v 1 -q:v 5 "$OUT/$SLUG-last.jpg"

echo
ls -la "$OUT" | grep "$SLUG"
