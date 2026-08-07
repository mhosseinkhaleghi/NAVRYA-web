import { chromium } from "playwright";
import fs from "node:fs";

/*
 * Layout audit across the desktop sizes people actually have.
 *
 * At every beat of the timeline, on every viewport, three questions:
 *   · does any block of content overlap the scroll cue, or the header?
 *   · does anything extend past the frame, in either axis?
 *   · is any text clipped by its own box?
 */

const VIEWPORTS = [
  // Real *viewport* sizes, not screen sizes. A Mac loses the menu bar and the
  // browser's own chrome — roughly 150px on a 14" — and that is exactly the
  // room a full-height composition runs out of first.
  ["MacBook Air 13", 1280, 650],
  ["MacBook Pro 14", 1512, 830],
  ["MacBook Pro 16", 1728, 965],
  ["MacBook Air 15", 1440, 750],
  ["MacBook Air 13 scaled", 1440, 810],
  ["Laptop 1366×768", 1366, 625],
  ["Laptop 1600×900", 1600, 760],
  ["FHD 1920×1080", 1920, 937],
  ["1680×1050", 1680, 910],
  ["QHD 2560×1440", 2560, 1300],
  ["4K 3840×2160", 3840, 2020],
  ["Ultrawide 3440×1440", 3440, 1300],
  ["5:4 1280×1024", 1280, 880],
  ["Windowed 1640×1250", 1640, 1250],
  ["Windowed 1200×900", 1200, 900],
  ["Half-screen 960×1040", 960, 1040],
  ["Short window 1500×600", 1500, 600],
];

const TOTAL = 4130;
const STOPS = [];
for (let vh = 20; vh <= 4100; vh += 40) STOPS.push([`${vh}vh`, vh]);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const findings = [];

for (const [name, width, height] of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto("http://localhost:4173/en", { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.dataset.timeline === "live", null, {
    timeout: 30000,
  });
  const max = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );

  for (const [label, vh] of STOPS) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round((max * vh) / TOTAL));
    await page.waitForTimeout(90);

    const issues = await page.evaluate(() => {
      const out = [];
      const W = window.innerWidth, H = window.innerHeight;
      const vis = (el) => {
        const s = getComputedStyle(el);
        if (s.visibility === "hidden" || s.display === "none" || +s.opacity < 0.02) return false;
        for (let n = el.parentElement; n; n = n.parentElement) {
          const p = getComputedStyle(n);
          if (p.visibility === "hidden" || p.display === "none" || +p.opacity < 0.02) return false;
        }
        return true;
      };
      const box = (el) => el.getBoundingClientRect();
      const hit = (a, b) =>
        a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;

      // Live content blocks, the scroll cues, and the header.
      const header = document.querySelector("header");
      const blocks = [];
      for (const sel of [
        '[data-panel][data-active] > div',
        '[data-hero]:not([data-gone]) [class*="content"]',
        "[data-arrow][data-active] h2",
        "[data-arrow][data-active] p",
        '[data-miss][data-active] [class*="statement"]',
        '[data-miss][data-active] [class*="rail"]',
        '[data-miss][data-active] [class*="bezel"]:not([class*="Notch"])',
      ]) {
        for (const el of document.querySelectorAll(sel)) if (vis(el)) blocks.push(el);
      }

      // The cue containers span the full width, so their own box says nothing
      // about where the mark actually is. Measure the union of their children.
      const leaving = (el) => {
        const owner = el.closest("[data-panel], [data-hero], [data-arrow]");
        return owner && +getComputedStyle(owner).getPropertyValue("--exit") > 0.001;
      };
      const cues = [];
      for (const el of document.querySelectorAll('[class*="cue"], [class*="scroll"]')) {
        if (!vis(el) || el.children.length === 0) continue;
        // A cue on a panel that is leaving is *meant* to be flying off frame.
        if (leaving(el)) continue;
        let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity, any = false;
        for (const kid of el.children) {
          if (!vis(kid)) continue;
          const k = box(kid);
          if (k.width < 1 && k.height < 1) continue;
          l = Math.min(l, k.left); r = Math.max(r, k.right);
          t = Math.min(t, k.top);  b = Math.max(b, k.bottom); any = true;
        }
        if (any) cues.push({ el, rect: { left: l, right: r, top: t, bottom: b, width: r - l, height: b - t } });
      }

      for (const blk of blocks) {
        const b = box(blk);
        if (b.height < 4) continue;
        // A block that is mid-exit is *meant* to be leaving the frame.
        const owner = blk.closest("[data-panel], [data-hero], [data-arrow]");
        const exiting = owner && +getComputedStyle(owner).getPropertyValue("--exit") > 0.001;
        if (exiting) continue;
        for (const { el: cueEl, rect: c } of cues) {
          if (blk.contains(cueEl) || cueEl.contains(blk)) continue;
          if (hit(b, c))
            out.push(`content overlaps the scroll cue — content ${Math.round(b.top)}‥${Math.round(b.bottom)}, cue ${Math.round(c.top)}‥${Math.round(c.bottom)}`);
        }
        if (header && vis(header)) {
          const h = box(header);
          if (hit(b, h) && b.top < h.bottom - 2)
            out.push(`content runs under the header — content top ${Math.round(b.top)}, header bottom ${Math.round(h.bottom)}`);
        }
        if (b.bottom > H + 1) out.push(`content past the bottom of the frame by ${Math.round(b.bottom - H)}px`);
        if (b.top < -1) out.push(`content above the top of the frame by ${Math.round(-b.top)}px`);
        if (b.right > W + 1) out.push(`content past the right edge by ${Math.round(b.right - W)}px`);
        if (b.left < -1) out.push(`content past the left edge by ${Math.round(-b.left)}px`);
      }

      for (const { rect: c } of cues) {
        if (c.bottom > H + 1) out.push(`scroll cue past the bottom by ${Math.round(c.bottom - H)}px`);
      }
      if (document.documentElement.scrollWidth > W + 1) out.push("the document scrolls horizontally");
      return [...new Set(out)];
    });

    for (const issue of issues) findings.push({ name, width, height, label, issue });
  }
  await page.close();
  const n = findings.filter((f) => f.name === name).length;
  console.log(`${String(width).padStart(4)}×${String(height).toString().padEnd(4)}  ${name.padEnd(26)} ${n === 0 ? "clean" : n + " issue(s)"}`);
}

console.log("\n───────────── findings ─────────────");
if (!findings.length) console.log("none");
for (const f of findings) {
  console.log(`  ${f.width}×${f.height}  [${f.label}]  ${f.issue}`);
}
fs.writeFileSync(
  "/tmp/claude-0/-home-user-NAVRYA-web/0bda1909-18c0-5a26-ab49-38498f328aa8/scratchpad/audit.json",
  JSON.stringify(findings, null, 2),
);
await browser.close();
