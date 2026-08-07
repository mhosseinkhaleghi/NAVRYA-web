/**
 * Builds a single self-contained HTML preview of the site from the *real*
 * production output — never a hand-written copy, so the preview can't drift
 * from the code.
 *
 *   npm run build && npx next start -p 4173
 *   node scripts/build-preview.mjs [baseUrl] [outFile]
 *
 * It pulls each locale's rendered body, inlines the CSS chunks and every font
 * as a data URI, strips the hydration scripts (the hero is pure HTML + CSS —
 * there is nothing to hydrate), and stacks the five locales in one page behind
 * a small preview control.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.argv[2] ?? "http://localhost:4173";
const OUT = process.argv[3] ?? join(ROOT, "preview", "navrya-hero.html");

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "tr", label: "TR" },
  { code: "fa", label: "FA" },
  { code: "ar", label: "AR" },
  { code: "es", label: "ES" },
];

const text = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
};

/** Rendered body, minus Next's hydration payload and streaming markers. */
function extractBody(html) {
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
  return body
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<template[\s\S]*?<\/template>/g, "")
    .replace(/<div hidden="">[\s\S]*?<\/div>/, "")
    .replace(/<!--\/?\$-->/g, "")
    .trim();
}

function cssHrefs(html) {
  return [...html.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1]);
}

/** Fonts must travel with the page: the artifact CSP blocks every other host. */
async function inlineFonts(css) {
  const refs = [...new Set([...css.matchAll(/url\((['"]?)(\/fonts\/[^'")]+\.woff2)\1\)/g)].map((m) => m[0]))];
  const files = [];
  for (const ref of refs) {
    const file = /(\/fonts\/[^'")]+\.woff2)/.exec(ref)[1];
    const buf = await readFile(join(ROOT, "public", file));
    css = css.replaceAll(ref, `url(data:font/woff2;base64,${buf.toString("base64")})`);
    files.push(file);
  }
  return { css, count: files.length };
}

const MIME = { mp4: "video/mp4", webm: "video/webm", jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const dataUri = async (path) => {
  const buf = await readFile(join(ROOT, "public", path));
  return `data:${MIME[path.split(".").pop()]};base64,${buf.toString("base64")}`;
};

const SCENE_RE = /<div class="[^"]*__scene"[\s\S]*?__scrim"[^>]*><\/div><\/div>/;

/**
 * The backdrop is identical in all five locales, and a data URI cannot be
 * range-requested — inlining it per pane would multiply the whole video by
 * five. It is lifted out once into a shared layer instead, and the switcher
 * re-points its `dir` so the RTL mirror still follows the active locale.
 */
async function inlineScene(scene, seen) {
  const sources = [...scene.matchAll(/<source\b[^>]*>/g)].map((m) => m[0]);
  // One rendition per codec — WebM for the browsers that prefer it, MP4 for
  // the ones without a VP9 decoder — and drop the smaller sizes: CSS still
  // drives the responsive crop, so the compact composition stays testable.
  const keep = ["video/webm", "video/mp4"]
    .map((type) => sources.find((s) => s.includes(`type="${type}"`)))
    .filter(Boolean);
  if (!keep.length) return scene;

  const inlined = [];
  for (const s of keep) {
    const src = /src="([^"]+)"/.exec(s)[1];
    const type = /type="([^"]+)"/.exec(s)[1];
    seen.add(src);
    inlined.push(
      `<source src="${await dataUri(src)}" type="${type}" ` +
        `media="(prefers-reduced-motion: no-preference)">`,
    );
  }

  for (const s of sources) scene = scene.replace(s, keep[0] === s ? inlined.join("") : "");

  const poster = /poster="([^"]+)"/.exec(scene);
  if (poster) {
    seen.add(poster[1]);
    scene = scene.replace(poster[0], `poster="${await dataUri(poster[1])}"`);
  }
  return scene;
}

const HARNESS_CSS = `
/* Preview control — deliberately mute, and built from Navrya's own tokens so
   it never competes with the composition it is framing. */
.nvp{position:fixed;left:16px;bottom:16px;z-index:9999;display:flex;align-items:center;
  gap:2px;padding:5px;border:1px solid rgb(216 166 75 / .34);border-radius:999px;
  background:rgb(3 3 3 / .74);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  font-family:'DM Sans',system-ui,sans-serif;line-height:1;
  transition:opacity .3s cubic-bezier(.22,.61,.36,1)}
.nvp:not(:hover){opacity:.62}
.nvp button{appearance:none;margin:0;border:0;background:none;cursor:pointer;
  font:inherit;color:rgb(237 234 227 / .74);font-size:10px;letter-spacing:.18em;
  padding:7px 9px;border-radius:999px;transition:color .2s,background-color .2s}
.nvp button:hover{color:#ede4d2}
.nvp button[aria-pressed="true"]{color:#d8a64b;background:rgb(216 166 75 / .12)}
.nvp button:focus-visible{outline:1px solid #d8a64b;outline-offset:2px}
.nvp .nvp-sep{width:1px;height:14px;margin:0 4px;background:rgb(216 166 75 / .3)}
.nvp .nvp-node{width:6px;height:6px;border:1px solid #d8a64b;transform:rotate(45deg)}
.nvp-toggle{display:flex;align-items:center;justify-content:center;padding:8px !important}
.nvp[data-open="false"] .nvp-langs,.nvp[data-open="false"] .nvp-sep{display:none}
.nv-locale[hidden]{display:none}
/* The backdrop is shared across the panes, so it lives behind them and the
   panes' own frame background steps aside to let it through. */
#nv-scene{position:fixed;inset:0;z-index:0}
#nv-scene>div{position:absolute;inset:0}
.nv-locale>div{background-color:transparent}
@media (prefers-reduced-motion:reduce){.nvp{transition:none}}
`;

const HARNESS_JS = `
(function(){
  var bar=document.querySelector('.nvp');
  var panes=document.querySelectorAll('.nv-locale');
  var scene=document.getElementById('nv-scene');
  function show(code){
    panes.forEach(function(p){
      p.hidden=p.dataset.loc!==code;
      if(!p.hidden&&scene) scene.dir=p.dir;
    });
    bar.querySelectorAll('[data-set]').forEach(function(b){
      b.setAttribute('aria-pressed',String(b.dataset.set===code));
    });
    if(location.hash.slice(1)!==code) history.replaceState(null,'','#'+code);
  }
  bar.addEventListener('click',function(e){
    var b=e.target.closest('button'); if(!b) return;
    if(b.dataset.set) show(b.dataset.set);
    else bar.dataset.open=bar.dataset.open==='true'?'false':'true';
  });
  var start=location.hash.slice(1);
  show(${JSON.stringify(LOCALES.map((l) => l.code))}.indexOf(start)>-1?start:'en');
  // On a narrow frame the expanded row would sit over the scroll cue, so it
  // starts collapsed and stays out of the composition until it is asked for.
  if(window.innerWidth<480) bar.dataset.open='false';
})();
`;

const pane = (loc, dir, body) =>
  `<div class="nv-locale" data-loc="${loc}" lang="${loc}" dir="${dir}"${loc === "en" ? "" : " hidden"}>\n${body}\n</div>`;

async function main() {
  const first = await text(`${BASE}/en`);
  const hrefs = cssHrefs(first);
  if (!hrefs.length) throw new Error("no stylesheet found — is the production server running?");

  let css = "";
  for (const href of hrefs) css += (await text(BASE + href)) + "\n";
  const inlined = await inlineFonts(css);

  const panes = [];
  const media = new Set();
  let scene = "";
  for (const { code } of LOCALES) {
    const html = code === "en" ? first : await text(`${BASE}/${code}`);
    const dir = /<html[^>]*\bdir="(\w+)"/.exec(html)?.[1] ?? "ltr";
    let body = extractBody(html);
    const found = SCENE_RE.exec(body);
    if (found) {
      if (!scene) scene = await inlineScene(found[0], media);
      body = body.replace(found[0], "");
    }
    panes.push(pane(code, dir, body));
  }
  const sceneLayer = scene ? `<div id="nv-scene" dir="ltr">${scene}</div>\n` : "";

  const controls = LOCALES.map(
    ({ code, label }) =>
      `<button type="button" data-set="${code}" aria-pressed="${code === "en"}">${label}</button>`,
  ).join("");

  const page = `<title>Navrya — Hero Section</title>
<style>${inlined.css}${HARNESS_CSS}</style>
${sceneLayer}${panes.join("\n")}
<div class="nvp" data-open="true" role="group" aria-label="Preview language">
  <button type="button" class="nvp-toggle" aria-label="Toggle preview controls"><span class="nvp-node"></span></button>
  <span class="nvp-sep"></span>
  <span class="nvp-langs">${controls}</span>
</div>
<script>${HARNESS_JS}</script>`;

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, page);
  console.log(
    `${OUT}\n  ${LOCALES.length} locales · ${inlined.count} fonts · ` +
      `${media.size} media (${[...media].map((m) => m.split("/").pop()).join(", ") || "none"}) · ` +
      `${(page.length / 1024 / 1024).toFixed(2)} MB`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
