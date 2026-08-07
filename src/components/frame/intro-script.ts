/**
 * The opening beat.
 *
 * The plate is a reveal: the valley is empty, the hunter walks in, and at 4.33s
 * he turns to face the viewer. The interface is held back until that turn, then
 * rises into place over the frame the video comes to rest on.
 *
 * This ships as an inline script rather than a client component for two
 * reasons. It has to run before first paint, or the composition flashes on
 * screen and then vanishes. And with no JavaScript at all the attribute is
 * never set, so the CSS hiding rules never match and the page is simply
 * visible — the interface can never be lost behind a backdrop.
 */

/** Seconds into the plate where the hunter begins to turn. */
export const INTRO_REVEAL_AT = 4.33;

/** Autoplay refused, or the plate never started buffering. */
const START_GRACE_MS = 3500;

/** Absolute stop: whatever went wrong, the words go up. */
const HARD_CAP_MS = 12000;

export const introScript = `
(function () {
  var root = document.documentElement;
  var REVEAL = ${INTRO_REVEAL_AT};

  function show() { root.dataset.intro = 'shown'; }

  // Reduced motion never gets the hold — the composition is simply there.
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    show();
  } else {
    root.dataset.intro = 'armed';
    ready(function () {
      var video = document.querySelector('[data-scene-video]');
      if (!video) return show();

      var frame, started = false;
      function watch() {
        if (video.currentTime >= REVEAL) { cancelAnimationFrame(frame); return show(); }
        frame = requestAnimationFrame(watch);
      }

      video.addEventListener('playing', function () {
        started = true;
        cancelAnimationFrame(frame);
        watch();
      });
      video.addEventListener('ended', show);
      video.addEventListener('error', show);

      setTimeout(function () { if (!started) show(); }, ${START_GRACE_MS});
      setTimeout(show, ${HARD_CAP_MS});

      if (!video.paused) watch();
    });
  }

  // Native <details> opens and closes on its own; these are the two dismissals
  // it does not give you.
  ready(function () {
    function close(within) {
      document.querySelectorAll('details[data-language-menu][open]').forEach(function (menu) {
        if (within && menu.contains(within)) return;
        menu.open = false;
      });
    }
    document.addEventListener('click', function (e) { close(e.target); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var open = document.querySelector('details[data-language-menu][open]');
      if (!open) return;
      close(null);
      var summary = open.querySelector('summary');
      if (summary) summary.focus();
    });
  });

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
})();
`.trim();
