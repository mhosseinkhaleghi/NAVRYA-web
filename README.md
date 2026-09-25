# Navrya — web

A premium cinematic marketing site. **Current scope: sections 1–10.**

```bash
npm install
npm run dev     # http://localhost:3000 → redirects to /en
npm run build
npm start
```

Deployment is documented in [`DEPLOYMENT.md`](DEPLOYMENT.md); what has to hold
before a deploy, and the harness that proves it, are in
[`VERIFY_PLAN.md`](VERIFY_PLAN.md) and `scripts/verify.mjs`.

---

## The frame model

Navrya is not a scrolling document. The viewport is a **full-screen cinematic
frame** that never translates while the film runs. Everything renders inside
`components/frame/Stage`, whose screen is `position: sticky; inset-block-start:
0` inside a block as tall as the timeline.

Sticky rather than fixed, and the distinction is load-bearing. A fixed screen
needs a spacer to stand in for the height it no longer occupies and a z-index
stack to sit under the document that follows it; sticky needs neither, because
the block *is* the height and the screen simply stops pinning when its block
ends. The handover to section 7 is then a fact of layout instead of something
kept in step by hand.

It comes with one sharp edge, and the site has been bitten by it: **a sticky
element pins to its nearest scroll container, not necessarily the viewport.**
Give `html` or `body` an `overflow` of anything but `visible` on either axis and
the spec forces the other axis to `auto`, body becomes that scroll container,
and the screen pins to a scrollport that never scrolls — which is to say it does
not pin at all, and every panel positioned against it leaves the top of the
page. That is why `globals.css` sets `overflow-x: **clip**` and not `hidden`:
clip cuts the overflow without creating a scroll container. Do not change it
back.

The *document*, however, does scroll — and that scroll is the timeline. Native
scroll rather than synthesised wheel events, because it comes with momentum,
trackpads, touch, keyboard and the scrollbar already working, and because a
position is inherently reversible in a way an event stream is not. The
scrollbar is hidden, so nothing about the frame reads as a scrolling page.

Overscroll chaining is switched off **sideways only**. On the vertical axis
`overscroll-behavior: none` does not mean "no rubber-banding" — it means "this
document does not hand a scroll to whatever contains it", and embedded in an
iframe that is exactly the wrong promise: when the frame's own scroll runs out
the only way onward is to chain to the parent. With it on both axes the wheel
died at the bottom of an embed while the rail, which scrolls by script, kept
working. Hence `overscroll-behavior-x`.

Inside the film the page moves **one chapter per intent**. A wheel gesture, a
swipe or a key picks the next complete story state and a travel carries the
page there, playing the footage in between; every frame is still a pure
function of scroll position, so the film runs backwards as readily as forwards.
Below the film the page scrolls natively, in both directions. See *Stepping*.

Scroll position feeds scene changes *inside* the frame. `Stage` renders a track
below itself whose only job is to give the document height to scroll through;
`--timeline-vh` is that height, and stretching it slows every beat of the
sequence proportionally. The controller writes it from its own beat table before
first paint — the two drifted once, when a beat was added and the token was not,
and the sequence ran off the end of its own track — so what is in `tokens.css`
is the no-JS fallback.

The unit it is multiplied by is a clamped `lvh` (see `.film` in
`Stage.module.css`): clamped so that a frame sized to its content cannot feed
back into the track's length, and the *large* viewport so that a phone's
toolbar sliding in and out while the page below the film scrolls does not
resize the thirty-eight-screen track above the reader by thirty-eight toolbars.

### Stepping

One intent, one chapter. The states are where the choreography has finished a
readable thought — each panel complete, the closing sentence lit, the miss
statement whole, each psychology card — and they are computed from the same cue
and beat tables the frames are painted from, so retiming a scene moves its stop.
The last step of the film is the hand-off onto the page: the same target and
glide as section 7's rail mark.

What a step does, and what it no longer does:

- **Its speed is the viewer's.** An ordinary scroll — a notch or a short turn of
  a wheel, an unhurried trackpad swipe, a swipe on a phone, a key — plays the
  footage at the speed it was shot (7.3s from the opening to section 2). Harder
  input plays it faster, up to 4×: a wheel or trackpad by how much it has moved
  in the last moments, a touch by the finger's speed, a held key at 2×, and each
  further flick, notch or swipe while a step runs (or each half second of a
  wheel or key kept going through it) adds half a speed. A step speeds up the
  moment the input does and does not slow down before it lands; the next one
  keeps that speed while the viewer is still going, and one asked for from rest
  starts again from the input. Constants: `RATE_MAX` and the ones after it in
  `stage-script.ts`. It used to be fixed either way: first everything at 1×
  however hard the viewer scrolled, then every step squeezed into about two
  seconds (2–4×) however gently.
- **Input during a step is kept, not dropped.** A flick while travelling is
  taken the moment the travel lands (two are kept); a flick the other way turns
  the travel round to the chapter it left.
- **A held wheel or key carries on; momentum does not.** A gesture is a burst of
  wheel events, timed by the events' own timestamps; input still at strength
  when a step lands continues into the next one, and a trackpad's decaying tail
  never does, so one swipe is one step.
- **Space presses a focused button**, ctrl + wheel still zooms, and a sideways
  swipe (the bar's links scroll sideways on a phone) is left alone.
- **Upward below the film is ordinary scrolling.** From section 7's top one step
  goes back into the film; further down the page scrolls up natively. It used
  to take any upward wheel below the film — from section 9 as readily as 7 —
  straight back to the film's last chapter.
- **Nothing waits on the opening.** A first step taken while the opening shot is
  still playing runs the rest of it faster — 2× for an ordinary scroll, up to 4×
  for a hard one — and steps the moment it ends, so the film continues from its
  last frame rather than cutting out of the middle.
- **A travel paints each frame itself**, in the frame it moves, instead of a
  frame later from the scroll event it raises.

Measured against the original on the same build setup: one notch to section 2
took 8.7s and takes 2.3s; a held wheel reached section 7 in 58.6s and reaches
it in 19.6s; on a phone the first swipe landed after 8.1s and lands after 1.6s,
and reaching section 7 took 43 swipes and 44s against 16 and 15s.

### Where the film stops

The site is a film and then a page. Sections 1–6 are the film: a fixed frame,
scrubbed by scroll, nothing latching. **Section 7 onward is an ordinary
document** — `Stage`'s `after` — vertical sections stacked one against the next,
each on its own opaque black, scrolling up over the pinned frame and past it.
The frame has faded to that same black by the time any of it is on screen, so the
handover has nothing to see. Nothing pins, nothing is a slide: they scroll like
any site's sections, and a ninth section is one more block in the same list.

That split is why the film measures its progress against **the track** rather
than the document: the document continues past the film, and measuring the whole
of it would stretch every beat over content the film has nothing to do with. The
film completes exactly as the track's last screen goes by, and the first document
section begins on the pixel the track ends.

**The reveal is still scrubbed**, which is what keeps these sections feeling like
the film they follow rather than a different website bolted on. Every block that
arrives carries `data-rise` and names a property; the controller measures where
that block is in the frame and writes the progress onto its section, so the CSS
is the same `--head` / `--body` the film used. The headline rises, and the
paragraph follows *because it is lower down and reaches the mark later* — no
stagger is written by hand, and adding a block to a section needs no timing.

What is different from the film is that none of it runs backwards. Each value is
kept at its high-water mark, so scrolling back up leaves an arrived section
arrived and the page simply moves. That is the only one-shot behaviour on the
site and it is deliberate: below the film, a page should behave like a page.

The bar and the section rail are a **third layer**, fixed above both. They cannot
live in the stage: it is a stacking context, so anything inside it is covered the
moment a document section scrolls over the frame. The bar is transparent for the
whole of the film — the footage is the point — and takes the page's own ground
below it, because copy scrolling under a transparent bar just reads as a
collision. On compact frames the bar used to be a grid row of the stage, so the
stage now holds that row open with a spacer sized from `--chrome-h`, which the
controller measures off the real bar with a `ResizeObserver`: measuring it once
was not enough, because the bar is first measured with fallback metrics and grows
when the faces land.

## The sequence

One continuous shot in seven plates, driven end to end by scroll **position** —
so it runs backwards exactly as readily as forwards. Nothing latches, nothing
fires once. `components/frame/stage-script.ts` maps scroll onto the beats:

| beat | scroll | what happens |
| ---- | ------ | ------------ |
| — | on load | The bar, the headline and both calls to action are up at first paint — held only for the opening's typefaces, at most 500ms. `hunter-dawn` plays once it can run without stalling; at **4.33s** the hunter turns to face the viewer. Nothing is locked: a first step taken while it plays runs the rest of it at 2–4× (by how hard it was asked for) and steps the moment it ends. |
| `turn` | 210vh | `hunter-turn` scrubs: he turns back to the valley. The hero block leaves over it. |
| `prey` | 380vh | `valley-prey` scrubs. The deer clears the frame edge at **0.40s** and section 2's headline lands on it; at **3.60s** it drops its head to graze and the rest of the panel assembles. |
| `draw` | 380vh | `hunter-draw` scrubs. The draw settles into the aim at **2.50s** and section 3 arrives. Section 2 leaves over it. |
| `strike` | 520vh | `hunter-strike` scrubs. The camera reaches the draw at **4.00s**, about 70% back, and section 4 arrives. Section 3 leaves over it. |
| `clear` | 160vh | Section 4 leaves, over the closing frame and nothing else. The release is the loudest moment in the sequence and the text is off the screen before it. |
| `arrow` | 520vh | `arrow-learns` scrubs: the release, the flight, the fall to black. At **2.00s** the arrow is dead centre and section 5's headline arrives above it; from **5.15s** the valley falls away and the paragraph fades up with it. |
| `learn` | 340vh | The paragraph lights up a word at a time and the edge light draws itself round the frame. Both finish as the beat does — the sentence completing *is* the end of the section, so the last word goes white at 95–97% of the beat, depending on how many words the locale's sentence has. |
| `depart` | 150vh | Section 5's words leave, the arrow follows them off, the frame dips through black, and the next morning fades up. Every vh of it is moving, which is what lets it be this short. |
| `miss` | 420vh | `forest-miss` scrubs. The arrow buries itself in the tree at **0.67s** and section 6's statement lands on it; the block lifts as the stag turns and runs at **1.30s**; the frame is empty by **3.95s**. |
| `traits` | 560vh | The psychology features, one slide per stretch of scroll, over the plate's own last frame — which stays. The deck finishes at 96% of the beat rather than 75%, so the last feature landing is the end of the section. |
| `fall` | 180vh | Section 6 lifts away and the forest goes down behind it, leaving the frame on the page's own black. The one handover with no plate on the other side, and the end of the film — section 7 begins on the next pixel. |

The shape repeats: a plate runs, its panel arrives on a cue taken from the
footage, and the panel leaves again **over the next plate**, which is already
moving. There are no held frames anywhere in the chain — a still image followed
by sudden motion reads as a jump however well the frames match. Sections 2, 3
and 4 are one component rendered three times —
`components/panel/PanelSection` — differing only in copy and icon.

Cue points for the scrubbed plates are stored as *fractions* of each plate
rather than seconds, so the same numbers still land when there is no video at
all: under reduced motion nothing downloads, the stills carry the sequence, and
scroll still moves the story forward.

### Section 5

The closing plate carries no panel. The headline sits above the arrow and the
paragraph below it, both centred, because the subject they are composed around
is centred. The band the arrow occupies is *reserved* rather than guessed: the
plate's rendered height is known in CSS, the arrow sits at a fixed fraction of
it, and the two text blocks take the rows above and below. That is what keeps
the headline off the fletching at every aspect ratio with no media query.

The paragraph then lights up a word at a time as the viewer scrolls. The whole
reveal rides on one custom property: the controller advances `--lit` across the
paragraph, each word knows its own index, and each works out its own brightness
from the difference. A frame of the reveal costs two style writes rather than
thirty.

The edge light is a line, not a glow — a real stroke around the perimeter, drawn
progressively from top centre as the beat is scrolled, with a blurred copy of
itself behind it for bloom and a slowly turning conic gradient behind that for
atmosphere. `--glow` is the fraction of the perimeter drawn, so the light
advances at a constant rate and retreats if the wheel does.

Its length has to be stated in screen pixels rather than path units:
`vector-effect: non-scaling-stroke` is what keeps the stroke an even weight
while a square viewBox is stretched to the frame, but it also resolves the dash
pattern in the host coordinate space, so `pathLength` never reaches it — and the
ring came out as a few dozen little segments scattered round the frame. The path
traces the frame exactly, so its perimeter is twice the width plus twice the
height, which CSS can state directly.

### Section 6

Two states over one plate. The statement is centred, because the shot it sits
on is a wide empty meadow with its subject leaving; the features are two
columns, because they are a product screen and the words about it. The
statement's block *lifts as the stag runs*, so the words travel with the animal
rather than watching it go.

The features are a carousel the wheel drives. `--in` and `--out` are the two
progresses the controller writes onto each slide, so there is no index and no
state anywhere — scroll back and the deck runs backwards. Every slide occupies
the same grid cell, so the deck is as tall as the tallest of them and nothing
reflows as they change. The dots read the same two properties, which makes them
the carousel rather than a readout of it.

They also **drive** it: each dot is a button that scrolls to the point in the
beat where its own slide is fully in. That point is the inverse of the reach the
deck is painted from — `reach = (tp / TRAIT_LEAD) * (n - 1 + hold)`, and a slide
is whole at `reach = t + hold` — so the two can never disagree. It is the same
travelled jump the section rail makes, which means the deck *runs* to the slide
rather than cutting to it, and the plate behind it never moves.

The plate does not fade under them: the features are read against the shot's own
last frame, held. That puts the busiest, highest-contrast area in the sequence —
the tree trunk — directly behind a block of type, so this block alone carries
`--text-lift-heavy`. It is still a shadow on the words, never a layer over the
picture.

### Section 7

The first section that is not a shot — an ordinary block of the document below
the track. See *Where the film stops* for how those behave.

It is composed over nothing: The forest goes down through `fall` and
what is left is the near-black the document has underneath the whole film, so
the sequence ends on the page's own ground rather than handing over to another
shot — there is no plate after the forest to cut to.

Two reveals over it. The headline rises on `--head` and **the orb rides the same
property**, which is the whole of "the backdrop fades in as the words come up":
one number, written once per frame, read by both. The paragraph follows on its
own beat, `--body`.

The headline and the orb come up together on `--head` — the orb reads the same
property, which is the whole of "the backdrop fades in as the words rise" — and
the paragraph follows on `--body` a little further into the scroll. The shape it
had as a beat, kept.

The block carries the comp's own ornament: a hairline with a pair of facing
scrolls around a centred diamond, and a second, longer one below the headline
stopped with a dot at each end. Heavier than the rule the panels use and heavier
than section 6's star, which is the point — this block is the only thing on a
black frame.

`--s7-measure` and `--fs-s7-display` are set together so the comp's two lines
stay two lines: "Meet the AI Trading Journal" is 27 characters and has to hold
one line. The frame's side columns are symmetric rather than gutter-then-lane,
because the words are centred on the frame and so is the orb behind them.

#### The orb

`components/orb/orb-script.ts`. The fragment shader is React Bits' `Orb`,
carried over unchanged; the delivery is not. Upstream it is a React client
component importing `ogl`, and this site has no client React and no client
bundle, so it runs as an inline script over raw WebGL instead. Three reasons,
all pointing the same way:

- `ogl`'s part in it is a renderer, a program, a full-screen triangle and a
  vec3 — about eighty lines, against a dependency and a hydration boundary.
- **The preview build inlines the site into one file and drops every
  `<script src>`**, so a client component would never run in the artifact,
  which is where this actually gets looked at.
- Nothing else on the site needs React on the client, and one decorative
  backdrop is a poor reason to start.

It compiles nothing until the controller marks its host live, a screen ahead
of the section, and it gives the frame back when the section is out of reach or
the tab is hidden. On a touch screen it renders at no more than 1.5× the CSS
pixel size: a soft glow has no edges to sharpen.
Under `prefers-reduced-motion` it never runs; without WebGL the section simply
reads without it. The words are markup over the canvas, never inside it.

The hue is measured, not derived. `adjustHue` rotates in YIQ rather than HSL, so
there is no arithmetic that turns the shader's purple into the site's gold: the
ring was sampled at 120 points around its circumference and swept in 20° steps
until it read back at the right hue. `ORB_HUE = 200` renders rgb(175, 139, 72),
hue 39°, against 40° for `--c-gold`.

### Section 8

The prop firms. One screen, hard against section 7, scrolled like any other part
of a page — its heading arrives on `--head` and the rail of firms on `--body`,
which is lower down and so comes after it.

The firms sit on one continuous rail and **drift** along it. The run is rendered
twice and the track travels exactly half its own width before repeating, so the
loop has no seam to find; it is slow on purpose — atmosphere behind a row of
names, not a ticker — and it is what makes six firms work on a frame that cannot
hold six firms. Nothing is cut off, it is simply not on screen yet. The drift
runs only while the section is on screen, and is switched off entirely under
reduced motion. In Arabic and Persian it runs the other way, because the eye does.

The emblems are line art on the site's own hairline, each a mark rather than a
logo — these are placeholder partners. Firm names stay Latin in every locale, as
brand names do; the kind and the tagline are translated.

### The section rail

One mark per section down the **trailing** edge of the frame — right in English,
Turkish and Spanish, left in Persian and Arabic — with the current one drawn
long. The sequence is ~44 screens of scroll end to end, which is right for
watching it and wrong for going back to something.

It is not a component with state. Which mark is lit and where each one lands are
both derived by the stage controller from the same beat table that drives
everything else, so retiming a beat moves the rail with it. A mark owns the
scroll from the beat its section takes the frame on until the next mark's, which
puts every boundary on a plate handover.

Where a mark *goes* is deliberately not where its section starts: jumping to a
section's first frame lands on a headline mid-blur with its panel still
assembling. The targets are each section at rest: the panel built, the closing
sentence complete, section 6's statement whole and not yet lifting — the same
states a step lands on. Marks below the film re-read their target on every frame
of the jump,
because a section's height can change while the page is travelling to it.

A jump is travelled, not teleported. Every frame is a pure function of scroll
position, so scrolling to the target *plays* the footage in between, which is the
only transition this site could honestly have. The browser's own smooth scroll is
no use for it — Blink caps the duration well under a second, and nine thousand
pixels in under a second is a blur — so the glide is keyed to distance, and the
wheel cancels it the moment the viewer takes the scroll back.

Unlike the leading margin, the trailing edge is not free: the hero and the panels
are inset from the leading edge and then run all the way to it, and section 6's
features column ends there too. Each of those takes `--rail-lane` in place of its
trailing gutter. They are all logical columns, so the reservation mirrors with
the writing direction on its own. Below 1024px the leading inset is gone and the
blocks take the full measure, so the rail stands down rather than lie over the
copy.

**Adding a section:** the rail is `RAIL` in `stage-script.ts` and nowhere else.
Add an entry — a `name`, the beat the section takes the frame on, and the point
it is composed at — and `SectionRail.tsx` will fail to compile until that `name`
is given a label, because the label map is a `Record` keyed by `RAIL`'s own
names. The rail cannot silently fall a section behind the site. If the new
section's composition runs to the trailing edge, give it `--rail-lane` as well.

### Handovers are cuts

The clips are pieces of one continuous render, so a plate's closing frame *is*
the next plate's opening frame, and a translation search over each handover
finds its minimum at exactly (0,0). Measured in the browser at the instant of
each cut, 0.3%–4.4% of pixels differ by more than 12/255, against 39% for a
single frame of real motion and 0.0% for the same frame screenshotted twice.

There is exactly one deliberate exception, at the end. The closing plate is a
black studio frame and the plate after it is a forest at dawn, with nothing
continuous between them, so that handover dips through black: the arrow fades
down, the frame is empty for a moment, then the morning fades up. The two are
never on screen together, so the one-plate rule holds even there.

Two separate things used to break this, and both were mine.

**A cross-dissolve**, which caused the very artefact it was meant to hide. The
outgoing plate rests on its closing frame while the incoming plate is already
running, so at the midpoint of a fade there are literally two hunters on screen
a few frames apart, at half opacity each. Exactly one plate is composited at any
moment now — the controller writes only 0 or 1 to `--o`, never anything between.

**Per-plate crops**, which was far worse and invisible at 16:9. Below the aspect
threshold every plate switched to `cover`, and two of them had their own
`object-position` — the prey plate pulled right to hold the deer, the closing
plate contained rather than cropped. At a 1.31 viewport that made the *whole
image* jump sideways at two handovers: **59.5%** and **59.9%** of pixels moved,
more than a frame of real motion. Every plate is now placed identically at every
viewport, with no exception of any kind, and the threshold is portrait rather
than 7/5 so that `contain` — which cannot mismatch — covers every frame it
reasonably can. The rule is worth more than what it costs: a portrait window of
a 16:9 plate is about a quarter of its width, so the deer and the arrowhead do
fall outside it there.

The same reasoning governs the encode. A plate that is trimmed in a separate
pass carries a second generation of quantisation noise, and that noise is
visible as a shimmer at the handover into it, so `encode-scene.sh` takes the
trim length as an argument and does it in the delivery encode.

## Motion language

Three tiers, and most things are in none of them:

- **Primary — the film.** One step per chapter: the shot plays, the old panel
  leaves over the next plate, the new one arrives, and the step lands on the
  chapter complete. Plates cut on shared frames; the one dip to black is the
  release into the next morning. Scrubbed by scroll position, so it runs
  backwards as readily as forwards.
- **Secondary — arrivals.** A headline resolves, its body follows, a rule
  draws from the text's leading edge, timed on cues taken from the footage.
  Below the film a section's head is up by the time its top is a third of the
  way up the screen, and its body by half way.
- **Micro — feedback.** Hover and press states, the scroll cue, the rail.

What is deliberately still: the plates between cues, the held frame under
section 6's features, the page ground. Stillness is where the words are read.

On compact screens the scrubbed blurs (the headlines resolving, the hero
leaving, section 5's bloom stroke) are dropped — each is a full-size repaint on
every frame of the scroll — and the rise and fade carry the motion alone.
Layers (`will-change`) exist only while their section is on screen, and the
looping animations — the partners and testimonial marquees here, the features
page's card stack and gallery — run only while theirs is (`data-reveal` →
`data-in`). The features page's stack steps `z-index`, which the compositor
cannot animate, so left running below the film it was 60–73% of that page's
idle main-thread work. Under `prefers-reduced-motion` nothing downloads, the
stills carry the film, entrances do not animate, and each step moves to the next
chapter at once instead of travelling to it.

The features page is the same controller on its own film, so all of the above
holds there too: stepping at the reader's speed, the opening, the loading, the
layers. Its slides are hidden by opacity rather than visibility when off
screen, like the home film's panels, so their words stay in the accessibility
tree; the council slides' call to action alone is hidden outright, so an
invisible button never takes a Tab stop or a click.

## The plates

Shown **raw**: no scrim, no tint, no gradient. Whatever grading the footage
carries is what reaches the screen. Type sits directly on it, so `--text-lift`
and `--text-lift-micro` in `tokens.css` give the words a soft shadow — that
lifts them off the brightest frames without touching a pixel of the video. Set
them to `none` to see the type completely untreated.

`object-fit` is **`contain`** everywhere except a portrait frame, and **every
plate is placed identically** — see the note under *Handovers are cuts* for why
that rule has no exceptions. Where the viewport is not 16:9 the page's own
near-black shows at the edges, which reads as a letterbox rather than a crop.
Only below a 1:1 aspect, where `contain` would leave a thin strip, does the
plate fill instead, with the crop pulled onto the hunter.

```bash
scripts/encode-scene.sh <source.mp4> <slug> [play|scrub] [seconds]
```

`play` gives a long GOP for the plate that plays itself; `scrub` puts a keyframe
every 12 frames, which is what decides whether scrolling feels attached to the
wheel or laggy behind it. `seconds` trims the plate, in the delivery encode
rather than a separate pass. Both modes strip the audio, write 1080p and 720p in
H.264 and VP9 pinned to exactly 16:9, and pull two stills — the **first** frame
stands in until the video decodes, the **last** is the resting image and the
only one a `prefers-reduced-motion` viewer sees.

### Weight, and where it is actually paid

Only the opening plate is fetched at load, and it is tuned lighter than the
rest — about 1.1 MB. Nothing else is: the other plates are `preload="none"`, and
so are their stills (a hidden element still fetches its background, and all
seven used to come with the page) and the section 10 portraits, which are lazy
`<img>`s. Once the opening has *played* — or at the viewer's first scroll, if
that comes sooner — the controller fetches the rest in the order they are
watched, one file at a time: the light tier first, then the shipping plates. A
plate the viewer reaches before the queue does jumps it. A connection that asks
to save data, or reports 2G/3G, gets the light tier alone.

Nothing is fetched *while* the opening plays. A second decoder spinning up under
the playing shot stalled the main thread for 1.3s in measurement (1.6s of total
blocking time on a fast 4G profile); with the same files arriving after the shot,
nothing. The opening is five seconds long and the first plate's light copy is
120KB, so nothing is lost by waiting.

That is why the scrubbed plates are encoded for picture rather than for bytes.
The numbers behind the CRF and GOP chosen there are in `encode-scene.sh`; the
short version is that lengthening the GOP from 6 to 12 paid for a three-stop CRF
improvement and still came out slightly smaller. AV1 was measured and rejected —
a GOP this short is nearly all intra, which is where its advantage disappears.

Every plate leads with WebM. That used to be true only of the played plate —
H.264 beat VP9 on the scrubbed ones while they carried a keyframe every 6
frames, because a GOP that short is nearly all intra. At the 12-frame GOP they
ship with now VP9 is 30-35% smaller on all of them, so it goes first everywhere
and MP4 stays behind it as the fallback. The browser only ever downloads one.
The scrubbed plates also carry `preload="none"` and are loaded by the controller
a beat ahead, so they never compete for bandwidth with the plate on screen.

The composition is load-bearing: the hunter holds one side of the plate and the
valley opens on the other, which is the rail the text sits on. So **RTL mirrors
the footage** (`transform: scaleX(-1)`) and the figure keeps the closed side in
both directions. Note `object-position` picks the crop window in *source*
coordinates, before the mirror flips the painted result — both directions
select the same window.

## Why an inline script

`stage-script.ts` ships as an inline script rather than a client component for
two reasons. It has to run before first paint, or the composition flashes on
screen and then vanishes. And with no JavaScript at all its attributes are
never set, so the CSS holding rules never match and the page is simply,
statically visible — the interface can never be lost behind a backdrop.

The interface is never held for the footage. It is held for one thing — the
faces the opening is set in, which are preloaded — and for at most 500ms, so
the headline arrives in its own face rather than reflowing a moment after it
has been read (Cinzel is far wider than any fallback; the swap used to grow the
block by a third). It used to wait for the opening plate to reach the frame
where the hunter turns: 5.3s on a fast line, 7-8s on a phone, with the scroll
locked until the shot had finished.

Nothing carries `autoplay`. It begins at `canplay`, which promises exactly one
more decodable frame, and the hitch that follows is what made the opening look
broken. The controller starts the plate only once it is buffered *or* the file
is arriving faster than it plays, and only while the viewer is still at the top
to watch it. A first step taken while it plays runs the rest of it at 2–4×
(by how hard it was asked for) and steps the moment it ends: the plate after it opens on the frame it closes on,
so the film continues rather than cutting into the middle of the shot.

Seeks are queued one at a time per plate — a seek issued while another is
resolving is dropped by the browser — which keeps the picture as close to the
scroll as the decoder allows. Each frame of the controller reads every
measurement it needs before it writes anything, so it never forces a layout
mid-frame; it costs under a millisecond per frame.

To retime anything: `BEATS` for how much scroll each beat gets, the cue
constants (`DEER_ENTERS`, `DEER_GRAZES`, `BOW_SET`, `AIM_HELD`) for where each
panel lands — and so where each step rests — `RATE_MAX` and the constants after
it for how fast a step plays for a given input,
and `RAIL` for where each mark goes. The
reveal styling itself lives in the `Intro` / `Reveal` sections of the component
stylesheets.

The inline scripts are written with their notes in, and `inline-script.ts`
strips comments and indentation before they ship: an inline script is in the
document twice (once as the script, once inside the RSC payload), and the notes
alone were ~100KB of every page. The stripped script is compiled at build time,
so a strip that broke it would fail the build rather than the page.

## Layout

```
src/
  app/[locale]/          route shell — sets <html lang dir> per locale
  components/
    frame/Stage          the sticky screen + the block that gives it its run
    frame/Scene          the seven plates — played raw, no overlay
    frame/stage-script   the opening beat, the scroll timeline, the rail
    site/SiteHeader      wordmark, nav, language menu, Login → the product
    site/BrandMark       the compass-and-arrow mark, drawn as SVG
    site/LanguageMenu    <details>-based, works without JavaScript
    hero/Hero            section 1 — headline, rule, sub-headline, cue
    panel/PanelSection   sections 2-4 — one component, three sets of copy
    arrow/ArrowSection   section 5 — the closing line, word by word
    miss/MissSection     section 6 — the shot that missed
    dark/DarkSection     section 7 — the journal, inside the orb
    partners/…           section 8 — the prop-firm rail
    testimonials/…       section 9 — three columns of quotes
    archetypes/…         section 10 — the four-way cast accordion, each a
                         link into the product
    rail/SectionRail     one mark per section, down the trailing edge
    icons/               globe, chevron, and one per panel
  config/site.ts         the product's address, named once
  i18n/
    config.ts            locale list, text direction, short labels
    dictionaries/*.json  one file per language
  styles/
    brand.css            ← the only file that names a typeface
    fonts.css            generated @font-face declarations
    tokens.css           colour, type scale, spacing, composition
  proxy.ts               bare paths → negotiated locale

public/
  fonts/brand/           ← drop the brand typeface here
  scene/                 encoded plate renditions + stills

scripts/
  encode-scene.sh        raw plate → renditions + stills (play|scrub)
  build-preview.mjs      production output → one shareable HTML file
```

## Preview build

`scripts/build-preview.mjs` produces a single self-contained HTML file from the
*real* production output, so a shared preview can never drift from the code:

```bash
npm run build && npx next start -p 4173
node scripts/build-preview.mjs        # → preview/navrya-hero.html (gitignored)
```

It pulls each locale's rendered body, inlines the CSS, every font subset, the
stills and the plates as data URIs, and drops Next's hydration payload. Only a
540p WebM proxy of each plate travels — five plates at 720p would put the file
past 15MB: every byte is a byte the viewer waits on,
and CSS still drives the crop and the whole timeline, so nothing about the
behaviour is approximated — only the resolution. The
site's own inline scripts are carried over, so the intro sequence and the
language menu behave exactly as they do in production rather than being
approximated.

All five locales stack in the one file, but only one is ever *in* the DOM: the
harness prunes the rest synchronously, before any `DOMContentLoaded` handler
runs, so the controller's document-wide queries bind to the locale actually on
screen. Hiding them was not enough — `querySelector` still found the first one,
which left every language but English with a panel that never opened.

Picking a language reloads the page against a hash rather than swapping text in
place, because in production a language link *is* a real navigation and the
whole sequence replays from the first frame. The preview shows that, not a
shortcut. The controller also comes before the plates in document order: their
data URIs are megabytes of base64 for the parser to chew through, and putting
them first delayed the opening beat by about a second. The backdrop is lifted into one
shared layer rather than inlined per locale — a data URI cannot be
range-requested, and five copies would multiply the video by five.

### Design tokens

`styles/tokens.css` is the single source for colour, type scale and
composition. The reference comp was measured at a **1672px-wide frame**, and
every fluid value is written as `referencePx / 1672` in `vw` — so at that width
the build reproduces the comp 1:1, and the `clamp()` bounds hold it together
everywhere else. Change a token, not a component.

## Typography

`styles/brand.css` is the swap point. It declares two families —
`--font-display` (wordmark, headline) and `--font-sans` (nav, sub-headline,
labels) — and nothing else in the project names a typeface.

**To install the brand font:** drop the web files into `public/fonts/brand/`,
uncomment the `@font-face` blocks in `brand.css`, fix the filenames. Done —
`Navrya Display` / `Navrya Sans` already sit first in both stacks.

Until then the stand-ins are Playfair Display (display) and DM Sans (sans),
chosen to match the reference. Every face is **self-hosted** in `public/fonts`,
so builds and page loads never touch a font CDN. Subsets keep their own
`unicode-range`: an English visitor downloads ~98 KB of Latin and none of the
Arabic.

## Languages

| Locale | Route | Direction |
| ------ | ----- | --------- |
| English | `/en` | LTR |
| Turkish | `/tr` | LTR |
| Persian | `/fa` | **RTL** |
| Arabic  | `/ar` | **RTL** |
| Spanish | `/es` | **LTR** |

`proxy.ts` negotiates `Accept-Language` and redirects bare paths to a
locale-prefixed URL, so every page carries an explicit `lang` and `dir`. The
header's language menu (`components/site/LanguageMenu`) is built on `<details>`,
so it opens, closes and takes keyboard focus natively — no JavaScript required,
which also means it survives the preview build.

Its links are **plain anchors, not `next/link`**, and that is load-bearing. A
client-side navigation swaps the markup without reloading the document, so the
inline stage controller never runs again: the `<html>` attributes it owns are
dropped by the re-render, the incoming locale's plates are brand new elements
nobody has started, and the previous controller is left holding a DOM that no
longer exists. Changing language is a change of document here, and the film
plays again from its first frame.

A reload, or Back from the product, returns the viewer to where they were:
scroll restoration and the back/forward cache are left to the browser. Every
frame of the film is a pure function of scroll position, so the page renders
correctly wherever it lands, and the opening does not replay under a viewer
who is already in the middle of the film. (It used to force the page back to
the top on every one of those, reloading outright on a back/forward restore,
because the opening had locked the scroll and nothing could be shown without
it.) Each language is named in its own script, isolated so a Persian or Arabic
endonym cannot drag the row's layout around it.

The layout is written entirely in **logical properties** — `inset-inline-start`,
`margin-inline`, `text-align: start` — so `dir="rtl"` mirrors the whole
composition with no directional forks. The handful of things that genuinely are
directional carry a `[dir="rtl"]` override: the two hairline gradients, the
diamond node's transform, and the tracked micro-label (letter-spacing breaks
the cursive joins in Arabic script, so it is zeroed and the size raised).

Arabic and Persian glyphs resolve through per-glyph font fallback to Amiri and
Vazirmatn; `tokens.css` re-keys the display size and leading under `[dir="rtl"]`
to match their very different vertical metrics. The `Navrya` wordmark and the
locale code stay Latin and LTR in every locale via `unicode-bidi: isolate`.

Adding a string: add the key to `i18n/dictionaries/en.json` — it types the
shape of all five — then fill in the other four files.

## Fitting the frame

Every scene is one screen that never scrolls, so the composition has to fit in
*both* axes — and width alone does not tell you the height available. A 1920×1080
monitor is a 1920×937 viewport once the browser's chrome is gone; a 14" MacBook
is 1512×830. Both are far wider than 16:9, so a width-keyed type scale sets type
for a frame taller than the one it has.

Two changes, and between them the composition can no longer outgrow its screen:

- **Every vertical size is `min(<n>vw, <n × 1.778>vh)`.** 1vw is exactly 1.778vh
  at 16:9, so this changes nothing at the comp's aspect and scales by height on
  anything shorter. Only sizes in the vertical stack carry it; gutters, rails and
  text measures stay keyed to width, which is what they are about.
- **The bar's band and the cue's band are grid rows, not padding.** An item
  taller than its content box overflows *both* ends of a centred track, so
  padding cannot hold back something bigger than the box it is in. The cue's row
  is `auto`, measured off the cue itself — the previous computed reserve was
  196px against a cue that measured 234px.

`scripts/audit-layout.mjs` is the check: 17 real viewport sizes × a scroll
position every 40vh of the film, looking for content under the bar, content in
the cue, and anything past an edge. Before: 300+ collisions, on every laptop in
the list. After: none.

## Responsive

Three bands, and the compact ones are re-composed rather than scaled down:

- **≥ 1024px** — the comp. Header overlays the frame in one row; the text block
  sits on its rail at 36.4% of the frame and centres against the *whole*
  viewport, header included.
- **768–1023px** — header splits into two rows (identity + controls, then the
  five links centred beneath on their own hairline) and joins the layout column,
  so the scene can never be pushed under it. The text block keeps a reduced 9%
  rail.
- **< 768px** — the block gives up the rail and takes the full measure between
  the gutters. The sub-headline's authored two-line break rejoins into one
  paragraph and wraps naturally instead of breaking mid-thought.

`@media (max-height: 560px)` tightens the whole scale for landscape phones and
split views. Safe-area insets are respected on notched devices.
