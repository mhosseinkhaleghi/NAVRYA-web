/**
 * The scatter plate must carry no burned-in lettering.
 *
 * The source for the features page's third slide is three seconds long and its
 * eight callouts *draw themselves into the footage* from frame 22 onward, in
 * English. Shipped whole, a Persian reader would get a Persian page with English
 * labels painted into the picture — unfixable in CSS, and exactly the fault the
 * site had just been corrected for elsewhere. So the plate is trimmed to the
 * clean run before them and the labels are set as text, which is what makes the
 * slide work in five languages off one video.
 *
 * That trim is a number in a shell command, and a number in a shell command is
 * the kind of thing a re-encode quietly loses. This is the guard.
 *
 * The test is colour, not shape: the lettering is cream — bright in all three
 * channels — while the map is black rock lit by ember reds and golds, which are
 * never bright in blue. Counting near-white pixels separates them cleanly. The
 * lit keep and the gold columns peak at two or three such pixels per frame, so
 * the threshold sits above that and far below the ~40 the first word brings.
 *
 *   node scripts/check-plate-clean.mjs
 */
import { execFileSync } from "node:child_process";

const PLATES = [
  { file: "public/scene/commander-scatter-1080.webm", limit: 8 },
  { file: "public/scene/commander-scatter-proxy.webm", limit: 8 },
];

const W = 479;
const H = 270;
let bad = 0;

for (const { file, limit } of PLATES) {
  const raw = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-vf", `scale=${W}:${H}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    { maxBuffer: 1 << 30 },
  );
  const n = W * H * 3;
  let worst = 0;
  let worstFrame = -1;
  for (let f = 0; f < Math.floor(raw.length / n); f++) {
    let cream = 0;
    for (let p = f * n; p < (f + 1) * n; p += 3) {
      if (raw[p] > 120 && raw[p + 1] > 120 && raw[p + 2] > 120) cream++;
    }
    if (cream > worst) {
      worst = cream;
      worstFrame = f;
    }
  }
  const ok = worst <= limit;
  if (!ok) bad++;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${file} — worst frame ${worstFrame}: ${worst} cream pixel(s), limit ${limit}`,
  );
}

if (bad) {
  console.error(
    "\nA plate carries burned-in lettering. Re-encode it trimmed to the clean run:\n" +
      "  scripts/encode-scene.sh <source> commander-scatter scrub 0.875\n",
  );
  process.exit(1);
}
console.log("\nplates carry no burned-in lettering.");
