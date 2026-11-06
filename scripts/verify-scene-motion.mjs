import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const output = resolve("output/playwright/scene-motion");
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
const shot = (name) =>
  page.screenshot({ path: resolve(output, `${name}.png`) });
const pan = () =>
  page.locator(".frame-parallax").evaluate((e) => {
    const m = new DOMMatrix(getComputedStyle(e).transform);
    return { x: m.m41, y: m.m42, scale: m.m11 };
  });
const check = (name, data) => {
  checks.push({ name, data });
  console.log("PASS " + name);
};
const observe = (ms) =>
  page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const start = performance.now(),
          frames = [];
        function sample() {
          const root = document.querySelector(".frames-stage");
          const visible = [...document.querySelectorAll(".scene-frame")].filter(
            (e) => getComputedStyle(e).visibility === "visible",
          );
          frames.push({
            time: performance.now() - start,
            progress: Number(root.dataset.transitionProgress),
            shot: root.dataset.shot,
            count: visible.length,
            opacity: Number(getComputedStyle(visible[0]).opacity),
            transform: getComputedStyle(visible[0]).transform,
          });
          if (performance.now() - start < ms) requestAnimationFrame(sample);
          else resolve(frames);
        }
        sample();
      }),
    ms,
  );
try {
  await page.goto("http://127.0.0.1:4321/");
  await page.locator('[data-scene-mode="frames"]').waitFor();
  await wait(500);
  const title = await page.locator(".hero-copy").boundingBox(),
    header = await page.locator(".site-header").boundingBox();
  await page.mouse.move(100, 540);
  await wait(750);
  const left = await pan();
  await shot("motion-01-left");
  await page.mouse.move(1330, 540);
  await wait(70);
  const partial = await pan();
  await wait(700);
  const right = await pan();
  await shot("motion-02-right");
  assert.ok(right.x - left.x > 25);
  assert.ok(partial.x > left.x && partial.x < right.x - 1);
  assert.deepEqual(await page.locator(".hero-copy").boundingBox(), title);
  assert.deepEqual(await page.locator(".site-header").boundingBox(), header);
  await wait(300);
  assert.deepEqual(await pan(), right);
  check(
    "pointer response is damped, settles, and leaves typography stationary",
    { left, partial, right },
  );
  for (const [x, y] of [
    [20, 120],
    [1420, 120],
    [1420, 880],
    [20, 880],
  ]) {
    await page.mouse.move(x, y);
    await wait(700);
    const box = await page.locator(".overview-frame img").boundingBox();
    assert.ok(
      box.x <= 0 &&
        box.y <= 0 &&
        box.x + box.width >= 1440 &&
        box.y + box.height >= 900,
    );
  }
  check("pointer limits keep all four image edges covered");
  await page.mouse.move(400, 45);
  await wait(750);
  const centered = await pan();
  assert.equal(centered.x, 0);
  assert.equal(centered.y, 0);
  check("leaving the scene recenters the illustration", centered);
  const samples = observe(1400);
  await page.mouse.wheel(0, 850);
  const transition = await samples;
  assert.ok(transition.some((f) => f.opacity > 0.15 && f.opacity < 0.85));
  assert.ok(transition.every((f) => f.count === 1));
  assert.equal(transition.at(-1).shot, "encounter");
  assert.equal(transition.at(-1).opacity, 1);
  await shot("motion-03-encounter");
  check(
    "transition has visible intermediate opacity and resolves to one complete shot",
    transition,
  );
  await page.getByRole("button", { name: "01远望", exact: true }).click();
  await wait(1300);
  const reverseSamples = observe(1500);
  await page.mouse.wheel(0, 800);
  await page.waitForFunction(() => {
    const p = Number(
      document.querySelector(".frames-stage").dataset.transitionProgress,
    );
    return p > 0.04 && p < 0.4;
  });
  await page.mouse.wheel(0, -800);
  const reversed = await reverseSamples;
  const peak = Math.max(...reversed.map((f) => f.progress));
  assert.ok(peak > 0 && peak < 1);
  assert.equal(reversed.at(-1).progress, 0);
  assert.equal(reversed.at(-1).opacity, 1);
  check(
    "reverse scroll reverses the in-flight transition without completing a stale destination",
    { peak, frames: reversed },
  );
  await page.mouse.move(1320, 600);
  await wait(100);
  await page.locator('.world-label[data-category="notes"]').hover();
  await wait(100);
  const held = await pan();
  await wait(400);
  assert.deepEqual(await pan(), held);
  await shot("motion-04-preview");
  await page.locator('.world-label[data-category="notes"]').click();
  await page.locator(".article-row").first().click();
  await page.locator(".prose h1").waitFor();
  await wait(1000);
  const reading = await pan();
  assert.equal(reading.x, 0);
  assert.equal(reading.y, 0);
  await page.mouse.move(1000, 150);
  await wait(500);
  assert.deepEqual(await pan(), reading);
  await shot("motion-05-reading");
  check(
    "hover targets stay still; reading recenters and suspends pointer motion",
    { held, reading },
  );
  await page.getByRole("button", { name: "返回观测站" }).click();
  await page.locator(".content-panel").waitFor({ state: "detached" });
  await wait(500);
  await page.getByRole("button", { name: "02观测站", exact: true }).click();
  await page
    .locator('[data-shot="encounter"][data-transitioning="false"]')
    .waitFor();
  await page.locator(".monolith-control").hover();
  await page.mouse.down();
  await wait(550);
  const charging = await pan();
  await shot("motion-06-charging");
  await page.mouse.up();
  await page.locator('[data-phase="idle"]').waitFor();
  await wait(500);
  check("hold can be cancelled after the transition", charging);
  await page.locator(".monolith-control").hover();
  await page.mouse.down();
  await page.locator('[data-phase="awakening"]').waitFor();
  await page.mouse.up();
  await page.locator('[data-phase="awake"]').waitFor();
  await wait(400);
  await shot("motion-07-awake");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "01远望", exact: true }).click();
  await wait(200);
  const quiet = await pan();
  await page.mouse.move(1320, 600);
  await wait(200);
  assert.deepEqual(await pan(), quiet);
  assert.equal(quiet.scale, 1);
  await page.getByRole("button", { name: "02观测站", exact: true }).click();
  await wait(150);
  assert.equal(
    await page.locator(".frames-stage").getAttribute("data-transitioning"),
    "false",
  );
  assert.equal(
    await page
      .locator(".encounter-frame")
      .evaluate((e) => getComputedStyle(e).opacity),
    "1",
  );
  check(
    "reduced motion retains controls without parallax or transition movement",
    quiet,
  );
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "motion-results.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  const video = page.video();
  await context.close();
  await video.saveAs(resolve(output, "scene-motion-actual.webm"));
  await browser.close();
}
