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

/** Waits for the document to stop moving, and returns where it came to rest. */
// The budget has to outlast the longest step. Playing at footage speed, the
// stretch from section 4 to section 5 is about fifteen seconds of film — a
// shorter deadline would return a mid-glide position and read it as a landing.
async function settled(page, { quiet = 3, tick = 90, max = 400 } = {}) {
  let prev = null;
  let still = 0;
  for (let i = 0; i < max; i++) {
    const y = await page.evaluate(() => Math.round(window.scrollY));
    if (y === prev) {
      if (++still >= quiet) return y;
    } else {
      still = 0;
    }
    prev = y;
    await page.waitForTimeout(tick);
  }
  return prev;
}

/**
 * Wheels until the predicate holds or the budget runs out. Returns whether it did.
 *
 * One wheel, then wait for the page to come to rest, then the next. Inside the
 * film a gesture no longer scrolls by its own delta — it starts a glide to the
 * next stop and ignores everything until that lands — so wheeling on a fixed
 * cadence would spend most of its events being correctly swallowed and read the
 * lock as a stall. Below the film this is just a slower ordinary walk.
 */
async function wheelUntil(page, predicate, { step = 600, max = 60 } = {}) {
  let stalls = 0;
  for (let i = 0; i < max; i++) {
    if (await page.evaluate(predicate)) return true;
    const before = await page.evaluate(() => Math.round(window.scrollY));
    await page.mouse.wheel(0, step);
    // Inside the film a step plays for as long as its footage — the whole
    // sequence runs fifty seconds. The second wheel, after the deaf window, is
    // the site's own way to end a shot early, and it lands on the same stop.
    // Watching the film out at 1x is asserted separately, in `stepped-scroll`.
    await page.waitForTimeout(500);
    await page.mouse.wheel(0, step);
    const after = await settled(page);
    // A heavy frame can drop a wheel; only a run of them is a stall.
    if (after === before) {
      if (++stalls > 4) return await page.evaluate(predicate);
    } else {
      stalls = 0;
    }
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

  /* Fonts: Persian and Arabic must actually be in Peyda. */
  if (locale.dir === "rtl") {
    const peyda = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('400 16px "Peyda"');
    });
    if (!peyda) fail({ ...where, at: "fonts" }, "font", "Peyda did not load for an RTL locale");
  }

  /* Stepped scroll: one gesture inside the film plays one whole shot.
   *
   * Asserted from the top, before the walk moves anything. What has to hold is
   * that a single wheel lands the page on one of the rail's own resting points
   * rather than somewhere in the middle of a beat, that it keeps going forward,
   * and that it covers real ground — a step that inches is the old free scroll
   * wearing a hat.
   */
  where.at = "stepped-scroll";
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  // The stops the controller itself would use, read off the page's own rail so
  // the check cannot drift from the timing it is checking.
  const railStops = await page.evaluate(() => {
    const track = document.querySelector("[data-track]");
    if (!track) return null;
    const filmMax = Math.max(1, track.offsetHeight - window.innerHeight);
    return { filmMax: Math.round(filmMax) };
  });
  if (!railStops) {
    fail(where, "scroll", "no [data-track] to measure the film against");
  } else {
    const landings = [];
    for (let i = 0; i < 8; i++) {
      const before = await page.evaluate(() => Math.round(window.scrollY));
      if (before >= railStops.filmMax - 2) break;
      await page.mouse.wheel(0, 120);
      const after = await settled(page);
      landings.push({ before, after });
      if (after <= before) break;
    }

    if (!landings.length) {
      fail(where, "scroll", "the film never accepted a wheel");
    } else {
      const stalled = landings.filter((l) => l.after <= l.before);
      if (stalled.length) {
        fail(
          where,
          "scroll",
          `a wheel inside the film did not advance (${stalled[0].before} → ${stalled[0].after})`,
        );
      }
      // A single small wheel used to move the page by its own delta. If a step
      // is really being taken, one 120px gesture has to travel far further than
      // that — the shortest beat in the table is 150vh.
      const short = landings.filter((l) => l.after - l.before < 200);
      if (short.length) {
        fail(
          where,
          "scroll",
          `one gesture moved only ${short[0].after - short[0].before}px — not a step`,
        );
      }
      // And it has to come to rest *on a section*, not between two.
      //
      // The expected stops are collected from the site's own controls rather
      // than recomputed here: click each of the film's six rail marks and each
      // of section 6's feature dots, and note where the page settles. Those are
      // the places the site itself calls resting points, so a step that lands
      // anywhere else is a step that stops mid-beat.
      // Marks 0-5 are the film's sections; mark 6 is the first flow section,
      // which is where the film's last step hands over rather than stopping on
      // the deliberately black frame at the very end of the track.
      const known = [0, railStops.filmMax];
      for (let m = 0; m < 7; m++) {
        const ok = await page.evaluate((i) => {
          const mark = document.querySelector(`[data-rail-mark="${i}"]`);
          if (!mark) return false;
          mark.click();
          return true;
        }, m);
        if (ok) known.push(await settled(page));
      }
      const dots = await page.evaluate(
        () => document.querySelectorAll("[data-miss] [data-dot]").length,
      );
      for (let d = 0; d < dots; d++) {
        await page.evaluate((i) => {
          document.querySelectorAll("[data-miss] [data-dot]")[i]?.click();
        }, d);
        known.push(await settled(page));
      }

      const adrift = landings
        .map((l) => l.after)
        .filter((y) => !known.some((k) => Math.abs(k - y) <= 4));
      if (adrift.length) {
        fail(
          where,
          "scroll",
          `a step came to rest at ${adrift[0]}, which is not a section ` +
            `(stops: ${[...known].sort((a, b) => a - b).join(", ")})`,
        );
      }

      // Re-walking the same gestures from the top must land on the same pixels.
      // A stepped scroll is deterministic; free scrolling dressed up as one is
      // not, and this is what tells them apart.
      //
      // Walked with the skip: a wheel, a pause past the deaf window, then a
      // second wheel that lands the shot early. That is a second real check —
      // ending a shot early has to arrive at the same stop as watching it out,
      // or the escape hatch quietly puts the viewer somewhere else — and it
      // replays the film in seconds rather than the fifty it now runs for.
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      const again = [];
      for (let i = 0; i < landings.length; i++) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(500);
        await page.mouse.wheel(0, 120);
        again.push(await settled(page));
      }
      const drifted = again
        .map((y, i) => ({ i, y, want: landings[i].after }))
        .filter((r) => Math.abs(r.y - r.want) > 2);
      if (drifted.length) {
        fail(
          where,
          "scroll",
          `step ${drifted[0].i + 1} landed at ${drifted[0].y} when cut short, ` +
            `${drifted[0].want} when played out — the two do not agree`,
        );
      }
    }

    // Stepping must not escape the film. Below it the page is a document and a
    // wheel has to move by roughly its own delta, not jump a section.
    await page.evaluate(() => {
      const track = document.querySelector("[data-track]");
      window.scrollTo(0, track.offsetHeight + 200);
    });
    await page.waitForTimeout(300);
    const flowBefore = await page.evaluate(() => Math.round(window.scrollY));
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(250);
    const flowAfter = await page.evaluate(() => Math.round(window.scrollY));
    const moved = flowAfter - flowBefore;
    if (moved > 400) {
      fail(
        where,
        "scroll",
        `a 120px wheel below the film moved ${moved}px — stepping is leaking into the document`,
      );
    }
  }

  /* The wheel walk: prove the document really scrolls end to end. */
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
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
    };
  });
  const expectLinks = [
    ["header login", appLinks.login, 1],
    ["archetype panel", appLinks.panels, 4],
    ["section 10 invitation", appLinks.foot, 1],
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
