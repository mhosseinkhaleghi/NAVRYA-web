/**
 * The stepped walk, shot by shot.
 *
 * One wheel gesture at a time through the film, a screenshot after each one has
 * come to rest, and a line of numbers saying where it landed and how far it
 * travelled. This is the evidence that a gesture plays a whole shot and stops —
 * the sort of thing a report can claim and only a picture can settle.
 *
 *   node scripts/step-walk.mjs --base=http://127.0.0.1:4175 --locale=en --bp=desktop
 *
 * Writes to verification/<iteration>/steps/<locale>/<breakpoint>/.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const BASE = args.base ?? "http://127.0.0.1:4175";
const LOCALE = args.locale ?? "en";
const ITERATION = String(args.iteration ?? "steps");
const BPS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};
const BP = args.bp ?? "desktop";
const view = BPS[BP];
if (!view) throw new Error(`unknown breakpoint ${BP}`);

const OUT = join(process.cwd(), "verification", ITERATION, "steps", LOCALE, BP);
mkdirSync(OUT, { recursive: true });

/** Waits for the document to stop moving. The budget outlasts the longest step,
 * which at footage speed is about fifteen seconds. */
async function settled(page, { quiet = 3, tick = 90, max = 400 } = {}) {
  let prev = null;
  let still = 0;
  for (let i = 0; i < max; i++) {
    const y = await page.evaluate(() => Math.round(window.scrollY));
    if (y === prev && ++still >= quiet) return y;
    if (y !== prev) still = 0;
    prev = y;
    await page.waitForTimeout(tick);
  }
  return prev;
}

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const launchArgs = ["--autoplay-policy=no-user-gesture-required"];
if (process.env.VERIFY_TLS12 === "1") launchArgs.push("--ssl-version-max=tls1.2");

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: launchArgs,
  proxy: proxy ? { server: proxy, bypass: "localhost,127.0.0.1,::1" } : undefined,
});
const context = await browser.newContext({ viewport: view, deviceScaleFactor: 1 });
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(`uncaught: ${e.message}`));

await page.goto(`${BASE}/${LOCALE}`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page
  .waitForFunction(
    () => document.documentElement.getAttribute("data-timeline") !== "held",
    { timeout: 25000 },
  )
  .catch(() => console.log("! timeline never unlocked"));
await page.waitForTimeout(700);

const filmMax = await page.evaluate(() => {
  const t = document.querySelector("[data-track]");
  return Math.round(Math.max(1, t.offsetHeight - window.innerHeight));
});

/** Which rail mark is lit, and what section 6's deck is showing. */
const readState = () =>
  page.evaluate(() => {
    const lit = [...document.querySelectorAll("[data-rail-mark]")].findIndex((m) =>
      m.hasAttribute("data-on"),
    );
    const dot = [...document.querySelectorAll("[data-miss] [data-dot]")].findIndex(
      (d) => d.getAttribute("aria-current") === "true",
    );
    return { y: Math.round(window.scrollY), lit, dot };
  });

const rows = [];
let shot = 0;
const capture = async (label) => {
  const s = await readState();
  const name = `${String(shot).padStart(2, "0")}-${label}.png`;
  await page.screenshot({ path: join(OUT, name) });
  rows.push({ shot, label, ...s, file: name });
  console.log(
    `${String(shot).padStart(2, "0")}  ${label.padEnd(14)} y=${String(s.y).padStart(6)}` +
      `  rail=${s.lit}  dot=${s.dot}`,
  );
  shot++;
};

await capture("at-rest");

// Down through the film, one gesture per step.
for (let i = 0; i < 14; i++) {
  const before = await page.evaluate(() => Math.round(window.scrollY));
  if (before >= filmMax - 2) break;
  await page.mouse.wheel(0, 120);
  const after = await settled(page);
  await capture(`down-${i + 1}`);
  if (after <= before) {
    console.log(`! gesture ${i + 1} did not move the page (${before} → ${after})`);
    break;
  }
}

// And back up, to prove a step is reversible and the sequence rewinds.
for (let i = 0; i < 3; i++) {
  const before = await page.evaluate(() => Math.round(window.scrollY));
  await page.mouse.wheel(0, -120);
  const after = await settled(page);
  await capture(`up-${i + 1}`);
  if (after >= before) {
    console.log(`! upward gesture ${i + 1} did not move the page`);
    break;
  }
}

writeFileSync(
  join(OUT, "steps.json"),
  JSON.stringify({ base: BASE, locale: LOCALE, bp: BP, filmMax, consoleErrors, rows }, null, 2),
);

console.log(`\nfilmMax ${filmMax} · ${rows.length} shots · ${consoleErrors.length} console errors`);
console.log(OUT);

await browser.close();
