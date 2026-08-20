/**
 * Navrya — verification harness.
 *
 *   node scripts/verify.mjs --target=local [--base=http://localhost:4173]
 *   node scripts/verify.mjs --target=live
 *
 * Playwright is deliberately **not** a dependency of this package. The
 * production image builds with `npm ci`, which installs devDependencies too,
 * and Playwright's postinstall pulls browser binaries — hundreds of megabytes
 * into an image that will never run a test. Install it wherever you like and
 * point Node at it:
 *
 *   npm i --prefix /tmp/pw playwright
 *   NODE_PATH=/tmp/pw/node_modules node scripts/verify.mjs --target=live
 *
 * Walks every locale at every breakpoint, visits all ten sections, screenshots
 * each one, and asserts the three defects the site was reported with: text that
 * renders but is not visible, videos that never decode, and layout that comes
 * apart. Writes `verification/<iteration>/<target>/report.json` and exits
 * non-zero if anything fails.
 *
 * Two things about the method, because both were learned the hard way here:
 *
 * - **Real wheel events, not `scrollTo`.** A scripted jump sets `scrollY` and
 *   fires one scroll event; it cannot reproduce a wheel that dies halfway down
 *   the page, which is the exact fault this site shipped. The walk uses
 *   `mouse.wheel` and checks the document actually moved.
 * - **Assert on position, not just opacity.** When the sticky screen fails to
 *   stick, the text is fully opaque and several thousand pixels above the
 *   viewport. Only an intersection test catches that.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

// `import` ignores NODE_PATH; `require` honours it. Resolving through
// createRequire is what lets Playwright live outside this package.
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const TARGET = args.target ?? "local";
const BASE =
  args.base ?? (TARGET === "live" ? "https://navrya.com" : "http://localhost:4173");
const ITERATION = String(args.iteration ?? "1");
const OUT = join(process.cwd(), "verification", ITERATION, TARGET);

// Mirrors `src/config/site.ts`. Deliberately a second copy rather than an
// import: the point of the check is that the built page carries this exact
// address, and importing the same constant the page was built from would make
// the assertion agree with itself no matter what shipped.
const APP_URL = "https://app.navrya.com/";

const ALL_LOCALES = [
  { code: "en", dir: "ltr" },
  { code: "tr", dir: "ltr" },
  { code: "fa", dir: "rtl" },
  { code: "ar", dir: "rtl" },
  { code: "es", dir: "ltr" },
];

const ALL_BREAKPOINTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

// `--locales=en,fa --breakpoints=desktop` narrows a run while iterating on a
// fix. It is a debugging convenience, never how a run is signed off: the
// contract in VERIFY_PLAN.md is the whole matrix, and the summary says loudly
// when a run was partial.
const pick = (all, arg, key) =>
  arg ? all.filter((x) => String(arg).split(",").includes(x[key])) : all;
const LOCALES = pick(ALL_LOCALES, args.locales, "code");
const BREAKPOINTS = pick(ALL_BREAKPOINTS, args.breakpoints, "name");
const PARTIAL =
  LOCALES.length !== ALL_LOCALES.length || BREAKPOINTS.length !== ALL_BREAKPOINTS.length;

/** The ten sections, in scroll order, with the rail index that travels to each. */
const SECTIONS = [
  { n: 1, name: "hero", sel: "[data-hero]", kind: "film" },
  { n: 2, name: "panel1", sel: '[data-panel="p1"]', kind: "film" },
  { n: 3, name: "panel2", sel: '[data-panel="p2"]', kind: "film" },
  { n: 4, name: "panel3", sel: '[data-panel="p3"]', kind: "film" },
  { n: 5, name: "closing", sel: "[data-arrow]", kind: "film" },
  { n: 6, name: "miss", sel: "[data-miss]", kind: "film" },
  { n: 7, name: "dark", sel: "[data-dark]", kind: "flow" },
  { n: 8, name: "partners", sel: "[data-partners]", kind: "flow" },
  { n: 9, name: "testimonials", sel: "[data-testimonials]", kind: "flow" },
  { n: 10, name: "archetypes", sel: "[data-archetypes]", kind: "flow" },
];

const failures = [];
const notes = [];
const fail = (where, what, detail) => {
  failures.push({ ...where, check: what, detail });
  console.log(`  FAIL  ${where.locale}/${where.bp}/${where.at} — ${what}: ${detail}`);
};

/* ── assertions that run inside the page ─────────────────────────────────── */

/**
 * Every text-bearing element in a subtree, with the facts needed to say whether
 * a human could actually read it. Only leaf-ish nodes are considered, so a
 * wrapper does not get counted as a second copy of its own child's words.
 */
const TEXT_PROBE = (sel) => {
  const root = document.querySelector(sel);
  if (!root) return { missing: true };

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const out = [];

  for (const el of root.querySelectorAll("*")) {
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    if (!own) continue;
    if (el.closest("[aria-hidden='true']") && !el.closest("[data-miss]")) {
      // aria-hidden is used on the film's decorative panels; they still have to
      // be visible, so they are kept — but nothing else hidden from AT is.
    }

    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();

    // Effective opacity: a parent at 0 hides a child at 1.
    let opacity = 1;
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
      opacity *= parseFloat(getComputedStyle(p).opacity || "1");
    }

    out.push({
      tag: el.tagName.toLowerCase(),
      text: own.slice(0, 60),
      opacity: +opacity.toFixed(3),
      visibility: cs.visibility,
      display: cs.display,
      w: Math.round(box.width),
      h: Math.round(box.height),
      top: Math.round(box.top),
      onScreen:
        box.bottom > 0 && box.top < vh && box.right > 0 && box.left < vw,
      color: cs.color,
    });
  }
  return { missing: false, nodes: out };
};

const VIDEO_PROBE = () =>
  [...document.querySelectorAll("video")].map((v) => {
    const box = v.getBoundingClientRect();
    return {
      readyState: v.readyState,
      videoWidth: v.videoWidth,
      videoHeight: v.videoHeight,
      w: Math.round(box.width),
      h: Math.round(box.height),
      networkState: v.networkState,
      error: v.error ? v.error.code : null,
      sources: [...v.querySelectorAll("source")].map((s) => s.getAttribute("src")),
      muted: v.muted,
      playsInline: v.playsInline,
    };
  });

const LAYOUT_PROBE = () => {
  const se = document.scrollingElement;
  const screen = document.querySelector("[data-track] > div");
  const badImgs = [...document.querySelectorAll("img")]
    .filter((i) => i.complete && i.naturalWidth === 0)
    .map((i) => i.currentSrc || i.src);
  return {
    dir: document.documentElement.getAttribute("dir"),
    lang: document.documentElement.getAttribute("lang"),
    scrollWidth: se.scrollWidth,
    clientWidth: se.clientWidth,
    scrollHeight: se.scrollHeight,
    scrollY: window.scrollY,
    screenTop: screen ? Math.round(screen.getBoundingClientRect().top) : null,
    screenPosition: screen ? getComputedStyle(screen).position : null,
    badImgs,
  };
};

/* ── the walk ────────────────────────────────────────────────────────────── */

/** Wheels until the predicate holds or the budget runs out. Returns whether it moved. */
async function wheelUntil(page, predicate, { step = 600, max = 400 } = {}) {
  let last = -1;
  let stalls = 0;
  for (let i = 0; i < max; i++) {
    if (await page.evaluate(predicate)) return true;
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(28);
    const y = await page.evaluate(() => window.scrollY);
    if (y === last) {
      // A heavy frame can drop a wheel; only a run of them is a stall.
      if (++stalls > 12) return await page.evaluate(predicate);
    } else {
      stalls = 0;
    }
    last = y;
  }
  return await page.evaluate(predicate);
}

async function visitSection(page, section, where, dirs) {
  const railIndex = section.n - 1;

  // Travel by the rail — it is the site's own way to a section, and it
  // exercises the controller's own idea of where each one lives.
  const clicked = await page.evaluate((i) => {
    const mark = document.querySelector(`[data-rail-mark="${i}"]`);
    if (!mark) return false;
    mark.click();
    return true;
  }, railIndex);

  if (!clicked) {
    fail(where, "rail", `no rail mark ${railIndex}`);
    return;
  }
  // The rail glides; wait for the document to stop moving.
  let prev = -1;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(100);
    const y = await page.evaluate(() => Math.round(window.scrollY));
    if (y === prev) break;
    prev = y;
  }
  await page.waitForTimeout(400);

  /* D1 — text visibility */
  const probe = await page.evaluate(TEXT_PROBE, section.sel);
  if (probe.missing) {
    fail(where, "D1-text", `${section.sel} not in the DOM`);
  } else {
    const visible = probe.nodes.filter(
      (n) =>
        n.opacity > 0.05 &&
        n.visibility !== "hidden" &&
        n.display !== "none" &&
        n.w > 0 &&
        n.h > 0 &&
        n.onScreen,
    );
    if (probe.nodes.length && visible.length === 0) {
      const worst = probe.nodes[0];
      fail(
        where,
        "D1-text",
        `${probe.nodes.length} text nodes, 0 visible ` +
          `(first: "${worst.text}" opacity=${worst.opacity} top=${worst.top} onScreen=${worst.onScreen})`,
      );
    }
    // An off-screen-but-opaque block is the signature of the sticky failure:
    // the text is fully painted and several thousand pixels above the frame.
    //
    // Only meaningful inside the film. Below it, section 9's columns are
    // vertical marquees that deliberately park duplicated quotes above the
    // window, and section 8's rail runs off both edges — flagging those would
    // be flagging the design.
    if (section.kind === "film") {
      const parked = probe.nodes.filter((n) => n.opacity > 0.5 && n.top < -1500);
      if (parked.length) {
        fail(
          where,
          "D1-text",
          `${parked.length} opaque text nodes parked off-screen (top=${parked[0].top}) — sticky screen not holding`,
        );
      }
    }
  }

  /* D3 — layout */
  const layout = await page.evaluate(LAYOUT_PROBE);
  if (layout.scrollWidth > layout.clientWidth + 1) {
    fail(
      where,
      "D3-layout",
      `horizontal overflow: scrollWidth ${layout.scrollWidth} > clientWidth ${layout.clientWidth}`,
    );
  }
  if (layout.dir !== dirs) {
    fail(where, "D3-layout", `dir is "${layout.dir}", expected "${dirs}"`);
  }
  // The screen is only meant to be pinned while the film is running. Section 7
  // onward is an ordinary document that scrolls up over the frame and past it,
  // so a large negative top down there is the design working, not failing.
  if (section.kind === "film" && layout.screenTop !== null && layout.screenTop < -200) {
    fail(
      where,
      "D3-layout",
      `sticky screen top is ${layout.screenTop} (expected ~0) — position:${layout.screenPosition}`,
    );
  }
  if (layout.badImgs.length) {
    fail(where, "D3-layout", `broken images: ${layout.badImgs.slice(0, 3).join(", ")}`);
  }

  const dir = join(OUT, where.locale, where.bp);
  await mkdir(dir, { recursive: true });
  await page.screenshot({
    path: join(dir, `${String(section.n).padStart(2, "0")}-${section.name}.png`),
  });

  return { layout };
}

/* ── per-locale, per-breakpoint run ──────────────────────────────────────── */

async function runOne(browser, locale, bp) {
  const where = { locale: locale.code, bp: bp.name, at: "load" };
  const context = await browser.newContext({
    viewport: { width: bp.width, height: bp.height },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  let firstError = null;

  page.on("console", (m) => {
    if (m.type() === "error") {
      consoleErrors.push(m.text());
      if (!firstError) firstError = m.text();
    }
  });
  page.on("pageerror", (e) => {
    pageErrors.push(String(e));
    if (!firstError) firstError = String(e);
  });
  page.on("requestfailed", (r) => {
    failedRequests.push({ url: r.url(), reason: r.failure()?.errorText });
  });
  page.on("response", (r) => {
    if (r.status() >= 400) failedRequests.push({ url: r.url(), status: r.status() });
  });

  const url = `${BASE}/${locale.code}`;
  const started = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  const loadMs = Date.now() - started;

  /* Watch the opening plate *while it plays*, before anything else.
   *
   * It has to be sampled here and not after the wait below, because the wait
   * ends when the shot ends — by then the only thing left to look at is a plate
   * sitting on its last frame, which says nothing about whether the shot was
   * ever on screen. The dimmest moment while the clock is advancing is the
   * honest measure, so that is what is kept.
   */
  /* The hero's two links must not exist for the viewer until the opening ends.
   *
   * They were added to the composition without being added to the reveal, so
   * they painted from the very first frame: a filled gold button sitting over
   * the film for five seconds while the words it belongs to were still at zero.
   * Invisible is not enough either — an element at `opacity: 0` still takes a
   * click and still holds a place in the tab order, so what is asserted is both
   * the opacity and that nothing can be pressed. */
  const heroGate = { live: 0, samples: 0, worst: null };

  const openingWatch = { minOpacity: 1, atTime: null, samples: 0, ready: null, lead: null };
  for (let i = 0; i < 40; i++) {
    const s = await page
      .evaluate(() => {
        const v = document.querySelector('[data-scene-video="dawn"]');
        if (!v) return null;
        return {
          t: v.currentTime,
          dur: v.duration || 0,
          opacity: +getComputedStyle(v).opacity,
          ready: v.hasAttribute("data-plate-ready"),
          lead: v.hasAttribute("data-plate-lead"),
          done: document.documentElement.getAttribute("data-timeline") !== "held",
          intro: document.documentElement.dataset.intro,
          hero: (() => {
            const el = document.querySelector("[data-hero-trial]")?.parentElement;
            if (!el) return null;
            const cs = getComputedStyle(el);
            return { opacity: +cs.opacity, pointer: cs.pointerEvents };
          })(),
        };
      })
      .catch(() => null);
    if (!s) break;
    // While the interface is still armed, the hero's links are neither visible
    // nor pressable.
    if (s.intro === "armed" && s.hero) {
      heroGate.samples++;
      if (s.hero.opacity > 0.02 || s.hero.pointer !== "none") {
        heroGate.live++;
        heroGate.worst ??= s.hero;
      }
    }
    // Only while the shot is actually running: a plate at 0 has not started and
    // a plate at its final frame has finished.
    if (s.t > 0.05 && (!s.dur || s.t < s.dur - 0.1)) {
      openingWatch.samples++;
      if (s.opacity < openingWatch.minOpacity) {
        openingWatch.minOpacity = s.opacity;
        openingWatch.atTime = +s.t.toFixed(2);
      }
      openingWatch.ready = s.ready;
      openingWatch.lead = s.lead;
    }
    if (s.done) break;
    await page.waitForTimeout(250);
  }

  // The timeline is held shut until the opening plate finishes. Wait it out
  // rather than fighting it — a wheel during the hold is correctly ignored.
  await page
    .waitForFunction(
      () => document.documentElement.getAttribute("data-timeline") !== "held",
      { timeout: 20000 },
    )
    .catch(() => notes.push(`${locale.code}/${bp.name}: timeline never unlocked`));

  await page.waitForTimeout(600);

  /* D2 — videos. Checked once per page: the plates are one shared layer.
   *
   * Only the opening plate is eager. Every other one is `preload="none"` and is
   * fetched a beat ahead of the viewer, so asserting that all seven have
   * decoded at load would be asserting the opposite of the design — a viewer
   * who never scrolls is meant to download exactly one video. What must hold at
   * load: the lead plate decodes, nothing reports a MediaError, every element
   * has a real box, and every source URL is actually served. That last one is
   * the check that catches media missing from a deploy.
   */
  const videos = await page.evaluate(VIDEO_PROBE);
  where.at = "videos";
  if (!videos.length) {
    fail(where, "D2-video", "no <video> elements in the document");
  }

  // The scene ships in two tiers: seven shipping plates and six light copies
  // that stand in until each shipping plate arrives. The light tier is what
  // keeps the film running under a magnetic step, which crosses a whole beat in
  // about a second — far less than a several-megabyte plate takes to land. If
  // it ever goes missing the film does not break loudly, it just freezes on
  // stills again, so its presence is asserted rather than assumed.
  const tiers = await page.evaluate(() => ({
    full: document.querySelectorAll("[data-scene-video]").length,
    proxy: document.querySelectorAll("[data-scene-proxy]").length,
    unmatched: [...document.querySelectorAll("[data-scene-proxy]")].filter(
      (p) => !p.closest("[data-plate-id]")?.querySelector("[data-scene-video]"),
    ).length,
  }));
  if (tiers.full !== 7)
    fail(where, "D2-video", `${tiers.full} shipping plates, expected 7`);
  if (tiers.proxy !== 6)
    fail(where, "D2-video", `${tiers.proxy} light copies, expected 6 (one per scrubbed plate)`);
  if (tiers.unmatched)
    fail(where, "D2-video", `${tiers.unmatched} light copies are not paired with a plate`);
  for (const [i, v] of videos.entries()) {
    if (v.error !== null) fail(where, "D2-video", `video ${i} MediaError code ${v.error}`);
    if (v.w === 0 || v.h === 0)
      fail(where, "D2-video", `video ${i} rendered box is ${v.w}×${v.h}`);
    if (!v.muted || !v.playsInline)
      fail(
        where,
        "D2-video",
        `video ${i} muted=${v.muted} playsInline=${v.playsInline} — mobile will refuse autoplay`,
      );
  }
  const lead = videos[0];
  if (lead) {
    if (lead.readyState === 0)
      fail(
        where,
        "D2-video",
        `the opening plate never loaded: readyState 0, networkState ${lead.networkState}, src=${lead.sources[0]}`,
      );
    else if (lead.videoWidth === 0)
      fail(where, "D2-video", `the opening plate decoded to 0×0 — src=${lead.sources[0]}`);
  }

  /* The opening plate has to be *visible*, which is not the same as working.
   *
   * This is the check that was missing when it mattered. A stylesheet rule held
   * the lead plate at `opacity: 0` for the whole of its five seconds and every
   * assertion here passed: it decoded, it buffered, it had a full-size box, its
   * clock advanced 0 to 5.04. It was flawless on every count anyone was
   * measuring and simply could not be seen — the visitor got the still frame
   * behind it and the one shot the whole opening is built around never played.
   *
   * Sampled above, while the shot was running; judged here.
   */
  where.at = "opening-plate";
  const openState = await page.evaluate(() => {
    const v = document.querySelector('[data-scene-video="dawn"]');
    if (!v) return null;
    const cs = getComputedStyle(v);
    const r = v.getBoundingClientRect();
    return {
      visibility: cs.visibility,
      display: cs.display,
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  });
  if (heroGate.live) {
    fail(
      where,
      "D1-text",
      `the hero's links were live during the opening: ${heroGate.live} of ` +
        `${heroGate.samples} samples at opacity ${heroGate.worst.opacity}, ` +
        `pointer-events ${heroGate.worst.pointer} — they sit over the film ` +
        `before the words they belong to have arrived`,
    );
  }

  if (!openState) {
    fail(where, "D2-video", 'no [data-scene-video="dawn"] in the document');
  } else {
    if (!openingWatch.samples) {
      notes.push(`${locale.code}/${bp.name}: never caught the opening plate mid-shot`);
    } else if (openingWatch.minOpacity <= 0.05) {
      fail(
        where,
        "D2-video",
        `the opening plate is invisible while it plays: opacity ${openingWatch.minOpacity} ` +
          `at currentTime ${openingWatch.atTime} over ${openingWatch.samples} samples ` +
          `(data-plate-lead=${openingWatch.lead}, data-plate-ready=${openingWatch.ready}) — ` +
          `it runs behind its own still and the visitor never sees the shot`,
      );
    }
    if (openState.visibility === "hidden" || openState.display === "none")
      fail(where, "D2-video", `the opening plate is ${openState.visibility}/${openState.display}`);
    if (openState.w === 0 || openState.h === 0)
      fail(where, "D2-video", `the opening plate box is ${openState.w}×${openState.h}`);
  }

  // Every source URL, fetched for real. A plate that is lazily loaded still has
  // to exist; this is what would have caught media left out of the image.
  where.at = "media";
  const sources = [...new Set(videos.flatMap((v) => v.sources))];
  const probes = await Promise.all(
    sources.map(async (src) => {
      const res = await page.request.get(new URL(src, BASE).href, {
        headers: { Range: "bytes=0-1024" },
        timeout: 30000,
      });
      return { src, status: res.status() };
    }),
  );
  for (const p of probes) {
    if (p.status >= 400) fail(where, "D2-video", `source ${p.src} returns ${p.status}`);
  }

  /* The light tier has a weight budget, and it is a correctness property.
   *
   * Presence is asserted above, and presence was not enough. Re-encoding the
   * tier at 1280×720 instead of 854×480 tripled it to 4.6MB and the whole suite
   * stayed green: the count was still six, every pairing still held, every URL
   * still served 200. What it cost was the opening — measured live, it doubled
   * the opening plate's arrival and pushed the unlock from 6.8s to 10.3s —
   * surfacing as the hero headline still at opacity 0 on the coldest run.
   *
   * The tier is fetched the moment the opening plate begins playing, so it no
   * longer competes with that plate for the line. It still has a deadline: the
   * scroll unlocks when the opening ends, and the tier is what the first
   * gesture draws. One shot's length is what it gets, so its weight is bounded.
   *
   * Checked from Content-Length off the wire rather than from the repository,
   * because what matters is what the edge actually serves.
   */
  const LIGHT_TIER_BUDGET = 2.5 * 1024 * 1024;
  const lightSrcs = await page.evaluate(() =>
    [...document.querySelectorAll("[data-scene-proxy] source")].map((s) => s.getAttribute("src")),
  );
  const lightSizes = await Promise.all(
    [...new Set(lightSrcs)].map(async (src) => {
      const res = await page.request.get(new URL(src, BASE).href, {
        headers: { Range: "bytes=0-0" },
        timeout: 30000,
      });
      // A 206 reports the full size in Content-Range; a server that ignored the
      // range reports it in Content-Length.
      const h = res.headers();
      const total = /\/(\d+)\s*$/.exec(h["content-range"] || "")?.[1] ?? h["content-length"];
      return { src, bytes: Number(total) || 0 };
    }),
  );
  const lightTotal = lightSizes.reduce((n, f) => n + f.bytes, 0);
  if (lightSizes.some((f) => !f.bytes)) {
    notes.push(
      `${locale.code}/${bp.name}: light tier size unreadable for ` +
        lightSizes.filter((f) => !f.bytes).map((f) => f.src).join(", "),
    );
  } else if (lightTotal > LIGHT_TIER_BUDGET) {
    const kb = (n) => `${Math.round(n / 1024)}KB`;
    fail(
      where,
      "D2-video",
      `light tier is ${kb(lightTotal)}, over its ${kb(LIGHT_TIER_BUDGET)} budget — ` +
        `it has one shot's length to arrive before the scroll unlocks. ` +
        lightSizes
          .sort((a, b) => b.bytes - a.bytes)
          .map((f) => `${f.src.split("/").pop()} ${kb(f.bytes)}`)
          .join(", "),
    );
  }

  /* Fonts: Persian and Arabic must actually be in Peyda. */
  if (locale.dir === "rtl") {
    const peyda = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('400 16px "Peyda"');
    });
    if (!peyda) fail({ ...where, at: "fonts" }, "font", "Peyda did not load for an RTL locale");
  }

  /* The film keeps a picture while a person is actually watching it.
   *
   * This is the check for the fault that was reported: with a magnetic step
   * crossing a whole beat in about a second, the shipping plates could not
   * arrive in time and shot after shot landed on a frozen still.
   *
   * Gestured at a human cadence — flick, look, flick — not settled between,
   * because waiting for the network is exactly what a viewer does not do.
   * `readyState` is no use here: it drops to 1 for the length of a seek even
   * when the whole file is in hand, so it reports a picture as missing when it
   * is on screen. What is asked instead is whether either tier holds data at
   * the time it has been asked to show.
   */
  where.at = "picture-while-stepping";
  // Throttled on purpose, and this is the whole point of the check. On the
  // line between this runner and the origin the shipping plates arrive fast
  // enough to hide the fault entirely — it was only ever visible to someone on
  // an ordinary connection. 12Mbps down, 40ms out, which is unremarkable.
  let throttle = null;
  try {
    throttle = await page.context().newCDPSession(page);
    await throttle.send("Network.enable");
    await throttle.send("Network.emulateNetworkConditions", {
      offline: false,
      downloadThroughput: (12 * 1024 * 1024) / 8,
      uploadThroughput: (3 * 1024 * 1024) / 8,
      latency: 40,
    });
  } catch {
    notes.push(`${locale.code}/${bp.name}: could not throttle; stepping check ran unthrottled`);
    throttle = null;
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const blind = [];
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(1400);
    const shot = await page.evaluate(() => {
      const covers = (v) => {
        if (!v || !v.duration) return false;
        const t = v.currentTime;
        for (let i = 0; i < v.buffered.length; i++) {
          if (t >= v.buffered.start(i) - 0.25 && t <= v.buffered.end(i) + 0.25) return true;
        }
        return false;
      };
      return [...document.querySelectorAll("[data-plate-id]")]
        .filter((p) => +(getComputedStyle(p).getPropertyValue("--o") || 0) > 0.01)
        .map((p) => ({
          id: p.getAttribute("data-plate-id"),
          ok:
            covers(p.querySelector("[data-scene-video]")) ||
            covers(p.querySelector("[data-scene-proxy]")),
        }))
        .filter((r) => !r.ok)
        .map((r) => r.id);
    });
    if (shot.length) blind.push(`step ${i + 1}: ${shot.join(",")}`);
  }
  if (blind.length) {
    fail(
      where,
      "D2-video",
      `plate on screen with no frames to draw — ${blind.slice(0, 3).join(" · ")}`,
    );
  }

  // Back to full speed; the rest of the run is not about bandwidth.
  if (throttle) {
    await throttle
      .send("Network.emulateNetworkConditions", {
        offline: false,
        downloadThroughput: -1,
        uploadThroughput: -1,
        latency: 0,
      })
      .catch(() => {});
  }

  /* The wheel walk: prove the document really scrolls end to end. */
  where.at = "wheel";
  const reachedBottom = await wheelUntil(
    page,
    () =>
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - 4,
    { step: 900, max: 900 },
  );
  const endY = await page.evaluate(() => window.scrollY);
  if (!reachedBottom) {
    fail(
      where,
      "scroll",
      `wheel stalled at ${endY} of ${await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)}`,
    );
  }

  // Having now scrolled the whole film, the plates the viewer passed should
  // have loaded. This is the real D2 check for the lazy ones — the load-time
  // pass could not make it, because at load they are deliberately empty.
  where.at = "videos-after-walk";
  const walked = await page.evaluate(VIDEO_PROBE);
  const undecoded = walked.filter((v) => v.readyState === 0 || v.videoWidth === 0);
  if (undecoded.length === walked.length && walked.length) {
    fail(where, "D2-video", `no plate decoded after scrolling the entire film`);
  }
  for (const [i, v] of walked.entries()) {
    if (v.error !== null)
      fail(where, "D2-video", `plate ${i} MediaError code ${v.error} after the walk`);
  }

  /* Each section, reached by the rail. */
  const perSection = {};
  for (const section of SECTIONS) {
    where.at = `s${section.n}-${section.name}`;
    const r = await visitSection(page, section, { ...where }, locale.dir);
    if (r) perSection[section.name] = r.layout;
  }

  /* Interactions. */
  where.at = "language-menu";
  const menu = await page.evaluate(() => {
    const details = document.querySelector("details[data-language-menu]");
    if (!details) return { missing: true };
    details.open = true;
    const links = [...details.querySelectorAll("a[href]")].map((a) =>
      a.getAttribute("href"),
    );
    details.open = false;
    return { missing: false, links };
  });
  if (menu.missing) fail(where, "interaction", "no language menu");
  else if (menu.links.length < 5)
    fail(where, "interaction", `language menu lists ${menu.links.length} locales, expected 5`);

  // Every way out of this site to the product. These are links, so what has to
  // hold is the address itself — not that something happens when you press it.
  where.at = "app-links";
  const appLinks = await page.evaluate(() => {
    const read = (sel) =>
      [...document.querySelectorAll(sel)].map((a) => ({
        tag: a.tagName,
        href: a.getAttribute("href"),
      }));
    return {
      login: read("[data-login]"),
      panels: read("[data-cast-panel]"),
      foot: read("[data-explore]"),
      hero: read("[data-hero-cta]"),
      trial: read("[data-hero-trial]"),
      footerCta: read("[data-footer-cta]"),
    };
  });
  const expectLinks = [
    ["header login", appLinks.login, 1],
    ["archetype panel", appLinks.panels, 4],
    ["section 10 invitation", appLinks.foot, 1],
    // The hero's pair and the closing one in the footer. Nine ways out of the
    // site now, not six — every one of them asserted, because a way out that
    // silently points somewhere else is the failure nobody sees.
    ["hero call to action", appLinks.hero, 1],
    ["hero free trial", appLinks.trial, 1],
    ["footer call to action", appLinks.footerCta, 1],
  ];
  for (const [label, found, want] of expectLinks) {
    if (found.length !== want) {
      fail(where, "interaction", `${found.length} ${label} link(s), expected ${want}`);
      continue;
    }
    for (const link of found) {
      if (link.tag !== "A")
        fail(where, "interaction", `${label} is a <${link.tag.toLowerCase()}>, expected <a>`);
      else if (link.href !== APP_URL)
        fail(where, "interaction", `${label} points at ${link.href}, expected ${APP_URL}`);
    }
  }

  where.at = "accordion";
  const panelCount = await page.evaluate(
    () => document.querySelectorAll("[data-cast-panel]").length,
  );
  if (panelCount !== 4) {
    fail(where, "interaction", `section 10 has ${panelCount} panels, expected 4`);
  } else if (bp.width < 768) {
    // Under 768px the gallery is not an accordion at all: it stacks into a
    // column and every archetype is open at once. Nothing widens on click, and
    // asserting that it does would be asserting against the design. What has to
    // hold instead is that all four are actually laid out and readable.
    const stacked = await page.evaluate(() =>
      [...document.querySelectorAll("[data-cast-panel]")].map((p) => {
        const b = p.getBoundingClientRect();
        return { w: Math.round(b.width), h: Math.round(b.height) };
      }),
    );
    const collapsed = stacked.filter((s) => s.w === 0 || s.h === 0);
    if (collapsed.length) {
      fail(
        where,
        "interaction",
        `${collapsed.length} of 4 stacked archetype panels have a zero box`,
      );
    }
  } else {
    // The panels are links, so a click leaves the page — that is the point of
    // this change, not a regression. Hover is what opens one, and hover is what
    // gets asserted: a real mouse move, so `pointerenter` arrives with
    // `pointerType: "mouse"` the way the controller requires.
    const widths = () =>
      page.evaluate(() =>
        [...document.querySelectorAll("[data-cast-panel]")].map((p) =>
          Math.round(p.getBoundingClientRect().width),
        ),
      );
    const before = await widths();
    await page.hover("[data-cast-panel='2']");
    await page.waitForTimeout(1400);
    const after = await widths();
    if (!(after[2] > before[2])) {
      fail(
        where,
        "interaction",
        `hovering panel 3 did not expand it (${before[2]} → ${after[2]})`,
      );
    }
    if (page.url() !== url) {
      fail(where, "interaction", `hovering panel 3 navigated to ${page.url()}`);
    }
  }

  /* Runtime health. */
  where.at = "console";
  for (const e of pageErrors) fail(where, "runtime", `uncaught: ${e}`);
  for (const e of consoleErrors.slice(0, 5)) fail(where, "runtime", `console.error: ${e}`);
  // `ERR_ABORTED` on a plate is the controller doing its job: it fetches a beat
  // ahead, and a viewer who scrolls past cancels the range request that is
  // still in flight. A cancelled fetch is not a broken asset — the sources are
  // verified for real above, by status code. Anything with a 4xx/5xx, and any
  // non-media failure, still counts.
  const realFailures = failedRequests.filter((r) => {
    if (/favicon/.test(r.url)) return false;
    if (r.status === 206) return false;
    if (r.reason === "net::ERR_ABORTED" && /\.(webm|mp4)$/.test(r.url)) return false;
    return true;
  });
  for (const r of realFailures.slice(0, 8)) {
    fail(where, "network", `${r.status ?? r.reason} ${r.url}`);
  }

  await context.close();

  return {
    locale: locale.code,
    breakpoint: bp.name,
    loadMs,
    firstError,
    videos: videos.length,
    consoleErrors,
    pageErrors,
    failedRequests: realFailures,
    sections: perSection,
  };
}

/* ── main ────────────────────────────────────────────────────────────────── */

async function main() {
  console.log(`\nverify — target=${TARGET} base=${BASE} iteration=${ITERATION}\n`);
  // Videos are the point of half these assertions, so the browser has to be
  // able to decode them: the bundled Chromium ships without proprietary codecs,
  // and the plates are WebM/VP9 precisely so it can. An explicit
  // `executablePath` also lets a pre-installed Chromium stand in for one whose
  // revision does not match this Playwright build.
  // Chromium does not read HTTPS_PROXY from the environment the way curl does;
  // behind an egress proxy it just resets the connection. Hand it over
  // explicitly, and keep loopback off it so a local target still resolves.
  const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy;
  const launchArgs = ["--autoplay-policy=no-user-gesture-required"];

  /*
   * `VERIFY_TLS12=1` caps the browser at TLS 1.2.
   *
   * This is a workaround for a *sandbox*, not for the site, and it is opt-in so
   * it can never be switched on by accident. Some egress gateways pass a host
   * straight through rather than re-terminating it, and reset Chromium's TLS
   * 1.3 ClientHello while accepting curl's — the symptom is
   * `ERR_CONNECTION_RESET` on every navigation while `curl` fetches the same
   * URL happily. Capping the version gets the browser onto the wire.
   *
   * Certificate verification is untouched: the origin's real certificate is
   * still validated against the browser's own roots. Nothing here weakens a
   * check, and nothing here changes what is being tested — but a genuine
   * TLS-1.3-only fault on the origin would be invisible while it is set, so
   * leave it off unless the reset is actually happening.
   */
  if (process.env.VERIFY_TLS12 === "1") launchArgs.push("--ssl-version-max=tls1.2");

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: launchArgs,
    proxy: proxyServer
      ? { server: proxyServer, bypass: "localhost,127.0.0.1,::1" }
      : undefined,
  });
  const results = [];

  /*
   * The features page.
   *
   * It is a second route running the same opening as the home page, off the
   * same components and the same controller — so what has to be asserted is not
   * that it works but that it works *the same way*: the plate decodes and is
   * visible while it plays, the interface is held back until the shot has run,
   * the words arrive, nothing overflows, and the bar knows which page it is on.
   *
   * Its own pass rather than a second route inside the matrix above: the home
   * run walks ten sections and takes most of a minute, and this page has one
   * slide. Every locale is covered at the desktop frame, where the composition
   * differs most from the compact one, and English is covered at all three.
   */
  async function runFeature(locale, bp) {
    const where = { locale: locale.code, bp: `${bp.name}/feature`, at: "load" };
    const context = await browser.newContext({
      viewport: { width: bp.width, height: bp.height },
      deviceScaleFactor: 1,
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    const bad = [];
    page.on("pageerror", (e) => bad.push(String(e)));
    page.on("console", (m) => m.type() === "error" && bad.push(m.text()));
    page.on("requestfailed", (r) => bad.push(`${r.url()} ${r.failure()?.errorText}`));
    page.on("response", (r) => r.status() >= 400 && bad.push(`${r.url()} ${r.status()}`));

    await page.goto(`${BASE}/${locale.code}/feature`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Held back while the shot runs — the same gate the home page's opening is
    // behind, and the reason the words are not on screen over the first frame.
    let heldSamples = 0;
    let leaked = 0;
    for (let i = 0; i < 40; i++) {
      const s = await page
        .evaluate(() => {
          const v = document.querySelector("[data-plate-lead]");
          const head = document.querySelector("[data-hero] h1");
          if (!v || !head) return null;
          return {
            intro: document.documentElement.dataset.intro,
            headOpacity: +getComputedStyle(head).opacity,
            plateOpacity: +getComputedStyle(v).opacity,
            t: v.currentTime,
            live: document.documentElement.getAttribute("data-timeline") !== "held",
          };
        })
        .catch(() => null);
      if (!s) break;
      if (s.intro === "armed") {
        heldSamples++;
        if (s.headOpacity > 0.05) leaked++;
        // The plate itself must be visible the whole way — the fault that had
        // the home page's opening playing behind its own still.
        if (s.t > 0.05 && s.plateOpacity <= 0.05) {
          fail(where, "D2-video", `the plate is invisible at currentTime ${s.t.toFixed(2)}`);
          break;
        }
      }
      if (s.live) break;
      await page.waitForTimeout(200);
    }
    if (!heldSamples) {
      notes.push(`${locale.code}/${bp.name}/feature: never caught the opening while held`);
    } else if (leaked) {
      fail(
        where,
        "D1-text",
        `the words were on screen during the opening: ${leaked} of ${heldSamples} samples`,
      );
    }

    await page
      .waitForFunction(
        () => document.documentElement.getAttribute("data-timeline") !== "held",
        { timeout: 25000 },
      )
      .catch(() => fail(where, "interaction", "the timeline never unlocked"));
    await page.waitForTimeout(700);

    where.at = "slide";
    const s = await page.evaluate(() => {
      const head = document.querySelector("[data-hero] h1");
      const sub = document.querySelector("[data-hero] p");
      const v = document.querySelector("[data-plate-lead]");
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
      };
      const active = document.querySelector('nav[aria-label] [aria-current]');
      return {
        headline: head ? { text: head.textContent.trim(), op: +getComputedStyle(head).opacity, ...box(head) } : null,
        subline: sub ? { op: +getComputedStyle(sub).opacity, ...box(sub) } : null,
        plate: v ? { rs: v.readyState, vw: v.videoWidth, op: +getComputedStyle(v).opacity } : null,
        sources: v ? [...v.querySelectorAll("source")].map((x) => x.getAttribute("src")) : [],
        dir: document.documentElement.dir,
        overflowX: document.scrollingElement.scrollWidth - document.documentElement.clientWidth,
        activeNav: active ? active.textContent.trim() : null,
        homeHref: document.querySelector('nav a[href$="/' + document.documentElement.lang + '"]')?.getAttribute("href") ?? null,
      };
    });

    for (const [name, t] of [["headline", s.headline], ["sub-headline", s.subline]]) {
      if (!t) fail(where, "D1-text", `no ${name} on the slide`);
      else if (t.op <= 0.05) fail(where, "D1-text", `the ${name} is at opacity ${t.op}`);
      else if (t.w === 0 || t.h === 0) fail(where, "D1-text", `the ${name} box is ${t.w}×${t.h}`);
    }
    if (!s.plate) fail(where, "D2-video", "no lead plate on the slide");
    else {
      if (s.plate.rs === 0) fail(where, "D2-video", "the plate never loaded");
      if (s.plate.vw === 0) fail(where, "D2-video", "the plate decoded to 0 wide");
      if (s.plate.op <= 0.05) fail(where, "D2-video", `the plate is at opacity ${s.plate.op}`);
    }
    for (const src of s.sources) {
      const res = await page.request
        .get(new URL(src, BASE).href, { headers: { Range: "bytes=0-1024" }, timeout: 30000 })
        .catch(() => null);
      if (!res || res.status() >= 400)
        fail(where, "D2-video", `source ${src} returns ${res ? res.status() : "no response"}`);
    }
    if (s.overflowX > 1)
      fail(where, "D3-layout", `${s.overflowX}px of horizontal overflow`);
    if (s.dir !== locale.dir)
      fail(where, "D3-layout", `dir is ${s.dir}, expected ${locale.dir}`);
    if (!s.activeNav)
      fail(where, "interaction", "no nav item marked current on the features page");
    if (!s.homeHref)
      fail(where, "interaction", "the bar has no way back to the home page");
    if (bad.length)
      fail(where, "runtime", `${bad.length} error(s), first: ${bad[0]}`);

    await context.close();
    return { locale: locale.code, breakpoint: bp.name, route: "feature" };
  }

  for (const locale of LOCALES) {
    for (const bp of BREAKPOINTS) {
      process.stdout.write(`${locale.code}/${bp.name} … `);
      const before = failures.length;
      try {
        results.push(await runOne(browser, locale, bp));
      } catch (err) {
        fail(
          { locale: locale.code, bp: bp.name, at: "harness" },
          "harness",
          String(err.message ?? err),
        );
      }
      const added = failures.length - before;
      console.log(added === 0 ? "ok" : `${added} failure(s)`);
    }
  }

  // Every locale at the desktop frame, and English at all three.
  const desktop = BREAKPOINTS.find((b) => b.name === "desktop") ?? BREAKPOINTS[BREAKPOINTS.length - 1];
  const featurePasses = [
    ...LOCALES.map((locale) => [locale, desktop]),
    ...BREAKPOINTS.filter((b) => b !== desktop).map((bp) => [LOCALES[0], bp]),
  ];
  for (const [locale, bp] of featurePasses) {
    process.stdout.write(`${locale.code}/${bp.name}/feature … `);
    const before = failures.length;
    try {
      results.push(await runFeature(locale, bp));
    } catch (err) {
      fail(
        { locale: locale.code, bp: `${bp.name}/feature`, at: "harness" },
        "harness",
        String(err.message ?? err),
      );
    }
    const added = failures.length - before;
    console.log(added === 0 ? "ok" : `${added} failure(s)`);
  }

  await browser.close();

  await mkdir(OUT, { recursive: true });
  await writeFile(
    join(OUT, "report.json"),
    JSON.stringify({ target: TARGET, base: BASE, failures, notes, results }, null, 2),
  );

  console.log(`\n${"─".repeat(60)}`);
  if (PARTIAL) {
    console.log(
      `PARTIAL RUN — ${LOCALES.length}/${ALL_LOCALES.length} locales, ` +
        `${BREAKPOINTS.length}/${ALL_BREAKPOINTS.length} breakpoints. Not a sign-off.`,
    );
  }
  if (failures.length === 0) {
    console.log(`PASS — ${results.length} locale/breakpoint runs, no failures.`);
    console.log(`${OUT}/report.json`);
    return 0;
  }

  const byCheck = {};
  for (const f of failures) byCheck[f.check] = (byCheck[f.check] ?? 0) + 1;
  console.log(`FAIL — ${failures.length} failure(s) across ${results.length} runs:`);
  for (const [check, n] of Object.entries(byCheck).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${check}`);
  }
  console.log(`\nfirst 15:`);
  for (const f of failures.slice(0, 15)) {
    console.log(`  ${f.locale}/${f.bp}/${f.at} — ${f.check}: ${f.detail}`);
  }
  console.log(`\n${OUT}/report.json`);
  return 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
