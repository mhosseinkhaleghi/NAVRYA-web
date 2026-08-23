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
 * Everything after the intro is a pure function of scroll position. The
 * controller moves that position between complete story states, one at a time,
 * so the wheel is an intent rather than a scrubber. The beats are still driven
 * by `--r` / `--exit` / `--o` custom properties instead of CSS transitions or
 * keyframes, which keeps every existing composition and cue intact.
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
 * The real duration of each beat, in seconds.
 *
 * Video beats use the source clip's duration. The composited beats between
 * clips have no video clock, so they retain the existing 70vh-per-second
 * pacing. This makes magnetic travel play every actual shot at normal speed.
 */
const BEAT_SECONDS = [
  ["turn", 3],
  ["prey", 5.041667],
  ["draw", 5.041667],
  ["strike", 7.041667],
  ["clear", 160 / 70],
  ["arrow", 6.7],
  ["learn", 340 / 70],
  ["depart", 150 / 70],
  ["miss", 4.4],
  ["traits", 560 / 70],
  ["fall", 180 / 70],
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

/** One intentional scroll travels to one complete story state. */
const STORY_INPUT_HOLD_MS = 650;

/*
 * A held gesture used to run the film at 3.5x once it was 30% through a travel.
 *
 * It is gone, and the reason is the whole point of the thing it was speeding
 * up. A magnetic travel already takes exactly as long as the footage it crosses
 * — `travelStory` sets its duration from `filmSecondsAt`, so the shot plays at
 * its own rate and the scroll is the projector. Multiplying that is not "faster
 * navigation", it is running the film at 3.5x, and on the features page's dive
 * it meant the entire descent from above the map into the council room went
 * past in a third of a second. Measured at 2.91x through the shot on a
 * continuous gesture against 1.13x on single ones: the same footage, and only
 * one of those is a shot anybody can watch.
 *
 * A held gesture still moves continuously — `storyDirection` chains straight
 * into the next state when one completes, which is the behaviour that was
 * wanted. What it no longer does is skip the pictures on the way.
 */

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

  /*
   * The sequence, and which page's sequence it is.
   *
   * This controller is one inline script shared by every page, and the tables
   * below are the home page's film. A second page with a film of its own says
   * so on its track element and these are read from there instead — same
   * mechanism, same rules, its own shots.
   *
   * JSON on an attribute rather than a second script: there is no client bundle
   * on this site and nothing to pass arguments through, and the alternative was
   * a second copy of everything under this line.
   */
  var HOME_BEATS = ${JSON.stringify(BEATS)};
  var HOME_BEAT_SECONDS = ${JSON.stringify(BEAT_SECONDS)};
  var HOME_SCENES = ${JSON.stringify(SCENES)};
  var HOME_PLATES = ${JSON.stringify(PLATES)};
  var HOME_PLATE_BEAT = ${JSON.stringify(PLATE_BEAT)};
  var BEATS = HOME_BEATS;
  var BEAT_SECONDS = HOME_BEAT_SECONDS;
  var SCENES = HOME_SCENES;
  var PLATES = HOME_PLATES;
  var PLATE_BEAT = HOME_PLATE_BEAT;
  var REVEAL = ${INTRO_REVEAL_AT};
  var TITLE_SPAN = ${TITLE_SPAN}, REST_SPAN = ${REST_SPAN};
  var HOME_HERO_EXIT = ${JSON.stringify(HERO_EXIT)};
  var HERO_EXIT = HOME_HERO_EXIT;
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
  var STORY_INPUT_HOLD_MS = ${STORY_INPUT_HOLD_MS};

  var reduced = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── beat boundaries, as fractions of total scroll ────────────────────────
  var total = 0, i;
  var edge = {};
  var secondsByBeat = {};

  /*
   * Resolve which film this page is running, and everything measured from it.
   *
   * Called twice, and it has to be. This script is the first thing in the body
   * so that it can hold the interface back before a single frame is painted —
   * which means the track element it would read the page's sequence from has
   * not been parsed yet. The first call therefore gets the home tables and
   * sizes the track for them; the second runs the moment the DOM is ready,
   * finds the attributes, and re-measures.
   *
   * The page states the same total in an inline style on the track itself, so
   * the height is right in the served HTML and nothing shifts between the two
   * calls. This is what makes the numbers *agree*; the style is what makes them
   * arrive on time.
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
    BEAT_SECONDS = declared('beat-seconds', HOME_BEAT_SECONDS);
    SCENES = declared('scenes', HOME_SCENES);
    PLATES = declared('plates', HOME_PLATES);
    PLATE_BEAT = declared('plate-beat', HOME_PLATE_BEAT);
    /*
     * When the opening leaves, as a fraction of the first beat.
     *
     * It has to travel with the film rather than be a constant, because what it
     * measures is a moment in a shot, not a distance down a page. The home
     * film's first beat is three seconds of a man turning round, and the words
     * hold for half of it. A film whose first beat is its only beat would keep
     * the opening on screen through more than half the page on the same
     * numbers, with the next slide's headline already arriving underneath it.
     */
    HERO_EXIT = declared('hero-exit', HOME_HERO_EXIT);

    total = 0;
    for (var k = 0; k < BEATS.length; k++) total += BEATS[k][1];

    // The beat table is the source of truth for how long the timeline is, and
    // the token in tokens.css is only the no-JS fallback. They drifted the first
    // time a beat was added and the sequence ran off the end of its own track,
    // so the controller states it rather than trusting the two to be kept in
    // step.
    root.style.setProperty('--timeline-vh', total);

    edge = {};
    var run = 0;
    for (k = 0; k < BEATS.length; k++) {
      edge[BEATS[k][0]] = [run / total, (run + BEATS[k][1]) / total];
      run += BEATS[k][1];
    }

    secondsByBeat = {};
    for (k = 0; k < BEAT_SECONDS.length; k++) {
      secondsByBeat[BEAT_SECONDS[k][0]] = BEAT_SECONDS[k][1];
    }
  }
  readSequence();

  /*
   * How tall a frame the timeline is measured against.
   *
   * The track's length used to be pure vh, and that is a loop as soon as the
   * page is in a frame something else sizes to its content: a taller frame
   * makes a taller document, which makes a taller frame. Measured in a 4000px
   * frame the document came out 151,900px, and every scroll made the end
   * recede — the sections after the film could not be reached by wheel at all,
   * while the rail, which jumps by script, still got there.
   *
   * Clamping cuts the loop. Once the frame is past the ceiling the length stops
   * changing, so the second measurement equals the first and it settles. The
   * range covers every real viewport; past it the number is a constant.
   */
  var FRAME_MIN = 380, FRAME_MAX = 1100;
  function frameH() {
    var h = window.innerHeight || FRAME_MAX;
    return h < FRAME_MIN ? FRAME_MIN : h > FRAME_MAX ? FRAME_MAX : h;
  }
  function sizeTrack() {
    root.style.setProperty('--track-px', Math.round((total / 100) * frameH()) + 'px');
  }
  sizeTrack();

  // The second read, before anything else that runs on ready — the scene table
  // and the plate list are built from these, so they have to be this page's by
  // the time that happens.
  ready(function () { readSequence(); sizeTrack(); });

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
  //     exists, and again on the load event.
  //   · the back/forward cache — a restored page keeps its scroll offset *and*
  //     every video's playhead, so the sequence resumes mid-shot with the
  //     opening already over. There is nothing to rewind into; the page is
  //     reloaded outright, which is also what makes a language change replay
  //     from the top after the viewer navigates back to it.
  //
  // Every one of those resets is off-limits the moment the viewer has moved the
  // page themselves. The load event waits on the last byte of the last plate,
  // and in the single-file preview that is megabytes of base64 — so it can land
  // long after someone has started scrolling, and it used to take them back to
  // the top when it did. Scrolling far enough to reach the sections below the
  // film takes long enough that this was almost guaranteed to happen on the way.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  var touched = false;
  function markTouched() { touched = true; }
  var TOUCHES = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
  for (var ti = 0; ti < TOUCHES.length; ti++) {
    window.addEventListener(TOUCHES[ti], markTouched, { passive: true, capture: true });
  }
  function toTop() { if (!touched) window.scrollTo(0, 0); }
  toTop();
  ready(toTop);
  window.addEventListener('load', toTop);
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) { toTop(); return; }
    // Reloading is the clean way to rewind a restored page, but inside a frame
    // the whole site is one multi-megabyte file and a reload is a long stall in
    // front of the viewer. Rewound in place there instead.
    if (window.top === window) { location.reload(); return; }
    touched = false;
    toTop();
  });

  // Two separate gates. \`intro\` raises the interface, on the frame the hunter
  // turns. \`timeline\` unlocks the scroll, and waits for the plate to reach its
  // *last* frame — which is the frame the next plate opens on. Releasing the
  // wheel while the opening was still running let the viewer cut away from the
  // middle of it, and the sequence jumped by however much was left.
  root.dataset.timeline = 'held';
  function live() { root.dataset.timeline = 'live'; }

  // ── warming the plates ───────────────────────────────────────────────────
  //
  // Every plate is fetched, in scroll order, starting as soon as the opening
  // beat is over. Not lazily, and not a beat ahead.
  //
  // A beat of lookahead was the right amount of warning when crossing a beat
  // meant several seconds of wheeling. A magnetic step crosses one in about a
  // second, and a five-megabyte plate does not arrive in a second, so the
  // viewer landed on shot after shot with nothing behind it — metadata only, no
  // frames. Measured on a 12Mbps line: eight of twelve stops had no picture.
  //
  // Sequential, not all at once, and that is the point. Seven parallel
  // downloads share the line seven ways and the plate you need *next* arrives
  // as slowly as the one you need last; one at a time means the next plate is
  // always the one being paid for. \`want\` jumps the queue when the viewer
  // reaches a plate the chain has not got to yet, so priority follows them.
  var loaded = {};
  function load(id) {
    if (loaded[id]) return false;
    var v = document.querySelector('[data-scene-video="' + id + '"]');
    if (!v) return false;
    loaded[id] = true;
    // One \`load()\`, and only from \`none\`. Calling it on an element that has
    // already fetched something restarts the resource selection algorithm and
    // throws that away — measured at three times the bytes and five seconds
    // added to the opening when every plate was reset this way.
    if (v.getAttribute('preload') === 'none') { v.preload = 'auto'; v.load(); }
    return true;
  }

  // A plate is warm enough to hand on when it can play through, and a slow or
  // dead one must not hold the queue, so the chain also moves on a timeout.
  var WARM_STEP_MS = 8000;
  function warmChain(order, i) {
    while (i < order.length && loaded[order[i]]) i++;
    if (i >= order.length) return;
    var id = order[i];
    var v = document.querySelector('[data-scene-video="' + id + '"]');
    load(id);
    if (!v) { warmChain(order, i + 1); return; }
    /*
     * A plate that can already play through is done, and waiting on it is
     * waiting for an event that has already happened.
     *
     * This cost eleven seconds of an idle line. The chain's first entry was the
     * opening plate — excluded on the home film by name, not by role, so any
     * other film handed it straight back — and that plate had finished at
     * 1.3s. \`canplaythrough\` had long since fired, the listener below caught
     * nothing, and the queue sat on the timeout while the viewer scrolled onto
     * plates that had not been asked for yet.
     */
    if (v.readyState >= 4) { warmChain(order, i + 1); return; }
    var moved = false;
    var next = function () {
      if (moved) return;
      moved = true;
      clearTimeout(timer);
      warmChain(order, i + 1);
    };
    var timer = setTimeout(next, WARM_STEP_MS);
    v.addEventListener('canplaythrough', next);
    v.addEventListener('error', next);
  }

  // The light tier is the only thing on the page fetched before the viewer asks
  // for anything, and that is a privilege it has to earn back.
  //
  // Marked \`preload="auto"\` it began at parse time, alongside the opening
  // plate — the one thing the interface actually waits on. Measured against the
  // live site by aborting the tier and watching the opening arrive, twice each:
  //
  //   with the tier   dawn 5952ms / 5514ms   unlock 10491ms / 10105ms
  //   tier aborted    dawn 2974ms / 3212ms   unlock  6767ms /  6929ms
  //
  // It doubled the opening plate's arrival and cost three and a half seconds
  // before anything could be looked at. Worth knowing: this did not reproduce
  // against a local server under the same emulated throttle — loopback had the
  // bytes either way — so the local reading said there was nothing here. The
  // live experiment is the one that settled it.
  //
  // So it waits. Nothing shares the line with the opening plate until that
  // plate is playing; from there the tier has the whole length of the shot to
  // arrive, which at 1.8MB is about a second of a five-second run.
  var proxiesWarmed = false;
  function warmProxies() {
    if (proxiesWarmed) return;
    proxiesWarmed = true;
    each('[data-scene-proxy]', function (el) {
      if (el.getAttribute('preload') === 'none') { el.preload = 'auto'; el.load(); }
    });
  }

  // Once started, the light tier must not be made to share the line with the
  // heavy one either. Started together, the shipping plates starved the proxies
  // and neither was ready: measured, every proxy still at metadata by the time
  // the viewer was three steps in.
  /*
   * The shipping plates, in the order they are watched.
   *
   * The lead is skipped because it is already on screen — it is the shot the
   * opening plays, and it was fetched outright before anything else. It used to
   * be skipped by *name*: \`PLATES[q] !== 'dawn'\`, which is what the home film
   * calls its lead and what every other film does not.
   */
  var chainStarted = false;
  function startWarmChain() {
    if (chainStarted) return;
    chainStarted = true;
    var order = [];
    for (var q = 0; q < PLATES.length; q++) {
      if (PLATE_BEAT[q]) order.push(PLATES[q]);
    }
    whenProxiesReady(function () { warmChain(order, 0); });
  }

  // A stalled opening must not hold the shipping plates back for ever.
  var OPENING_WAIT_MS = 9000;
  var PROXY_WAIT_MS = 6000;
  function whenProxiesReady(done) {
    var proxies = [];
    each('[data-scene-proxy]', function (el) { proxies.push(el); });
    if (!proxies.length) { done(); return; }

    var left = proxies.length, fired = false;
    function finish() { if (fired) return; fired = true; clearTimeout(cap); done(); }
    function tick() { if (--left <= 0) finish(); }
    // A parameter, so each element gets its own binding — see bindPlate.
    function watch(el) {
      if (el.readyState >= 3) { tick(); return; }
      var once = false;
      var go = function () {
        if (once) return;
        once = true;
        tick();
      };
      el.addEventListener('canplaythrough', go);
      el.addEventListener('error', go);
    }
    for (var i = 0; i < proxies.length; i++) watch(proxies[i]);
    // A stalled proxy must not hold the shipping plates back for ever.
    var cap = setTimeout(finish, PROXY_WAIT_MS);
  }

  function reveal() {
    if (root.dataset.intro === 'shown') return;
    root.dataset.intro = 'shown';
    // The whole sequence, in the order it is watched. The light copies first —
    // they are what make the film run from the first gesture — and the shipping
    // plates behind them, one at a time, upgrading each shot as it arrives.
    ready(function () {
      // Also here, not only from \`start\`: the opening can be skipped entirely —
      // autoplay refused, no decoder, or the line too slow for the patience
      // timer — and on those paths the light tier still has to be sent for.
      warmProxies();
      // The rest of the tier, once the opening has finished being watched.
      startWarmChain();
    });
  }

  if (reduced) {
    root.dataset.intro = 'shown';
    live();
  } else {
    root.dataset.intro = 'armed';
    ready(function () {
      var opening = document.querySelector('[data-plate-lead]');
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
        /*
         * The opening has what it needs and is about to run. Everything else on
         * the page may have the line now, and has the length of the shot to use
         * it — the light tier first, because it is what the first gesture draws,
         * and the shipping plates behind it.
         *
         * The chain used to wait for the reveal, which is the *end* of the
         * opening. Measured on this page, that left the line idle from 1.3s,
         * when the opening plate and every proxy had landed, until 12.9s — and
         * the viewer was already scrolling at 5.5s, onto plates still at
         * metadata. Starting here spends the length of the shot instead of
         * throwing it away, and takes nothing from the opening: that plate has
         * already buffered by the time this runs.
         */
        warmProxies();
        /*
         * The heavy tier waits for the opening plate to be *finished*, not
         * merely playable.
         *
         * The light tier may start here — that is measured and settled above.
         * The shipping plates are a different weight of thing: on the home film
         * they are fourteen megabytes, and starting them at the same moment put
         * 550ms back onto the opening, which is the regression the note above
         * this function exists to prevent. Waiting for \`canplaythrough\` costs
         * the feature page nothing — its opening plate lands at 1.7s and the
         * shot runs to 5.5s — and gives the home film its line back.
         */
        /*
         * One plate ahead during the opening, and only one.
         *
         * The first gesture lands on the film's first shot, and on a page whose
         * opening is short that shot was still at metadata when the viewer got
         * there — measured on the features page, the whole heavy tier had not
         * been asked for until 12.9s against an unlock at 5.5s.
         *
         * Warming the *whole* chain here instead is worse than the problem: six
         * 1080p plates preloading at once cost the home film 580ms on its
         * unlock, and not for want of bandwidth — the opening plate had already
         * landed by then — but because demuxing fourteen megabytes competes
         * with playing the shot that is on screen. One plate is the amount that
         * helps the next gesture without taking anything from the current one.
         */
        whenOpeningBuffered(function () {
          for (var f = 0; f < PLATES.length; f++) {
            if (PLATE_BEAT[f]) { load(PLATES[f]); break; }
          }
        });

        /*
         * "Finished" means the bytes are here, not that the browser is
         * optimistic about them.
         *
         * \`canplaythrough\` is an estimate against the current line, and on the
         * home film it fired at 2.1s for a plate that did not finish arriving
         * until 3.6s — so the fourteen megabytes behind it started while the
         * opening was still downloading and put 550ms back onto the unlock.
         * Buffered coverage is the same test this controller uses everywhere
         * else to decide whether a plate can really be drawn, and it is the
         * right one here too. Capped, so an opening that stalls cannot starve
         * everything behind it for ever.
         */
        function whenOpeningBuffered(done) {
          var fired = false;
          function covered() {
            var b = opening.buffered;
            return opening.duration && b.length &&
              b.end(b.length - 1) >= opening.duration - 0.05;
          }
          function fire() {
            if (fired) return;
            fired = true;
            clearTimeout(cap);
            opening.removeEventListener('progress', check);
            opening.removeEventListener('canplaythrough', check);
            done();
          }
          function check() { if (covered()) fire(); }
          var cap = setTimeout(fire, OPENING_WAIT_MS);
          if (covered()) { fire(); return; }
          opening.addEventListener('progress', check);
          opening.addEventListener('canplaythrough', check);
        }
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
    // The wanted position is kept as a *fraction*, not as a time, and it is
    // kept even when the plate has no duration yet.
    //
    // It used to be dropped on the floor in that case, and that is a second
    // way the picture went missing: a magnetic step lands, the plate it landed
    // on is still arriving, the seek is discarded — and because the step has
    // finished there are no more scroll events to ask again, so the plate sat
    // on its first frame until the viewer moved. Held here instead, and fired
    // the moment the decoder can honour it.
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
    // Every point at which the answer to "can you place a frame yet?" changes.
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
   * A function rather than inline in the loop, and that is not style. The loop
   * declares its locals with \`var\`, which is scoped to the whole function, so a
   * closure written inside it does not capture the plate of that turn — it
   * captures the one variable every turn shares, and reads whatever the last
   * turn left in it. Written inline, all six plates seeked the sixth. The
   * parameters here are a fresh binding per call, which is the fix.
   *
   * The proxy carries the motion from the first gesture. The full plate stays
   * transparent until it can honour the position it is being given, and
   * \`data-plate-ready\` is what the stylesheet fades in on.
   */
  function bindPlate(full, proxy) {
    var seekFull = scrubber(full);
    var seekProxy = scrubber(proxy);
    if (full) {
      var markReady = function () {
        if (full.readyState >= 3) full.setAttribute('data-plate-ready', '');
      };
      full.addEventListener('canplay', markReady);
      full.addEventListener('canplaythrough', markReady);
      full.addEventListener('seeked', markReady);
      markReady();
    }
    /*
     * The mark is also taken on every scrub, not only when an event says so.
     *
     * Three listeners are three chances to be told, and all three are missed if
     * the plate became ready before this binding — or if the browser simply did
     * not raise one. The cost of missing it is total, because the stylesheet
     * holds an unmarked plate at \`opacity: 0\`: a shot that is fully downloaded
     * stays invisible and the viewer watches the 854×480 stand-in instead, with
     * nothing to recover it. Seen on the deployed build, 100% buffered with no
     * attribute. Asking directly costs one property read and cannot be missed.
     */
    /*
     * When the shipping plate cannot follow, it gets out of the way.
     *
     * The two tiers exist so the light one can carry motion the heavy one
     * cannot, and until now the heavy one covered it the whole time — so what
     * the viewer saw during a travel was whatever the 1080p decoder managed,
     * and nothing better. Measured on the features page's fourth slide, on the
     * real page with the real compositor running: the shipping plate answers 37
     * seeks a second, the proxy 133. A magnetic travel crosses that whole shot
     * in about 1850ms and the shot is 51 frames — so the proxy has three and a
     * half times the throughput it needs and the plate has half of it. What
     * arrived was thirteen stills of a fifty-one frame dive.
     *
     * The signal is the plate's own lag, not the page's velocity. A plate that
     * is keeping up is never touched, on any machine, at any speed — this only
     * fires where the alternative was a frame that is simply wrong, because a
     * plate two frames behind is showing the viewer the past either way. Better
     * the right frame slightly soft than the wrong frame sharp, and while it is
     * engaged the footage is moving fast enough to be motion-blurred in the
     * source, which is what makes the substitution invisible.
     *
     * Hysteresis, because a threshold with one edge oscillates: it steps aside
     * two frames behind and does not come back until it is within half of one.
     */
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
    var opening = document.querySelector('[data-plate-lead]');

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
      scenes.push({
        cfg: cfg,
        seek: bindPlate(video, document.querySelector('[data-scene-proxy="' + cfg.plate + '"]')),
        panel: panel,
        groups: groups,
      });
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

    // ── complete story states ──────────────────────────────────────────────
    //
    // The film stays continuous, but the reader never has to hold a wheel in
    // the middle of it. These are the points where the existing choreography
    // has finished a readable thought. Their positions come directly from the
    // same cue and beat table used by apply, so retiming a scene cannot make
    // the magnetic scroll stop on an unfinished payload.
    function filmPoint(beat, progress) {
      var b = edge[beat];
      return (b[0] + (b[1] - b[0]) * progress) * filmMax;
    }

    function beatSeconds(beat) {
      var video = document.querySelector('[data-scene-video="' + beat + '"]');
      return video && video.duration ? video.duration : secondsByBeat[beat];
    }

    function filmSecondsAt(position) {
      var point = filmMax ? clamp01(position / filmMax) : 0;
      var seconds = 0;
      for (var b = 0; b < BEATS.length; b++) {
        var beat = BEATS[b][0], bounds = edge[beat], duration = beatSeconds(beat);
        if (point <= bounds[1] || b === BEATS.length - 1) {
          return seconds + duration * span(point, bounds[0], bounds[1]);
        }
        seconds += duration;
      }
      return seconds;
    }

    /*
     * The inverse of \`filmSecondsAt\`: where in the document a given second of
     * the film lives. Both walk the same table, so they cannot disagree.
     */
    function filmPositionAtSeconds(seconds) {
      var acc = 0;
      for (var b = 0; b < BEATS.length; b++) {
        var beat = BEATS[b][0], bounds = edge[beat], duration = beatSeconds(beat);
        if (seconds <= acc + duration || b === BEATS.length - 1) {
          var within = duration > 0 ? clamp01((seconds - acc) / duration) : 0;
          return (bounds[0] + (bounds[1] - bounds[0]) * within) * filmMax;
        }
        acc += duration;
      }
      return filmMax;
    }

    /*
     * The travel's shape, in film time.
     *
     * \`ease\` is \`1 - (1-t)^3\`, an ease-out, and its velocity is 3x the average
     * at t=0. Applied to a travel that is carrying a shot, that means the film
     * starts every move at *three times its own speed* and decelerates through
     * it — measured on the features page's dive at 2.91x, and it is why the
     * frames a reader saw were sparse at the head of the shot and bunched at the
     * tail. It reads exactly as the complaint describes: the camera leaves
     * before you have seen it go.
     *
     * A trapezoid instead: ramp in, run the film at exactly its own rate, ramp
     * out. The plateau is 1x by construction, which is what makes this "the
     * video's speed" rather than a nicer-looking guess — the ramps only exist so
     * a travel does not start and stop with a jerk.
     *
     * The duration is divided by (1 - FILM_RAMP) for the same reason: the ramps
     * cover less ground than the plateau would, so the move has to last slightly
     * longer for the middle of it to still run at 1x.
     */
    var FILM_RAMP = 0.15;
    function filmEase(t) {
      var r = FILM_RAMP, k = 2 * r * (1 - r);
      if (t <= r) return (t * t) / k;
      if (t >= 1 - r) { var u = 1 - t; return 1 - (u * u) / k; }
      return (t - r / 2) / (1 - r);
    }

    function filmStates() {
      var states = [{ at: 0, heavy: false }];
      var state = function (at, heavy) { states.push({ at: at, heavy: heavy }); };
      var panelRest = function (beat, cue, rest) {
        return filmPoint(beat, Math.min(1, cue + rest));
      };

      /*
       * A film rests where a panel has finished arriving.
       *
       * Every scene that carries one contributes a stop, taken from its own
       * second cue plus the stagger — which is the moment the last line of that
       * panel is up. Read from the scene table rather than written out, so a
       * film with different shots gets its stops from its own, and retiming a
       * scene moves its stop with it.
       *
       * This was three named beats of the home film. Naming them meant any
       * other film threw on the first wheel event: \`edge\` has no entry for a
       * beat that is not in its table, and the whole controller went down with
       * it — visibly, as a page that would not scroll at all.
       */
      for (var sc = 0; sc < SCENES.length; sc++) {
        var cfg = SCENES[sc];
        if (!cfg.panel || !cfg.cues) continue;
        state(panelRest(cfg.beat, cfg.cues[1], REST_SPAN), true);
      }

      // The sections that follow belong to the home film, and so do the beats
      // that time them. A film without them simply has no stop there.
      if (edge.arrow) {
        // The headline appears during the release. It is not a resting chapter:
        // the fired arrow continues through to the completed payload below.
        state(filmPoint('arrow', BODY_AT + BODY_SPAN), false);
      }
      if (edge.learn) state(filmPoint('learn', 0.99), true);
      if (edge.miss) state(filmPoint('miss', Math.min(1, MISS_STRUCK + MISS_SPAN)), true);

      var n = traitEls.length;
      if (n && edge.traits) {
        var reachAll = (n - 1) + TRAIT_HOLD;
        for (var t = 0; t < n; t++) {
          state(filmPoint('traits', TRAIT_LEAD * (t + TRAIT_HOLD) / reachAll), false);
        }
      }
      // The fall belongs to the handover, not to a readable chapter. The next
      // stop is Section 7 once its complete payload has arrived.
      return states;
    }

    function sectionSevenStop() {
      if (!flows.length) return null;
      var top = flows[0].el.getBoundingClientRect().top + window.scrollY;
      return { at: top - window.innerHeight + window.innerHeight * BODY_IN[1], heavy: true };
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

      // The panels are links now, so open/closed is presentation and not a
      // pressed state — \`aria-pressed\` on a link would announce a toggle that
      // does not exist. What each one announces is its own caption and where it
      // goes, which is true of all four whether or not they are open.
      var openPanel = function (i) {
        gallery.setAttribute('data-open', i);
        for (var p = 0; p < pads.length; p++) {
          if (p === i) pads[p].setAttribute('data-on', '');
          else pads[p].removeAttribute('data-on');
        }
      };

      // Below the stack breakpoint the gallery is not an accordion: every panel
      // is open and every caption is already readable, so there is nothing a
      // tap could usefully reveal.
      var stacked = window.matchMedia ? window.matchMedia('(max-width: 767px)') : null;

      var bind = function (i, el) {
        el.addEventListener('pointerenter', function (e) {
          if (e.pointerType === 'mouse' && (!fine || fine.matches)) openPanel(i);
        });
        // Whether the panel was open *before the finger landed* — which is not
        // the same question as whether it is open now. A tap focuses the link
        // before it clicks it, focus opens the panel, so by the time the click
        // arrives every panel looks open and a guard reading it then would
        // never hold. Read at pointerdown, used at click.
        //
        // It starts true so that Enter on a focused panel, which arrives with
        // no pointerdown at all, follows the link: a reader who tabbed here has
        // had the caption open in front of them since the moment they arrived.
        var wasOpen = true;
        el.addEventListener('pointerdown', function (e) {
          wasOpen = e.pointerType === 'mouse' || el.hasAttribute('data-on');
        });
        el.addEventListener('click', function (e) {
          // A mouse has already opened this panel by hovering it, so its click
          // means the link. A finger has not: the panel under it may still be a
          // sliver with its caption cropped, and following the link from there
          // would send a reader into the product before they could read who
          // they were choosing. So the first tap opens, and the next one goes.
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
        // The rail's marks are named against the home page's beats. A page
        // running its own sequence has none of them, and asking \`edge\` for a
        // beat that is not in the table is how this used to throw before the
        // first frame — taking the whole controller with it.
        var re = edge[RAIL[i].at[0]];
        if (!re) { railFlow.push(null); railAt.push(null); railFrom.push(null); continue; }
        railFlow.push(null);
        railAt.push(re[0] + (re[1] - re[0]) * RAIL[i].at[1]);
        railFrom.push(edge[RAIL[i].from] ? edge[RAIL[i].from][0] : re[0]);
      }
    }

    // Where a mark goes, in document pixels.
    function railTarget(m) {
      var el = railFlow[m];
      if (el) return el.getBoundingClientRect().top + window.scrollY;
      // A mark whose beat is not in this film's table has no position. Saying
      // so beats arithmetic on null, which quietly evaluates to the top of the
      // page and looks exactly like a scroll that refuses to move.
      if (railAt[m] === null) return null;
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

    var glide = null, handoffGlide = false;
    function stopGlide() {
      if (handoffGlide) return;
      if (glide === null) return;
      cancelAnimationFrame(glide);
      glide = null;
    }

    // The argument is a document offset in pixels.
    function goTo(where, done) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var to = Math.round(Math.max(0, Math.min(where, max)));
      var from = window.scrollY;
      var dist = Math.abs(to - from);
      stopGlide();
      if (reduced || dist < 2) {
        window.scrollTo(0, to);
        if (done) done();
        return;
      }

      var ms = GLIDE_MS[0] + clamp01(dist / (max || 1)) * GLIDE_MS[1];
      var t0 = performance.now();
      (function step(now) {
        var t = clamp01((now - t0) / ms);
        window.scrollTo(0, from + (to - from) * ease(t));
        if (t < 1) {
          glide = requestAnimationFrame(step);
          return;
        }
        glide = null;
        if (done) done();
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
    if (dotEls.length && edge.traits) {
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

    // ── magnetic story navigation ─────────────────────────────────────────
    //
    // Native scroll is still the rendering clock. Input no longer writes that
    // clock directly: one wheel, touch or keyboard intent picks the adjacent
    // complete state and this tween carries the playhead there. While it runs,
    // input merely marks the gesture as active. When a state completes, an
    // active gesture advances one further state. When input stops, the last
    // completed state remains the magnetic resting point.
    var storyGlide = null, storyLocked = false, touchY = null;
    var storyStarted = 0, storyDuration = 0;
    var storyFrom = 0, storyTo = 0, storyStartStop = 0, storyEndStop = 0;
    var storyDirection = 0, storyInputUntil = 0;
    var storyTravelDirection = 0;

    function storyStops() {
      var max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      var raw = filmStates();
      var sectionSeven = sectionSevenStop();
      if (sectionSeven) raw.push(sectionSeven);
      raw.sort(function (a, b) { return a.at - b.at; });

      var stops = [];
      for (var s = 0; s < raw.length; s++) {
        var point = Math.round(Math.max(0, Math.min(raw[s].at, max)));
        if (!stops.length || Math.abs(point - stops[stops.length - 1].at) > 2) {
          stops.push({ at: point, heavy: raw[s].heavy });
        }
      }
      return stops;
    }

    function nearestStop(stops, at) {
      var nearest = 0;
      for (var s = 1; s < stops.length; s++) {
        if (Math.abs(stops[s].at - at) < Math.abs(stops[nearest].at - at)) nearest = s;
      }
      return nearest;
    }

    function handoffToSectionSeven() {
      // RAIL's first flow mark is the real Section 7 button target. Reuse it
      // so the final film scroll and the rail button land identically.
      var darkMark = RAIL.findIndex(function (section) { return section.name === 'dark'; });
      if (darkMark < 0) return;
      // A film with nothing after it has no handover, and the mark has no
      // position to give. Without this the target came back as null times the
      // track length — zero — and every wheel glided the page back to the top.
      var to = railTarget(darkMark);
      if (typeof to !== 'number' || !isFinite(to)) return;
      storyDirection = 0;
      handoffGlide = true;
      goTo(to, function () { handoffGlide = false; });
    }

    function travelStory(direction, force, target, origin) {
      if ((!force && storyLocked) || root.dataset.timeline !== 'live' || !direction) return;
      if (typeof target !== 'number') {
        var stops = storyStops();
        var current = nearestStop(stops, window.scrollY);
        var next = Math.max(0, Math.min(stops.length - 1, current + direction));
        if (next === current) return;

        // The last stop is the final Section 6 card. Its forward action is the
        // Section 7 rail button, after which the document scrolls natively.
        // Only where there is a Section 7 to hand over to: on a film that ends
        // with its own last shot, this branch fired on the very first wheel —
        // two stops make the first one \`length - 2\` — and swallowed it.
        if (direction > 0 && flows.length
            && current === stops.length - 2 && next === stops.length - 1) {
          handoffToSectionSeven();
          return;
        }
        target = stops[next].at;
        origin = stops[current].at;
      }

      var from = window.scrollY, to = target, distance = Math.abs(to - from);
      storyLocked = true;
      storyTravelDirection = direction;
      storyStartStop = typeof origin === 'number' ? origin : from;
      storyEndStop = to;
      if (reduced || distance < 2) {
        window.scrollTo(0, to);
        storyLocked = false;
        return;
      }

      /*
       * A travel that carries footage is driven in film time; one that does not
       * keeps the old pixel tween.
       *
       * The difference matters because the beats are not the same length in
       * pixels as they are in seconds — a short shot can own a long stretch of
       * track — so interpolating pixels runs the film at whatever rate that
       * particular beat's exchange happens to be. Interpolating seconds is what
       * makes the shot play at its own speed wherever it sits.
       *
       * Below the film there is nothing to keep in time with, so those travels
       * stay on the pixel tween and its ease-out, which is the right shape for
       * moving a page.
       */
      var filmFrom = filmSecondsAt(from), filmTo = filmSecondsAt(to);
      var carriesFilm = Math.abs(filmTo - filmFrom) > 0.05
        && Math.max(from, to) <= filmMax + 1;
      var ms = Math.max(1, Math.abs(filmTo - filmFrom) * 1000
        / (carriesFilm ? (1 - FILM_RAMP) : 1));
      storyStarted = performance.now();
      storyDuration = ms;
      storyFrom = from;
      storyTo = to;
      (function step(now) {
        var progress = clamp01((now - storyStarted) / storyDuration);
        if (carriesFilm) {
          var at = filmPositionAtSeconds(filmFrom + (filmTo - filmFrom) * filmEase(progress));
          // The endpoints are the stops, not whatever the table rounds to: a
          // resting position that is a pixel off is a resting position the next
          // gesture measures from.
          if (progress >= 1) at = storyTo;
          window.scrollTo(0, at);
        } else {
          window.scrollTo(0, storyFrom + (storyTo - storyFrom) * ease(progress));
        }
        if (progress < 1) {
          storyGlide = requestAnimationFrame(step);
          return;
        }
        storyGlide = null;
        storyLocked = false;
        storyTravelDirection = 0;
        // A held same-direction gesture crosses directly into the next state.
        // Releasing it leaves the completed composition as the resting point.
        if (storyDirection && performance.now() < storyInputUntil) {
          var direction = storyDirection;
          storyDirection = 0;
          travelStory(direction);
          return;
        }
        storyDirection = 0;
      })(storyStarted);
    }

    function noteStoryInput(direction) {
      var now = performance.now();
      storyDirection = direction;
      storyInputUntil = now + STORY_INPUT_HOLD_MS;
    }


    function redirectStory(direction) {
      if (!storyLocked || direction === storyTravelDirection) return;
      var target = storyStartStop, origin = storyEndStop;
      if (storyGlide !== null) cancelAnimationFrame(storyGlide);
      storyGlide = null;
      storyLocked = false;
      // Reverse to the exact completed state the active transition departed.
      // Using nearestStop here can choose that origin while still inside its
      // midpoint, which would make the wheel appear to do nothing.
      travelStory(direction, true, target, origin);
    }

    function handleStoryInput(direction) {
      noteStoryInput(direction);
      if (!storyLocked) { travelStory(direction); return; }
      if (direction !== storyTravelDirection) { redirectStory(direction); return; }
    }

    function storyWheel(e) {
      if (root.dataset.timeline !== 'live' || !e.deltaY) return;
      if (handoffGlide) { e.preventDefault(); return; }
      if (window.scrollY >= filmMax && e.deltaY > 0) return;
      e.preventDefault();
      var direction = e.deltaY > 0 ? 1 : -1;
      // Trackpads emit a stream of pixel wheel events for one physical swipe.
      // They still continue through endpoints, but never enable fast playback.
      handleStoryInput(direction);
    }

    function storyKey(e) {
      if (root.dataset.timeline !== 'live' || e.defaultPrevented
        || e.metaKey || e.ctrlKey || e.altKey
        || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) return;
      var down = e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ';
      var up = e.key === 'ArrowUp' || e.key === 'PageUp';
      if (!down && !up) return;
      if (handoffGlide) { e.preventDefault(); return; }
      if (window.scrollY >= filmMax && down) return;
      e.preventDefault();
      var direction = down ? 1 : -1;
      handleStoryInput(direction);
    }

    window.addEventListener('wheel', storyWheel, { passive: false, capture: true });
    window.addEventListener('keydown', storyKey, { passive: false, capture: true });
    window.addEventListener('touchstart', function (e) {
      touchY = e.touches.length ? e.touches[0].clientY : null;
    }, { passive: true, capture: true });
    window.addEventListener('touchmove', function (e) {
      if (root.dataset.timeline !== 'live' || touchY === null || !e.touches.length) return;
      var y = e.touches[0].clientY, delta = touchY - y;
      if (Math.abs(delta) < 8) return;
      if (handoffGlide) { e.preventDefault(); return; }
      if (window.scrollY >= filmMax && delta > 0) return;
      e.preventDefault();
      touchY = y;
      var direction = delta > 0 ? 1 : -1;
      handleStoryInput(direction);
    }, { passive: false, capture: true });
    window.addEventListener('touchend', function () { touchY = null; }, { passive: true, capture: true });

    // Rail and trait-dot jumps remain directly addressable. Wheel input does
    // not interrupt a magnetic story transition, but it may still cancel one
    // of those explicit navigation jumps before its next story intent starts.
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

      /*
       * A handover whose two frames are not the same picture cannot be a cut.
       *
       * The rule above — one plate, always, no dissolve — is right wherever the
       * clips are pieces of one continuous render, and on the home film they
       * are: a plate's closing frame and the next plate's opening frame are the
       * same frame, so cutting moves nothing and dissolving would show the same
       * figure twice a few frames apart.
       *
       * The features film breaks that premise at one handover. Slide 3 ends on
       * the wide, still map; slide 4 opens already deep in the plunge, because
       * the first 22 frames of its source — the acceleration from the map down
       * into the dive — carry burned-in English lettering and had to go. The two
       * frames measure SSIM 0.194 against each other: not the same picture by
       * any reading, and a hard cut between them is exactly the break that was
       * reported.
       *
       * It was there all along and the film's own speed is what exposed it. At
       * the old 3x launch the cut went by in a couple of frames and read as part
       * of the violence; at 1x you watch it happen.
       *
       * So this dissolves, and the ghosting the note above warns about cannot
       * occur here for the same reason the cut fails: there is no near-duplicate
       * to double. The window is short and lands where the incoming shot is at
       * its most motion-blurred, so what it reads as is the camera taking off
       * rather than a fade.
       *
       * Declared per scene, so it stays an exception that has to be asked for.
       */
      for (s = 0; s < scenes.length; s++) {
        var dcfg = scenes[s].cfg;
        if (!shown || !dcfg.dissolve) continue;
        var dIdx = -1;
        for (i = 0; i < PLATES.length; i++) if (PLATES[i] === dcfg.plate) dIdx = i;
        if (dIdx < 1 || dIdx !== top) continue;
        var dBeat = edge[dcfg.beat];
        if (!dBeat) continue;
        var into = span(p, dBeat[0], dBeat[0] + dcfg.dissolve * (dBeat[1] - dBeat[0]));
        if (into < 1) {
          opacity[dIdx] = into;
          opacity[dIdx - 1] = 1 - into;
        }
      }

      // The one handover that is not a cut. The closing plate is a black studio
      // frame and the plate after it is a forest at dawn, so there is nothing
      // continuous to cut on. It dips through black instead: the arrow fades
      // down, the frame is empty for a moment, then the morning fades up. The
      // two are never on screen together, so the one-plate rule still holds.
      var db = edge.depart;
      if (db) {
        var dw = db[1] - db[0];
        var out = span(p, db[0] + DEPART_PLATE[0] * dw, db[0] + DEPART_PLATE[1] * dw);
        var into = span(p, db[0] + ARRIVE_PLATE[0] * dw, db[0] + ARRIVE_PLATE[1] * dw);
        if (shown && p > db[0] && p < db[1]) {
          opacity[ARROW_PLATE] = 1 - out;
          opacity[MISS_PLATE] = into;
        }
      }

      // The end of the sequence. There is no plate after the forest, so it goes
      // down to the page's own black rather than handing over to another shot,
      // and section 7 is composed on that ground.
      var fb = edge.fall;
      if (fb && shown && p > fb[0]) {
        var fw = fb[1] - fb[0];
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

        // The warming chain is walking the plates in order in the background.
        // If the viewer has got somewhere it has not reached yet — a rail jump,
        // a fast run of steps, a slow line — the plate under them takes the
        // line now rather than waiting its turn behind ones already passed.
        if (plateP > 0) load(cfg.plate);
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

      // Both sections belong to the home film, and so do the beats that drive
      // them. \`at\` reads 0 for a beat this page does not have, which is what
      // every one of these values already is before the sequence reaches them.
      function at(name) {
        var e = shown && edge[name];
        return e ? span(p, e[0], e[1]) : 0;
      }
      paintArrow(at('arrow'), at('learn'), at('depart'));
      paintMiss(at('miss'), at('traits'), at('fall'));

      paintFlow();
      paintRail();

      // Past the film the site is a page, and a page's content scrolls *under*
      // its bar. The bar is transparent over the footage by design — over
      // moving copy it just looks like a collision — so it takes the page's own
      // ground from here on.
      //
      // Only where there is a page to be past, though. On a film with nothing
      // after it the last half-viewport is still footage, and giving the bar a
      // solid ground there is exactly the collision this avoids everywhere else.
      if (flows.length && window.scrollY > filmMax - window.innerHeight * 0.5) {
        root.setAttribute('data-past-film', '');
      } else {
        root.removeAttribute('data-past-film');
      }

      /*
       * The opening leaves over the shot that follows it.
       *
       * That shot is the film's first beat — the lead plate has no beat of its
       * own, because it plays before the timeline unlocks. This was written as
       * \`edge.turn\`, which is what the home film happens to call that beat, and
       * naming it meant any other film threw here on its first frame.
       */
      var hb = BEATS.length ? edge[BEATS[0][0]] : null;
      var hw = hb ? hb[1] - hb[0] : 0;
      var heroOut = hb
        ? ease(span(p, hb[0] + HERO_EXIT[0] * hw, hb[0] + HERO_EXIT[1] * hw))
        : 0;
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
      sizeTrack();
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
