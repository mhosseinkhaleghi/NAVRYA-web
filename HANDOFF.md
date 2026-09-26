# Handoff

- Rules: follow AGENTS.md before modifying Next.js code.
- Architecture: Next.js 16 marketing site with scroll-driven cinematic scenes and localized routes. One inline controller (`src/components/frame/stage-script.ts`); the only client component is section 6's `BezelVideo`, which reads the controller's `data-active`/`aria-current` state rather than keeping its own.
- Deploys from `claude/navrya-hero-section-n3tkxr` (see DEPLOYMENT.md). `main` is behind it; branch new work from the deploy branch.
- Scroll: inside the film, one intent (wheel gesture, swipe, key) steps to the next complete story state; below the film the page scrolls natively, both ways. See the README's *Stepping*.
- Step speed follows the input: an ordinary scroll (a notch, a short wheel turn, an unhurried swipe, a key) plays the footage at 1× (7.3s to section 2); harder or continued scrolling plays it faster, up to 4× (`RATE_MAX` and the constants after it). A step never slows before it lands; the next keeps the speed while the viewer keeps going.
- Input: intents during a step are kept (up to two) and taken on landing; the opposite direction turns the travel round; a held wheel or key carries on, a trackpad's momentum tail does not. Gestures are timed by event timestamps.
- Fixed from the original stepping: upward scroll below the film no longer jumps back into the film; Space presses a focused button; ctrl + wheel zooms; sideways swipes are left alone; the hand-off glide into section 7 cannot be cancelled into a stuck state.
- Opening: the bar, headline and calls to action come up at first paint, held only for the preloaded opening faces (≤500ms). Nothing is locked; a first step during the opening shot runs it at 2–4× and steps the moment it ends.
- Loading: only the opening plate and its still load with the page. The rest is fetched one file at a time once the opening has played or on the first step; only save-data gets the light tier alone (`effectiveType` is RTT-only in Chromium and put fast high-latency lines on the 480p proxy for good). Section 10 portraits are lazy `<img>`s.
- Reloads and Back keep the viewer's place (scroll restoration and bfcache are the browser's).
- Features page: same controller and stepping. Its card stack and gallery run only while on screen (`data-reveal` → `data-in`); its slides are hidden by opacity (words in the accessibility tree), the council CTA by visibility.
- Verification: `scripts/verify.mjs` and `scripts/audit-layout.mjs` (Playwright outside the package — see their headers).
- Known issues: none open.
