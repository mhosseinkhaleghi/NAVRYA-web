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

- local: 15/15 runs pass, 0 failures.
- live: still failing — the fix is not deployed yet. Re-verified after deploy.

**Still open at the end of the iteration:** nothing on local; live pending the
push.
