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
  // The last word going white is the end of the section, not the middle of it —
  // both the paragraph and the ring finish within a hair of the beat's end, so
  // there is no stretch of scroll left over once the sentence is complete.
  ["learn", 340],
  // Section 5 leaves, the arrow goes with it, and the frame dips through black
  // before the next morning fades up. The one handover that is not a cut.
  //
  // Every vh of this is *moving* — the words go, the arrow goes, the morning
  // arrives — which is why it can be this short. What made the old 240 feel
  // long was not the handover but the 100vh of nothing in front of it, before
  // `LEARN_LEAD` was taken to the end of its own beat.
  ["depart", 150],
  ["miss", 420], // forest-miss   · 4.4s — the arrow is in the tree, the deer runs
  // The psychology features, one per stretch of scroll. The deck finishes with
  // the beat — see `TRAIT_LEAD` — so there is no stretch left over once the
  // last feature is up.
  ["traits", 560],
  // Section 6 lifts away and the forest goes with it, leaving the frame black.
  // The last plate of the sequence has nothing after it to cut to, so this one
  // ends on the page's own ground rather than on another shot.
  ["fall", 180],
  // The film ends here. Everything below is ordinary document — see `Stage`'s
  // `after` — vertical sections one after another, scrolled like any page.
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
const ARROW_STRUCK = 0.67 / 4.4; // it buries itself in the tree
const DEER_BOLTS = 1.3 / 4.4; // the stag turns and runs
const DEER_CLEARS = 3.95 / 4.4; // the last of it leaves the frame

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
  { plate: "miss", beat: "miss", panel: null, exit: null, cues: null },
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
const PLATES = ["dawn", "turn", "prey", "draw", "strike", "arrow", "miss"] as const;
const PLATE_BEAT = [null, "turn", "prey", "draw", "strike", "arrow", "miss"] as const;

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
 * word as the beat itself ends: the sentence completing *is* the end of the
 * section, so there is nothing left to scroll through once it is whole.
 */
const LEARN_FADE = 2;
/**
 * Taken all the way to the end of the beat. At 0.92 the last word went white
 * with 8% of `learn` and the whole of `depart` still to scroll — 280vh, nearly
 * three screens, and almost none of it moving. The sentence completing is the
 * end of the section, so it now completes where the section ends: the last word
 * lands at `(words + 1) / (words + 2)` of the beat, which is 95–97% of it in
 * every locale.
 */
const LEARN_LEAD = 1;
/**
 * The edge light is linear and finishes with the beat: `--glow` is the fraction
 * of the perimeter that has been drawn, so scrolling the beat draws the ring
 * exactly once, at a constant rate, and scrolling back erases it.
 */
const GLOW_LEAD = 1;

/**
 * The departure, as windows inside the `depart` beat.
 *
 * The text goes first, then the arrow follows it off, then a moment of nothing,
 * then the next morning fades up. Sequenced rather than cross-faded: the two
 * plates never share the frame, so the one-plate rule holds even here — what
 * happens between them is the stage's own black, which is what a dip to black
 * is.
 */
const DEPART_TEXT = [0, 0.4];
const DEPART_PLATE = [0.32, 0.62];
const ARRIVE_PLATE = [0.7, 1];

/**
 * Section 6's reveals, as fractions of the `forest-miss` plate.
 *
 * The headline lands on the impact — the frame the arrow buries itself in the
 * tree — and the block lifts as the stag turns and runs, so the text moves with
 * the animal rather than sitting still while it goes.
 */
const MISS_TITLE_SPAN = 0.16;
const MISS_LIFT = 0.34;

/** How much of the deck's run one feature holds the frame for. */
const TRAIT_HOLD = 0.26;
/**
 * Where in the `traits` beat the deck finishes, which is `LEARN_LEAD`'s job one
 * section along.
 *
 * The deck is complete once the last slide is fully in, and with the reach
 * running plainly at `tp * n` that happened at `(n - 1 + hold) / n` — 75% of the
 * beat for three slides, leaving a quarter of it, 163vh, in which nothing on
 * screen could change no matter how far the viewer scrolled. Scaling the reach
 * by this instead puts the last feature at the end of its own section.
 */
const TRAIT_LEAD = 0.96;

/**
 * Section 7 — the fall to black, and what rises out of it.
 *
 * `FALL_TEXT` is section 6 lifting away, `FALL_PLATE` the forest going down
 * behind it; the text leads, so the words are gone before the picture is. Both
 * are windows inside the `fall` beat.
 */
const FALL_TEXT = [0, 0.5];
const FALL_PLATE = [0.16, 0.78];

/**
 * How a section below the film arrives, as windows on its own entry.
 *
 * `0` is the moment its top edge touches the bottom of the frame; `1` is the
 * moment it is as far in as it can get — the whole of it in view for a section
 * shorter than the frame, its top edge at the top for one that is taller.
 *
 * Two steps, in this order, and the order is the point: the head — the title,
 * and in section 7 the orb behind it, which shares the same number — comes up
 * on the first part of the entry, and the body follows on the second. One
 * scroll brings the title and its backdrop, the next brings the words under it.
 *
 * Both finish before `1` so a section is composed a little before it is as far
 * in as it will ever get; the last section on the page has nothing past it to
 * scroll into, and would otherwise only complete at the final pixel.
 */
const HEAD_IN = [0, 0.45];
const BODY_IN = [0.45, 0.88];

/**
 * The section rail — one mark per section, in the order the frame reaches them.
 *
 * ── Adding a section ────────────────────────────────────────────────────────
 *
 * This array is the rail, and it is the only place the rail is written down.
 * A new section needs one entry here, and `SectionRail.tsx` will not compile
 * until its `name` is given a label, so the two cannot drift apart.
 *
 * `from` is the beat the section takes the frame on. A mark owns the scroll
 * from there until the next mark's `from`, which is what decides the one that
 * is lit, so the marks cover the timeline with no gaps and no overlaps and the
 * boundaries land on the plate handovers.
 *
 * `at` is where the mark *goes*, as a fraction of a beat, and it is deliberately
 * not the same point. A section starts arriving at its cue and is not composed
 * until a good deal later — jumping to the cue would land on a headline
 * mid-blur with its panel still assembling. These land on each section at rest:
 * the panel built, the closing sentence complete, section 6's statement whole
 * and not yet lifting. Both come off the same beat table the rest of the
 * sequence runs on, so retiming a beat moves the rail with it.
 */
export const RAIL = [
  { name: "hero", from: "turn", at: ["turn", 0] },
  { name: "panel1", from: "prey", at: ["prey", 0.93] },
  { name: "panel2", from: "draw", at: ["draw", 0.85] },
  { name: "panel3", from: "strike", at: ["strike", 0.88] },
  // Section 5 spans three beats; it is whole when the last word goes white,
  // which `LEARN_LEAD` now puts at 95–97% of `learn` depending on how many
  // words the locale's sentence has. Past all of them.
  { name: "closing", from: "arrow", at: ["learn", 0.99] },
  { name: "miss", from: "miss", at: ["miss", 0.34] },
  // Below the film, and so not beats at all: elements in ordinary flow. The
  // mark goes to where the element *is*, read at click time, because a
  // document's offsets are not fixed the way a timeline's are.
  { name: "dark", flow: "[data-dark]" },
  { name: "partners", flow: "[data-partners]" },
  { name: "testimonials", flow: "[data-testimonials]" },
  { name: "archetypes", flow: "[data-archetypes]" },
] as const;

/**
 * The sections below the film, as one selector.
 *
 * Every one of them reveals the same way — blocks that rise on the way in and
 * stay risen — so the controller only needs to know which element a rising
 * block belongs to. Written once here and read by `RAIL` and by the riser pass
 * alike, so a fourth section is one line rather than three.
 */
const FLOW_SECTIONS = RAIL.filter((s) => "flow" in s)
  .map((s) => (s as { flow: string }).flow)
  .join(", ");

/**
 * A jump is travelled, not teleported.
 *
 * The whole sequence is one continuous shot, and every frame of it is a pure
 * function of scroll position — so a scrolled jump *plays* the footage between
 * where the viewer is and where they asked to go, which is the only transition
 * this site could honestly have. The browser's own smooth scroll is no use for
 * it: Blink caps the duration well under a second, and nine thousand pixels in
 * under a second is a blur, not a shot.
 *
 * Keyed to distance so a neighbouring section is brisk and the full length of
 * the film is still a travelling shot rather than a smear.
 */
const GLIDE_MS = [620, 1400];

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

  var reduced = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── beat boundaries, as fractions of total scroll ────────────────────────
  var total = 0, i;
  for (i = 0; i < BEATS.length; i++) total += BEATS[i][1];

  // The beat table is the source of truth for how long the timeline is, and the
  // token in tokens.css is only the no-JS fallback. They drifted the first time
  // a beat was added and the sequence ran off the end of its own track, so the
  // controller states it rather than trusting the two to be kept in step. This
  // runs before first paint, so the track is never the wrong height for a frame.
  root.style.setProperty('--timeline-vh', total);
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
    var ARROW_PLATE = PLATES.indexOf('arrow'), MISS_PLATE = PLATES.indexOf('miss');

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

    function paintArrow(ap, lp, dp) {
      if (!arrow) return;

      // dp is the departure window: the text leaves before its plate does.
      var gone = ease(span(dp, DEPART_TEXT[0], DEPART_TEXT[1]));
      if (ap > 0 && gone < 1) arrow.setAttribute('data-active', '');
      else arrow.removeAttribute('data-active');

      arrow.style.setProperty('--head', ease(span(ap, ARROW_AT, ARROW_AT + ARROW_SPAN)));
      arrow.style.setProperty('--body', ease(span(ap, BODY_AT, BODY_AT + BODY_SPAN)));
      arrow.style.setProperty('--lit', clamp01(lp / LEARN_LEAD) * (words + LEARN_FADE));
      // Linear, and it completes with the beat — this is the fraction of the
      // perimeter the ring has been drawn to, not an opacity.
      arrow.style.setProperty('--glow', clamp01(lp / GLOW_LEAD));
      arrow.style.setProperty('--exit', gone);
    }

    // ── section 6 ──────────────────────────────────────────────────────────
    var miss = document.querySelector('[data-miss]');
    var traitEls = miss ? miss.querySelectorAll('[data-trait]') : [];
    var dotEls = miss ? miss.querySelectorAll('[data-dot]') : [];

    function paintMiss(mp, tp, fp) {
      if (!miss) return;

      // Section 6 lifts away over the fall beat, ahead of its own plate.
      var gone = ease(span(fp, FALL_TEXT[0], FALL_TEXT[1]));
      miss.style.setProperty('--exit', gone);
      if (mp > 0 && gone < 1) miss.setAttribute('data-active', '');
      else miss.removeAttribute('data-active');

      // The headline lands on the impact, and the block lifts as the stag runs,
      // so the words travel with the animal instead of watching it go.
      miss.style.setProperty('--head', ease(span(mp, MISS_STRUCK, MISS_STRUCK + MISS_SPAN)));
      miss.style.setProperty('--lift', ease(span(mp, MISS_BOLTS, MISS_BOLTS + MISS_LIFT)));
      // Once the frame is empty the statement gives way to the features.
      miss.style.setProperty('--told', ease(span(mp, MISS_CLEARS, 1)));

      // One feature per stretch of the beat: each slides in, holds, slides out,
      // and the whole thing reverses if the wheel does.
      var n = traitEls.length;
      if (!n) return;
      // Scaled so the deck is complete at TRAIT_LEAD of the beat rather than at
      // (n - 1 + hold) / n of it, which left the last quarter doing nothing.
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
    }

    // ── the document below the film ────────────────────────────────────────
    //
    // These sections are a page, not a reel: they stack vertically, they scroll
    // like anything else, and their content arrives *on the way in* and then
    // stays. Two mechanisms, and both are needed.
    //
    // The first is the arrival, and it is two steps in a fixed order: the head
    // — the title, and in section 7 the orb behind it — comes up on the first
    // part of the section's entry, and the body follows on the rest. Scrubbed
    // by the wheel rather than played at the viewer, and kept at a high-water
    // mark, so once a section has arrived scrolling back through it is only
    // scrolling.
    //
    // The measure is how far the section has climbed, over a screen of scroll —
    // *less whatever screen this particular section does not have*. Every
    // section but the last can travel a full screen from the moment its top
    // edge touches the bottom of the frame; the last one runs out of document
    // first, and how much sooner is exactly how far past the end of the scroll
    // its top edge would have to go. Taking that off the travel is what lets
    // one rule give every section the same unhurried two-step and still finish
    // the last one at the foot of the page. A fixed screen leaves the last
    // section permanently half-built; the section's own height instead makes
    // the entry as short as the section is, which on a phone is no entry at all.
    var flows = [];
    each(FLOW_SECTIONS, function (el) {
      flows.push({ el: el, head: 0, body: 0 });
    });

    function stage(win, v) { return clamp01((v - win[0]) / (win[1] - win[0])); }

    function paintFlow() {
      var h = window.innerHeight;
      var end = document.documentElement.scrollHeight - h;
      for (var i = 0; i < flows.length; i++) {
        var f = flows[i];
        var box = f.el.getBoundingClientRect();
        // How far above the frame's bottom edge this section's top can ever
        // get: a screen, unless the document runs out before it does.
        var travel = h - Math.max(0, box.top + window.scrollY - end);
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

    // The second is the drift in section 8, which is an animation rather than a
    // reveal — it only needs to know whether to run at all.
    var REVEAL_IN = 0.3;

    each('[data-reveal]', function (el) {
      // No observer, no reveal, and the CSS holds nothing back — so with the
      // API missing the section is simply, statically there.
      if (!window.IntersectionObserver) {
        el.setAttribute('data-in', '');
        el.setAttribute('data-on', '');
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        for (var e = 0; e < entries.length; e++) {
          if (entries[e].intersectionRatio >= REVEAL_IN) {
            el.setAttribute('data-in', '');
            io.disconnect();
          }
        }
      }, { threshold: [REVEAL_IN] });
      io.observe(el);
    });

    // The orb compiles when its own section is within a screen of the frame,
    // which is the document's version of fetching a plate a beat ahead.
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
    // CSS transition on the panel itself, so there is no timeline here to keep
    // in step with anything and nothing to tear down.
    //
    // The panel that opens on load is marked open in the markup rather than
    // here, so the section is composed before this runs and stays composed if
    // it never does.
    var gallery = document.querySelector('[data-gallery]');
    if (gallery) {
      var pads = [];
      each('[data-cast-panel]', function (el) { pads[+el.getAttribute('data-cast-panel')] = el; }, gallery);
      // Hover belongs to a mouse. On a touch screen a tap arrives as a pointer
      // that also enters, and opening on enter would make the first tap open a
      // panel the finger is only passing over.
      var fine = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;

      var openPanel = function (i) {
        gallery.setAttribute('data-open', i);
        for (var p = 0; p < pads.length; p++) {
          if (p === i) pads[p].setAttribute('data-on', '');
          else pads[p].removeAttribute('data-on');
          pads[p].setAttribute('aria-pressed', p === i ? 'true' : 'false');
        }
      };

      var bind = function (i, el) {
        el.addEventListener('pointerenter', function (e) {
          if (e.pointerType === 'mouse' && (!fine || fine.matches)) openPanel(i);
        });
        el.addEventListener('click', function () { openPanel(i); });
        el.addEventListener('focus', function () { openPanel(i); });
        el.addEventListener('keydown', function (e) {
          var k = e.key;
          var step = k === 'ArrowRight' || k === 'ArrowDown' ? 1
            : k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          // The row mirrors with the writing direction, so the arrows do too —
          // otherwise right-arrow walks left in Persian and Arabic.
          if ((k === 'ArrowRight' || k === 'ArrowLeft') && root.dir === 'rtl') step = -step;
          pads[(i + step + pads.length) % pads.length].focus();
        });
      };
      for (var pi = 0; pi < pads.length; pi++) bind(pi, pads[pi]);
    }

    // ── the section rail ───────────────────────────────────────────────────
    //
    // The rail spans both halves of the site. Its first marks are beats of the
    // film and resolve from the beat table; its last are elements in ordinary
    // flow and resolve from where those elements are. A document's offsets move
    // — fonts land, the viewport changes — so the flow marks are measured when
    // they are needed rather than cached at boot.
    var marks = [];
    each('[data-rail-mark]', function (el) {
      marks[+el.getAttribute('data-rail-mark')] = el;
    });

    var railAt = [], railFrom = [], railFlow = [];
    for (i = 0; i < RAIL.length; i++) {
      if (RAIL[i].flow) {
        railFlow.push(document.querySelector(RAIL[i].flow));
        railAt.push(null);
        railFrom.push(null);
      } else {
        var re = edge[RAIL[i].at[0]];
        railFlow.push(null);
        railAt.push(re[0] + (re[1] - re[0]) * RAIL[i].at[1]);
        railFrom.push(edge[RAIL[i].from][0]);
      }
    }

    // Where a mark goes, in document pixels.
    function railTarget(m) {
      var el = railFlow[m];
      if (el) return el.getBoundingClientRect().top + window.scrollY;
      return railAt[m] * filmMax;
    }

    function paintRail() {
      var on = 0;

      // Below the film the lit mark is whichever flow section holds the middle
      // of the frame — the same question the beat ranges answer above it, asked
      // of a document instead of a timeline.
      var mid = window.scrollY + window.innerHeight / 2;
      var inFlow = false;
      for (var m = 0; m < railFlow.length; m++) {
        var el = railFlow[m];
        if (!el) continue;
        var box = el.getBoundingClientRect();
        var top = box.top + window.scrollY;
        if (mid >= top && mid < top + box.height) { on = m; inFlow = true; }
      }

      if (!inFlow) {
        var p = filmMax > 0 ? clamp01(window.scrollY / filmMax) : 0;
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

    // The argument is a document offset in pixels.
    function goTo(where) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var to = Math.round(Math.max(0, Math.min(where, max)));
      var from = window.scrollY;
      var dist = Math.abs(to - from);
      stopGlide();
      if (reduced || dist < 2) { window.scrollTo(0, to); return; }

      var ms = GLIDE_MS[0] + clamp01(dist / (max || 1)) * GLIDE_MS[1];
      var t0 = performance.now();
      (function step(now) {
        var t = clamp01((now - t0) / ms);
        window.scrollTo(0, from + (to - from) * ease(t));
        glide = t < 1 ? requestAnimationFrame(step) : null;
      })(t0);
    }

    for (i = 0; i < marks.length; i++) {
      (function (m) {
        if (!marks[m]) return;
        marks[m].addEventListener('click', function () { goTo(railTarget(m)); });
      })(i);
    }

    // Section 6's dots drive the deck as well as read it. Each lands where its
    // own slide is fully in, which is the inverse of the reach the carousel is
    // painted from: reach = (tp / TRAIT_LEAD) * (n - 1 + hold), and a slide is
    // whole at reach = t + hold. Same travelled jump as the rail, so the deck
    // runs to the slide instead of cutting to it.
    if (dotEls.length) {
      var tb = edge.traits, tw = tb[1] - tb[0];
      var reachAll = (dotEls.length - 1) + TRAIT_HOLD;
      for (i = 0; i < dotEls.length; i++) {
        (function (t) {
          var tp = TRAIT_LEAD * (t + TRAIT_HOLD) / reachAll;
          dotEls[t].addEventListener('click', function () {
            goTo((tb[0] + tp * tw) * filmMax);
          });
        })(i);
      }
    }

    // The wheel always wins. A jump in flight is abandoned the moment the
    // viewer takes the scroll back, rather than fighting them for it.
    var takeover = ['wheel', 'touchstart', 'keydown'];
    for (i = 0; i < takeover.length; i++) {
      window.addEventListener(takeover[i], stopGlide, { passive: true });
    }

    function apply() {
      // Against the *track*, not the document. The document now continues past
      // the film into ordinary sections, and measuring the whole of it would
      // stretch every beat over content the film has nothing to do with. The
      // film completes exactly as the track's last screen goes by, which is the
      // moment the first flow section reaches the bottom of the frame.
      var p = filmMax > 0 ? clamp01(window.scrollY / filmMax) : 0;
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
      var opacity = [];
      for (i = 0; i < plateEls.length; i++) opacity.push(i === top ? 1 : 0);

      // The one handover that is not a cut. The closing plate is a black studio
      // frame and the plate after it is a forest at dawn, so there is nothing
      // continuous to cut on. It dips through black instead: the arrow fades
      // down, the frame is empty for a moment, then the morning fades up. The
      // two are never on screen together, so the one-plate rule still holds.
      var db = edge.depart, dw = db[1] - db[0];
      var out = span(p, db[0] + DEPART_PLATE[0] * dw, db[0] + DEPART_PLATE[1] * dw);
      var into = span(p, db[0] + ARRIVE_PLATE[0] * dw, db[0] + ARRIVE_PLATE[1] * dw);
      if (shown && p > db[0] && p < db[1]) {
        opacity[ARROW_PLATE] = 1 - out;
        opacity[MISS_PLATE] = into;
      }

      // The end of the sequence. There is no plate after the forest, so it goes
      // down to the page's own black rather than handing over to another shot,
      // and section 7 is composed on that ground.
      var fb = edge.fall, fw = fb[1] - fb[0];
      if (shown && p > fb[0]) {
        opacity[MISS_PLATE] =
          1 - span(p, fb[0] + FALL_PLATE[0] * fw, fb[0] + FALL_PLATE[1] * fw);
      }

      for (i = 0; i < plateEls.length; i++) {
        if (!plateEls[i]) continue;
        plateEls[i].style.setProperty('--o', opacity[i]);
        if (opacity[i] > 0.001) plateEls[i].setAttribute('data-plate-on', '');
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
        shown ? span(p, edge.learn[0], edge.learn[1]) : 0,
        shown ? span(p, edge.depart[0], edge.depart[1]) : 0
      );
      paintMiss(
        shown ? span(p, edge.miss[0], edge.miss[1]) : 0,
        shown ? span(p, edge.traits[0], edge.traits[1]) : 0,
        shown ? span(p, edge.fall[0], edge.fall[1]) : 0
      );

      paintFlow();
      paintRail();

      // Past the film the site is a page, and a page's content scrolls *under*
      // its bar. The bar is transparent over the footage by design — over
      // moving copy it just looks like a collision — so it takes the page's own
      // ground from here on.
      if (window.scrollY > filmMax - window.innerHeight * 0.5) {
        root.setAttribute('data-past-film', '');
      } else {
        root.removeAttribute('data-past-film');
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

    var track = document.querySelector('[data-track]');
    var bar = document.querySelector('header');
    var filmMax = 0;
    function measure() {
      filmMax = track ? track.offsetHeight - window.innerHeight : 0;
      if (filmMax < 1) filmMax = 1;
      // The bar is a layer above the document now, so on compact frames the
      // stage can no longer size a row from it. Its real height is published
      // instead, and the stage holds that much open.
      if (bar) root.style.setProperty('--chrome-h', bar.offsetHeight + 'px');
    }
    measure();

    // The bar's height is not settled at this point: it is measured with
    // fallback metrics and grows when the faces land, which left the compact
    // spacer four pixels short and the scene four pixels under the bar. Watch
    // the bar itself rather than guessing when it has stopped moving.
    if (bar && window.ResizeObserver) new ResizeObserver(measure).observe(bar);
    else if (bar && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure);
    }

    var queued = false;
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; apply(); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { measure(); onScroll(); });
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
