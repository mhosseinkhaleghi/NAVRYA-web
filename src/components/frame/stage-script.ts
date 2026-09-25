import { inlineScript } from "./inline-script";

/**
 * The stage controller.
 *
 * It ships as an inline script rather than a client component because it has
 * to run before first paint, and because with no JavaScript at all none of its
 * attributes are ever set, so the CSS holding rules never match and the page is
 * simply, statically visible.
 *
 * Three jobs:
 *
 *   · bring the interface up — at once, waiting only (and briefly) for the
 *     faces the opening is set in, never for the footage;
 *   · play the opening shot, and hand it over cleanly to the scrubbed film
 *     whenever the viewer starts to scroll;
 *   · map the document's scroll position onto the film.
 *
 * Scroll is the viewer's. Nothing here reads the wheel, touch or keyboard to
 * decide where the page goes — the browser scrolls it natively, with its own
 * momentum, keyboard handling and accessibility, and every frame of the film
 * is a pure function of where it has been scrolled to. The only scripted
 * scrolls are the ones a viewer explicitly asks for: a section-rail mark and
 * section 6's dots, and both give the scroll back the moment it is touched.
 *
 * (It used to intercept every input inside the film and tween the page
 * between "story states" at the footage's own speed. One notch of a mouse
 * wheel then moved the page 5.2 screens and took 8.7s to settle, holding the
 * wheel took 50s to reach section 7, and further input was ignored until each
 * move finished. The film length that made that necessary is gone too — see
 * `BEATS`.)
 */

/**
 * How long the interface waits for its typefaces before coming up anyway.
 *
 * The opening headline is set in a display face that is much wider than any
 * fallback, and swapping it in reflowed the block by a third of its height.
 * The faces are preloaded, so on any ordinary connection they are here before
 * this runs out; past it, a reflow is a better outcome than an empty frame.
 */
const FONT_WAIT_MS = 500;

/**
 * The opening plays itself; everything after it is scrubbed.
 *
 * `OPENING_BUFFER_S` is how much of it has to be in hand before it starts —
 * all of it, in practice — unless the file is arriving `RATE_MARGIN` times
 * faster than it plays. Starting at `canplay`, which promises one frame, is
 * what made the opening hitch.
 *
 * A viewer who starts scrolling while it is still playing is not held to it:
 * the shot runs on at `OPENING_RUSH` so it finishes under them, and the first
 * scrubbed plate then eases from the frame the opening ended on to wherever
 * the scroll has got to, over `HANDOVER_MS`. The two frames either side of
 * that handover are the same picture (see `PLATES`), so what the viewer sees
 * is one continuous, briefly quickened shot rather than a cut.
 */
const OPENING_BUFFER_S = 5.5;
const RATE_MARGIN = 1.25;
const OPENING_RUSH = 2.5;
const HANDOVER_MS = 650;

/**
 * The timeline: one beat per plate, in vh of scroll. Must add up to the
 * `--timeline-vh` token, which is the no-JS fallback for the track's height.
 *
 * 1740vh — seventeen screens — for six chapters. It was 3840, paced at 70vh
 * per second of footage so that a scrolling reader watched every shot at its
 * own speed; at that length the film could only be crossed with the input
 * taken away from the reader, which is what it did. At this length it is
 * crossed by scrolling: a flick of a trackpad or a phone covers a chapter, and
 * each chapter keeps a stretch of scroll in which its panel is complete and
 * nothing moves but the footage (see the cues on `SCENES`).
 *
 * There are still no holds on a frozen frame: each plate runs straight into
 * the next, and text leaves *over* the plate that is already moving.
 */
const BEATS = [
  ["turn", 130], // hunter-turn   · 3.0s — he turns back to the valley; the opening leaves
  ["prey", 170], // valley-prey   · 5.0s — the deer walks in and grazes
  ["draw", 180], // hunter-draw   · 5.0s — he raises the bow and draws
  ["strike", 200], // hunter-strike · 7.0s — the camera pushes in to the draw
  // Section 4 leaves here, over the plate's closing frame and nothing else.
  // The release is the loudest moment in the sequence and the text must be off
  // the screen before it, not sliding out across it.
  ["clear", 60],
  ["arrow", 220], // arrow-learns  · 6.7s — the release, and the world goes dark
  // The paragraph lights up a word at a time and the edge light draws itself
  // round the frame; both finish with the beat.
  ["learn", 150],
  // Section 5 leaves, the arrow goes with it, and the frame dips through black
  // before the next morning fades up. The one handover that is not a cut.
  ["depart", 80],
  ["miss", 180], // forest-miss   · 4.4s — the arrow is in the tree, the deer runs
  // The psychology features, one per stretch of scroll.
  ["traits", 300],
  // Section 6 lifts away and the forest goes with it, onto the page's own
  // black, and section 7 rises out of it.
  ["fall", 70],
] as const;

/**
 * Cue points, as a fraction of each plate's duration.
 *
 * Fractions rather than seconds so the same numbers still land when there is no
 * video at all — under reduced motion nothing downloads and the stills carry the
 * sequence. The ones named after something in the footage were measured off it
 * frame by frame.
 */
const DEER_ENTERS = 0.4 / 5.041667; // clears the right edge of frame
const ARROW_MID = 2.0 / 6.7; // the arrow crisp and dead centre in the air
const WORLD_GONE = 5.15 / 6.7; // the valley has fallen away behind it
const ARROW_STRUCK = 0.67 / 4.4; // it buries itself in the tree
const DEER_BOLTS = 1.3 / 4.4; // the stag turns and runs
const DEER_CLEARS = 3.95 / 4.4; // the last of it leaves the frame

/** How much of a plate's own progress each reveal group takes to complete. */
const TITLE_SPAN = 0.12;
const REST_SPAN = 0.15;

/**
 * One entry per scrubbed plate: which beat scrubs it, which panel it carries,
 * the two cues that panel's reveal hangs on, and the window in the *next* beat
 * it leaves during — so it slides out over a plate that is already running.
 *
 * The panels arrive early in their plate and then stay. They used to wait on
 * late moments in the footage — section 2's body on the deer lowering its head
 * at 71% of its shot, sections 3 and 4 on the aim settling at 50% and 57% — and
 * a reader scrolling through saw a headline alone, or nothing but footage, for
 * two and three screens at a time. Now each panel is complete about a third of
 * the way into its plate, and the rest of the plate, plus the start of the
 * next, is the panel at rest with its shot still moving behind it: roughly a
 * screen of scroll in which to read it, wherever the reader stops.
 *
 * Section 2's headline still lands on the deer's entrance. Its body follows as
 * soon as the headline has settled.
 */
const SCENES = [
  { plate: "turn", beat: "turn", panel: null, exit: null, cues: null },
  {
    plate: "prey",
    beat: "prey",
    panel: "p1",
    exit: ["draw", 0, 0.2],
    cues: [DEER_ENTERS, DEER_ENTERS + TITLE_SPAN],
  },
  {
    plate: "draw",
    beat: "draw",
    panel: "p2",
    exit: ["strike", 0, 0.18],
    cues: [0.36, 0.38],
  },
  {
    plate: "strike",
    beat: "strike",
    panel: "p3",
    // Finished well inside its own beat: the closing plate must open on an
    // empty frame.
    exit: ["clear", 0, 0.72],
    cues: [0.4, 0.42],
  },
  { plate: "arrow", beat: "arrow", panel: null, exit: null, cues: null },
  { plate: "miss", beat: "miss", panel: null, exit: null, cues: null },
] as const;

/**
 * Every plate in the order it takes the frame, with the beat that brings it on.
 *
 * Handovers are cuts, not dissolves. Each clip was rendered as one continuous
 * shot and cut into pieces, so a plate's closing frame and the next plate's
 * opening frame are the *same frame* — measured, under 2% of pixels differ by
 * more than 12/255, and that residue is codec noise on the silhouette edge. A
 * dissolve between two such frames shows the figure twice, a few frames apart,
 * so exactly one plate is composited at any moment.
 */
const PLATES = ["dawn", "turn", "prey", "draw", "strike", "arrow", "miss"] as const;
const PLATE_BEAT = [null, "turn", "prey", "draw", "strike", "arrow", "miss"] as const;

/**
 * The opening leaves over the first beat: it holds for the first stretch of
 * scroll, so a reader who nudges the page is not rewarded with an empty frame,
 * and is gone about a screen in.
 */
const HERO_EXIT = [0.3, 0.8];

/**
 * Section 5's two entrances, as fractions of the closing plate. The headline
 * lands when the arrow is crisp and centred, and the paragraph fades up as the
 * valley disappears behind it.
 */
const ARROW_TITLE_SPAN = 0.11;
const ARROW_BODY_SPAN = 0.18;

/**
 * The closing paragraph lights up a word at a time. `LEARN_FADE` is how many
 * words are mid-transition at once; `LEARN_LEAD` finishes the last word as the
 * beat itself ends, so the sentence completing *is* the end of the section.
 */
const LEARN_FADE = 2;
const LEARN_LEAD = 1;
/** The edge light: the fraction of the perimeter drawn, linear with the beat. */
const GLOW_LEAD = 1;

/**
 * The departure, as windows inside the `depart` beat: the text goes first, then
 * the arrow follows it off, then a moment of nothing, then the next morning
 * fades up. The two plates never share the frame.
 */
const DEPART_TEXT = [0, 0.4];
const DEPART_PLATE = [0.32, 0.62];
const ARRIVE_PLATE = [0.7, 1];

/**
 * Section 6's reveals, as fractions of the `forest-miss` plate. The headline
 * lands on the impact and the block lifts as the stag runs.
 */
const MISS_TITLE_SPAN = 0.16;
const MISS_LIFT = 0.34;

/** How much of the deck's run one feature holds the frame for. */
const TRAIT_HOLD = 0.26;
/** Where in the `traits` beat the deck finishes: the last feature landing is the
 *  end of its section, with nothing left over to scroll through. */
const TRAIT_LEAD = 0.96;

/**
 * The fall: section 6 lifting away, then the forest going down behind it. The
 * text leads, so the words are gone before the picture is.
 */
const FALL_TEXT = [0, 0.5];
const FALL_PLATE = [0.16, 0.78];

/**
 * How a section below the film arrives, as windows on its own entry.
 *
 * `0` is the moment its top edge touches the bottom of the frame; `1` is the
 * moment it is as far in as it can get. The head (and section 7's orb, which
 * shares the number) comes up first and the body follows, both kept at their
 * high-water mark so scrolling back is only scrolling.
 *
 * Both finish early: the head by the time the section's top is a third of the
 * way up the frame, the body by the time it is half way. They used to finish
 * at 45% and 88%, which left a section's cards translucent while they were
 * already in the middle of the screen being read.
 */
const HEAD_IN = [0, 0.35];
const BODY_IN = [0.15, 0.6];

/**
 * The section rail — one mark per section, in the order the frame reaches them.
 *
 * ── Adding a section ────────────────────────────────────────────────────────
 *
 * This array is the rail, and it is the only place the rail is written down.
 * A new section needs one entry here, and `SectionRail.tsx` will not compile
 * until its `name` is given a label, so the two cannot drift apart.
 *
 * `from` is the beat the section takes the frame on; a mark owns the scroll
 * from there until the next mark's `from`. `at` is where the mark *goes*: a
 * point inside the stretch where that chapter is complete and at rest, so a
 * jump never lands on a headline mid-arrival. Both come off the same tables
 * as the rest of the sequence, so retiming a beat moves the rail with it.
 */
export const RAIL = [
  { name: "hero", from: "turn", at: ["turn", 0] },
  { name: "panel1", from: "prey", at: ["prey", 0.62] },
  { name: "panel2", from: "draw", at: ["draw", 0.76] },
  { name: "panel3", from: "strike", at: ["strike", 0.78] },
  // Whole when the last word goes white, at the very end of `learn`.
  { name: "closing", from: "arrow", at: ["learn", 0.99] },
  // The statement is whole and has not yet started to give way.
  { name: "miss", from: "miss", at: ["miss", 0.4] },
  // Below the film, and so not beats at all: elements in ordinary flow. The
  // mark goes to where the element *is*, read while the jump runs, because a
  // document's offsets are not fixed the way a timeline's are.
  { name: "dark", flow: "[data-dark]" },
  { name: "partners", flow: "[data-partners]" },
  { name: "testimonials", flow: "[data-testimonials]" },
  { name: "archetypes", flow: "[data-archetypes]" },
] as const;

/** The sections below the film, as one selector — read by the rail and the
 *  riser pass alike, so a new section is one line rather than two. */
const FLOW_SECTIONS = RAIL.filter((s) => "flow" in s)
  .map((s) => (s as { flow: string }).flow)
  .join(", ");

/**
 * A rail jump is travelled, not teleported: every frame is a pure function of
 * scroll, so a scrolled jump *plays* the footage in between. Keyed to distance
 * so a neighbouring section is brisk and the whole film is still a shot rather
 * than a smear. The browser's own smooth scroll caps well under a second.
 */
const GLIDE_MS = [620, 1400];

export const stageScript = inlineScript(`
(function () {
  var root = document.documentElement;

  /*
   * The sequence, and which page's sequence it is.
   *
   * One inline script shared by every page; the tables below are the home
   * page's film. A page with a film of its own states it on its track element
   * and those are read instead — same mechanism, same rules, its own shots.
   */
  var HOME_BEATS = ${JSON.stringify(BEATS)};
  var HOME_SCENES = ${JSON.stringify(SCENES)};
  var HOME_PLATES = ${JSON.stringify(PLATES)};
  var HOME_PLATE_BEAT = ${JSON.stringify(PLATE_BEAT)};
  var HOME_HERO_EXIT = ${JSON.stringify(HERO_EXIT)};
  var BEATS = HOME_BEATS;
  var SCENES = HOME_SCENES;
  var PLATES = HOME_PLATES;
  var PLATE_BEAT = HOME_PLATE_BEAT;
  var HERO_EXIT = HOME_HERO_EXIT;
  var TITLE_SPAN = ${TITLE_SPAN}, REST_SPAN = ${REST_SPAN};
  var ARROW_AT = ${ARROW_MID}, ARROW_SPAN = ${ARROW_TITLE_SPAN};
  var BODY_AT = ${WORLD_GONE}, BODY_SPAN = ${ARROW_BODY_SPAN};
  var LEARN_FADE = ${LEARN_FADE}, LEARN_LEAD = ${LEARN_LEAD}, GLOW_LEAD = ${GLOW_LEAD};
  var DEPART_TEXT = ${JSON.stringify(DEPART_TEXT)};
  var DEPART_PLATE = ${JSON.stringify(DEPART_PLATE)};
  var ARRIVE_PLATE = ${JSON.stringify(ARRIVE_PLATE)};
  var MISS_STRUCK = ${ARROW_STRUCK}, MISS_SPAN = ${MISS_TITLE_SPAN};
  var MISS_BOLTS = ${DEER_BOLTS}, MISS_LIFT = ${MISS_LIFT}, MISS_CLEARS = ${DEER_CLEARS};
  var TRAIT_HOLD = ${TRAIT_HOLD}, TRAIT_LEAD = ${TRAIT_LEAD};
  var FALL_TEXT = ${JSON.stringify(FALL_TEXT)};
  var FALL_PLATE = ${JSON.stringify(FALL_PLATE)};
  var HEAD_IN = ${JSON.stringify(HEAD_IN)};
  var BODY_IN = ${JSON.stringify(BODY_IN)};
  var RAIL = ${JSON.stringify(RAIL)};
  var FLOW_SECTIONS = ${JSON.stringify(FLOW_SECTIONS)};
  var GLIDE_MS = ${JSON.stringify(GLIDE_MS)};
  var FONT_WAIT_MS = ${FONT_WAIT_MS};
  var OPENING_BUFFER_S = ${OPENING_BUFFER_S}, RATE_MARGIN = ${RATE_MARGIN};
  var OPENING_RUSH = ${OPENING_RUSH}, HANDOVER_MS = ${HANDOVER_MS};

  var reduced = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // A connection that has asked to be spared, or cannot carry the shipping
  // plates, gets the film on the light tier alone. The picture is softer; the
  // sequence, every cue and every word are identical.
  var conn = navigator.connection;
  var lite = !!(conn && (conn.saveData || /2g|3g/.test(conn.effectiveType || '')));

  // ── beat boundaries, as fractions of the film ────────────────────────────
  var total = 0, i;
  var edge = {};

  /*
   * Called twice, and it has to be. This script runs before the track element
   * has been parsed, so the first call sizes the track from the home tables;
   * the second, on ready, reads the page's own. A page with its own film also
   * states the total inline on the track, so nothing shifts between the two.
   */
  function readSequence() {
    var trackEl = document.querySelector('[data-track]');
    function declared(name, home) {
      var raw = trackEl && trackEl.getAttribute('data-' + name);
      if (!raw) return home;
      try {
        var parsed = JSON.parse(raw);
        return parsed && parsed.length ? parsed : home;
      } catch (e) { return home; }
    }
    BEATS = declared('beats', HOME_BEATS);
    SCENES = declared('scenes', HOME_SCENES);
    PLATES = declared('plates', HOME_PLATES);
    PLATE_BEAT = declared('plate-beat', HOME_PLATE_BEAT);
    HERO_EXIT = declared('hero-exit', HOME_HERO_EXIT);

    total = 0;
    for (var k = 0; k < BEATS.length; k++) total += BEATS[k][1];
    root.style.setProperty('--timeline-vh', total);

    edge = {};
    var run = 0;
    for (k = 0; k < BEATS.length; k++) {
      edge[BEATS[k][0]] = [run / total, (run + BEATS[k][1]) / total];
      run += BEATS[k][1];
    }
  }
  readSequence();

  // The track's height is the stylesheet's (see \`.film\` in Stage.module.css):
  // the beat total times a clamped large-viewport unit. The second read, on
  // ready, picks up a page's own film once its track has been parsed.
  ready(readSequence);

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function span(p, a, b) { return b === a ? (p >= b ? 1 : 0) : clamp01((p - a) / (b - a)); }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  // ── the interface ────────────────────────────────────────────────────────
  //
  // Up at first paint. It is held for one thing only — the faces the opening
  // is set in — and for at most FONT_WAIT_MS, so the headline arrives in its
  // own face instead of reflowing a moment after it has been read.
  //
  // It used to wait for the opening *footage* to reach the frame where the
  // hunter turns: 5.3s on a fast line, 7-8s on a phone, with the bar, the
  // headline and both calls to action invisible and the scroll locked until
  // the shot had finished. With no JavaScript none of this runs and nothing
  // is ever held back.
  root.dataset.intro = 'armed';
  function showInterface() { root.dataset.intro = 'shown'; }
  setTimeout(showInterface, FONT_WAIT_MS);

  // The face an element's text is actually set in: the first family in its
  // stack with a face for its letters. Asking for the whole stack at once
  // loads a face from *every* family in it — Peyda, Amiri and Vazirmatn
  // under an English headline — so the families are tried one at a time.
  // Letters only: every Latin face covers the space and the full stop, which
  // would make Cinzel look like the answer for a Persian headline.
  function faceFor(el) {
    var cs = getComputedStyle(el);
    var families = cs.fontFamily.split(',');
    var head = cs.fontStyle + ' ' + cs.fontWeight + ' 16px ';
    var raw = el.textContent || '', text = '';
    for (var c = 0; c < raw.length; c++) {
      var code = raw.charCodeAt(c);
      if (code > 0xbf || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) text += raw[c];
    }
    return new Promise(function (done) {
      (function next(k) {
        if (k >= families.length || !text) { done(); return; }
        document.fonts.load(head + families[k].trim(), text).then(function (faces) {
          if (faces && faces.length) done();
          else next(k + 1);
        }, function () { next(k + 1); });
      })(0);
    });
  }

  ready(function () {
    var faces = [];
    if (document.fonts && document.fonts.load) {
      each('[data-hero] h1, [data-hero] p', function (el) { faces.push(faceFor(el)); });
    }
    Promise.all(faces).then(showInterface, showInterface);
  });

  // ── fetching the film ────────────────────────────────────────────────────
  //
  // Only the opening is fetched at load. Everything else waits until the
  // opening has played — or until the viewer scrolls, which means they need
  // the film now — and then comes in scroll order, one file at a time: the light
  // tier first, because it is what carries the motion from the first scroll,
  // then the shipping plates behind it, which sharpen each shot as they land.
  //
  // One at a time, because the file that matters is always the *next* one: six
  // parallel downloads share the line six ways and the next plate arrives as
  // late as the last. A plate the viewer reaches before the queue does is
  // fetched on the spot (see \`want\`).
  function proxyOf(id) { return document.querySelector('[data-scene-proxy="' + id + '"]'); }
  function plateOf(id) { return document.querySelector('[data-scene-video="' + id + '"]'); }

  // One \`load()\`, and only from \`none\`: calling it on an element that has
  // already fetched something restarts resource selection and throws it away.
  function fetchNow(v) {
    if (!v || v.getAttribute('preload') !== 'none') return;
    v.preload = 'auto';
    v.load();
  }

  function chain(list, stepMs, done) {
    var at = 0;
    (function next() {
      while (at < list.length && (!list[at] || list[at].readyState >= 4)) at++;
      if (at >= list.length) { if (done) done(); return; }
      var v = list[at++], moved = false, timer;
      function go() {
        if (moved) return;
        moved = true;
        clearTimeout(timer);
        v.removeEventListener('canplaythrough', go);
        v.removeEventListener('error', go);
        next();
      }
      // A slow or dead file must not hold the queue.
      timer = setTimeout(go, stepMs);
      v.addEventListener('canplaythrough', go);
      v.addEventListener('error', go);
      fetchNow(v);
    })();
  }

  var opening = null;
  // waiting → playing → done. \`done\` also covers an opening that was never
  // going to play: no plate, reduced motion, autoplay refused, or a viewer who
  // scrolled away before it could start.
  var openingState = 'waiting';

  // The shipping plates wait for the opening to have fully arrived: fourteen
  // megabytes started alongside it cost it half a second on a live line.
  function whenOpeningSettled(done) {
    if (!opening || openingState === 'done') { done(); return; }
    var fired = false, cap;
    function covered() {
      var b = opening.buffered;
      return opening.duration && b.length && b.end(b.length - 1) >= opening.duration - 0.05;
    }
    function fire() {
      if (fired) return;
      fired = true;
      clearTimeout(cap);
      opening.removeEventListener('progress', check);
      done();
    }
    function check() { if (covered()) fire(); }
    cap = setTimeout(fire, 9000);
    if (covered()) { fire(); return; }
    opening.addEventListener('progress', check);
  }

  var warming = false;
  function warm() {
    if (warming || reduced) return;
    warming = true;
    var proxies = [], plates = [];
    for (var q = 0; q < PLATES.length; q++) {
      if (!PLATE_BEAT[q]) continue;
      proxies.push(proxyOf(PLATES[q]));
      plates.push(plateOf(PLATES[q]));
    }
    chain(proxies, 4000, function () {
      if (!lite) whenOpeningSettled(function () { chain(plates, 8000); });
    });
  }

  // The plate under the viewer, and the one after it, jump the queue.
  function want(id) {
    if (reduced) return;
    warm();
    fetchNow(proxyOf(id));
    if (!lite) fetchNow(plateOf(id));
  }

  // ── scrubbing ────────────────────────────────────────────────────────────
  // A seek issued while another is still resolving is dropped by the browser,
  // so each plate keeps one pending target and fires it when the last seek
  // lands. That keeps the picture as close to the scroll as the decoder allows
  // without ever queueing seeks up behind each other.
  function scrubber(video) {
    if (!video) return function () {};
    // The wanted position is kept as a *fraction*, and kept even when the plate
    // has no duration yet — then fired the moment the decoder can honour it,
    // so a plate that is still arriving lands on the right frame without the
    // viewer having to scroll again.
    var wantFraction = null, busy = false;
    function pump() {
      if (busy || wantFraction === null || !video.duration) return;
      var t = clamp01(wantFraction) * (video.duration - 0.02);
      if (Math.abs(video.currentTime - t) < 0.01) return;
      busy = true;
      try { video.currentTime = t; } catch (e) { busy = false; }
    }
    video.addEventListener('seeked', function () { busy = false; pump(); });
    video.addEventListener('error', function () { busy = false; });
    video.addEventListener('loadedmetadata', pump);
    video.addEventListener('durationchange', pump);
    video.addEventListener('loadeddata', pump);
    video.addEventListener('canplay', pump);
    return function (fraction) {
      wantFraction = fraction;
      pump();
    };
  }

  /*
   * One plate, both tiers, as one seek.
   *
   * A function rather than inline in the loop: the loop's \`var\`s are shared
   * by every turn, and a closure written inline would seek whichever plate the
   * last turn left behind.
   *
   * The proxy carries the motion from the first scroll. The full plate stays
   * transparent until it can honour the position it is being given —
   * \`data-plate-ready\` is what the stylesheet fades in on — and steps aside
   * again whenever it falls behind (\`data-plate-behind\`): the proxy answers
   * several times as many seeks a second, and the right frame slightly soft
   * beats the wrong frame sharp. Hysteresis, so it does not oscillate.
   */
  function bindPlate(full, proxy) {
    var seekFull = scrubber(full);
    var seekProxy = scrubber(proxy);
    function markReady() {
      if (full && full.readyState >= 3) full.setAttribute('data-plate-ready', '');
    }
    if (full) {
      full.addEventListener('canplay', markReady);
      full.addEventListener('canplaythrough', markReady);
      full.addEventListener('seeked', markReady);
      markReady();
    }
    var BEHIND_OUT = 2 / 24, BEHIND_IN = 0.5 / 24, behind = false;
    function follow(fraction) {
      if (!full || !full.duration || !proxy) return;
      var lag = Math.abs(full.currentTime - clamp01(fraction) * (full.duration - 0.02));
      if (!behind && lag > BEHIND_OUT) {
        behind = true;
        full.setAttribute('data-plate-behind', '');
      } else if (behind && lag < BEHIND_IN) {
        behind = false;
        full.removeAttribute('data-plate-behind');
      }
    }
    return function (fraction) {
      // Asked on every scrub as well as on the events above: a plate that
      // became ready before this binding, or without an event, would otherwise
      // stay invisible behind its stand-in for good.
      if (full && !full.hasAttribute('data-plate-ready')) markReady();
      seekProxy(fraction);
      seekFull(fraction);
      follow(fraction);
    };
  }

  // ── the sequence ─────────────────────────────────────────────────────────
  ready(function () {
    var hero = document.querySelector('[data-hero]');
    var heroParts = document.querySelectorAll('[data-hero-part]');
    opening = document.querySelector('[data-plate-lead]');

    var plateEls = [];
    for (i = 0; i < PLATES.length; i++) {
      plateEls.push(document.querySelector('[data-plate-id="' + PLATES[i] + '"]'));
    }
    var ARROW_PLATE = PLATES.indexOf('arrow'), MISS_PLATE = PLATES.indexOf('miss');

    var scenes = [];
    for (var s = 0; s < SCENES.length; s++) {
      var cfg = SCENES[s];
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
        seek: bindPlate(plateOf(cfg.plate), proxyOf(cfg.plate)),
        panel: panel,
        groups: groups,
      });
    }

    // ── section 5 ──────────────────────────────────────────────────────────
    // The release, the flight, the fall to black, the two entrances, the
    // paragraph lighting up and the ring drawing itself: all pure functions of
    // scroll position.
    var arrow = document.querySelector('[data-arrow]');
    var words = arrow ? +arrow.getAttribute('data-words') || 0 : 0;

    function paintArrow(ap, lp, dp) {
      if (!arrow) return;

      // dp is the departure window: the text leaves before its plate does.
      var gone = ease(span(dp, DEPART_TEXT[0], DEPART_TEXT[1]));
      if (ap > 0 && gone < 1) arrow.setAttribute('data-active', '');
      else arrow.removeAttribute('data-active');

      arrow.style.setProperty('--head', ease(span(ap, ARROW_AT, ARROW_AT + ARROW_SPAN)));
      arrow.style.setProperty('--body', ease(span(ap, BODY_AT, BODY_AT + BODY_SPAN)));
      arrow.style.setProperty('--lit', clamp01(lp / LEARN_LEAD) * (words + LEARN_FADE));
      arrow.style.setProperty('--glow', clamp01(lp / GLOW_LEAD));
      arrow.style.setProperty('--exit', gone);
    }

    // ── section 6 ──────────────────────────────────────────────────────────
    var miss = document.querySelector('[data-miss]');
    var traitEls = miss ? miss.querySelectorAll('[data-trait]') : [];
    var dotEls = miss ? miss.querySelectorAll('[data-dot]') : [];

    function paintMiss(mp, tp, fp) {
      if (!miss) return;

      var gone = ease(span(fp, FALL_TEXT[0], FALL_TEXT[1]));
      miss.style.setProperty('--exit', gone);
      if (mp > 0 && gone < 1) miss.setAttribute('data-active', '');
      else miss.removeAttribute('data-active');

      // The headline lands on the impact, and the block lifts as the stag runs.
      miss.style.setProperty('--head', ease(span(mp, MISS_STRUCK, MISS_STRUCK + MISS_SPAN)));
      miss.style.setProperty('--lift', ease(span(mp, MISS_BOLTS, MISS_BOLTS + MISS_LIFT)));
      // Once the frame is empty the statement gives way to the features.
      miss.style.setProperty('--told', ease(span(mp, MISS_CLEARS, 1)));

      // One feature per stretch of the beat: each slides in, holds, slides out,
      // and the whole thing reverses with the scroll.
      var n = traitEls.length;
      if (!n) return;
      var reach = (tp / TRAIT_LEAD) * (n - 1 + TRAIT_HOLD);
      for (var t = 0; t < n; t++) {
        var local = reach - t;
        var on = clamp01(local / TRAIT_HOLD);
        var off = clamp01((local - (1 - TRAIT_HOLD)) / TRAIT_HOLD);
        var into = ease(on), away = t === n - 1 ? 0 : ease(off);
        traitEls[t].style.setProperty('--in', into);
        traitEls[t].style.setProperty('--out', away);
        // The dots are the carousel, not a readout of it.
        if (dotEls[t]) {
          var fill = into * (1 - away);
          dotEls[t].style.setProperty('--in', fill);
          if (fill > 0.5) dotEls[t].setAttribute('aria-current', 'true');
          else dotEls[t].removeAttribute('aria-current');
        }
      }
      miss.style.setProperty('--traits', tp > 0 ? 1 : 0);
      // The dots are buttons; while the deck is not on screen they must not be
      // in the tab order either.
      if (tp > 0) miss.setAttribute('data-traits', '');
      else miss.removeAttribute('data-traits');
    }

    // ── the document below the film ────────────────────────────────────────
    //
    // A page, not a reel: the sections stack and scroll like anything else,
    // and their content arrives on the way in and then stays, kept at a
    // high-water mark. The measure is how far a section has climbed over a
    // screen of scroll, less whatever screen the last section does not have
    // before the document runs out — which is what lets one rule finish the
    // last section at the foot of the page too.
    var flows = [];
    each(FLOW_SECTIONS, function (el) {
      flows.push({ el: el, head: 0, body: 0 });
    });

    function stage(win, v) { return clamp01((v - win[0]) / (win[1] - win[0])); }

    // Measurements are passed in: every read in a frame happens before the
    // first write, so none of them forces a layout mid-frame.
    function paintFlow(boxes, h, y, end) {
      for (var i = 0; i < flows.length; i++) {
        var f = flows[i], box = boxes[i];
        var travel = h - Math.max(0, box.top + y - end);
        if (travel < 1) travel = 1;
        var shown = clamp01((h - box.top) / travel);
        var head = ease(stage(HEAD_IN, shown));
        var body = ease(stage(BODY_IN, shown));
        if (head > f.head) f.head = head;
        if (body > f.body) f.body = body;
        f.el.style.setProperty('--head', f.head);
        f.el.style.setProperty('--body', f.body);
      }
    }

    // Section 8's and 9's drift is an animation rather than a reveal: it runs
    // while its section is on screen and pauses when it is not.
    each('[data-reveal]', function (el) {
      if (!window.IntersectionObserver) {
        el.setAttribute('data-in', '');
        el.setAttribute('data-on', '');
        return;
      }
      new IntersectionObserver(function (entries) {
        if (entries[entries.length - 1].isIntersecting) el.setAttribute('data-in', '');
        else el.removeAttribute('data-in');
      }).observe(el);
    });

    // The orb compiles when its own section is within a screen of the frame,
    // and gives the frame back when it is out of reach.
    var orb = document.querySelector('[data-orb]');
    if (orb && window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        for (var e = 0; e < entries.length; e++) {
          if (entries[e].isIntersecting) orb.setAttribute('data-orb-live', '');
          else orb.removeAttribute('data-orb-live');
        }
      }, { rootMargin: '100% 0px' }).observe(orb);
    } else if (orb) {
      orb.setAttribute('data-orb-live', '');
    }

    // ── section 10's accordion ─────────────────────────────────────────────
    //
    // All this does is say which panel is open. The widths, the colour coming
    // back into the open plate, the caption growing — every one of those is a
    // CSS transition on the panel itself. The panel that opens on load is marked
    // open in the markup, so the section is composed before this runs.
    var gallery = document.querySelector('[data-gallery]');
    if (gallery) {
      var pads = [];
      each('[data-cast-panel]', function (el) { pads[+el.getAttribute('data-cast-panel')] = el; }, gallery);
      // Hover belongs to a mouse: a tap arrives as a pointer that also enters.
      var fine = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;

      var openPanel = function (i) {
        gallery.setAttribute('data-open', i);
        for (var p = 0; p < pads.length; p++) {
          if (p === i) pads[p].setAttribute('data-on', '');
          else pads[p].removeAttribute('data-on');
        }
      };

      // Below the stack breakpoint every panel is open already.
      var stacked = window.matchMedia ? window.matchMedia('(max-width: 767px)') : null;

      var bind = function (i, el) {
        el.addEventListener('pointerenter', function (e) {
          if (e.pointerType === 'mouse' && (!fine || fine.matches)) openPanel(i);
        });
        // Whether the panel was open *before the finger landed*: a tap focuses
        // the link before it clicks it, and focus opens the panel. Starts true
        // so that Enter on a focused panel follows the link.
        var wasOpen = true;
        el.addEventListener('pointerdown', function (e) {
          wasOpen = e.pointerType === 'mouse' || el.hasAttribute('data-on');
        });
        el.addEventListener('click', function (e) {
          // A finger's first tap opens the panel so the caption can be read;
          // the next one follows the link.
          var needsALook =
            !wasOpen && !(fine && fine.matches) && !(stacked && stacked.matches);
          if (needsALook) e.preventDefault();
          wasOpen = true;
          openPanel(i);
        });
        el.addEventListener('focus', function () { openPanel(i); });
        el.addEventListener('keydown', function (e) {
          var k = e.key;
          var step = k === 'ArrowRight' || k === 'ArrowDown' ? 1
            : k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          // The row mirrors with the writing direction, so the arrows do too.
          if ((k === 'ArrowRight' || k === 'ArrowLeft') && root.dir === 'rtl') step = -step;
          pads[(i + step + pads.length) % pads.length].focus();
        });
      };
      for (var pi = 0; pi < pads.length; pi++) bind(pi, pads[pi]);
    }

    // ── the section rail ───────────────────────────────────────────────────
    //
    // Its first marks are beats of the film and resolve from the beat table;
    // its last are elements in ordinary flow and resolve from where those
    // elements are, measured when they are needed rather than cached.
    var marks = [];
    each('[data-rail-mark]', function (el) {
      marks[+el.getAttribute('data-rail-mark')] = el;
    });

    var railAt = [], railFrom = [], railFlow = [];
    for (i = 0; i < RAIL.length; i++) {
      railFlow.push(-1);
      railAt.push(null);
      railFrom.push(null);
      if (RAIL[i].flow) {
        var flowEl = document.querySelector(RAIL[i].flow);
        for (var fi = 0; fi < flows.length; fi++) if (flows[fi].el === flowEl) railFlow[i] = fi;
        continue;
      }
      // A page running its own film has none of the home page's beats, and a
      // mark whose beat is not in the table simply has no position.
      var re = edge[RAIL[i].at[0]];
      if (!re) continue;
      railAt[i] = re[0] + (re[1] - re[0]) * RAIL[i].at[1];
      railFrom[i] = edge[RAIL[i].from] ? edge[RAIL[i].from][0] : re[0];
    }

    // Where a mark goes, in document pixels, or null if it goes nowhere.
    function railTarget(m) {
      if (railFlow[m] >= 0) return flows[railFlow[m]].el.getBoundingClientRect().top + window.scrollY;
      if (railAt[m] === null) return null;
      return railAt[m] * filmMax;
    }

    function paintRail(boxes, h, y) {
      var on = 0;

      // Below the film the lit mark is whichever flow section holds the middle
      // of the frame.
      var mid = h / 2, inFlow = false;
      for (var m = 0; m < railFlow.length; m++) {
        if (railFlow[m] < 0) continue;
        var box = boxes[railFlow[m]];
        if (mid >= box.top && mid < box.top + box.height) { on = m; inFlow = true; }
      }

      if (!inFlow) {
        var p = filmMax > 0 ? clamp01(y / filmMax) : 0;
        for (m = 1; m < railFrom.length; m++) {
          if (railFrom[m] !== null && p >= railFrom[m]) on = m;
        }
      }

      for (m = 0; m < marks.length; m++) {
        if (!marks[m]) continue;
        if (m === on) {
          marks[m].setAttribute('data-on', '');
          marks[m].setAttribute('aria-current', 'true');
        } else {
          marks[m].removeAttribute('data-on');
          marks[m].removeAttribute('aria-current');
        }
      }
    }

    var glide = null;
    function stopGlide() {
      if (glide === null) return;
      cancelAnimationFrame(glide);
      glide = null;
    }

    // A travelled jump. \`where\` is a function, re-read on every frame: a
    // section below the film can change height while the jump is running —
    // a face or a lazy image landing — and a target fixed at the start would
    // land short of it.
    function goTo(where) {
      var from = window.scrollY;
      function target() {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        var to = where();
        if (typeof to !== 'number' || !isFinite(to)) to = from;
        return Math.round(Math.max(0, Math.min(to, max)));
      }
      var first = target(), dist = Math.abs(first - from);
      stopGlide();
      if (reduced || dist < 2) { window.scrollTo(0, first); return; }
      var ms = GLIDE_MS[0]
        + clamp01(dist / (document.documentElement.scrollHeight || 1)) * GLIDE_MS[1];
      var t0 = performance.now();
      (function step(now) {
        var t = clamp01((now - t0) / ms);
        window.scrollTo(0, from + (target() - from) * ease(t));
        glide = t < 1 ? requestAnimationFrame(step) : null;
      })(t0);
    }

    for (i = 0; i < marks.length; i++) {
      (function (m) {
        if (!marks[m]) return;
        marks[m].addEventListener('click', function () {
          goTo(function () { return railTarget(m); });
        });
      })(i);
    }

    // Section 6's dots drive the deck as well as read it. Each lands where its
    // own slide is fully in — the inverse of the reach the deck is painted
    // from: reach = (tp / TRAIT_LEAD) * (n - 1 + hold), whole at t + hold.
    if (dotEls.length && edge.traits) {
      var tb = edge.traits, tw = tb[1] - tb[0];
      var reachAll = (dotEls.length - 1) + TRAIT_HOLD;
      for (i = 0; i < dotEls.length; i++) {
        (function (t) {
          var tp = TRAIT_LEAD * (t + TRAIT_HOLD) / reachAll;
          dotEls[t].addEventListener('click', function () {
            goTo(function () { return (tb[0] + tp * tw) * filmMax; });
          });
        })(i);
      }
    }

    // Any input of the viewer's own takes the scroll back from a jump.
    var takeover = ['wheel', 'touchstart', 'keydown'];
    for (i = 0; i < takeover.length; i++) {
      window.addEventListener(takeover[i], stopGlide, { passive: true });
    }

    // ── the opening ────────────────────────────────────────────────────────
    //
    // The lead plate plays; it is the one shot the viewer does not drive. It
    // starts once it can run without stalling, and only while the viewer is
    // still at the top of the page to watch it.
    var firstBeat = BEATS.length ? edge[BEATS[0][0]] : null;
    var handoverAt = 0;

    function retireOpening() {
      if (openingState === 'done') return;
      openingState = 'done';
      if (opening) {
        opening.pause();
        // Rest it on its last frame, which is the first frame of the plate
        // after it — so scrolling back to the top shows the same picture the
        // film continues from.
        try { if (opening.duration) opening.currentTime = opening.duration; } catch (e) {}
      }
      warm();
    }

    function runHandover() {
      (function step() {
        apply();
        if (handoverAt) requestAnimationFrame(step);
      })();
    }

    if (!opening || reduced) {
      openingState = 'done';
      warm();
    } else {
      var t0 = Date.now();
      // How far a single unbroken range from the start reaches.
      var buffered = function () {
        try {
          for (var b = 0; b < opening.buffered.length; b++) {
            if (opening.buffered.start(b) <= 0.05) return opening.buffered.end(b);
          }
        } catch (e) {}
        return 0;
      };
      var start = function () {
        if (openingState !== 'waiting') return;
        openingState = 'playing';
        // Nothing else is fetched while the opening plays, unless the viewer
        // scrolls (\`want\`) and needs it. A second decoder spinning up under a
        // playing shot stalled the main thread for 1.3s in measurement — with
        // the same files arriving after the shot, nothing. The shot is five
        // seconds long and the first plate's light copy is 120KB.
        var played = opening.play();
        // Autoplay refused, or no decoder: the still stays, and the film takes
        // over from it as soon as the viewer scrolls.
        if (played && played.catch) played.catch(retireOpening);
      };
      var enough = function () {
        if (openingState !== 'waiting') return;
        var have = buffered();
        if (opening.readyState >= 4) return start();
        if (have >= Math.min(opening.duration || 1e9, OPENING_BUFFER_S)) return start();
        var elapsed = (Date.now() - t0) / 1000;
        if (elapsed > 0.8 && have > 0.6 && have / elapsed > RATE_MARGIN) start();
      };
      opening.addEventListener('progress', enough);
      opening.addEventListener('loadeddata', enough);
      opening.addEventListener('canplaythrough', start);
      opening.addEventListener('error', retireOpening);
      opening.addEventListener('ended', function () {
        if (openingState !== 'playing') return;
        openingState = 'done';
        warm();
        // The viewer is already into the first beat: ease the plate after it
        // from this very frame up to wherever the scroll has reached.
        if (window.scrollY > 0) { handoverAt = performance.now(); runHandover(); }
      });
      enough();
    }

    // ── one frame ──────────────────────────────────────────────────────────
    function apply() {
      // Reads first — every measurement this frame needs, before any write.
      var y = window.scrollY, h = window.innerHeight;
      var docEnd = document.documentElement.scrollHeight - h;
      var boxes = [];
      for (var f = 0; f < flows.length; f++) boxes.push(flows[f].el.getBoundingClientRect());

      // Against the *track*, not the document: the film completes exactly as
      // the track's last screen goes by.
      var p = filmMax > 0 ? clamp01(y / filmMax) : 0;
      var now = performance.now();

      // The opening, while it is still the frame.
      var heroSpan = firstBeat ? firstBeat[1] - firstBeat[0] : 0;
      var heroOutAt = firstBeat ? firstBeat[0] + HERO_EXIT[0] * heroSpan : 0;
      var heroGoneAt = firstBeat ? firstBeat[0] + HERO_EXIT[1] * heroSpan : 0;
      // Not started yet: it keeps the frame while the opening copy is still
      // there to read, and is let go once that begins to leave.
      if (openingState === 'waiting' && p > heroOutAt) retireOpening();
      // Playing: it keeps the frame for as long as the opening copy is on
      // screen, and not a pixel longer. The shot belongs to the opening; on a
      // film whose first beat also carries a slide (the features page's map),
      // holding it for the whole beat put that slide's headline over the
      // wrong picture.
      if (openingState === 'playing' && p >= heroGoneAt) retireOpening();
      var holding = openingState !== 'done';
      if (openingState === 'playing') {
        var rate = p > 0 ? OPENING_RUSH : 1;
        if (opening.playbackRate !== rate) opening.playbackRate = rate;
      }

      var ramp = 1;
      if (handoverAt) {
        ramp = ease(clamp01((now - handoverAt) / HANDOVER_MS));
        if (ramp >= 1) handoverAt = 0;
      }

      // Exactly one plate is ever composited: the last one whose beat has
      // begun — or the opening, for as long as it is still playing.
      var top = 0;
      if (!holding) {
        for (i = 1; i < PLATES.length; i++) {
          if (p > edge[PLATE_BEAT[i]][0]) top = i;
        }
      }
      var opacity = [];
      for (i = 0; i < plateEls.length; i++) opacity.push(i === top ? 1 : 0);

      /*
       * A handover whose two frames are not the same picture cannot be a cut.
       * Declared per scene, so it stays an exception that has to be asked for:
       * the features film has one, where slide 3's map and slide 4's dive
       * measure SSIM 0.194 against each other.
       */
      for (s = 0; s < scenes.length; s++) {
        var dcfg = scenes[s].cfg;
        if (!dcfg.dissolve) continue;
        var dIdx = PLATES.indexOf(dcfg.plate);
        if (dIdx < 1 || dIdx !== top) continue;
        var dBeat = edge[dcfg.beat];
        if (!dBeat) continue;
        var dIn = span(p, dBeat[0], dBeat[0] + dcfg.dissolve * (dBeat[1] - dBeat[0]));
        if (dIn < 1) {
          opacity[dIdx] = dIn;
          opacity[dIdx - 1] = 1 - dIn;
        }
      }

      // The one handover that is not a cut: the closing plate is a black studio
      // frame and the plate after it a forest at dawn, so it dips through black.
      var db = edge.depart;
      if (db && p > db[0] && p < db[1]) {
        var dw = db[1] - db[0];
        opacity[ARROW_PLATE] = 1 - span(p, db[0] + DEPART_PLATE[0] * dw, db[0] + DEPART_PLATE[1] * dw);
        opacity[MISS_PLATE] = span(p, db[0] + ARRIVE_PLATE[0] * dw, db[0] + ARRIVE_PLATE[1] * dw);
      }

      // The end of the film goes down to the page's own black.
      var fb = edge.fall;
      if (fb && p > fb[0]) {
        var fw = fb[1] - fb[0];
        opacity[MISS_PLATE] =
          1 - span(p, fb[0] + FALL_PLATE[0] * fw, fb[0] + FALL_PLATE[1] * fw);
      }

      for (i = 0; i < plateEls.length; i++) {
        var plate = plateEls[i];
        if (!plate) continue;
        plate.style.setProperty('--o', opacity[i]);
        if (opacity[i] > 0.001) plate.setAttribute('data-plate-on', '');
        else plate.removeAttribute('data-plate-on');
        // A plate's still is fetched once the plate is on screen, or next up
        // once the film has started fetching — not for all seven at load. Under
        // reduced motion the stills are the whole picture, so the next one is
        // always on its way.
        var next = i === top + 1 && (warming || reduced);
        if ((i === top || next) && !plate.hasAttribute('data-plate-near')) {
          plate.setAttribute('data-plate-near', '');
        }
      }

      for (s = 0; s < scenes.length; s++) {
        var sc = scenes[s], cfg = sc.cfg;
        var beat = edge[cfg.beat];
        var plateP = span(p, beat[0], beat[1]);
        // The first scrubbed plate, easing up from the opening's last frame.
        if (ramp < 1 && s === 0) plateP *= ramp;
        sc.seek(plateP);

        // The plate under the viewer and the next one take the line now, ahead
        // of the queue.
        if (plateP > 0 && plateP < 1) {
          want(cfg.plate);
          if (s + 1 < scenes.length) want(scenes[s + 1].cfg.plate);
        }

        if (!sc.panel) continue;

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

      function at(name) {
        var e = edge[name];
        return e ? span(p, e[0], e[1]) : 0;
      }
      paintArrow(at('arrow'), at('learn'), at('depart'));
      paintMiss(at('miss'), at('traits'), at('fall'));

      paintFlow(boxes, h, y, docEnd);
      paintRail(boxes, h, y);

      // Past the film the bar takes the page's ground, so copy scrolling under
      // it does not read as a collision. Only where there is a page to be past.
      if (flows.length && y > filmMax - h * 0.5) root.setAttribute('data-past-film', '');
      else root.removeAttribute('data-past-film');

      // The opening leaves over the first beat.
      var hw = firstBeat ? firstBeat[1] - firstBeat[0] : 0;
      var heroOut = firstBeat
        ? ease(span(p, firstBeat[0] + HERO_EXIT[0] * hw, firstBeat[0] + HERO_EXIT[1] * hw))
        : 0;
      for (var hp = 0; hp < heroParts.length; hp++) {
        heroParts[hp].style.setProperty('--exit', heroOut);
      }
      if (hero) {
        if (heroOut >= 1) hero.setAttribute('data-gone', '');
        else hero.removeAttribute('data-gone');
      }
    }

    var track = document.querySelector('[data-track]');
    var bar = document.querySelector('header');
    var filmMax = 0;
    function measure() {
      filmMax = track ? track.offsetHeight - window.innerHeight : 0;
      if (filmMax < 1) filmMax = 1;
      // On compact frames the stage holds the bar's row open; the stylesheet
      // estimates it, and this corrects it to the pixel once the bar exists.
      if (bar) root.style.setProperty('--chrome-h', bar.offsetHeight + 'px');
    }
    measure();

    // The bar grows when its faces land; watch it rather than guess when.
    if (bar && window.ResizeObserver) new ResizeObserver(measure).observe(bar);

    var queued = false;
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; apply(); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { measure(); onScroll(); });
    // A page restored from the back/forward cache comes back where the viewer
    // left it, with every plate where it was; this only re-syncs the frame.
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) { measure(); apply(); }
    });
    each('[data-scene-video]', function (v) {
      v.addEventListener('loadedmetadata', onScroll);
    });
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
`);
