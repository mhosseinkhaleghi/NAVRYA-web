# VERIFY_PLAN.md — the verification contract

This inventory is the contract. It does not shrink to make a run pass. If a
check is wrong, fix the check and say so; do not delete it to reach green.

## What this site actually is

Worth stating up front, because it rules out most of the usual suspects:

- **Next.js 16.3 (Turbopack), React 19, server-rendered.** Deployed as a
  standalone Node server in Docker, behind a shared Caddy edge.
- **No client React.** Not one `"use client"` component. All behaviour is a
  single inline controller (`src/components/frame/stage-script.ts`) injected as
  a template literal and run before first paint.
- **No GSAP, no ScrollTrigger, no Lenis, no Three.js, no canvas, no WebGL.**
  Scroll-driven reveals are plain CSS custom properties (`--head`, `--body`,
  `--r`) written onto elements by that one controller on `scroll`.
- **CSS Modules only.** No Tailwind, no shadcn, no runtime CSS-in-JS.
- **Assets are served from `public/`** at absolute root paths (`/scene/...`,
  `/cast/...`, `/fonts/...`). No bundler imports for media, no base path.

So the failure modes worth asserting on are: the controller throwing before it
writes its properties, the reveal properties never leaving 0, the sticky screen
failing to stick, media 404ing out of the container, and RTL mirroring.

## Coverage matrix

**Locales (5).** `en` (ltr), `tr` (ltr), `fa` (rtl), `ar` (rtl), `es` (ltr).

**Breakpoints (3).** 390×844 mobile, 768×1024 tablet, 1440×900 desktop.

**Routes.** `/{locale}` for each of the five. Plus `/` (must redirect to a
locale) and one unknown path (must 404, not 500).

**Targets.** `local` (production build, `next start`) and `live`
(`https://navrya.com`). Local green with live broken is a failed run.

## Sections, in scroll order

The first six live inside the film — a sticky screen scrubbed by scroll. The
last four are ordinary document flow below it.

| # | Section | Marker | Kind |
|---|---------|--------|------|
| 1 | Hero | `[data-hero]` | film |
| 2 | Panel 1 | `[data-panel="p1"]` | film |
| 3 | Panel 2 | `[data-panel="p2"]` | film |
| 4 | Panel 3 | `[data-panel="p3"]` | film |
| 5 | Closing / arrow | `[data-arrow]` | film |
| 6 | Miss | `[data-miss]` | film |
| 7 | Dark | `[data-dark]` | flow |
| 8 | Partners | `[data-partners]` | flow |
| 9 | Testimonials | `[data-testimonials]` | flow |
| 10 | Archetypes | `[data-archetypes]` | flow |

Every section must be reached, screenshotted, and asserted on, in every locale,
at every breakpoint, on both targets.

## Named defect checks

These three are what the user reported. They are mandatory and they are checked
at every stop, not once per run.

### D1 — Text visibility

For every element carrying visible text content inside the section under test:

- computed `opacity` > 0.05 (the reveal properties must have advanced)
- computed `visibility` !== `hidden`, `display` !== `none`
- bounding box width > 0 and height > 0
- box intersects the viewport (not parked thousands of pixels off-screen —
  this is the exact shape of the sticky failure)
- rendered text colour is not within a negligible contrast distance of the
  background behind it

A section that reaches its stop with zero passing text blocks is a failure.

### D2 — Video playback

For every `<video>` in the document:

- `readyState` > 0
- `videoWidth` > 0 and `videoHeight` > 0
- rendered bounding box is non-zero
- no failed network request for any of its `<source>` URLs
- every `<source>` URL returns 2xx (checked directly, not just inferred)

### D3 — Layout integrity

- `document.scrollingElement.scrollWidth` must not exceed the viewport width by
  more than 1px — no horizontal overflow at any breakpoint
- the sticky screen (`[data-track] > div`) must report a viewport top of ~0
  once the timeline has been entered; a large negative top means sticky is
  broken and is a hard failure
- `<html dir>` must be `rtl` for fa/ar and `ltr` for en/tr/es
- no element with `NaN` in its computed position
- no image with `naturalWidth === 0`

## Runtime health, collected at every stop

- browser console errors and warnings (the **first** error thrown on load is
  recorded separately — an early throw aborts the controller and would explain
  D1 and D3 together)
- unhandled promise rejections, page crashes
- failed network requests (4xx, 5xx, blocked, CORS)
- fonts: `document.fonts.check` for Peyda at the RTL locales, so a Persian
  regression is caught rather than eyeballed

## Interactions

- **Language menu**: open, confirm all five locales listed, close on Escape and
  on outside click.
- **Section rail**: present, correct number of marks, clicking a mark moves the
  document and lands on that section.
- **Section 10 accordion**: hovering a panel must expand it (its width must
  grow) and contract the others, with a real mouse move so `pointerenter`
  carries `pointerType: "mouse"`. Hover must not navigate. Arrow keys must move
  the selection, mirrored under RTL.
- **Links out to the product**: the header's login, all four archetype panels
  and the invitation under them must each be an `<a>` whose `href` is exactly
  `https://app.navrya.com/` — read off the built page, not from the constant the
  page was built from. Six links per locale, at every breakpoint.

  A panel is a link, so pressing one leaves the site by design; expansion is
  asserted through hover instead. This replaces a click assertion with a hover
  assertion of the same strength and adds six link assertions per run — the
  accordion is still covered, and the count of checks goes up, not down.
- **Scroll the full timeline**: real wheel events, not `scrollTo` — a
  synthesised jump hides exactly the class of bug reported here. Confirm the
  document actually advances and never stalls.

## Exit criteria

Both targets exit zero, every section in the matrix has a screenshot that has
been *looked at*, and FINDINGS.md for the final iteration is empty.
