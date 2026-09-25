# Provenance

Vendored from [`latent-spaces/brag`](https://github.com/latent-spaces/brag)
(`skills/brag/`), commit `c893c5ed52aed84e3e2ee56787de869fccdae6b0`.

The full `/brag` workflow: reads the project, plans a launch-video
storyboard, then hands a composition brief to Hyperframes (HeyGen's
HTML-video-composition engine — see `.claude/skills/hyperframes-*`) to
build, time, and render it. Needs `npx hyperframes` (Node 22+, FFmpeg,
Chrome — see `hyperframes doctor`) and, for anything beyond a fully local
render (HeyGen cloud rendering, HeyGen-hosted voice, account sign-in),
network access to `hyperframes.heygen.com` / `api.heygen.com`.

`/brag-slim` (`.claude/skills/brag-slim/`) is the lighter alternative
installed earlier in this repo: no Hyperframes, no bundled assets, the
model builds the video directly with tools already on the machine.

To update: re-copy `skills/brag/` from the upstream repo.
License: MIT (see `LICENSE` in this directory).
