# Handoff

- Rules: follow AGENTS.md before modifying Next.js code.
- Architecture: Next.js 16 marketing site with scroll-driven cinematic scenes and localized routes.
- Status: cloned at c7f03c4; dependencies installed; dev server running on port 3002; scroll controller now advances between complete story states.
- Scroll timing: magnetic film transitions use the authored video duration at normal speed; continuous input advances exactly one state at each completed endpoint, while a stopped gesture rests magnetically at the last completed state.
- Section 6→7: removed the fall and Section 7 heading-only magnetic stops; the final psychology card now transitions directly to the complete Section 7 payload.
- Section 7 onward: restored native continuous scrolling; magnetic navigation is limited to the film and its Section 7 handover target.
- Section 6→7 forward scroll now reuses the Section 7 rail button target and glide, then releases normal downward scrolling; upward scroll remains magnetic.
- Continuous-scroll tuning: active input remains valid for 650ms, and consecutive states begin immediately when scrolling continues.
- Continuous-scroll timing: continued input starts the next state immediately at its endpoint. Trackpad and touch input stay at normal speed; sustained coarse-wheel or keyboard input after 30% of a state plays its remaining tail at 3.5× speed, then restores normal speed on release.
- Intro→Section 2 reverse: an opposing input now retargets directly to Intro, even before the transition midpoint.
- Arrow release: removed the headline-only magnetic stop; the release now runs directly to the completed Section 5 payload.
- Known issues: none.
