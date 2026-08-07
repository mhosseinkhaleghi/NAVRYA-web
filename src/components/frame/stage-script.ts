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
 *
 * The one exception is the closing plate. The arrow is released and *plays*, in
 * its own time, because a loosed arrow that waits on the wheel is not a loosed
 * arrow. Scroll still owns whether that plate is on screen at all, so scrolling
 * back out of it still rewinds the sequence.
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
  ["turn", 210], // hunter-turn   · 3.0s — he turns back to the valley
  ["prey", 380], // valley-prey   · 5.0s — the deer walks in and grazes
  ["draw", 380], // hunter-draw   · 5.0s — he raises the bow and draws
  ["strike", 520], // hunter-strike · 7.0s — the camera pushes in to the draw
  // Section 4 leaves here, over the plate's closing frame and nothing else.
  // The release is the loudest moment in the sequence and the text must be off
  // the screen before it, not sliding out across it.
  ["clear", 160],
  ["arrow", 520], // arrow-learns  · 6.7s — the release, and the world goes dark
  ["learn", 520], // the closing text lights up a word at a time
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
const ARROW_MID = 2.0 / 6.7; // the arrow crisp and dead centre in the air
const WORLD_GONE = 5.15 / 6.7; // the valley has fallen away behind it

/**
 * One entry per scrubbed plate: which beat scrubs it, which panel it carries,
 * and the two cues that panel's reveal hangs on.
 *
 * `exit` names the beat the panel leaves *during*, which is always the one
 * after its own, plus the window inside it. That is what removes the pauses: a
 * panel slides out over the next plate, which is already running, instead of
 * over a frozen frame. There is room for it — every cue lands in the first half
 * of its plate, so the outgoing text is long gone before the next one arrives.
 *
 * The first plate carries the hero, which is markup of its own, so it has no
 * panel here. Sections 3 and 4 have a single cue in the footage, so their two
 * reveal groups fire off the same moment a beat apart — the headline still
 * leads, exactly as it does in section 2.
 */
const SCENES = [
  { plate: "turn", beat: "turn", panel: null, exit: null, cues: null },
  {
    plate: "prey",
    beat: "prey",
    panel: "p1",
    exit: ["draw", 0, 0.2],
    cues: [DEER_ENTERS, DEER_GRAZES],
  },
  {
    plate: "draw",
    beat: "draw",
    panel: "p2",
    exit: ["strike", 0, 0.18],
    cues: [BOW_SET, BOW_SET + 0.02],
  },
  {
    plate: "strike",
    beat: "strike",
    panel: "p3",
    // Its own beat, and finished well inside it: the closing plate must open on
    // an empty frame.
    exit: ["clear", 0, 0.72],
    cues: [AIM_HELD, AIM_HELD + 0.02],
  },
  { plate: "arrow", beat: "arrow", panel: null, exit: null, cues: null },
] as const;

/**
 * Every plate in the order it takes the frame, with the beat that brings it on.
 *
 * Handovers are cuts, not dissolves. Each clip was rendered as one continuous
 * shot and cut into pieces, so a plate's closing frame and the next plate's
 * opening frame are the *same frame* — measured, under 2% of pixels differ by
 * more than 12/255, and that residue is codec noise on the silhouette edge.
 *
 * A dissolve between them was worse than useless: the outgoing plate sits on
 * its closing frame while the incoming one is already running, so halfway
 * through a cross-fade there are literally two hunters on screen, a few frames
 * apart, at half opacity each. That double exposure was the "character
 * displacement". Exactly one plate is composited at any moment now, and at the
 * instant of the cut the two frames are identical, so nothing moves.
 */
const PLATES = ["dawn", "turn", "prey", "draw", "strike", "arrow"] as const;
const PLATE_BEAT = [null, "turn", "prey", "draw", "strike", "arrow"] as const;

/** The hero leaves late in the first plate, once the head has come back round. */
const HERO_EXIT = [0.55, 0.92];

/** How much of a plate's own progress each reveal group takes to complete. */
const TITLE_SPAN = 0.12;
const REST_SPAN = 0.15;

/**
 * Section 5's two entrances, as fractions of the closing plate.
 *
 * The release, the arrow's flight and the fall to black are all scrubbed, like
 * every other plate — the wheel is the clock here too. The headline lands when
 * the arrow is crisp and centred, and the paragraph fades up as the valley
 * disappears behind it, so the words arrive into the space the picture leaves.
 */
const ARROW_TITLE_SPAN = 0.11;
const ARROW_BODY_SPAN = 0.18;

/**
 * The closing paragraph lights up a word at a time. `LEARN_FADE` is how many
 * words are mid-transition at once — one at a time reads as a ticker, and the
 * whole line at once is not a reveal at all. `LEARN_LEAD` finishes the last
 * word two thirds of the way through the beat, so the sentence stands whole
 * for a while rather than completing on the last pixel of scroll.
 */
const LEARN_FADE = 2;
const LEARN_LEAD = 0.62;
/**
 * The edge light is linear and finishes with the beat: `--glow` is the fraction
 * of the perimeter that has been drawn, so scrolling the beat draws the ring
 * exactly once, at a constant rate, and scrolling back erases it.
 */
const GLOW_LEAD = 0.94;

/**
 * The opening plate is never started until it can run without stalling.
 *
 * `autoplay` starts at `canplay`, which promises exactly one more decodable
 * frame — on anything but a fast connection the opening then plays, hitches and
 * catches up, and that is what made the first four seconds look broken however
 * often the timing was retuned.
 *
 * Two ways to clear the gate. Either the whole beat is buffered, or the file is
 * arriving faster than it plays, in which case starting now still finishes
 * ahead of the playhead. The second is what keeps a merely *slow* connection
 * from waiting for the entire clip before anything moves.
 *
 * `PATIENCE_MS` is the point at which the connection is judged too slow for the
 * shot to run at all. Rather than start a playback that is certain to stutter,
 * the interface comes up over the plate's opening frame — a complete, still
 * composition — and the timeline unlocks. The shot still plays if it ever
 * buffers. `HARD_CAP_MS` is the backstop for everything else: no decoder, no
 * network, a source that never resolves.
 */
const RATE_MARGIN = 1.25;
const PATIENCE_MS = 5000;
const HARD_CAP_MS = 12000;

export const stageScript = `
(function () {
  var root = document.documentElement;
  var BEATS = ${JSON.stringify(BEATS)};
  var SCENES = ${JSON.stringify(SCENES)};
  var PLATES = ${JSON.stringify(PLATES)};
  var PLATE_BEAT = ${JSON.stringify(PLATE_BEAT)};
  var REVEAL = ${INTRO_REVEAL_AT};
  var TITLE_SPAN = ${TITLE_SPAN}, REST_SPAN = ${REST_SPAN};
  var HERO_EXIT = ${JSON.stringify(HERO_EXIT)};
  var ARROW_AT = ${ARROW_MID}, ARROW_SPAN = ${ARROW_TITLE_SPAN};
  var BODY_AT = ${WORLD_GONE}, BODY_SPAN = ${ARROW_BODY_SPAN};
  var LEARN_FADE = ${LEARN_FADE}, LEARN_LEAD = ${LEARN_LEAD}, GLOW_LEAD = ${GLOW_LEAD};

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

  // ── always from the first frame ──────────────────────────────────────────
  // A refresh, a language change and a back-button return must all begin where
  // the sequence begins. Three separate things can put the viewer somewhere
  // else, and all three have to be answered:
  //
  //   · scroll restoration — the browser puts back the offset it remembered.
  //     Switched off, and the position reset here, before first paint.
  //   · the document growing — the track is not in the DOM yet at this point,
  //     so the reset above lands on a short page. Repeated once the layout
  //     exists, and again on the load event, when nothing can move it.
  //   · the back/forward cache — a restored page keeps its scroll offset *and*
  //     every video's playhead, so the sequence resumes mid-shot with the
  //     opening already over. There is nothing to rewind into; the page is
  //     reloaded outright, which is also what makes a language change replay
  //     from the top after the viewer navigates back to it.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  function toTop() { window.scrollTo(0, 0); }
  toTop();
  ready(toTop);
  window.addEventListener('load', toTop);
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) location.reload();
    else toTop();
  });

  // Two separate gates. \`intro\` raises the interface, on the frame the hunter
  // turns. \`timeline\` unlocks the scroll, and waits for the plate to reach its
  // *last* frame — which is the frame the next plate opens on. Releasing the
  // wheel while the opening was still running let the viewer cut away from the
  // middle of it, and the sequence jumped by however much was left.
  root.dataset.timeline = 'held';
  function live() { root.dataset.timeline = 'live'; }

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
    live();
  } else {
    root.dataset.intro = 'armed';
    ready(function () {
      var opening = document.querySelector('[data-scene-video="dawn"]');
      if (!opening) { reveal(); return live(); }

      // How far a single unbroken range from the start reaches. Anything else
      // is a range the playhead will not touch on the way through.
      function buffered() {
        try {
          for (var b = 0; b < opening.buffered.length; b++) {
            if (opening.buffered.start(b) <= 0.05) return opening.buffered.end(b);
          }
        } catch (e) {}
        return 0;
      }

      var going = false, frame, t0 = Date.now();
      function watch() {
        if (opening.currentTime >= REVEAL) reveal();
        if (opening.ended || opening.currentTime >= (opening.duration || 1e9) - 0.06) {
          cancelAnimationFrame(frame);
          reveal();
          return live();
        }
        frame = requestAnimationFrame(watch);
      }

      function start() {
        if (going) return;
        going = true;
        var p = opening.play();
        // Autoplay refused, or no decoder: show the interface rather than hold
        // the page hostage to a video that is never going to run.
        if (p && p.catch) p.catch(function () { reveal(); live(); });
        watch();
      }

      function enough() {
        if (going) return;
        var have = buffered();
        if (opening.readyState >= 4) return start();
        if (have >= Math.min(opening.duration || 1e9, REVEAL + 1.2)) return start();
        var elapsed = (Date.now() - t0) / 1000;
        if (elapsed > 0.8 && have > 0.6 && have / elapsed > ${RATE_MARGIN}) start();
      }

      opening.addEventListener('progress', enough);
      opening.addEventListener('loadeddata', enough);
      opening.addEventListener('canplaythrough', start);
      opening.addEventListener('ended', function () { reveal(); live(); });
      opening.addEventListener('error', function () { reveal(); live(); });
      // Too slow for the shot to run cleanly. Bring the interface up over the
      // opening frame and let the viewer move — a still composition they can
      // use beats a stuttering one they cannot.
      setTimeout(function () { if (!going) { reveal(); live(); } }, ${PATIENCE_MS});
      setTimeout(function () { reveal(); live(); }, ${HARD_CAP_MS});
      enough();
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
    var hero = document.querySelector('[data-hero]');
    var heroParts = document.querySelectorAll('[data-hero-part]');
    var opening = document.querySelector('[data-scene-video="dawn"]');

    var plateEls = [];
    for (i = 0; i < PLATES.length; i++) {
      plateEls.push(document.querySelector('[data-plate-id="' + PLATES[i] + '"]'));
    }

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
      scenes.push({ cfg: cfg, seek: scrubber(video), panel: panel, groups: groups });
    }

    // ── section 5 ──────────────────────────────────────────────────────────
    // Every value here is a pure function of scroll position, exactly like the
    // rest of the sequence: the release, the flight, the fall to black, the two
    // entrances, the paragraph lighting up and the ring drawing itself.
    var arrow = document.querySelector('[data-arrow]');
    var words = arrow ? +arrow.getAttribute('data-words') || 0 : 0;

    function paintArrow(ap, lp) {
      if (!arrow) return;

      if (ap > 0) arrow.setAttribute('data-active', '');
      else arrow.removeAttribute('data-active');

      arrow.style.setProperty('--head', ease(span(ap, ARROW_AT, ARROW_AT + ARROW_SPAN)));
      arrow.style.setProperty('--body', ease(span(ap, BODY_AT, BODY_AT + BODY_SPAN)));
      arrow.style.setProperty('--lit', clamp01(lp / LEARN_LEAD) * (words + LEARN_FADE));
      // Linear, and it completes with the beat — this is the fraction of the
      // perimeter the ring has been drawn to, not an opacity.
      arrow.style.setProperty('--glow', clamp01(lp / GLOW_LEAD));
    }

    function apply() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? clamp01(window.scrollY / max) : 0;
      var shown = root.dataset.intro === 'shown';

      // Exactly one plate is ever composited: the last one whose beat has
      // begun. No dissolve, so two frames of the same shot can never be on
      // screen together — see the note on PLATES.
      var top = 0;
      if (shown) {
        for (i = 1; i < PLATES.length; i++) {
          if (p > edge[PLATE_BEAT[i]][0]) top = i;
        }
      }

      // The viewer scrolled out of the opening before it finished — on a slow
      // connection the timeline unlocks early, so this is reachable. Run the
      // plate to its end rather than cutting away from the middle of it: the
      // frame the next plate opens on is the frame this one closes on, and
      // anywhere else in the shot the cut would visibly skip.
      if (top > 0 && opening && !opening.ended && opening.duration) {
        opening.pause();
        try { opening.currentTime = opening.duration; } catch (e) {}
      }
      for (i = 0; i < plateEls.length; i++) {
        if (!plateEls[i]) continue;
        plateEls[i].style.setProperty('--o', i === top ? 1 : 0);
        if (i === top) plateEls[i].setAttribute('data-plate-on', '');
        else plateEls[i].removeAttribute('data-plate-on');
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
        if (cfg.exit) {
          var nb = edge[cfg.exit[0]], w = nb[1] - nb[0];
          out = ease(span(p, nb[0] + cfg.exit[1] * w, nb[0] + cfg.exit[2] * w));
        }
        var alive = p >= beat[0] && out < 1;
        if (alive) sc.panel.setAttribute('data-active', '');
        else sc.panel.removeAttribute('data-active');
        sc.panel.style.setProperty('--exit', out);
        if (!alive) continue;

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

      paintArrow(
        shown ? span(p, edge.arrow[0], edge.arrow[1]) : 0,
        shown ? span(p, edge.learn[0], edge.learn[1]) : 0
      );

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
    // The plates only start changing hands once the opening beat is over.
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
