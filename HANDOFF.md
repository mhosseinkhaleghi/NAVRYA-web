# Handoff

- Rules: follow AGENTS.md before modifying Next.js code.
- Architecture: Next.js 16 marketing site with scroll-driven cinematic scenes and localized routes. No client components; one inline controller (`src/components/frame/stage-script.ts`).
- Deploys from `claude/navrya-hero-section-n3tkxr` (see DEPLOYMENT.md). `main` is behind it; branch new work from the deploy branch.
- Scroll: inside the film, one intent (wheel gesture, swipe, key) steps to the next complete story state; below the film the page scrolls natively, both ways. See the README's *Stepping*.
- Step timing: a step's length comes from the footage it crosses, compressed — short shots at 1×, every step landing in ~1.8–2.6s (`STEP_*`). It used to play everything at 1× (7.3s to section 2, 10.5s for the release).
- Input: intents during a step are kept (up to two) and taken on landing; the opposite direction turns the travel round; a held wheel or key carries on, a trackpad's momentum tail does not. Gestures are timed by event timestamps.
- Fixed from the original stepping: upward scroll below the film no longer jumps back into the film; Space presses a focused button; ctrl + wheel zooms; sideways swipes are left alone; the hand-off glide into section 7 cannot be cancelled into a stuck state.
- Opening: the bar, headline and calls to action come up at first paint, held only for the preloaded opening faces (≤500ms). Nothing is locked; a first step during the opening shot runs it at 4× and steps the moment it ends.
- Loading: only the opening plate and its still load with the page. The rest is fetched one file at a time once the opening has played or on the first step; save-data/2G/3G gets the light tier only. Section 10 portraits are lazy `<img>`s.
- Reloads and Back keep the viewer's place (scroll restoration and bfcache are the browser's).
- Verification: `scripts/verify.mjs` and `scripts/audit-layout.mjs` (Playwright outside the package — see their headers).
- Known issues: none open.
