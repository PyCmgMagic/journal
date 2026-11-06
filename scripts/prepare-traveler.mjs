import sharp from "sharp";
import { writeFile } from "node:fs/promises";

// Repack authored full poses onto one shared hip / ground anchor. No limbs
// are cut apart. Source sheets are retained alongside the production atlas.
const dir = "public/images/layers";
const width = 384,
  height = 448,
  baseline = 420,
  hip = 224;
const composites = [],
  registration = [];
for (let frame = 0; frame < 12; frame++) {
  const walking = frame < 8;
  const source = `${dir}/traveler-${walking ? "walk" : "poses"}-v2.png`;
  const meta = await sharp(source).metadata();
  const rows = walking ? 2 : 3;
  const column = frame % 4,
    row = walking ? Math.floor(frame / 4) : 2;
  const x = Math.round((column * meta.width) / 4);
  const y = Math.round((row * meta.height) / rows);
  const crop = {
    left: x,
    top: y,
    width: Math.round(((column + 1) * meta.width) / 4) - x,
    height: Math.round(((row + 1) * meta.height) / rows) - y,
  };
  const { data, info } = await sharp(source)
    .extract(crop)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width,
    right = 0,
    top = info.height,
    bottom = 0;
  for (let cy = 0; cy < info.height; cy++)
    for (let cx = 0; cx < info.width; cx++) {
      if (data[(cy * info.width + cx) * 4 + 3] < 96) continue;
      left = Math.min(left, cx);
      right = Math.max(right, cx);
      top = Math.min(top, cy);
      bottom = Math.max(bottom, cy);
    }
  // Torso centre is unaffected by the wide scarf or by a forward foot.
  const xs = [];
  for (
    let cy = Math.round(top + (bottom - top) * 0.43);
    cy < top + (bottom - top) * 0.5;
    cy++
  )
    for (let cx = left; cx <= right; cx++)
      if (data[(cy * info.width + cx) * 4 + 3] > 160) xs.push(cx);
  xs.sort((a, b) => a - b);
  const anchor = xs[Math.floor(xs.length / 2)];
  const scale = 368 / (bottom - top + 1);
  const w = Math.round((right - left + 1) * scale),
    h = 368;
  const input = await sharp(data, { raw: info })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(w, h)
    .png()
    .toBuffer();
  const dx = Math.round(hip - (anchor - left) * scale),
    dy = baseline - h;
  if (dx < 0 || dx + w > width)
    throw new Error(`Frame ${frame} escapes its cell`);
  composites.push({
    input,
    left: (frame % 4) * width + dx,
    top: Math.floor(frame / 4) * height + dy,
  });
  registration.push({
    frame,
    source,
    crop,
    bounds: [left, top, right, bottom],
    anchor,
    offset: [dx, dy],
    size: [w, h],
  });
}
const atlas = await sharp({
  create: {
    width: width * 4,
    height: height * 3,
    channels: 4,
    background: "#00000000",
  },
})
  .composite(composites)
  .png()
  .toBuffer();
await writeFile(`${dir}/traveler-animation.png`, atlas);
await sharp(atlas)
  .webp({ quality: 95, alphaQuality: 100, effort: 5 })
  .toFile(`${dir}/traveler-animation.webp`);
await writeFile(
  `${dir}/traveler-animation.json`,
  JSON.stringify(
    { columns: 4, rows: 3, cell: [width, height], hip, baseline, registration },
    null,
    2,
  ),
);
console.log(
  "Packed 8 walk and 4 standing/reach poses; shared ground and torso registration.",
);
