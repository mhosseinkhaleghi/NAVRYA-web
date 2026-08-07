/**
 * The stage controller.
 *
 * Two jobs: play the opening beat, then hand the whole sequence over to scroll
 * position. It ships as an inline script rather than a client component because
 * it has to run before first paint — otherwise the composition flashes on
 * screen and then vanishes — and because with no JavaScript at all none of its
 * attributes are ever set, so the CSS holding rules never match and the page is
 * simply, statically visible.
 *
 * Everything after the intro is a pure function of scroll position. Nothing
 * latches, nothing is one-shot: scroll back and the plates rewind, the hero
 * comes down, the panel takes itself apart. That is why the beats are driven by
 * `--r` / `--exit` custom properties instead of CSS transitions or keyframes —
 * the scroll wheel is the clock.
 */

/** Seconds into the opening plate where the hunter begins to turn. */
export const INTRO_REVEAL_AT = 4.33;

/**
 * The timeline, in vh of scroll each beat is given. Must add up to the
 * `--timeline-vh` token, which is what actually creates the scrollable height.
 *
 *   turn   the hunter turns back to the valley   (plate: hunter-turn)
 *   exit   the hero block leaves the frame
 *   prey   the deer walks in and settles to graze (plate: valley-prey)
 *   rest   tail room, so the last reveal is not pinned to the very bottom
 */
const BEATS = [
  ["turn", 140],
  ["exit", 90],
  ["prey", 340],
  ["rest", 70],
] as const;

/**
 * Cue points inside the prey plate, as a fraction of its duration.
 *
 * Measured off the footage: the deer clears the right edge of frame at 0.40s
 * and drops its head to graze at 3.60s, of 5.04s total. They are expressed as
 * fractions rather than seconds so the cues still land when there is no video
 * at all — under reduced motion the same numbers drive the same reveals.
 */
const DEER_ENTERS = 0.4 / 5.041667;
const DEER_GRAZES = 3.6 / 5.041667;

/** Reveal windows, in prey-plate progress. */
const TITLE_WINDOW = [DEER_ENTERS, DEER_ENTERS + 0.16];
const REST_WINDOW = [DEER_GRAZES, DEER_GRAZES + 0.21];

const START_GRACE_MS = 3500;
const HARD_CAP_MS = 12000;

export const stageScript = `
(function () {
  var root = document.documentElement;
  var BEATS = ${JSON.stringify(BEATS)};
  var REVEAL = ${INTRO_REVEAL_AT};
  var TITLE = ${JSON.stringify(TITLE_WINDOW)};
  var REST = ${JSON.stringify(REST_WINDOW)};

  var reduced = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── beat boundaries, as fractions of total scroll ────────────────────────
  var total = 0, i;
  for (i = 0; i < BEATS.length; i++) total += BEATS[i][1];
  var edge = {}, run = 0;
  for (i = 0; i < BEATS.length; i++) {
    edge[BEATS[i][0]] = [run / total, (run + BEATS[i][1]) / total];
    run += BEATS[i][1];
  }

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function span(p, a, b) { return b === a ? (p >= b ? 1 : 0) : clamp01((p - a) / (b - a)); }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  // ── the opening beat ─────────────────────────────────────────────────────
  // Always start from the top: a restored scroll position would drop the
  // viewer into the middle of a sequence that had not played yet.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  function reveal() {
    if (root.dataset.intro === 'shown') return;
    root.dataset.intro = 'shown';
    // The scrubbed plates are held back until now so they cannot compete for
    // bandwidth with the plate that is actually playing.
    ready(function () {
      each('[data-scene-video]', function (v) {
        if (v.getAttribute('preload') === 'none') { v.preload = 'auto'; v.load(); }
      });
    });
  }

  if (reduced) {
    root.dataset.intro = 'shown';
  } else {
    root.dataset.intro = 'armed';
    ready(function () {
      var opening = document.querySelector('[data-scene-video="dawn"]');
      if (!opening) return reveal();

      var frame, started = false;
      function watch() {
        if (opening.currentTime >= REVEAL) { cancelAnimationFrame(frame); return reveal(); }
        frame = requestAnimationFrame(watch);
      }
      opening.addEventListener('playing', function () {
        started = true; cancelAnimationFrame(frame); watch();
      });
      opening.addEventListener('ended', reveal);
      opening.addEventListener('error', reveal);
      setTimeout(function () { if (!started) reveal(); }, ${START_GRACE_MS});
      setTimeout(reveal, ${HARD_CAP_MS});
      if (!opening.paused) watch();
    });
  }

  // ── the scrubbed plates ──────────────────────────────────────────────────
  // A seek issued while another is still resolving is dropped by the browser,
  // so each plate keeps one pending target and fires it when the last seek
  // lands. That keeps the picture as close to the wheel as the decoder allows
  // without ever queueing seeks up behind each other.
  function scrubber(video) {
    var want = null, busy = false;
    function pump() {
      if (busy || want === null || !video.duration) return;
      var t = want; want = null;
      if (Math.abs(video.currentTime - t) < 0.01) return;
      busy = true;
      try { video.currentTime = t; } catch (e) { busy = false; }
    }
    video.addEventListener('seeked', function () { busy = false; pump(); });
    video.addEventListener('error', function () { busy = false; });
    video.addEventListener('loadedmetadata', pump);
    return function (fraction) {
      if (!video.duration) return;
      want = clamp01(fraction) * (video.duration - 0.02);
      pump();
    };
  }

  // ── the sequence ─────────────────────────────────────────────────────────
  ready(function () {
    var scene = document.querySelector('[data-plate]');
    var hero = document.querySelector('[data-hero]');
    var heroParts = document.querySelectorAll('[data-hero-part]');
    var panel = document.querySelector('[data-scenario]');
    var groups = { title: [], rest: [] };
    each('[data-reveal-group]', function (el) {
      var g = el.getAttribute('data-reveal-group');
      if (groups[g]) groups[g].push(el);
    });
    groups.rest.sort(function (a, b) {
      return (+a.getAttribute('data-reveal-step')) - (+b.getAttribute('data-reveal-step'));
    });

    var turn = document.querySelector('[data-scene-video="turn"]');
    var prey = document.querySelector('[data-scene-video="prey"]');
    var seekTurn = turn ? scrubber(turn) : function () {};
    var seekPrey = prey ? scrubber(prey) : function () {};

    // The opening plate holds its last frame; the turn plate's first frame is
    // the same picture, so swapping between them is invisible. Wait for its
    // metadata so the swap never lands on an undecoded element.
    var handedOver = false;
    function handOver() {
      if (handedOver || root.dataset.intro !== 'shown') return;
      handedOver = true;
      if (scene && scene.dataset.plate === 'dawn') scene.dataset.plate = 'turn';
    }
    if (reduced) { handOver(); }
    else if (turn) {
      if (turn.readyState >= 1) handOver();
      turn.addEventListener('loadedmetadata', handOver);
      turn.addEventListener('error', handOver);
      setTimeout(handOver, ${HARD_CAP_MS});
    } else { handOver(); }

    function apply() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? clamp01(window.scrollY / max) : 0;

      var turnP = span(p, edge.turn[0], edge.turn[1]);
      var exitP = ease(span(p, edge.exit[0], edge.exit[1]));
      var preyP = span(p, edge.prey[0], edge.prey[1]);
      var inPrey = p >= edge.prey[0];

      seekTurn(turnP);
      seekPrey(preyP);

      if (scene && handedOver) scene.dataset.plate = inPrey ? 'prey' : 'turn';

      for (var i = 0; i < heroParts.length; i++) {
        heroParts[i].style.setProperty('--exit', exitP);
      }
      if (hero) {
        if (exitP >= 1) hero.setAttribute('data-gone', '');
        else hero.removeAttribute('data-gone');
      }

      if (panel) {
        if (inPrey) panel.setAttribute('data-active', '');
        else panel.removeAttribute('data-active');
      }

      var titleP = ease(span(preyP, TITLE[0], TITLE[1]));
      for (var t = 0; t < groups.title.length; t++) {
        groups.title[t].style.setProperty('--r', titleP);
      }

      var restP = span(preyP, REST[0], REST[1]);
      var n = groups.rest.length;
      var stagger = n > 1 ? 0.55 / (n - 1) : 0;
      for (var r = 0; r < n; r++) {
        groups.rest[r].style.setProperty('--r', ease(clamp01((restP - r * stagger) / 0.45)));
      }
    }

    var queued = false;
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; apply(); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    if (turn) turn.addEventListener('loadedmetadata', apply);
    if (prey) prey.addEventListener('loadedmetadata', apply);
    apply();
  });

  // ── language menu ────────────────────────────────────────────────────────
  // Native <details> opens and closes on its own; these are the two dismissals
  // it does not give you.
  ready(function () {
    function close(within) {
      each('details[data-language-menu][open]', function (menu) {
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

  function each(selector, fn) {
    var list = document.querySelectorAll(selector);
    for (var i = 0; i < list.length; i++) fn(list[i]);
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
})();
`.trim();
