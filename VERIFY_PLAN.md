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

`/{locale}/feature` as well — the features page, which runs the same opening off
the same `Stage`, `Scene`, `Hero` and controller. It gets its own pass rather
than a second route through the matrix: the home run walks ten sections and this
page has two slides. Every locale at the desktop frame, where the composition
differs most from the compact one, and English at all three.

What is asserted there is not that it works but that it works *the same way*:
the plate decodes and stays visible for the whole shot, the interface is held
back until the shot ends, the headline and sub-headline arrive, nothing
overflows, `dir` is right, and the bar marks the page it is on and still offers
a way back. If the two pages ever stop sharing an implementation, this is what
notices.

**Slide 2 — the battle map.** Reached with real wheel events, never `scrollTo`,
because the two are not the same test and the difference is what a whole round
of debugging turned on: the page was perfectly scrollable by script while every
wheel gesture was being swallowed. With two stops the first one is also
`length - 2`, so the film took the home page's hand-off-to-section-7 branch on
the opening gesture and glided back to the top. What is asserted:

- one gesture moves the page at all;
- the opening and the slide's headline are never legible at the same time —
  sampled all the way through the travel, not only at the ends. Read off
  `[data-hero-part]`, which is the element the exit opacity is on, and never off
  the heading inside it: `opacity` composites rather than inheriting, so a
  headline inside a block at `opacity: 0` still computes to 1. Asking the `h1`
  was this check's own first bug and it reported seven collisions on a page that
  has none. Proved both ways — the corrected check is silent on the shipped
  timing and fires on the old exit window, where the opening is still at full
  opacity with the slide's headline 22% arrived. It then found a second, real
  one: the scroll cue's entrance animation is still running when the timeline
  unlocks — measured at opacity 0.752 with the page already live — and a running
  animation overrides the exit declaration, so the cue was pinned on screen over
  the arriving slide. The entrance now lives on an inner span and the exit on
  the part, which is the arrangement the rest of the hero already uses;
- the film's last magnetic stop is the foot of the document. Anything short of
  it is scroll the wheel refuses to travel while the scrollbar says there is
  more, and the fix is the film's own timing, never a shorter track: a resting
  stop is `cues[1] + REST_SPAN` of its beat, so a last scene resting at the end
  of its shot is what makes the two agree;
- at rest the panel is active, both reveal groups are complete, the headline is
  painted with a box, and the shot has actually reached its end;
- neither medallion is cropped. They are drawn *outside* the frame they belong
  to, so the row has to reserve their overhang — before it did, the foot mark
  was cut by the viewport at every desktop frame measured;
- the bar keeps its transparent ground. It takes the page's ground below the
  film, and this film has no page below it, so the closing half-screen is still
  footage.

**One exemption, and its evidence.** `net::ERR_ABORTED` on a `.webm` or `.mp4`
is not counted, on either route. A media element opens an unbounded range
request and closes it the moment it holds the whole resource; the home page
raises eleven of these per visit and the features page two, and every one was
checked to end with the element at `readyState 4`, `networkState` idle, and
`buffered` equal to `duration`. Nothing else is exempt: every source is proved
separately by fetching it and reading its status, and any non-media failure or
any 4xx/5xx is still a failure.

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

### D5 — The page is in the reader's language

Checked on both routes, in every locale, at every breakpoint.

- `<html lang>` must equal the locale being visited
- the page must have a non-empty `<title>`
- across a full run, the five locales of a route must not share a title. One
  hardcoded English pair served all five for a while: the page rendered in
  Turkish while its tab, its bookmark, its shared link and its search result all
  said "Become the Hunter." A single run cannot see that — only the set can,
  which is why this one assertion is made after the matrix rather than inside it
  (and is skipped on a `--locales=` run, where fewer than five proves nothing)
- every language menu on the page — the bar's and the footer's alike — must
  offer exactly `en,tr,fa,ar,es`, and **every option must point at the current
  route in that locale**, not at its home page. Changing language is a change of
  language, not a change of subject: `/en/feature` → Turkish must be
  `/tr/feature`. It was `/tr`, so switching language on the features page
  dropped the reader onto the home page, in the language they had just told us
  they read better

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
