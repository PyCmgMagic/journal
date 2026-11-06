import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const output = resolve("output/playwright/scene-cuts");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: {
    dir: resolve(output, "video"),
    size: { width: 1440, height: 900 },
  },
});
const page = await context.newPage(),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = () => page.locator(".frames-stage").getAttribute("data-shot");
const capture = (name) =>
  page.screenshot({ path: resolve(output, `${name}.png`) });
const check = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
try {
  await page.goto("http://127.0.0.1:4321/");
  await page.locator('[data-scene-mode="frames"]').waitFor();
  await wait(500);
  await capture("actual-01-overview");
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 150);
    await wait(100);
  }
  await wait(450);
  assert.equal(await shot(), "encounter");
  await capture("actual-02-encounter");
  for (const delta of [-300, 700, -750, 700]) {
    await page.mouse.wheel(0, delta);
    await wait(450);
    const visible = await page
      .locator(".scene-frame")
      .evaluateAll(
        (nodes) =>
          nodes.filter((n) => getComputedStyle(n).visibility === "visible")
            .length,
      );
    assert.equal(visible, 1);
  }
  assert.equal(await shot(), "encounter");
  check(
    "rapid forward/reverse always leaves exactly one complete shot visible",
  );
  const before = await page.evaluate(() => scrollY);
  await page.getByRole("link", { name: "文章", exact: true }).click();
  await page.locator(".article-row").first().click();
  await page.locator(".prose h1").waitFor();
  await wait(750);
  await capture("actual-06-reading");
  await page.getByRole("button", { name: "返回观测站" }).click();
  await page.locator(".content-panel").waitFor({ state: "detached" });
  await wait(500);
  assert.equal(await shot(), "encounter");
  assert.equal(await page.evaluate(() => scrollY), before);
  check(
    "reading opened from the close shot restores that shot and exact scroll",
  );
  await page.locator(".monolith-control").hover();
  await page.mouse.down();
  await wait(250);
  await page.mouse.up();
  await wait(400);
  assert.equal(
    await page.locator(".journal-app").getAttribute("data-phase"),
    "idle",
  );
  await page.mouse.down();
  await wait(500);
  await capture("actual-03-charging");
  await page.locator('[data-phase="awakening"]').waitFor();
  await page.mouse.up();
  await page.locator('[data-shot="overview"]').waitFor();
  await wait(1200);
  await capture("actual-04-wave");
  await page.locator('[data-phase="awake"]').waitFor();
  await wait(400);
  await capture("actual-05-awake");
  check("cancel then retry wakes the same scene and cuts back to the overview");
  await page.getByRole("button", { name: "02观测站", exact: true }).click();
  await wait(800);
  assert.equal(await shot(), "encounter");
  await capture("actual-07-revisit");
  check("station navigation still revisits the lit close shot after awakening");
  await page.getByRole("button", { name: "01远望", exact: true }).click();
  await wait(1000);
  await page.locator('.world-label[data-category="notes"]').hover();
  await wait(300);
  await capture("actual-08-preview");
  await page.locator('.world-label[data-category="notes"]').click();
  await wait(800);
  await capture("actual-09-category");
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "cut-checks.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  const video = page.video();
  await context.close();
  await video.saveAs(resolve(output, "scene-cuts-actual.webm"));
  await browser.close();
}
