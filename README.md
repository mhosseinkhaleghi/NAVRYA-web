# Navrya — web

A premium cinematic marketing site. **Current scope: sections 1–6.**

```bash
npm install
npm run dev     # http://localhost:3000 → redirects to /en
npm run build
npm start
```

---

## The frame model

Navrya is not a scrolling document. The viewport is a **fixed, full-screen
cinematic frame** that never translates. Everything renders inside
`components/frame/Stage` (`position: fixed; inset: 0; overflow: hidden`).

The *document*, however, does scroll — and that scroll is the timeline. Native
scroll rather than synthesised wheel events, because it comes with momentum,
trackpads, touch, keyboard and the scrollbar already working, and because a
position is inherently reversible in a way an event stream is not. The
scrollbar is hidden and overscroll chaining switched off, so nothing about the
frame reads as a scrolling page.

Scroll input feeds scene changes *inside* the frame. `Stage` renders a track
below itself whose only job is to give the document height to scroll through;
`--timeline-vh` is that height, and stretching it slows every beat of the
sequence proportionally.

## The sequence

One continuous shot in seven plates, driven end to end by scroll **position** — so
it runs backwards exactly as readily as forwards. Nothing latches, nothing fires
once. `components/frame/stage-script.ts` maps scroll onto the beats:

| beat | scroll | what happens |
| ---- | ------ | ------------ |
| — | on load | `hunter-dawn` plays. At **4.33s** the hunter turns to face the viewer and the interface rises into frame; the timeline unlocks when the plate reaches its last frame. |
| `turn` | 210vh | `hunter-turn` scrubs: he turns back to the valley. The hero block leaves over it. |
| `prey` | 380vh | `valley-prey` scrubs. The deer clears the frame edge at **0.40s** and section 2's headline lands on it; at **3.60s** it drops its head to graze and the rest of the panel assembles. |
| `draw` | 380vh | `hunter-draw` scrubs. The draw settles into the aim at **2.50s** and section 3 arrives. Section 2 leaves over it. |
| `strike` | 520vh | `hunter-strike` scrubs. The camera reaches the draw at **4.00s**, about 70% back, and section 4 arrives. Section 3 leaves over it. |
| `clear` | 160vh | Section 4 leaves, over the closing frame and nothing else. The release is the loudest moment in the sequence and the text is off the screen before it. |
| `arrow` | 520vh | `arrow-learns` scrubs: the release, the flight, the fall to black. At **2.00s** the arrow is dead centre and section 5's headline arrives above it; from **5.15s** the valley falls away and the paragraph fades up with it. |
| `learn` | 340vh | The paragraph lights up a word at a time and the edge light draws itself round the frame. Both finish as the beat does — the sentence completing *is* the end of the section. |
| `depart` | 240vh | Section 5's words leave, the arrow follows them off, the frame dips through black, and the next morning fades up. |
| `miss` | 420vh | `forest-miss` scrubs. The arrow buries itself in the tree at **0.67s** and section 6's statement lands on it; the block lifts as the stag turns and runs at **1.30s**; the frame is empty by **3.95s**. |
| `traits` | 660vh | The psychology features, one slide per stretch of scroll, over the plate's own last frame — which stays. |
| `rest` | 40vh | Tail room, so the last reveal is not pinned to the very bottom. |

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

The plate does not fade under them: the features are read against the shot's own
last frame, held. That puts the busiest, highest-contrast area in the sequence —
the tree trunk — directly behind a block of type, so this block alone carries
`--text-lift-heavy`. It is still a shadow on the words, never a layer over the
picture.

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

Only the opening plate is on the critical path. It is the one the interface
waits for, so it is tuned lighter than the rest — about 1.1 MB. Every other
plate is `preload="none"` and is fetched a beat ahead of the viewer, while they
are watching the one before it, so quality on plates 2–6 costs nothing at open
and there is a whole beat of scrolling to cover the fetch.

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

Nothing carries `autoplay`. It begins at `canplay`, which promises exactly one
more decodable frame, and the hitch that follows is what made the opening look
broken. The controller starts the plate only once the beat is buffered *or* the
file is arriving faster than it plays; a connection too slow for either gets the
interface over the opening frame instead of a stutter. Measured cold and warm
across five network profiles, no frozen frames in any of them.

The reveal then watches the plate's own `currentTime`, so it lands on the turn
however slowly the plate buffers, with fallbacks on `ended`, `error`, a 5s
patience limit and a 12s hard cap. The timeline unlocks a beat later still, when
the plate reaches its *last* frame — which is the frame the next plate opens on,
so the first scroll continues the shot instead of cutting into the middle of it. Seeks are queued one at a time per plate — a seek issued while
another is resolving is dropped by the browser — which keeps the picture as
close to the wheel as the decoder allows.

To retime anything: `INTRO_REVEAL_AT` for the opening beat, `BEATS` for how
much scroll each beat gets, and the cue constants (`DEER_ENTERS`,
`DEER_GRAZES`, `BOW_SET`, `AIM_HELD`) for where each panel lands. The reveal styling itself lives in the `Intro` / `Reveal` sections of the
component stylesheets.

## Layout

```
src/
  app/[locale]/          route shell — sets <html lang dir> per locale
  components/
    frame/Stage          the fixed frame + the scroll track behind it
    frame/Scene          the five plates — played raw, no overlay
    frame/stage-script   the opening beat and the scroll timeline
    site/SiteHeader      wordmark, nav, language menu, Login
    site/LanguageMenu    <details>-based, works without JavaScript
    hero/Hero            section 1 — headline, rule, sub-headline, cue
    panel/PanelSection   sections 2-4 — one component, three sets of copy
    icons/               globe, chevron, and one per panel
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

Three other things can drop a viewer into the middle of the sequence, and the
controller answers all three: scroll restoration is switched off and the
position reset before first paint, again once the track exists and again on
`load`; and a back/forward-cache restore — which brings back the scroll offset
*and* every playhead — reloads the page outright, because there is nothing to
rewind into. Each language is named in its
own script, isolated so a Persian or Arabic endonym cannot drag the row's layout
around it.

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

`scripts/audit-layout.mjs` is the check: 17 real viewport sizes × 103 scroll
positions, looking for content under the bar, content in the cue, and anything
past an edge. Before: 300+ collisions, on every laptop in the list. After: none.

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
