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

/*
 * The council plate is guarded differently, because the cream test cannot see
 * it: that shot is lit parchment and candlelight and is full of near-white
 * pixels by nature.
 *
 * Its source is a *transition* — it opens on slide 3's labelled map, flashes
 * white, and whips into the council table — so the plate starts at source frame
 * 37 and the risk is not a lost trim but a lost `START`. Losing it would put
 * the labelled map, English and all, at the head of slide 4. So the test is
 * aimed at one place: the patch of frame where slide 3's "Price." callout sits.
 * On the labelled map it reads about 25; on this shot it is dark stone under 8.
 */
const STARTS_CLEAN = [
  { file: "public/scene/commander-council-1080.webm", crop: "90:34:415:245", limit: 12 },
  { file: "public/scene/commander-council-proxy.webm", crop: "40:15:185:109", limit: 12 },
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

for (const { file, crop, limit } of STARTS_CLEAN) {
  const raw = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-vf", `crop=${crop}`, "-f", "rawvideo", "-pix_fmt", "gray", "-"],
    { maxBuffer: 1 << 30 },
  );
  const [w, h] = crop.split(":").map(Number);
  const n = w * h;
  let worst = 0;
  for (let f = 0; f < Math.floor(raw.length / n); f++) {
    let sum = 0;
    for (let p = f * n; p < (f + 1) * n; p++) sum += raw[p];
    worst = Math.max(worst, sum / n);
  }
  const ok = worst <= limit;
  if (!ok) bad++;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${file} — brightest that patch ever gets: ` +
      `${worst.toFixed(1)}, limit ${limit} (the labelled map reads ~25)`,
  );
}

if (bad) {
  console.error(
    "\nA plate carries burned-in lettering, or starts before its own shot does.\n" +
      "Re-encode it over the clean run:\n" +
      "  scripts/encode-scene.sh <source> commander-scatter scrub 0.875\n" +
      "  START=1.583333 scripts/encode-scene.sh <source> commander-council scrub 1.458\n",
  );
  process.exit(1);
}
console.log("\nplates carry no burned-in lettering, and each starts on its own shot.");
