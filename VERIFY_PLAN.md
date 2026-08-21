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

**Each slide is judged at its own resting stop.** The walk samples every step
and, for each slide, the assertions run against the sample where that slide is
up and furthest arrived — not against the film's last frame. They all read off
the final sample once, which held for exactly as long as the last slide was the
only slide; when a fourth arrived, fourteen runs reported "slide 2 never became
active" about a slide that had been complete several stops earlier. The site was
right and the check was looking in the wrong place.

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
- at rest the panel is active, its reveal is complete, the headline is painted
  with a box, and the shot has actually reached its end;
- the rule under the headline is present, has a real width, and **does not cross
  the words**. There was a gold ornamental frame on this slide and it is gone —
  the map is the whole picture now — which brought the site's usual stopped rule
  back under the title. Sitting straight beneath the h2 it struck through the
  text: `line-height: 1.08` is tighter than Cinzel's metrics, so the border box
  ends six pixels above the ink and every box-based measure called the stack
  clean. The check reads the glyphs with a Range, not the element box;
- the bar keeps its transparent ground. It takes the page's ground below the
  film, and this film has no page below it, so the closing half-screen is still
  footage.

**Slide 3 — the map, named.** The same shot continued: the map's closing frame
and this plate's opening frame differ by more than 12/255 on 0.04% of pixels, so
the handover is a cut nobody sees. Eight callouts and a closing sentence arrive
staggered over it, and the film's last stop is the foot of the document. What is
asserted at that stop:

- the panel is active, all eight callouts and the closing lines have reached
  `--r > 0.99`, and no callout is empty in any locale;
- the scatter plate has decoded and run to its end;
- no callout sits outside the viewport, **and neither does the closing
  sentence**. It is the stage's sibling rather than its child, because on a wide
  frame it is set over the foot of the picture instead of pinned to a point on
  it — so the portrait layout has to stack the two explicitly, and when it did
  not the sentence went absolute against a panel it no longer filled and sat at
  y=844 in an 844-tall viewport. Fully opaque, `--r` complete, flush against the
  bottom edge and invisible; only a box test sees it, and the first version of
  this check tested the callouts alone and let it through;
- **the callout layer lands on the painted plate, within 2px on every edge.**
  This is the one that matters. The labels are pinned to percentages of the
  *picture*, and the picture is `object-fit: contain` — so its box is only the
  element's box when the viewport happens to be 16:9. Any drift and all eight
  point at empty ground, differently at every width, with nothing about a single
  screenshot to give it away. Below 1:1 the plate switches to `cover` and cannot
  be tracked at all, so the slide changes to a list there and the check does not
  apply.

**Slide 4 — the council table.** Not a continuation but a cut to another room:
its source arrives as a transition — the labelled map, a white flash at frame
31, then a whip into the table — so the plate starts at source frame 37 and the
opening belongs to slide 3. Asserted at the last stop:

- the panel is active; the head, the call to action and all three pillars have
  reached `--r > 0.99`; none of its blocks is empty in any locale;
- nothing sits outside the viewport;
- the council plate has decoded and run to its end;
- **slide 2's headline has fully left.** That panel has no exit across slide 3
  on purpose — the map is named under the sentence that introduced it — and when
  a fourth slide arrived it was still up: "The Battlefield Is Never Missing
  Data." over a different room. A panel with no exit is correct only until
  something else takes the frame;
- **the block is on the side of the frame the picture leaves empty.** The shot
  is a table seen from above with the commander to its right, so the words go
  left — and the plate mirrors under RTL, so in Persian and Arabic they must go
  right with it. Checked as which half of the frame the block's centre falls in,
  on wide frames only.

**Every stop shows its own plate, not the stand-in.** Checked at each resting
stop of the features walk: the composited shipping plate must carry
`data-plate-ready`. The proxy is 854×480 and exists to cover the moment before
the real shot lands; it covered the first two slides of this page outright. The
warm chain skipped its lead plate by *name* — `'dawn'`, which is what the home
film calls its lead and what no other film does — so on this film it queued the
lead first and then waited eight seconds for a `canplaythrough` that had fired
seven seconds earlier. No shipping plate was requested until 12.9s, against an
unlock at 5.5s: measured at the first two stops, 21% and 59% buffered with the
viewer watching the proxy. The chain now skips the lead by role, never waits on
a plate that is already warm, and warms exactly one plate ahead while the
opening plays. One, not the whole tier — preloading six 1080p plates at once
cost the home film 580ms on its unlock, not for want of bandwidth but because
demuxing fourteen megabytes competes with playing the shot on screen.

**The plates carry no burned-in lettering.** `scripts/check-plate-clean.mjs`,
run separately from the browser suite because it is a property of the files
rather than of the page. The source for slide 3 draws its own English callouts
into the footage from frame 22 on; shipped whole, a Persian reader would get a
Persian page with English words painted into the picture, and no stylesheet
could reach them. The plate is trimmed to the clean run before them and the
words are set as text — which is what lets one video serve five languages. The
check counts near-white pixels, because the lettering is cream while the map is
only ever bright in red and gold: the lit keep and the gold columns peak at four
such pixels, the first word brings twenty. Proved both ways — it passes on the
shipped plate and fails on the untrimmed one at 20 and 35.

The council plate is guarded differently, because the cream test cannot see it:
that shot is lit parchment and candlelight and is full of near-white pixels by
nature. Its risk is a lost `START` rather than a lost trim — the source opens on
the labelled map — so the test is aimed at one patch, the square where slide 3's
"Price." callout sits. On this shot it is dark stone and never exceeds 7.3; on
the labelled map it reads about 25. Proved both ways: re-encoding without
`START` takes it to 86.2 and the guard fails.

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
