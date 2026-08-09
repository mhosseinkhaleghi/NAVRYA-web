# Brand fonts

## Peyda — the Persian and Arabic face

Upload the **WOFF2** files here. Four weights, and the FaNum cut if the package
has one (it draws Persian digits ۱۲۳ rather than Latin ones, which is what the
rest of the site already uses):

| upload this file                | or rename it to  | used for                    |
| ------------------------------- | ---------------- | --------------------------- |
| `PeydaWebFaNum-Regular.woff2`   | `peyda-400.woff2`| body copy                   |
| `PeydaWebFaNum-Medium.woff2`    | `peyda-500.woff2`| sub-headlines               |
| `PeydaWebFaNum-SemiBold.woff2`  | `peyda-600.woff2`| tracked micro-labels        |
| `PeydaWebFaNum-Bold.woff2`      | `peyda-700.woff2`| headlines                   |

Either column works — `src/styles/brand.css` lists both names for every weight.
Nothing else needs changing: `Peyda` already sits in both font stacks, behind
the Latin faces so English keeps Playfair and DM Sans, and ahead of Amiri and
Vazirmatn so every Arabic-script glyph falls through to it.

**WOFF2 only.** TTF and OTF are three to five times the bytes for the same
glyphs, and every one of those bytes is inlined into the preview file.

If the package ships a variable font instead of static weights, upload it as
`peyda-var.woff2` and say so — the four blocks in `brand.css` collapse into one.

## A Latin brand face

None yet. When there is one, drop `navrya-display.woff2` and
`navrya-sans.woff2` here and uncomment the two commented blocks in
`src/styles/brand.css`. `Navrya Display` and `Navrya Sans` already sit first in
the stacks, so they take over the moment they resolve.
