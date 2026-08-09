# Production deployment

The public marketing site is served at `https://navrya.com` and
`https://www.navrya.com`.

Every push to the repository's default branch,
`claude/navrya-hero-section-n3tkxr`, runs lint and a production build in GitHub
Actions. After verification, the workflow connects to the production server,
updates `/opt/navrya-web`, rebuilds the Docker image, and replaces the running
website container.

TLS and public routing are handled by the existing Caddy edge service shared
with `app.navrya.com` and `admin.navrya.com`. The marketing container only joins
that private Docker network and does not expose a host port.
