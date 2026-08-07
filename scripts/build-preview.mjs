/**
 * Builds a single self-contained HTML preview of the site from the *real*
 * production output — never a hand-written copy, so the preview can't drift
 * from the code.
 *
 *   npm run build && npx next start -p 4173
 *   node scripts/build-preview.mjs [baseUrl] [outFile]
 *
 * It pulls each locale's rendered body, inlines the CSS chunks, every font and
 * the backdrop as data URIs, drops Next's hydration payload, and stacks the
 * five locales in one page.
 *
 * The site's own inline scripts are carried over, so the intro sequence and the
 * language menu behave exactly as they do in production. The menu's links point
 * at real routes, which do not exist inside a single file, so the harness
 * intercepts them and swaps panes instead.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.argv[2] ?? "http://localhost:4173";
const OUT = process.argv[3] ?? join(ROOT, "preview", "navrya-hero.html");

const LOCALES = [
  { code: "en", dir: "ltr" },
  { code: "tr", dir: "ltr" },
  { code: "fa", dir: "rtl" },
  { code: "ar", dir: "rtl" },
  { code: "es", dir: "ltr" },
];

const text = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
};

/**
 * Rendered body, minus Next's hydration payload and streaming markers.
 *
 * The project's own inline scripts are kept — the intro sequence and the
 * language-menu dismissals are plain inline JS by design, so the preview shows
 * the real behaviour rather than an approximation of it. Only Next's loader
 * and its streamed payload are dropped.
 */
function extractBody(html) {
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
  return body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (tag) =>
      /\bsrc=/.test(tag) || tag.includes("__next_f") || tag.includes("__NEXT")
        ? ""
        : tag,
    )
    .replace(/<template[\s\S]*?<\/template>/g, "")
    .replace(/<div hidden="">[\s\S]*?<\/div>/, "")
    .replace(/<!--\/?\$-->/g, "")
    .trim();
}

/** Pulls the page's inline scripts out so they can run once, not per locale. */
function takeInlineScripts(html) {
  const scripts = [];
  const stripped = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (tag) => {
    scripts.push(tag);
    return "";
  });
  return { stripped, scripts };
}

function cssHrefs(html) {
  return [...html.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1]);
}

const MIME = {
  mp4: "video/mp4", webm: "video/webm",
  jpg: "image/jpeg", png: "image/png", webp: "image/webp",
  woff2: "font/woff2",
};
const dataUri = async (path) => {
  const buf = await readFile(join(ROOT, "public", path));
  return `data:${MIME[path.split(".").pop()]};base64,${buf.toString("base64")}`;
};

/**
 * Everything the stylesheet reaches for has to travel inside the page: the
 * artifact CSP blocks every other host, and a file:// preview has no server.
 * That means the font subsets and the scene stills alike.
 */
async function inlineCssAssets(css) {
  const pattern = /url\((['"]?)(\/(?:fonts|scene)\/[^'")]+)\1\)/g;
  const refs = [...new Set([...css.matchAll(pattern)].map((m) => m[0]))];
  const files = [];
  for (const ref of refs) {
    const file = /(\/(?:fonts|scene)\/[^'")]+)/.exec(ref)[1];
    css = css.replaceAll(ref, `url(${await dataUri(file)})`);
    files.push(file);
  }
  return { css, files };
}

/* The whole backdrop layer: three plates, ending on the last one's video. */
const SCENE_RE = /<div class="[^"]*__scene"[\s\S]*?<\/video><\/div><\/div>/;

/**
 * The backdrop is identical in all five locales, and a data URI cannot be
 * range-requested — inlining it per pane would multiply three videos by five.
 * It is lifted out once into a shared layer instead, and the switcher re-points
 * its `dir` so the RTL mirror still follows the active locale.
 *
 * Only the 720p WebM of each plate travels. Every byte in the page is a byte
 * the viewer waits on before anything renders, and the three 1080p renditions
 * in both codecs would be four times the weight for a preview. CSS still drives
 * the responsive crop and the whole timeline, so nothing about the behaviour is
 * approximated — only the resolution.
 */
async function inlineScene(scene, seen) {
  for (const video of scene.match(/<video\b[\s\S]*?<\/video>/g) ?? []) {
    const sources = video.match(/<source\b[^>]*>/g) ?? [];
    const keep = sources.find((s) => /-720\.webm"/.test(s));
    if (!keep) continue;

    // The proxy, not the shipping rendition. Every byte in this file is a byte
    // the viewer waits on before anything renders, and five plates at shipping
    // quality would put it past the 16MB ceiling.
    const src = /src="([^"]+)"/.exec(keep)[1].replace("-720.webm", "-proxy.webm");
    seen.add(src);
    const inlined =
      `<source src="${await dataUri(src)}" type="video/webm" ` +
      `media="(prefers-reduced-motion: no-preference)">`;

    let next = video;
    for (const s of sources) next = next.replace(s, s === keep ? inlined : "");
    scene = scene.replace(video, next);
  }

  // The stills arrive as custom properties on inline style attributes, and
  // take the matching proxy so a handover never pops in sharpness.
  for (const ref of new Set(scene.match(/url\(&quot;\/scene\/[^&]+&quot;\)/g) ?? [])) {
    const file = /(\/scene\/[^&]+)/.exec(ref)[1].replace(/\.jpg$/, "-proxy.jpg");
    seen.add(file);
    scene = scene.replaceAll(ref, `url(&quot;${await dataUri(file)}&quot;)`);
  }
  return scene;
}

const HARNESS_CSS = `
.nv-locale[hidden]{display:none}
.nv-locale{contain:none}
/* The backdrop is shared across the panes, so it lives behind them and the
   panes' own frame background steps aside to let it through. */
#nv-scene{position:fixed;inset:0;z-index:0}
#nv-scene>div{position:absolute;inset:0}
.nv-locale>div{background-color:transparent}
`;

/**
 * Runs before the plates parse. Without it the scene renders left-to-right and
 * then snaps mirrored the moment the harness sets `dir`, which looks exactly
 * like the footage jumping sideways mid-play.
 */
const HARNESS_DIR = `
(function(){
  var DIRS=${JSON.stringify(Object.fromEntries(LOCALES.map((l) => [l.code, l.dir])))};
  var code=location.hash.slice(1);
  if(!DIRS[code]) code='en';
  document.documentElement.lang=code;
  document.documentElement.dir=DIRS[code];
})();
`;

const HARNESS_JS = `
(function(){
  var CODES=${JSON.stringify(LOCALES.map((l) => l.code))};
  var start=location.hash.slice(1);
  if(CODES.indexOf(start)<0) start='en';

  // Runs synchronously, straight after the panes and before any
  // DOMContentLoaded handler — including the site controller's. Everything but
  // the chosen locale is removed outright rather than hidden, so the
  // controller's document-wide queries bind to the locale actually on screen.
  // Hiding them was not enough: querySelector still found the first pane.
  var panes=document.querySelectorAll('.nv-locale');
  for (var i=0;i<panes.length;i++){
    if (panes[i].dataset.loc===start) panes[i].hidden=false;
    else panes[i].remove();
  }

  // In production a language link is a real navigation: the page reloads and
  // the whole sequence replays from the first frame. Reload here too, rather
  // than swapping text in place, so the preview shows that and not a shortcut.
  document.addEventListener('click',function(e){
    var link=e.target.closest&&e.target.closest('a[href]');
    if(!link) return;
    var match=/^\\/([a-z]{2})$/.exec(link.getAttribute('href')||'');
    if(!match||CODES.indexOf(match[1])<0) return;
    e.preventDefault();
    if(match[1]===start){ location.reload(); return; }
    location.hash=match[1];
    location.reload();
  });
})();
`;

// Every pane ships hidden. The harness un-hides exactly one, synchronously,
// before the controller ever looks at the DOM.
const pane = (loc, dir, body) =>
  `<div class="nv-locale" data-loc="${loc}" lang="${loc}" dir="${dir}" hidden>\n${body}\n</div>`;

async function main() {
  const first = await text(`${BASE}/en`);
  const hrefs = cssHrefs(first);
  if (!hrefs.length) throw new Error("no stylesheet found — is the production server running?");

  let css = "";
  for (const href of hrefs) css += (await text(BASE + href)) + "\n";
  const inlined = await inlineCssAssets(css);

  const panes = [];
  const media = new Set();
  let scene = "";
  let siteScripts = [];
  for (const { code } of LOCALES) {
    const html = code === "en" ? first : await text(`${BASE}/${code}`);
    const dir = /<html[^>]*\bdir="(\w+)"/.exec(html)?.[1] ?? "ltr";
    let body = extractBody(html);

    const found = SCENE_RE.exec(body);
    if (found) {
      if (!scene) scene = await inlineScene(found[0], media);
      body = body.replace(found[0], "");
    }

    // Identical in every locale: run them once, not five times over.
    const taken = takeInlineScripts(body);
    if (!siteScripts.length) siteScripts = taken.scripts;
    panes.push(pane(code, dir, taken.stripped));
  }

  const sceneLayer = scene ? `<div id="nv-scene">${scene}</div>\n` : "";

  // Document order matters here. The controller runs first so it marks the
  // document held-back before anything paints; then the plates, whose data URIs
  // are megabytes of base64 the parser has to chew through — putting them ahead
  // of the controller delayed the opening beat by about a second. The harness
  // goes last, because it prunes panes that must already exist.
  const page = `<title>Navrya — Hero Section</title>
<style>${inlined.css}${HARNESS_CSS}</style>
<script>${HARNESS_DIR}</script>
${siteScripts.join("\n")}
${sceneLayer}${panes.join("\n")}
<script>${HARNESS_JS}</script>`;

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, page);
  console.log(
    `${OUT}\n  ${LOCALES.length} locales · ${inlined.files.length} css assets · ` +
      `${media.size} media (${[...media].map((m) => m.split("/").pop()).join(", ") || "none"}) · ` +
      `${siteScripts.length} inline script(s) carried · ` +
      `${(page.length / 1024 / 1024).toFixed(2)} MB`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
