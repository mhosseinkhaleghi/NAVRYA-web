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
#                 A keyframe every 24 frames rather than every 12 — one second
#                 rather than half of one. Worst case the decoder walks 23
#                 frames, which is tens of milliseconds against a scrub that
#                 animates over one to fifteen seconds, and it is a third of the
#                 file. Measured on the heaviest plate against the highest
#                 fidelity copy that exists, SSIM over the whole clip:
#
#                   gop 12 · 1920 · crf 28   5.38 MB   0.95593   ← used to ship
#                   gop 24 · 1920 · crf 28   4.14 MB   0.95656
#                   gop 24 · 1920 · crf 30   3.68 MB   0.95576   ← ships now
#                   gop 24 · 1920 · crf 31   3.41 MB   0.95521
#                   gop 24 · 1792 · crf 29   3.64 MB   0.95500
#                   gop 24 · 1600 · crf 28   3.42 MB   0.95452
#
#                 A third smaller at a quality difference of 0.0002 SSIM, which
#                 is not a difference. Note the last two rows: dropping
#                 resolution and dropping the quantiser cost about the same
#                 bytes, and the quantiser gives the better picture — so the
#                 plates stay at full resolution and the saving is spent there.
#                 Nothing is upscaled on any display.
#
#                 AV1 was measured here too and is not worth it: at gop 6 SVT-AV1
#                 came out at 5.63 MB against H.264's 5.33 and VP9's 4.98. A GOP
#                 this short is nearly all intra, which is exactly where AV1's
#                 advantage disappears.
#
#   CROP=w:h:x:y  optional, in the environment: a window to take out of the
#                 source before anything else. Generated footage arrives with a
#                 generator's watermark burned into a corner, and a product site
#                 cannot ship one. Cropping is the only removal that does not
#                 invent pixels, so the window is chosen as the largest 16:9
#                 rectangle that excludes it — measure the mark first rather
#                 than guessing, and prefer losing frame edge to losing aspect.
#
#                 It is applied inside the same filter chain as the scale, so
#                 the plate stays one generation off the source. Cropping in a
#                 separate pass first would make every rendition a second.
#
#   START=<s>     optional, in the environment: where the plate begins in the
#                 source. A source can arrive as a *transition* — the shot
#                 before it, a wipe, then the shot this plate actually is — so
#                 its opening seconds belong to the previous slide, burned-in
#                 lettering and all.
#
#                 Given as an output seek, after the input, so it is frame
#                 accurate and stays in the same filter chain as the scale.
#                 Seeking on the input side would land on the nearest keyframe
#                 instead, and re-encoding a pre-trimmed file would make every
#                 rendition a second generation.
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
CROP=${CROP:-}
START=${START:-}

# Prepended to every filter chain below, so the crop and the delivery encode
# are one generation. Empty unless asked for.
CUTBOX=""
[ -n "$CROP" ] && CUTBOX="crop=$CROP,"

OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/public/scene"
mkdir -p "$OUT"

case "$MODE" in
  play)  GOP=48; H_1080=23; H_720=25; V_1080=32; V_720=35 ;;
  scrub) GOP=24; H_1080=21; H_720=24; V_1080=30; V_720=32 ;;
  *) echo "unknown mode: $MODE (want play or scrub)" >&2; exit 1 ;;
esac

# Applied to every encode below, so the trim and the delivery encode are the
# same generation.
CUT=()
[ -n "$START" ] && CUT+=(-ss "$START")
[ -n "$TRIM" ] && CUT+=(-t "$TRIM")

DUR=$(ffprobe -v error -select_streams v:0 -show_entries format=duration -of csv=p=0 "$SRC")
FPS=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$SRC")
FRAMES=$(ffprobe -v error -select_streams v:0 -count_frames \
  -show_entries stream=nb_read_frames -of csv=p=0 "$SRC")
# The stills are pulled by frame index straight from the source, so they need the
# start expressed the same way — otherwise a plate beginning at 1.583s takes its
# opening still from the source's frame 0, which is the shot before it.
SKIP=0
[ -n "$START" ] && SKIP=$(awk -v t="$START" -v f="$FPS" \
  'BEGIN { split(f, a, "/"); printf "%d", t * a[1] / a[2] }')

if [ -n "$TRIM" ]; then
  DUR=$TRIM
  FRAMES=$(awk -v t="$TRIM" -v f="$FPS" 'BEGIN { split(f, a, "/"); printf "%d", t * a[1] / a[2] }')
fi
echo "$SLUG · ${DUR}s · ${FRAMES} frames from source frame ${SKIP} · mode=$MODE (gop=$GOP)"

# Both codecs, always. VP9 is the smaller file when the GOP is long, H.264 wins
# when it is short — but the browser only ever downloads one, so shipping the
# pair costs repository size, not bandwidth, and it is what lets a Firefox or a
# Safari each get a plate they can decode.
enc() { # width  height  h264-crf  vp9-crf  label
  ffmpeg -v error -y -i "$SRC" "${CUT[@]}" -an -vf "${CUTBOX}scale=$1:$2:flags=lanczos" \
    -c:v libx264 -preset slow -crf "$3" -g "$GOP" -keyint_min "$GOP" \
    -profile:v high -pix_fmt yuv420p -movflags +faststart "$OUT/$SLUG-$5.mp4"
  ffmpeg -v error -y -i "$SRC" "${CUT[@]}" -an -vf "${CUTBOX}scale=$1:$2:flags=lanczos" \
    -c:v libvpx-vp9 -crf "$4" -b:v 0 -row-mt 1 -cpu-used 3 -g "$GOP" -keyint_min "$GOP" \
    -pix_fmt yuv420p "$OUT/$SLUG-$5.webm"
}

enc 1920 1080 "$H_1080" "$V_1080" 1080
enc 1280 720  "$H_720"  "$V_720"  720

# The light tier: 854×480, the whole film in about 1.8MB. Two consumers, and
# both of them are why every number on this line is what it is.
#
#   The site renders it behind every scrubbed plate. It is fetched eagerly, so
#   its weight lands in front of the opening plate rather than behind it — the
#   viewer waits on it before the interface comes up. At 4.6MB it pushed the
#   opening from 6.4s to 11.2s on a 12Mbps line and left the hero headline still
#   at opacity 0 when the page was first looked at.
#
#   The preview build inlines it as a data URI, so the whole sequence has to fit
#   in one file, under a 16MB ceiling, before anything renders.
#
# Both want it small; the site also wants it *seekable*, and that is the part
# worth writing down. This used to be one keyframe for the whole clip — free for
# a file the preview plays start to finish, and 189ms to answer a seek in the
# tier whose entire job is answering a seek instantly. A keyframe every 24
# frames costs bytes and buys that back:
#
#   854×480  one keyframe per clip   1127 KB   189 ms   SSIM 0.9216  ← used to
#   854×480  gop 24 crf 50           1314 KB   104 ms   SSIM 0.9241     ship
#   854×480  gop 24 crf 46           1785 KB   104 ms   SSIM 0.9393  ← ships now
#
# A better picture than the tier it replaces, at 45% of the seek cost. SSIM is
# measured against the plate the proxy stands in for, both at 854×480.
#
# Its own GOP, deliberately not "$GOP": the light tier is scrubbed on the site
# whichever mode the plate was encoded in, so it needs the keyframes either way.
#
# Do not raise the resolution here. It has been 1280×720 twice by accident —
# the script said 720p while the files that shipped were 854×480 — and both
# times it went unnoticed until the opening slowed down.
ffmpeg -v error -y -i "$SRC" "${CUT[@]}" -an -vf "${CUTBOX}scale=854:480:flags=lanczos" \
  -c:v libvpx-vp9 -crf 46 -b:v 0 -row-mt 1 -cpu-used 4 \
  -g 24 -keyint_min 24 -pix_fmt yuv420p "$OUT/$SLUG-proxy.webm"
for edge in first last; do
  [ "$edge" = first ] && n=$SKIP || n=$((SKIP + FRAMES - 1))
  ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,$n),${CUTBOX}scale=854:480:flags=lanczos" \
    -frames:v 1 -q:v 5 "$OUT/$SLUG-$edge-proxy.jpg"
done

ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,$SKIP),${CUTBOX}scale=1920:1080:flags=lanczos" \
  -frames:v 1 -q:v 5 "$OUT/$SLUG-first.jpg"
ffmpeg -v error -y -i "$SRC" -vf "select=eq(n\,$((SKIP + FRAMES - 1))),${CUTBOX}scale=1920:1080:flags=lanczos" \
  -frames:v 1 -q:v 5 "$OUT/$SLUG-last.jpg"

echo
ls -la "$OUT" | grep "$SLUG"
