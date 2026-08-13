# Verification loop — changelog

Run with:

```bash
npm i --prefix /tmp/pw playwright
node .next/standalone/server.js &                     # the real production server
NODE_PATH=/tmp/pw/node_modules node scripts/verify.mjs --target=local --base=http://127.0.0.1:4173
NODE_PATH=/tmp/pw/node_modules node scripts/verify.mjs --target=live
```

---

## Iteration 1

**Defects found**

1. Sections 2–6 render nothing on `https://navrya.com`, in all five locales at
   all three breakpoints. Text present in the DOM at `opacity: 1`, positioned
   4,000–24,000px above the viewport. 225 assertion failures.
2. The deploy pipeline could not ship: `Dockerfile` copies `.next/standalone`,
   which `next.config.ts` never asked Next to emit.

**Fixes applied**

| File | Change | Why |
|------|--------|-----|
| `src/app/globals.css` | `overflow-x: hidden` → `overflow-x: clip` on `html, body` | `hidden` makes the box a scroll container on both axes, so the film's `position: sticky` screen stuck to body's scrollport — which never scrolls — instead of the viewport. `clip` cuts overflow without creating a scroll container. |
| `next.config.ts` | added `output: "standalone"` | The image runs `node .next/standalone/server.js`; without this the directory does not exist, the `COPY` fails, and the deploy exits non-zero leaving the old container running. |
| `scripts/verify.mjs` | new | The harness. |
| `VERIFY_PLAN.md` | new | The coverage contract. |

**Also corrected: five assertions in the harness that were wrong**, not the
site — the sticky-screen check below the film, the off-screen-text check inside
section 9's marquees, the eager-decode check against `preload="none"` plates,
`ERR_ABORTED` on cancelled plate prefetches, and click-to-expand on section 10
below 768px where it is a stacked list. Detail in `1/FINDINGS.md`.

**Result after fixes**

- local (iteration 2): 15/15 runs pass, 0 failures.
- live (iteration 3, after deploy): 15/15 runs pass, 0 failures.

**Deploy.** Run `31348684221` on `44b44d1` — verify and deploy both green. This
was the first push since the pipeline was added that changed the Docker build
context, so it was the first real image build; the run before it changed only
`.github/`, which `.dockerignore` excludes, so it was a full cache hit and never
exercised the `COPY .next/standalone` that would have failed.

Confirmed on the live origin afterwards: `body{…overflow-x:clip}` in
`/_next/static/chunks/23c1-ff-tnlc_.css`, and section 3 at `en/desktop` — a
black rectangle before — renders headline, subline and feature card.

**Still open at the end of the iteration:** nothing. Both targets green.

---

## Loop exit

Two iterations of fixes, four verification runs, 60 locale/breakpoint runs and
600 section visits in total. Exited green on both targets rather than on the
iteration limit.

## Final acceptance pass — `https://navrya.com`

Run against the deployed HEAD (`4830a5f`), after all three workflow runs went
green:

```
PASS — 15 locale/breakpoint runs, no failures.
runs: 15 | failures: 0
page errors total: 0
console errors total: 0
failed requests total: 0
videos per page: 7
first error on load: none, in any run
load ms  min/median/max: 896 / 1164 / 1517
```

Console is clean, no request fails, all seven plates are present on every page,
and nothing throws on load in any of the fifteen runs.

## Fixed — the opening shot played the whole way through at `opacity: 0`

Reported: the first video, the one where the hunter walks into frame, never
appears. Everything else clean.

It was correct. It just could not be seen.

```
currentTime 0.69  paused false  readyState 4  box 1440x900  opacity 0
currentTime 1.90  paused false  readyState 4  box 1440x900  opacity 0
currentTime 3.10  paused false  readyState 4  box 1440x900  opacity 0
currentTime 4.31  paused false  readyState 4  box 1440x900  opacity 0
currentTime 5.04  paused  true  readyState 4  box 1440x900  opacity 0
```

**Mine, from the two-tier fix.** That change added

```css
.video:not([data-plate-ready]) { opacity: 0 }
```

so a shipping plate stays transparent until it can honour the position it is
being scrubbed to — otherwise it paints its own first frame over a light copy
already sitting in the right place. `data-plate-ready` is set by `bindPlate`,
which runs over `SCENES`. `SCENES` starts at `turn`. The opening plate is
`dawn`, it is played rather than scrubbed, and it is not in that table — so it
never got the attribute, and the rule held it invisible for all five seconds
while the still frame sat behind it.

The guard was about handing over from a light copy. The lead plate has no light
copy — it has no proxy at all, and it is never handed a position it might fail
to honour. It should never have been inside that rule.

Fixed in CSS rather than by setting the attribute from the controller, so the
one plate every visitor waits on is visible even if no script runs:

```css
.video:not([data-plate-lead]):not([data-plate-ready]) { opacity: 0 }
```

**Why nothing caught it, which is the part worth keeping.** D2 asked whether
every video decoded, had frames, had a non-zero box, and whether its sources
were served. The plate answered yes to all four. It was flawless on every count
anyone was measuring and simply invisible — *working* and *visible* were never
the same property, and only the first was ever checked.

D2 now asserts the opening plate's computed opacity **while the shot is
running**, sampled across it rather than once. That timing is deliberate: the
timeline unlocks when the shot ends, so anything measured after the suite's
existing wait is looking at a plate parked on its final frame, which says
nothing about whether it was ever on screen. Confirmed to fail against the
reintroduced rule — *"opacity 0 at currentTime 0.23 over 19 samples"* — and to
pass against the fix.

Screenshots taken across the shot at 0.6s, 1.8s, 3.0s and 4.2s: the valley at
dawn, then the hunter entering with bow and quiver as the sun breaks. Looked at,
not inferred.

## Fixed — the re-encode put three and a half seconds in front of the opening

The re-encode below shipped with a regression I introduced and did not catch.
Reported as the site still being slow, and it was.

**What happened.** `encode-scene.sh` writes the light tier at 1280×720. The
light tier that was actually shipping was 854×480 — `58e7dd6` had shrunk it by
hand to cut the preview build and never updated the script, so the two had
disagreed silently ever since. Re-running the script regenerated the tier at its
own resolution and undid that edit: **1.21MB → 4.60MB**, tripled.

That tier was the one thing on the page marked `preload="auto"`, so it began
downloading at parse time, alongside the opening plate — the plate the interface
waits on before anything can be looked at.

**Measured against the live site, by aborting the tier and watching the
opening.** Two runs each:

| | dawn arrives | timeline unlocks |
|---|---|---|
| with the 4.5MB tier | 5952ms · 5514ms | 10491ms · 10105ms |
| tier aborted | 2974ms · 3212ms | 6767ms · 6929ms |

It doubled the opening plate's arrival and cost three and a half seconds before
first paint. It also produced the one failure in the live suite —
`en/mobile/s1-hero — D1-text: 4 text nodes, 0 visible ("Become the Hunter."
opacity=0)` — the hero caught still at zero on the coldest run.

**Worth recording: local said there was nothing here.** Under the same emulated
throttle, a local server unlocked in 6555ms with the 1.8MB tier and 6597ms with
the 4.6MB one — identical, so the local A/B cleared a tier that was in fact
costing three seconds in the field. Loopback had the bytes either way. The live
experiment is what settled it, and this is the second time in this loop that a
local reading has been the misleading one.

**Two fixes, because there were two faults.**

*The tier waits its turn.* It is `preload="none"` now, and the controller sends
for it the moment the opening plate starts playing. Nothing shares the line with
the opening; from there the tier has the whole length of the shot to arrive,
which at 1.8MB is about a second of a five-second run — and its only real
deadline is the unlock, several seconds later.

*The tier is budgeted, and the budget is asserted.* Presence was already checked
— six copies, each paired with a plate — and presence is what stayed green while
the tier tripled. `verify.mjs` now reads Content-Length off the wire and fails
over 2.5MB, naming the offenders. Confirmed to fail against the 4.6MB tier and
pass against the fixed one, so it is a check and not decoration.

**And the tier is better than the one it replaces**, rather than merely smaller.
It had been encoded with one keyframe for the whole clip — free for a file the
preview plays start to finish, and 189ms to answer a seek in the tier whose
entire job is answering a seek instantly. Measured on the heaviest plates:

| light tier | film | seek | SSIM |
|---|---|---|---|
| 854×480, one keyframe per clip | 1127 KB | 189 ms | 0.9216 ← used to ship |
| 854×480, gop 24 crf 50 | 1314 KB | 104 ms | 0.9241 |
| **854×480, gop 24 crf 46** | **1785 KB** | **104 ms** | **0.9393** ← ships now |

A better picture than the tier it replaces at 45% of the seek cost. The script
now writes exactly this, with its own keyframe interval rather than the plate's,
because the light tier is scrubbed on the site whichever mode the plate was
encoded in.

**Result on `https://navrya.com`**, throttled to 12Mbps, gesturing at a human
cadence, four runs:

| | before | after |
|---|---|---|
| timeline unlocks | 10105–10491ms | **6452–8044ms** |
| hero readable when the scroll opens | not on the coldest run | **every run** |
| stops carrying the shipping plate | 10 of 12 | **12 of 12** |

And the opening shot itself runs clean: sampled against the wall clock it plays
4.89s of footage in 4.89s, with **zero frozen milliseconds** — playback begins
at 1.57–2.6s, which is where it begins with no light tier on the page at all.
So what remains before the interface arrives is the opening shot playing, which
is the design, and not the network.

15/15 local, 15/15 live. Zero page errors, zero console errors, zero failed
requests across all fifteen live runs; 13 videos per page, the two tiers
complete. Load 1265 / 1356 / 1891ms.

**One thing deliberately not changed.** The origin serves HTML with
`cache-control: s-maxage=31536000` — a year, to shared caches, with no
revalidation. It is Next's default for a fully static page and it is a hazard
worth knowing about, but it is not causing anything today: this deploy's HTML
was live on the edge the moment the workflow finished. Flagged, not fixed,
because changing caching as a side effect of a video fix is how the next
mystery gets made.

## Re-encoded — a third off the film, at the same picture

The two-tier fix stopped the freezing but left the weight: 23MB on desktop.
Re-encoded from the highest fidelity copy that exists — there is no original in
the repository, so every plate here is a second generation off the shipping
1080 MP4, and that is stated rather than glossed.

**Measured before choosing.** Six settings on the heaviest plate, SSIM over the
whole clip against that source:

| setting | size | SSIM |
|---|---|---|
| gop 12 · 1920 · crf 28 | 5.38 MB | 0.95593 ← used to ship |
| gop 24 · 1920 · crf 28 | 4.14 MB | 0.95656 |
| **gop 24 · 1920 · crf 30** | **3.68 MB** | **0.95576** ← ships now |
| gop 24 · 1920 · crf 31 | 3.41 MB | 0.95521 |
| gop 24 · 1792 · crf 29 | 3.64 MB | 0.95500 |
| gop 24 · 1600 · crf 28 | 3.42 MB | 0.95452 |

A third smaller at a quality difference of 0.0002 SSIM, which is not a
difference. The keyframe interval was the whole story: one every twelve frames
spent a third of the file on intra frames for no visible gain, and one every
twenty-four still leaves a seek only twenty-three frames to walk — tens of
milliseconds against a scrub that animates over one to fifteen seconds.

The last two rows are why the plates stayed at full resolution. Dropping pixels
and dropping the quantiser cost about the same bytes, and the quantiser gives
the better picture. So nothing is upscaled on any display.

| | before | after |
|---|---|---|
| desktop (1080 webm) | 23 MB | **15 MB** |
| mobile (720 webm) | 13 MB | **7.9 MB** |
| page total, throttled walk | 28.5 MB | **21.8 MB** |

**Checked, not assumed.** Handover continuity — each plate's closing frame
against the next plate's opening frame, which is what a second generation would
damage first — is within 0.01 SSIM of the old encodes at every one of the five
cuts. A 1:1 crop of the most detailed plate, old beside new, shows no visible
softening in the scale armour, the fletching or the leather.

And the thing that actually matters: on a throttled line at a human gesture
cadence, **all twelve stops now carry the shipping plate**, not the light copy.
Before the re-encode two of them still fell back to the proxy.

## Fixed — the film froze on stills under the magnetic scroll

Reported: videos not playing since the scroll changed, and the site slow.

**The cause is arithmetic, not a bug in the scroll.** The plates were
`preload="none"` and fetched one beat ahead of the viewer. A beat of warning was
plenty when crossing one meant several seconds of wheeling; a magnetic step
crosses a whole beat in about a second, and a five-megabyte plate does not
arrive in a second. So the viewer landed on shot after shot with nothing behind
it and saw the still frame — the sequence looked frozen, not black.

Measured on a 12Mbps line, gesturing at a human cadence: **eight stops out of
twelve had no picture.**

Ordering the downloads better cannot fix it. The whole set is 23MB on desktop,
which is fifteen seconds at that speed; the scroll unlocks at six and the viewer
steps every second and a half. They are always ahead of it. Tried and measured:
warming every plate in scroll order still left eight stops blind.

**What fixed it was weight.** The repository already carried a proxy tier from
the preview pipeline — the same shots at 854×480, the whole film in 1.3MB — with
durations identical to the frame. Each scrubbed plate now renders two videos:
the light copy, which is in hand before the scroll even unlocks, and the
shipping plate behind it, which fades in when it can honour the position it is
being given. Both answer the same scrub fraction, so the handover lands on the
same picture, softer to sharper, in the same place.

| | before | after |
|---|---|---|
| stops with no picture (12Mbps, 12 steps) | 8 | **0** |
| scroll unlocks | 6.3s | 5.8s |

**Three faults found on the way, all mine, all found by measuring:**

*`preload="metadata"` on the plates made it worse* — seven metadata requests
sharing the line with the plate being watched. Bytes went 32MB → 78MB and the
unlock 6.3s → 11.3s. Back to `none`.

*`.load()` on an element that has already fetched something restarts resource
selection and throws it away.* That is where most of those bytes went. It is now
called only from `none`.

*Six plates all seeked the sixth.* The scene loop declares its locals with
`var`, which is function-scoped, so closures written inside it captured the one
shared binding rather than that turn's plate. Every plate but the last sat at
time zero. Fixed by binding through function parameters (`bindPlate`).

*And the scrubber threw away the position it was asked for* when the plate had
no duration yet — so after a step finished there were no further scroll events
to ask again, and the plate stayed on its first frame. It now holds the wanted
fraction and fires the moment the decoder can honour it.

**Verified.** 15/15 local. The new check reproduces the original fault against
the unfixed build still on production — "plate on screen with no frames to draw
— step 3: draw · step 4: strike" — and passes against the fix, so it is a check
and not decoration. It runs throttled on purpose: unthrottled, the broken build
passed it.

## Reverted — stepped scrolling through the film

Briefly, the film stepped: one gesture glided to the next section and waited,
and a later change made each glide last as long as the footage it scrubbed.
Both were reverted at the owner's request. `61d1531` and `71111b4`, undone in
`30b3993`; the tree is byte-identical to what it was before them.

Scroll is native again — a wheel moves the page by its own delta, momentum,
trackpad, touch, keyboard and scrollbar all untouched, and every frame of the
sequence is a pure function of `scrollY`.

Nothing else went with it. The links to the product, the `overflow-x: clip`
fix and the standalone-output fix are all still in place.

## Change — the login and the archetypes link to the product

Requested, not a defect. The header's Login, section 10's four archetypes and
the invitation under them now point at `https://app.navrya.com/`.

| File | Change |
|------|--------|
| `src/config/site.ts` | new — the product's address, named once |
| `src/components/site/SiteHeader.tsx` | Login `<button>` → `<a href>` |
| `src/components/archetypes/ArchetypesSection.tsx` | panels `<button>` → `<a href>`, `aria-pressed` dropped, foot text wrapped in a link |
| `src/components/archetypes/ArchetypesSection.module.css` | `.footLink` |
| `src/components/frame/stage-script.ts` | open state read at `pointerdown`, used at `click`; no more `aria-pressed` |
| `scripts/verify.mjs` | six link assertions per run; accordion asserted through hover |
| `VERIFY_PLAN.md` | the contract for both |

**Two traps worth recording.**

A tap focuses a link before it clicks it, and focus opens a panel — so a guard
that reads "is this panel open?" at click time reads `true` every time and never
holds. The state has to be read at `pointerdown`. The first version of this
change was wrong in exactly that way and the touch test caught it.

The sandbox then hid the failure: with no route stub, a tap *did* navigate, the
request to the product died on the egress gateway's TLS reset, and the page
stayed put — which looks identical to a guard that worked. Stubbing the app host
inside the browser is what made the difference visible.

**Also:** a build served on a port that already had a stale server bound to it
returned the old page while the new build sat correct on disk. `ps` could not
see the old process. Worth knowing before trusting a local check.

**Verified.** Local standalone server 15/15, live 15/15 after deploy, 6 links in
all five locales. Eleven navigation behaviours tested directly against
`https://navrya.com` — hover opens without navigating, mouse click goes, first
tap on a coarse pointer opens and the second goes, a stacked-layout tap goes,
and every panel is still a working link with JavaScript switched off. The new
link assertion was confirmed to fail six times when pointed at a wrong address,
so it is a check and not decoration.

## Independent re-check — same URL, later, cold

Re-run from a fresh container with a freshly installed browser, well after the
deploy settled, to catch anything the first pass could have seen only because it
ran minutes behind its own push — a warm CDN edge, a still-running old
container, a cached asset:

```
PASS — 15 locale/breakpoint runs, no failures.
runs: 15 | failures: 0
page errors: 0 | console errors: 0 | failed requests: 0 | firstError runs: 0
videos per page: 7
load ms  min/median/max: 1081 / 1163 / 1627
```

`screenTop` is `0` with `position: sticky` at every one of the six film markers,
in all five locales — the fix is holding, not merely passing. Origin still
serves `body{…overflow-x:clip}` from `/_next/static/chunks/23c1-ff-tnlc_.css`.
Screenshots reviewed: `en/desktop/03-panel2` (the black rectangle of iteration
1) renders headline, subline, feature card and plate; `fa/desktop/01-hero`
mirrors correctly — nav right, rail left, RTL copy, plate playing.
