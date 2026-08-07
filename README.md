# Navrya — web

A premium cinematic marketing site. **Current scope: the Hero Section only.**

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
`components/frame/Stage` (`position: fixed; inset: 0; overflow: hidden`), and
the document itself is locked in `app/globals.css` — `overflow: hidden` on
`html`/`body` plus `overscroll-behavior: none` to kill pull-to-refresh and
rubber-banding.

Later steps will feed scroll input into scene changes *inside* this frame. None
of that is implemented yet: today the frame holds one scene, the hero. The
groundwork that exists for it is only the frame itself.

## The scene

The frame's backdrop is a 5s silent plate (`components/frame/Scene`): the valley
is empty, the hunter walks in, and at 4.33s he turns to face the viewer. It
**plays once and holds that closing frame** — no `loop`, because the shot is a
reveal and the last frame is where the composition comes to rest. A video with
no `loop` keeps its final frame painted after `ended`, so nothing has to swap in
behind it.

The plate is shown **raw**: no scrim, no tint, no gradient. Whatever grading the
footage carries is what reaches the screen. Type sits directly on it, so the
`--text-lift` token in `tokens.css` gives the words a soft shadow — that lifts
them off the brightest frames without touching a pixel of the video. Set it to
`none` to see the type completely untreated.

`object-fit` is **`contain`** on desktop, so the whole plate stays on screen.
Where the viewport is wider than 16:9 the page's own near-black shows at the
edges, which reads as a letterbox rather than a crop. Below a 7:5 aspect the
plate switches to `cover` with the crop pulled onto the figure — keyed to aspect
ratio rather than width, because what breaks the composition is a frame taller
than the footage, and a portrait crop of a 16:9 plate shows only its middle 26%.

`scripts/encode-scene.sh <source.mp4> <slug> [crossfade-seconds]` produces
everything: audio stripped, 1080p and 720p in both H.264 and VP9, pinned to
exactly 16:9, plus two stills. The **first** frame stands in until the video
decodes so playback starts without a jump; the **last** frame is the resting
image, and the only image a `prefers-reduced-motion` viewer ever sees. The
crossfade argument is for plates meant to loop and defaults to off — it would
destroy the closing frame this one depends on.

The plate's composition is load-bearing: the hunter holds the left and the
valley opens on the right, which is the rail the hero text sits on. So **RTL
mirrors the footage** (`transform: scaleX(-1)`) and the figure keeps the closed
side in both directions. Note `object-position` picks the crop window in
*source* coordinates, before the mirror flips the painted result — both
directions select the same window.

## The intro

Nothing but the backdrop is on screen until the hunter turns. Then the interface
rises into the frame the video comes to rest on: the headline resolves out of
focus, the rule draws from the text's leading edge, the sub-headline follows a
line at a time, and the scroll cue arrives last.

`components/frame/intro-script.ts` drives it, and ships as an **inline script**
rather than a client component for two reasons. It has to run before first
paint, or the composition flashes on screen and then vanishes. And with no
JavaScript at all the `data-intro` attribute is never set, so the CSS hiding
rules never match and the page is simply visible — the interface can never be
lost behind a backdrop. The same script adds the two dismissals native
`<details>` lacks, which is all the language menu needs to work.

The reveal watches the video's own `currentTime`, so it lands on the turn no
matter how slowly the plate buffers. Three fallbacks make sure the words always
arrive: `ended`, `error`, a 3.5s check that playback ever started (autoplay
refused), and a 12s hard cap. `prefers-reduced-motion` skips the hold entirely.

To retime the reveal, change `INTRO_REVEAL_AT`. The animation itself lives in
the `Intro` sections of `Hero.module.css` and `SiteHeader.module.css`.

## Layout

```
src/
  app/[locale]/          route shell — sets <html lang dir> per locale
  components/
    frame/Stage          the fixed full-screen frame
    frame/Scene          background plate — played raw, no overlay
    frame/intro-script   holds the interface back until the hunter turns
    site/SiteHeader      wordmark, nav, language menu, Login
    site/LanguageMenu    <details>-based, works without JavaScript
    hero/Hero            headline, ornamental rule, sub-headline, scroll cue
    icons/               globe + chevron
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
  scene/                 encoded backdrop renditions + stills

scripts/
  encode-scene.sh        raw plate → renditions + stills
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
stills and the backdrop as data URIs, and drops Next's hydration payload. The
site's own inline scripts are carried over, so the intro sequence and the
language menu behave exactly as they do in production rather than being
approximated.

All five locales stack in the one file, and the site's real language menu drives
the switch: its links point at routes that cannot resolve inside a single file,
so the harness intercepts them and swaps panes. The backdrop is lifted into one
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
