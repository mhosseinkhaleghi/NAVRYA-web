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

And for the opening plate specifically, **it must be visible while it plays**:
computed `opacity` > 0.05 sampled repeatedly across the shot, not once at the
end. Working and visible are different properties, and this list used to check
only the first. A stylesheet rule held the lead plate at `opacity: 0` for the
whole of its five seconds while it decoded, buffered, held a full-size box and
advanced its clock 0 → 5.04 — flawless on every count above, and invisible. The
visitor saw the still frame behind it, and the one shot the entire opening is
built around never appeared.

Sampled during playback on purpose: the timeline unlocks when the shot ends, so
anything measured after that wait is looking at a plate on its final frame,
which says nothing about whether the shot was ever on screen.

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
- **Links out to the product**: the header's login, all four archetype panels,
  the invitation under them, the hero's two calls to action and the footer's
  closing one must each be an `<a>` whose `href` is exactly
  `https://app.navrya.com/` — read off the built page, not from the constant the
  page was built from. Nine links per locale, at every breakpoint.
- **The hero's links are gated behind the opening**: while `data-intro` is
  `armed`, the pair must be at `opacity: 0` *and* `pointer-events: none`,
  sampled repeatedly across the shot.

  Both halves are the check. They were added to the composition without being
  added to the reveal, so a filled gold button painted over the film for five
  seconds while the words it belongs to were still at zero. And invisible alone
  would not be enough: an element at `opacity: 0` still takes a click and still
  holds its place in the tab order, so an ungated pair is two invisible targets
  over the footage.

  A panel is a link, so pressing one leaves the site by design; expansion is
  asserted through hover instead. This replaces a click assertion with a hover
  assertion of the same strength and adds six link assertions per run — the
  accordion is still covered, and the count of checks goes up, not down.
- **Scroll the full timeline**: real wheel events, not `scrollTo` — a
  synthesised jump hides exactly the class of bug reported here. Confirm the
  document actually advances and never stalls.
- **A picture while stepping** — the guard for the reported fault. Gesture
  through the film at a human cadence (flick, look, flick; no waiting for the
  network) **on a throttled line**, 12Mbps down and 40ms out, and require every
  plate that is on screen to hold data at the time it is being asked to show.

  Two things this deliberately does not do. It does not settle between
  gestures: waiting for the network is precisely what a viewer will not do, and
  settling hid the fault completely. And it does not read `readyState`, which
  drops to 1 for the length of a seek even when the whole file is in hand —
  buffered coverage of the wanted time is the only honest question.

  Throttled because the fault is invisible at datacentre speed: unthrottled,
  the broken build passed this check.
- **Both scene tiers are present**: seven shipping plates and six light copies,
  each light copy paired with a plate. The light tier is what keeps the film
  running under a magnetic step; if it disappears the film does not fail
  loudly, it quietly freezes on stills again.
- **The light tier is inside its weight budget**: the six light copies together
  must be under 2.5MB, read from `Content-Length` off the wire rather than from
  the repository, because what matters is what the edge serves.

  Presence alone was not enough, and this is the check that was missing when it
  mattered. The tier is the one thing on the page marked `preload="auto"`, so
  its bytes are spent *before* the viewer asks for anything — in front of the
  opening plate, which is what the interface waits on. Re-encoding it at
  1280×720 rather than 854×480 tripled it to 4.6MB and the whole suite stayed
  green: six copies, every pairing intact, every URL 200. What it actually cost
  was the opening, 6.4s to 11.2s on a 12Mbps line, surfacing as the hero
  headline sitting at `opacity: 0` on the coldest run.

## Exit criteria

Both targets exit zero, every section in the matrix has a screenshot that has
been *looked at*, and FINDINGS.md for the final iteration is empty.
