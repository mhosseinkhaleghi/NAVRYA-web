#!/usr/bin/env sh
# -----------------------------------------------------------------------------
# Serve the built site the way production serves it.
#
# `next start` is not that. This project builds with `output: standalone` and
# Next says so on startup — "next start does not work with output: standalone" —
# then serves from a different tree than the one that ships. A local target that
# is not the artefact being deployed can agree with itself and still disagree
# with the site, which is the one thing local verification exists to rule out.
#
# What ships is `.next/standalone/server.js` with `public/` and `.next/static`
# beside it; the Dockerfile copies both in. Here they are symlinks, so an edit
# to a font or an image is live without a re-copy.
#
# They have to be re-made after every build. `next build` rewrites
# `.next/standalone` wholesale and takes them with it, and the failure is quiet
# and confusing rather than loud: the server starts, every page returns 200, and
# every stylesheet 404s. What that looks like downstream is not "no CSS" — it is
# a `<header>` measuring 10538px tall and a hero block 76px tall, identical in
# every locale, which reads as a layout catastrophe until you notice the numbers
# are the same in all five languages and nothing that shape is a real bug.
#
# Usage:  sh scripts/serve-local.sh [port]        (default 4173)
#         sh scripts/serve-local.sh --build       build first, then serve
# -----------------------------------------------------------------------------
set -eu

cd "$(dirname "$0")/.."
ROOT=$(pwd)

if [ "${1:-}" = "--build" ]; then
  shift
  npx next build
fi

PORT=${1:-4173}

if [ ! -f .next/standalone/server.js ]; then
  echo "no standalone build — run 'npx next build' first" >&2
  exit 1
fi

ln -sfn "$ROOT/public" .next/standalone/public
ln -sfn "$ROOT/.next/static" .next/standalone/.next/static

# Bound to every interface on purpose: the harness reaches it as `localhost`,
# and a server bound only to 127.0.0.1 answers curl while leaving the browser
# looking at a closed port over ::1.
PORT="$PORT" HOSTNAME=0.0.0.0 exec node .next/standalone/server.js
