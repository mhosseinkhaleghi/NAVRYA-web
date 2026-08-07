# Navrya — web

A premium cinematic marketing site. **Current scope: sections 1–4.**

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

One continuous shot in five plates, driven end to end by scroll **position** —
so it runs backwards exactly as readily as forwards. Nothing latches, nothing
fires once. `components/frame/stage-script.ts` maps scroll onto the beats:

| beat | scroll | what happens |
| ---- | ------ | ------------ |
| — | on load | `hunter-dawn` plays itself. At **4.33s** the hunter turns to face the viewer and the interface rises into frame. Until then the timeline is locked shut. |
| `turn` | 140vh | `hunter-turn` scrubs: he turns back to the valley. |
| `exit1` | 90vh | The hero block leaves, over the held closing frame. |
| `prey` | 380vh | `valley-prey` scrubs. The deer clears the frame edge at **0.40s** and section 2's headline lands on it; at **3.60s** it drops its head to graze and the rest of the panel assembles. |
| `exit2` | 90vh | Section 2 leaves. |
| `draw` | 340vh | `hunter-draw` scrubs. The draw settles into the aim at **2.50s** and section 3 arrives. |
| `exit3` | 90vh | Section 3 leaves. |
| `strike` | 440vh | `hunter-strike` scrubs. The camera reaches the draw at **4.00s**, about 70% back, and section 4 arrives. |
| `rest` | 50vh | Tail room, so the last reveal is not pinned to the very bottom. |

The shape repeats: a plate scrubs, its panel arrives on a cue taken from the
footage, the plate **holds its closing frame** while the panel scrolls back out,
then the next plate takes over. Sections 2, 3 and 4 are one component rendered
three times — `components/panel/PanelSection` — differing only in copy and icon.

Cue points are stored as *fractions* of each plate rather than seconds, so the
same numbers still land when there is no video at all: under reduced motion
nothing downloads, the stills carry the sequence, and scroll still moves the
story forward.

### Handovers are dissolves, not cuts

Each plate is framed identically to the next, so a cut looks like the obvious
choice. Measured, it is not: the renders draw the hunter's silhouette slightly
differently between clips, and at a cut that reads as the figure twitching. The
plates are pixel-aligned — a translation search over ±6px found the best match
at exactly (0,0) — so there is nothing to correct geometrically. A
cross-dissolve of ~15vh of scroll (`PLATE_FADE`) is what actually hides it, and
it is driven by scroll position like everything else, so it reverses too.

## The plates

Shown **raw**: no scrim, no tint, no gradient. Whatever grading the footage
carries is what reaches the screen. Type sits directly on it, so `--text-lift`
and `--text-lift-micro` in `tokens.css` give the words a soft shadow — that
lifts them off the brightest frames without touching a pixel of the video. Set
them to `none` to see the type completely untreated.

`object-fit` is **`contain`** on desktop, so the whole plate stays on screen.
Where the viewport is wider than 16:9 the page's own near-black shows at the
edges, which reads as a letterbox rather than a crop. Below a 7:5 aspect the
plate switches to `cover` with the crop pulled onto the subject — keyed to
aspect ratio rather than width, because what breaks the composition is a frame
taller than the footage, and a portrait crop of a 16:9 plate shows only its
middle 26%.

```bash
scripts/encode-scene.sh <source.mp4> <slug> [play|scrub]
```

`play` gives a long GOP for a plate that plays itself; `scrub` puts a keyframe
every 6 frames, which is the single thing deciding whether scrolling feels
attached to the wheel or laggy behind it. Both modes strip the audio, write
1080p and 720p in H.264 and VP9 pinned to exactly 16:9, and pull two stills —
the **first** frame stands in until the video decodes, the **last** is the
resting image and the only one a `prefers-reduced-motion` viewer sees.

Codec order is per plate: VP9 compresses a long GOP better and H.264 a short
one, so the played plate leads with WebM and the scrubbed plates lead with MP4.
The browser only ever downloads one. The scrubbed plates also carry
`preload="none"` and are loaded by the controller once the intro is over, so
they never compete for bandwidth with the plate that is actually playing.

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

The reveal watches the opening plate's own `currentTime`, so it lands on the
turn no matter how slowly the plate buffers, with fallbacks on `ended`,
`error`, a 3.5s check that playback ever started (autoplay refused) and a 12s
hard cap. Seeks are queued one at a time per plate — a seek issued while
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
which also means it survives the preview build. Each language is named in its
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
