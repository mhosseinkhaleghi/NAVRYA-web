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

## Layout

```
src/
  app/[locale]/          route shell — sets <html lang dir> per locale
  components/
    frame/Stage          the fixed full-screen frame
    site/SiteHeader      wordmark, nav, language control, Login
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
```

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
locale-prefixed URL, so every page carries an explicit `lang` and `dir`.

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
