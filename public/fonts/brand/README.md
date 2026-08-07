# Brand font drop-in

Put the Navrya brand web fonts here — `.woff2` strongly preferred, one file per
weight, or a single variable file per family.

Then open `src/styles/brand.css`, uncomment the `@font-face` block(s) and fix
the filenames. Nothing else needs to change: `Navrya Display` and `Navrya Sans`
already sit first in the `--font-display` / `--font-sans` stacks, so the brand
font takes over the moment it resolves.

Suggested names (match them in `brand.css`):

    navrya-display.woff2   → wordmark + hero headline
    navrya-sans.woff2      → navigation, sub-headline, labels, buttons
