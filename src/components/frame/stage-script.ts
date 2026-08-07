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
 * latches, nothing is one-shot: scroll back and the plates rewind, the text
 * comes down, the panels take themselves apart. That is why the beats are
 * driven by `--r` / `--exit` / `--o` custom properties instead of CSS
 * transitions or keyframes — the scroll wheel is the clock.
 */

/** Seconds into the opening plate where the hunter begins to turn. */
export const INTRO_REVEAL_AT = 4.33;

/**
 * The timeline: one beat per plate, in vh of scroll. Must add up to the
 * `--timeline-vh` token, which is what actually creates the scrollable height.
 *
 * There are no holds. Earlier the picture froze on a plate's closing frame
 * while its panel scrolled out, and every one of those pauses ended in a lurch
 * as the next plate took over — a still image and then sudden motion reads as a
 * jump however well the frames match. Now each plate runs straight into the
 * next and the text leaves *over* the plate that is already moving.
 *
 * Scroll is allocated at roughly 70vh per second of footage, so every plate
 * scrubs at the same rate and the sequence never changes pace at a seam.
 */
const BEATS = [
  ["turn", 210], // hunter-turn  · 3.0s — he turns back to the valley
  ["prey", 380], // valley-prey  · 5.0s — the deer walks in and grazes
  ["draw", 380], // hunter-draw  · 5.0s — he raises the bow and draws
  ["strike", 520], // hunter-strike · 7.0s — the camera pushes in to the draw
  ["rest", 40], // tail room, so the last reveal is not pinned to the bottom
] as const;

/**
 * Cue points, as a fraction of each plate's duration.
 *
 * Measured off the footage frame by frame. They are fractions rather than
 * seconds so the same numbers still land when there is no video at all — under
 * reduced motion nothing downloads and the stills carry the sequence.
 */
const DEER_ENTERS = 0.4 / 5.041667; // clears the right edge of frame
const DEER_GRAZES = 3.6 / 5.041667; // drops its head to feed
const BOW_SET = 2.5 / 5.041667; // the draw settles into the aim
const AIM_HELD = 4.0 / 7.041667; // camera on the draw, roughly 70% back

/**
 * One entry per scrubbed plate: which beat scrubs it, which panel it carries,
 * and the two cues that panel's reveal hangs on.
 *
 * `exit` is expressed as a window inside the *following* beat, not this one.
 * That is what removes the pauses: a panel slides out over the next plate,
 * which is already running, instead of over a frozen frame. There is room for
 * it — every cue lands in the first half of its plate, so the outgoing text is
 * long gone before the next one arrives.
 *
 * The first plate carries the hero, which is markup of its own, so it has no
 * panel here. Sections 3 and 4 have a single cue in the footage, so their two
 * reveal groups fire off the same moment a beat apart — the headline still
 * leads, exactly as it does in section 2.
 */
const SCENES = [
  { plate: "turn", beat: "turn", panel: null, exit: null, cues: null },
  { plate: "prey", beat: "prey", panel: "p1", exit: [0, 0.2], cues: [DEER_ENTERS, DEER_GRAZES] },
  { plate: "draw", beat: "draw", panel: "p2", exit: [0, 0.18], cues: [BOW_SET, BOW_SET + 0.02] },
  { plate: "strike", beat: "strike", panel: "p3", exit: null, cues: [AIM_HELD, AIM_HELD + 0.02] },
] as const;

/** The hero leaves late in the first plate, once the head has come back round. */
const HERO_EXIT = [0.55, 0.92];

/** How much of a plate's own progress each reveal group takes to complete. */
const TITLE_SPAN = 0.12;
const REST_SPAN = 0.15;

/**
 * Cross-dissolve at a handover, as a fraction of the incoming plate's beat.
 *
 * The plates are pixel-aligned but the renders draw the hunter's silhouette
 * slightly differently between clips, so a cut makes the figure twitch. Long
 * enough to read as a dissolve rather than a glitch, and the incoming plate is
 * already moving underneath it, which does most of the hiding.
 */
const PLATE_FADE = 0.1;

const START_GRACE_MS = 3500;
const HARD_CAP_MS = 12000;

export const stageScript = `
(function () {
  var root = document.documentElement;
  var BEATS = ${JSON.stringify(BEATS)};
  var SCENES = ${JSON.stringify(SCENES)};
  var REVEAL = ${INTRO_REVEAL_AT};
  var TITLE_SPAN = ${TITLE_SPAN}, REST_SPAN = ${REST_SPAN}, FADE = ${PLATE_FADE};
  var HERO_EXIT = ${JSON.stringify(HERO_EXIT)};

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

  var loaded = {};
  function load(id) {
    if (loaded[id]) return;
    var v = document.querySelector('[data-scene-video="' + id + '"]');
    if (!v) return;
    loaded[id] = true;
    if (v.getAttribute('preload') === 'none') { v.preload = 'auto'; v.load(); }
  }

  function reveal() {
    if (root.dataset.intro === 'shown') return;
    root.dataset.intro = 'shown';
    // Only the next plate. The rest arrive a beat ahead of the viewer, so
    // nothing competes with the plate that is actually on screen.
    ready(function () { load(SCENES[0].plate); });
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

  // ── scrubbing ────────────────────────────────────────────────────────────
  // A seek issued while another is still resolving is dropped by the browser,
  // so each plate keeps one pending target and fires it when the last seek
  // lands. That keeps the picture as close to the wheel as the decoder allows
  // without ever queueing seeks up behind each other.
  function scrubber(video) {
    if (!video) return function () {};
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
    var dawn = document.querySelector('[data-plate-id="dawn"]');
    var hero = document.querySelector('[data-hero]');
    var heroParts = document.querySelectorAll('[data-hero-part]');

    var scenes = [];
    for (var s = 0; s < SCENES.length; s++) {
      var cfg = SCENES[s];
      var video = document.querySelector('[data-scene-video="' + cfg.plate + '"]');
      var panel = cfg.panel && document.querySelector('[data-panel="' + cfg.panel + '"]');
      var groups = { title: [], rest: [] };
      if (panel) {
        each('[data-reveal-group]', function (el) {
          var g = el.getAttribute('data-reveal-group');
          if (groups[g]) groups[g].push(el);
        }, panel);
        groups.rest.sort(function (a, b) {
          return (+a.getAttribute('data-reveal-step')) - (+b.getAttribute('data-reveal-step'));
        });
      }
      scenes.push({
        cfg: cfg,
        seek: scrubber(video),
        plate: document.querySelector('[data-plate-id="' + cfg.plate + '"]'),
        panel: panel,
        groups: groups,
        loadedmeta: video,
      });
    }

    function paintPlate(el, o, covered) {
      if (!el) return;
      el.style.setProperty('--o', o);
      if (o > 0 && !covered) el.setAttribute('data-plate-on', '');
      else el.removeAttribute('data-plate-on');
    }

    function apply() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? clamp01(window.scrollY / max) : 0;

      // Plate opacities first, so a plate can be marked covered by the one
      // dissolving in over it and drop off the compositor.
      var fades = [];
      for (var s = 0; s < scenes.length; s++) {
        var b = edge[scenes[s].cfg.beat];
        var over = (b[1] - b[0]) * FADE;
        fades.push(root.dataset.intro === 'shown' ? span(p, b[0], b[0] + over) : 0);
      }
      paintPlate(dawn, 1, fades[0] >= 1);
      for (s = 0; s < scenes.length; s++) {
        paintPlate(scenes[s].plate, fades[s], s + 1 < fades.length && fades[s + 1] >= 1);
      }

      for (s = 0; s < scenes.length; s++) {
        var sc = scenes[s], cfg = sc.cfg;
        var beat = edge[cfg.beat];
        var plateP = span(p, beat[0], beat[1]);
        sc.seek(plateP);

        // One beat of lookahead: the next plate starts fetching as this one
        // begins, which is a whole beat of scrolling before it is needed.
        if (plateP > 0 && s + 1 < scenes.length) load(scenes[s + 1].cfg.plate);

        if (!sc.panel) continue;

        // The exit window lives in the next beat, so the panel leaves over a
        // plate that is still running rather than over a frozen frame.
        var out = 0;
        if (cfg.exit && s + 1 < scenes.length) {
          var nb = edge[scenes[s + 1].cfg.beat];
          var w = nb[1] - nb[0];
          out = ease(span(p, nb[0] + cfg.exit[0] * w, nb[0] + cfg.exit[1] * w));
        }
        var live = p >= beat[0] && out < 1;
        if (live) sc.panel.setAttribute('data-active', '');
        else sc.panel.removeAttribute('data-active');
        sc.panel.style.setProperty('--exit', out);
        if (!live) continue;

        var titleP = ease(span(plateP, cfg.cues[0], cfg.cues[0] + TITLE_SPAN));
        for (var t = 0; t < sc.groups.title.length; t++) {
          sc.groups.title[t].style.setProperty('--r', titleP);
        }
        var restP = span(plateP, cfg.cues[1], cfg.cues[1] + REST_SPAN);
        var n = sc.groups.rest.length;
        var stagger = n > 1 ? 0.55 / (n - 1) : 0;
        for (var r = 0; r < n; r++) {
          sc.groups.rest[r].style.setProperty('--r', ease(clamp01((restP - r * stagger) / 0.45)));
        }
      }

      var hb = edge.turn, hw = hb[1] - hb[0];
      var heroOut = ease(span(p, hb[0] + HERO_EXIT[0] * hw, hb[0] + HERO_EXIT[1] * hw));
      for (var h = 0; h < heroParts.length; h++) {
        heroParts[h].style.setProperty('--exit', heroOut);
      }
      if (hero) {
        if (heroOut >= 1) hero.setAttribute('data-gone', '');
        else hero.removeAttribute('data-gone');
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
    each('[data-scene-video]', function (v) {
      v.addEventListener('loadedmetadata', apply);
    });
    // The plates only start dissolving once the opening beat has finished.
    var armed = setInterval(function () {
      if (root.dataset.intro === 'shown') { clearInterval(armed); apply(); }
    }, 120);
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

  function each(selector, fn, scope) {
    var list = (scope || document).querySelectorAll(selector);
    for (var i = 0; i < list.length; i++) fn(list[i]);
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
})();
`.trim();
