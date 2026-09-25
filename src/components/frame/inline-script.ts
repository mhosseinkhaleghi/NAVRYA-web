/**
 * Prepares a controller written as a template literal for inlining.
 *
 * The controllers are documented at length, and every word of that used to
 * ship: an inline script is in the page once as the script and a second time as
 * a string inside the RSC payload, so the stage controller alone put ~150KB of
 * prose into every document. The notes belong in the source, not in the bytes
 * a phone has to download and parse before first paint.
 *
 * Comments and indentation only — no renaming, no rewriting. That is safe for
 * these scripts because none of them carries `//` or `/*` inside a string or a
 * regular expression; a trailing `//` note is only removed when nothing on its
 * line after it is a quote, so a string can never be cut short. The result is
 * then compiled, so a script this breaks fails the build instead of the page.
 */
export function inlineScript(source: string): string {
  const out = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "")
    .replace(/[ \t]+\/\/[^'"`\n]*$/gm, "")
    .replace(/^[ \t]+/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
  // A syntax check, run once at build time when the page is rendered.
  new Function(out);
  return out;
}
