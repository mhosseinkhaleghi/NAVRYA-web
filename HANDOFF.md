# Handoff

- Rules: follow AGENTS.md before modifying Next.js code.
- Architecture: Next.js 16 marketing site with scroll-driven cinematic scenes and localized routes.
- Status: cloned at c7f03c4; dependencies installed; dev server running on port 3002; scroll controller now advances between complete story states.
- Scroll tuning: heavy story states use double-duration glides; continuous input advances exactly one state at each completed endpoint, while a stopped gesture rests magnetically at the last completed state.
- Section 6→7: removed the fall and Section 7 heading-only magnetic stops; the final psychology card now transitions directly to the complete Section 7 payload.
- Section 7 onward: restored native continuous scrolling; magnetic navigation is limited to the film and its Section 7 handover target.
- Section 6→7 forward scroll now reuses the Section 7 rail button target and glide, then releases normal downward scrolling; upward scroll remains magnetic.
- Known issues: none.
