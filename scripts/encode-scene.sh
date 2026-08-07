#!/usr/bin/env bash
#
# Turns a raw scene plate into the renditions the site ships.
#
#   scripts/encode-scene.sh <source.mp4> <slug> [mode] [seconds]
#
#   mode = play   (default) the plate is played, not scrubbed. Long GOP, and a
#                 WebM alongside the MP4 because VP9 wins on this content. This
#                 is the plate the opening waits on, so its weight is the first
#                 thing a visitor pays for and it is tuned lighter than the rest.
#   mode = scrub  the plate is driven by scroll position, so it needs keyframes
#                 often enough that a seek never has far to decode.
#
#                 A keyframe every 12 frames rather than every 6: worst case the
#                 decoder walks 11 frames, which is a few milliseconds and
#                 nowhere near a dropped frame, and it costs 35% of the file.
#                 Measured on the heaviest plate, at 1080p:
#
#                   crf 23 · gop  6   5.33 MB   (what this used to ship)
#                   crf 23 · gop 12   3.47 MB
#                   crf 20 · gop 12   4.97 MB   ← better picture, fewer bytes
#                   crf 18 · gop 12   6.36 MB
#
#                 So the saving is spent on quality instead of bandwidth and the
#                 plates come out sharper *and* slightly smaller than before.
#
#                 AV1 was measured here too and is not worth it: at gop 6 SVT-AV1
#                 came out at 5.63 MB against H.264's 5.33 and VP9's 4.98. A GOP
#                 this short is nearly all intra, which is exactly where AV1's
#                 advantage disappears.
#
#   seconds       optional: trim the plate to this length. Several of the
#                 sources end on a run of identical frames, and shipping them
#                 is pure weight — the timeline holds the last frame for as
#                 long as the beat needs anyway. Trimming here rather than in a
#                 separate pass matters: an intermediate file is a second
#                 generation of lossy encoding, and the extra quantisation
#                 noise shows up as a shimmer at the handover into this plate,
#                 where the frame is meant to be identical to the one before it.
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

SRC=${1:?usage: encode-scene.sh <source> <slug> [play|scrub] [seconds]}
SLUG=${2:?usage: encode-scene.sh <source> <slug> [play|scrub] [seconds]}
MODE=${3:-play}
TRIM=${4:-}

OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/public/scene"
mkdir -p "$OUT"

case "$MODE" in
  play)  GOP=48; H_1080=23; H_720=25; V_1080=32; V_720=35 ;;
  scrub) GOP=12; H_1080=20; H_720=23; V_1080=28; V_720=31 ;;
  *) echo "unknown mode: $MODE (want play or scrub)" >&2; exit 1 ;;
esac

# Applied to every encode below, so the trim and the delivery encode are the
# same generation.
CUT=()
[ -n "$TRIM" ] && CUT=(-t "$TRIM")

DUR=$(ffprobe -v error -select_streams v:0 -show_entries format=duration -of csv=p=0 "$SRC")
FPS=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$SRC")
FRAMES=$(ffprobe -v error -select_streams v:0 -count_frames \
  -show_entries stream=nb_read_frames -of csv=p=0 "$SRC")
if [ -n "$TRIM" ]; then
  DUR=$TRIM
  FRAMES=$(awk -v t="$TRIM" -v f="$FPS" 'BEGIN { split(f, a, "/"); printf "%d", t * a[1] / a[2] }')
fi
echo "$SLUG · ${DUR}s · ${FRAMES} frames · mode=$MODE (gop=$GOP)"

# Both codecs, always. VP9 is the smaller file when the GOP is long, H.264 wins
# when it is short — but the browser only ever downloads one, so shipping the
# pair costs repository size, not bandwidth, and it is what lets a Firefox or a
# Safari each get a plate they can decode.
enc() { # width  height  h264-crf  vp9-crf  label
  ffmpeg -v error -y -i "$SRC" "${CUT[@]}" -an -vf "scale=$1:$2:flags=lanczos" \
    -c:v libx264 -preset slow -crf "$3" -g "$GOP" -keyint_min "$GOP" \
    -profile:v high -pix_fmt yuv420p -movflags +faststart "$OUT/$SLUG-$5.mp4"
  ffmpeg -v error -y -i "$SRC" "${CUT[@]}" -an -vf "scale=$1:$2:flags=lanczos" \
    -c:v libvpx-vp9 -crf "$4" -b:v 0 -row-mt 1 -cpu-used 3 -g "$GOP" -keyint_min "$GOP" \
    -pix_fmt yuv420p "$OUT/$SLUG-$5.webm"
}

enc 1920 1080 "$H_1080" "$V_1080" 1080
enc 1280 720  "$H_720"  "$V_720"  720

# A 720p proxy, for the self-contained preview only. That build inlines every
# plate as a data URI, so the whole sequence has to fit inside one file the
# viewer downloads before anything renders. Resolution carries perceived
# sharpness further than bitrate does, so the proxy keeps 720p and spends the
# saving on compression instead of pixels.
ffmpeg -v error -y -i "$SRC" "${CUT[@]}" -an -vf "scale=1280:720:flags=lanczos" \
  -c:v libvpx-vp9 -crf 40 -b:v 0 -row-mt 1 -cpu-used 4 \
  -g "$GOP" -keyint_min "$GOP" -pix_fmt yuv420p "$OUT/$SLUG-proxy.webm"
for edge in first last; do
  [ "$edge" = first ] && n=0 || n=$((FRAMES - 1))
  ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,$n),scale=1280:720:flags=lanczos" \
    -frames:v 1 -q:v 5 "$OUT/$SLUG-$edge-proxy.jpg"
done

ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,0),scale=1920:1080:flags=lanczos" \
  -frames:v 1 -q:v 5 "$OUT/$SLUG-first.jpg"
ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,$((FRAMES - 1))),scale=1920:1080:flags=lanczos" \
  -frames:v 1 -q:v 5 "$OUT/$SLUG-last.jpg"

echo
ls -la "$OUT" | grep "$SLUG"
