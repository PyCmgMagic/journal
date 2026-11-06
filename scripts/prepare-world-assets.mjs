import sharp from "sharp";
import { stat } from "node:fs/promises";

// Current full-frame scenes. Historical layer sources remain untouched.
for (const name of ["observatory-world", "monolith-encounter"]) {
  const output = `public/images/${name}.webp`;
  await sharp(`public/images/${name}.png`)
    .webp({ quality: name === "observatory-world" ? 92 : 94, effort: 5 })
    .toFile(output);
  console.log(name, `${Math.round((await stat(output)).size / 1024)} KB`);
}
