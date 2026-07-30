#!/usr/bin/env node
/**
 * make-mascot-cutouts.mjs — turn the baked-paper mascot JPEGs into real
 * transparent PNG cutouts.
 *
 * WHY: every /images/brand/argus-v2/*.jpg is a JPEG, and JPEG has no alpha
 * channel. So each mascot ships with its own cream rectangle (plus a painted
 * vignette) baked into the pixels. Dropping one onto a paper section shows that
 * rectangle as a visible box — no CSS can remove it, because the box IS the
 * image. `mix-blend-mode: multiply` was the previous workaround and it made
 * things worse: multiplying the image's cream (#ede6da-ish) by the section's
 * cream (#ebe2d0) yields a patch DARKER than either, i.e. a darker box.
 *
 * The fix is an actual alpha channel. Method (deterministic, no model):
 *   1. sample the four corners → the paper base colour
 *   2. flood-fill inward from every border pixel, taking any pixel within
 *      `tolerance` of the paper base — connectivity is what protects the dog's
 *      own cream chest/paws, which a global luminance threshold would eat
 *   3. drop stray kept islands (the faint printed rule, vignette speckle)
 *   4. feather the alpha ~1px and erode a hair, so edges antialias without a
 *      bright paper fringe on dark backgrounds
 *   5. trim to the content bbox and write a PNG
 *
 * Run: node scripts/make-mascot-cutouts.mjs [--out DIR]
 * Source JPEGs stay untouched — the cutouts are written alongside as *-cut.png.
 */

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'public/images/brand/argus-v2');

const outArgIdx = process.argv.indexOf('--out');
const OUT_DIR = outArgIdx > -1 ? process.argv[outArgIdx + 1] : SRC_DIR;

// Only the full-illustration mascots. The face mark is a deliberate plated
// avatar (ArgusFaceMark draws its own rounded plate) — it keeps its background.
const SOURCES = [
  'argus-watching.jpg',
  'argus-canon.jpg',
  'argus-companion.jpg',
  'argus-returning.jpg',
];

// How far a pixel may sit from the sampled paper base and still count as
// background. Generous enough to swallow the painted vignette (which darkens
// the corners by ~8%), tight enough that the pencil outline around a cream paw
// still stops the fill.
const TOLERANCE = 46;

// Longest edge of the emitted cutout.
const MAX_EDGE = 900;

async function cut(file) {
  const src = join(SRC_DIR, file);
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const at = (x, y) => (y * W + x) * C;

  // 1 · paper base = median-ish of the four corner blocks
  const samples = [];
  for (const [ox, oy] of [[0, 0], [W - 10, 0], [0, H - 10], [W - 10, H - 10]]) {
    for (let y = oy; y < oy + 10; y++) {
      for (let x = ox; x < ox + 10; x++) {
        const i = at(x, y);
        samples.push([data[i], data[i + 1], data[i + 2]]);
      }
    }
  }
  const base = [0, 1, 2].map((k) => {
    const col = samples.map((s) => s[k]).sort((a, b) => a - b);
    return col[Math.floor(col.length / 2)];
  });

  const near = (i) => {
    const dr = data[i] - base[0];
    const dg = data[i + 1] - base[1];
    const db = data[i + 2] - base[2];
    return Math.sqrt(dr * dr + dg * dg + db * db) <= TOLERANCE;
  };

  // 2 · flood fill from the border (4-connected, explicit stack — recursion
  // would blow the stack on a 1200x686 plate)
  const bg = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    const p = y * W + x;
    if (bg[p]) return;
    if (!near(at(x, y))) return;
    bg[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % W, y = (p / W) | 0;
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }

  // 3 · drop tiny kept islands (printed rule fragments, speckle)
  const seen = new Uint8Array(W * H);
  let removed = 0;
  for (let p0 = 0; p0 < W * H; p0++) {
    if (bg[p0] || seen[p0]) continue;
    const comp = [];
    const st = [p0];
    seen[p0] = 1;
    while (st.length) {
      const p = st.pop();
      comp.push(p);
      const x = p % W, y = (p / W) | 0;
      const nb = [];
      if (x > 0) nb.push(p - 1);
      if (x < W - 1) nb.push(p + 1);
      if (y > 0) nb.push(p - W);
      if (y < H - 1) nb.push(p + W);
      for (const q of nb) if (!bg[q] && !seen[q]) { seen[q] = 1; st.push(q); }
    }
    if (comp.length < 900) {
      for (const p of comp) bg[p] = 1;
      removed += comp.length;
    }
  }

  // 4 · alpha mask → feather. Erode by one pixel first so the antialiased rim
  // keeps the subject's own colour rather than a ring of paper.
  const alpha = Buffer.alloc(W * H);
  for (let p = 0; p < W * H; p++) alpha[p] = bg[p] ? 0 : 255;
  const eroded = Buffer.alloc(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (!alpha[p]) { eroded[p] = 0; continue; }
      const l = x > 0 ? alpha[p - 1] : 255;
      const r = x < W - 1 ? alpha[p + 1] : 255;
      const u = y > 0 ? alpha[p - W] : 255;
      const d = y < H - 1 ? alpha[p + W] : 255;
      eroded[p] = (l && r && u && d) ? 255 : 0;
    }
  }
  // NOTE: sharp hands a 1-channel raw buffer BACK as 3 channels, so read the
  // reported stride instead of assuming 1 — indexing it as [p] silently samples
  // every third pixel and yields a mask that looks like melted nonsense.
  const blurred = await sharp(eroded, { raw: { width: W, height: H, channels: 1 } })
    .blur(0.9)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const stride = blurred.info.channels;
  const softAlpha = Buffer.alloc(W * H);
  for (let p = 0; p < W * H; p++) softAlpha[p] = blurred.data[p * stride];

  // 5 · compose + trim to content
  const rgba = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    const i = at(p % W, (p / W) | 0);
    rgba[p * 4] = data[i];
    rgba[p * 4 + 1] = data[i + 1];
    rgba[p * 4 + 2] = data[i + 2];
    rgba[p * 4 + 3] = softAlpha[p];
  }
  // Own bbox, not sharp's .trim(): trim keys off the top-left pixel's COLOUR,
  // which on a fully transparent border is undefined enough that it collapsed
  // one plate to 137x1. Alpha is the ground truth here, so read it directly.
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (softAlpha[y * W + x] < 8) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const PAD = 2; // breathing room so the feathered rim is never clipped
  x0 = Math.max(0, x0 - PAD); y0 = Math.max(0, y0 - PAD);
  x1 = Math.min(W - 1, x1 + PAD); y1 = Math.min(H - 1, y1 + PAD);

  // WebP, not PNG: same lossless-looking line art with alpha at ~1/9 the bytes
  // (85KB vs 738KB for the watching plate), and next/image reads it natively.
  const out = join(OUT_DIR, basename(file, '.jpg') + '-cut.webp');
  mkdirSync(dirname(out), { recursive: true });
  // The largest rendered mascot is 256px CSS wide, so cap the long edge at
  // MAX_EDGE — 3x the biggest display size, and a third of the file weight of
  // the untouched plate.
  const meta = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(out);

  const kept = W * H - bg.reduce((a, b) => a + b, 0);
  console.log(
    `${file} → ${basename(out)}  ${meta.width}x${meta.height}  ` +
    `base=rgb(${base.join(',')})  subject=${((kept / (W * H)) * 100).toFixed(1)}%  ` +
    `islands_dropped=${removed}px  ${(meta.size / 1024).toFixed(0)}KB`,
  );
}

for (const f of SOURCES) await cut(f);
