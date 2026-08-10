# Iteration 1 — findings

Two targets, five locales, three breakpoints, ten sections each.

| target | result | failures |
|--------|--------|----------|
| local (production build, standalone server) | **pass** | 0 |
| live (`https://navrya.com`) | **fail** | 225 |

Local and live are the same commit apart from one uncommitted line. That line is
the whole difference.

---

## 1. Sections 2–6 render nothing — every locale, every breakpoint

- **Route/lang/breakpoint:** all of them. 15 of 15 runs, 5 sections each.
- **Severity:** critical. This is the reported bug, and it is all three of the
  reported symptoms at once.
- **Root cause file:** `src/app/globals.css`

The measurement, from `verification/1/live/report.json`:

```
en/desktop/s3-panel2 — D1-text: 8 text nodes, 0 visible
                       (first: "Section 3" opacity=1 top=-7238 onScreen=false)
en/desktop/s3-panel2 — D3-layout: sticky screen top is -7504 (expected ~0)
```

The text is not hidden. It is fully opaque — `opacity=1` — and 7,238 pixels
above the top of the window. The screenshot at
`verification/1/live/en/desktop/03-panel2.png` is a black rectangle with only
the header and the section rail on it.

**Why.** `html, body` carried `overflow-x: hidden`. A box with `overflow`
other than `visible` on one axis is a scroll container on *both* — the spec
forces the other axis to `auto`. Once `body` is a scroll container, a
`position: sticky` descendant sticks to **body's** scrollport instead of the
viewport. Body's scrollport never scrolls, so `.stage` never stuck: it scrolled
away with its own block, and every panel absolutely positioned against it went
with it.

Section 1 survives because it is on screen before any of this matters, and
sections 7–10 survive because they are ordinary flow below the film and are not
positioned against the stage at all. That is precisely the 2-through-6 shape the
user reported.

**Fix.** `overflow-x: clip`. It cuts the overflow without creating a scroll
container, which is the reason `clip` exists.

**This one defect explains all three reported symptoms:**

- *"Text is invisible in several sections"* — the text is off-screen, not
  transparent.
- *"Videos do not display in some sections"* — the plates live inside the same
  sticky screen and left with it. Nothing is wrong with the media: every source
  URL returns 2xx on live, the opening plate decodes, and no `<video>` reports a
  `MediaError`. Zero D2 failures in the entire live run.
- *"Overall layout is broken"* — the film's whole screen is gone from the
  viewport for two thirds of the page.

## 2. The deploy pipeline could not have shipped anything

- **Severity:** critical, and it would have silently swallowed the fix above.
- **Root cause file:** `next.config.ts`

`Dockerfile` runs `COPY --from=builder /app/.next/standalone ./` and starts
`node server.js`, but `next.config.ts` never set `output: "standalone"`, so
`.next/standalone` is never produced. The image build fails at that `COPY`; the
deploy step is `set -eu`, so it exits non-zero and the running container is left
alone. The site stays up and the push appears to do nothing.

Verified by building before and after: no `.next/standalone` before, a working
`server.js` after. The local target in this run is that standalone server, not
`next start` — `next start` refuses standalone output and would not have been
the same thing being tested.

## 3. Not defects — assertions I had wrong

Recorded because a check that cries wolf is worse than no check.

- The sticky screen is *supposed* to leave the viewport below the film. The
  screen-top assertion now only applies to sections 1–6.
- Section 9's columns are vertical marquees that park duplicated quotes above
  the window on purpose. The off-screen-text assertion is now scoped to the film.
- Plates 2–7 are `preload="none"` by design — a viewer who never scrolls
  downloads one video. Asserting all seven had decoded at load asserted against
  the design. Now: the lead plate must decode, every source URL must return 2xx,
  nothing may report a `MediaError`, and after a full wheel walk at least one
  plate must have decoded.
- `ERR_ABORTED` on a plate is the controller cancelling a prefetch the viewer
  scrolled past. Filtered for media only; 4xx/5xx still fail.
- Below 768px section 10 is not an accordion — it stacks and opens all four.
  The click-to-expand assertion now only runs at ≥768px.

## Environment note, not a site finding

Chromium could not reach `https://navrya.com` from this sandbox:
`ERR_CONNECTION_RESET` on every navigation, while `curl` fetched the same URL
fine. The egress gateway passes this host through rather than re-terminating it
and resets Chromium's TLS 1.3 ClientHello. The harness takes `VERIFY_TLS12=1` to
cap at TLS 1.2; certificate verification is untouched. This is a property of the
test sandbox, not of the site — real visitors are not behind this gateway.
