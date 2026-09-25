# Handoff

- Rules: follow AGENTS.md before modifying Next.js code.
- Architecture: Next.js 16 marketing site with scroll-driven cinematic scenes and localized routes. No client components; one inline controller (`src/components/frame/stage-script.ts`).
- Deploys from `claude/navrya-hero-section-n3tkxr` (see DEPLOYMENT.md). `main` is behind it; branch new work from the deploy branch.
- Scroll: native everywhere. The controller never intercepts wheel, touch or keyboard input; the film is a pure function of scroll position. The magnetic "story state" navigation was removed — it made one wheel notch travel 5.2 screens over 8.7s and took 50s of held input to reach section 7.
- Film length: 1740vh (was 3840vh). Each chapter's copy is complete about a third of the way into its shot and rests for roughly a screen of scroll. See the `BEATS` / `SCENES` notes and the README's *Motion language*.
- Opening: the bar, headline and calls to action come up at first paint, held only for the preloaded opening faces (≤500ms). Scrolling is never locked; scrolling during the opening shot runs it at 2.5× and eases the first scrubbed plate in from its last frame.
- Loading: only the opening plate and its still load with the page. The rest of the film is fetched one file at a time once the opening has played or the viewer scrolls; save-data/2G/3G gets the light tier only. Section 10 portraits are lazy `<img>`s.
- Reloads and Back keep the viewer's place (scroll restoration and bfcache are the browser's).
- Verification: `scripts/verify.mjs` (Playwright outside the package — see its header); performance numbers for this change are in the commit message.
- Known issues: none open.
