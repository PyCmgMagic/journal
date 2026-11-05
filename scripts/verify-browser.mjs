// Run against an already running local server. Playwright is a QA tool, not an app dependency.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:4321";
const output = resolve("output/playwright");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE
    ? { executablePath: process.env.BROWSER_EXECUTABLE }
    : {}),
  args: ["--enable-unsafe-swiftshader"],
});
const results = {
  browser: browser.version(),
  date: new Date().toISOString(),
  checks: [],
  errors: [],
};
const mark = (name, detail = true) => {
  results.checks.push({ name, detail });
  console.log(`PASS ${name}`);
};
const screenshot = (page, name) =>
  page.screenshot({ path: resolve(output, name), scale: "css" });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const phase = (page, value) =>
  page.locator(`.journal-app[data-phase="${value}"]`).waitFor();
const ready = async (page) => {
  await page.goto(base);
  await page.locator('[data-scene-mode="webgl"]').waitFor();
  await page.locator(".scene-ready").waitFor();
  await page.waitForFunction(() =>
    document.querySelector('[data-hotspot="stone"]')?.style.left.endsWith("px"),
  );
};
const observe = (page) => {
  page.setDefaultTimeout(8000);
  page.on("pageerror", (e) => results.errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") results.errors.push(m.text());
  });
};
const camera = async (page) =>
  JSON.parse(await page.locator("canvas").getAttribute("data-camera"));

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  observe(page);
  await ready(page);
  await page.mouse.move(720, 450);
  await delay(900);
  await screenshot(page, "01-initial.png");
  await page.mouse.move(110, 640);
  await delay(900);
  const left = await camera(page);
  await screenshot(page, "parallax-left.png");
  await page.mouse.move(1320, 640);
  await delay(900);
  const right = await camera(page);
  await screenshot(page, "parallax-right.png");
  assert.ok(right[0] - left[0] > 0.5);
  mark("damped pointer camera", { left, right });
  const travelDistance = await page.evaluate(
    () => document.documentElement.scrollHeight - innerHeight,
  );
  assert.ok(travelDistance >= 2000);
  await page.mouse.wheel(0, 450);
  await delay(1200);
  const earlyProgress = Number(
    await page.locator(".world-viewport").getAttribute("data-journey-progress"),
  );
  assert.ok(earlyProgress > 0.1 && earlyProgress < 0.25);
  assert.equal(await page.locator(".latest-section").count(), 0);
  const handoffScroll = Math.round(travelDistance * 0.42);
  const readHandoff = () =>
    page
      .locator(".world-viewport")
      .evaluate((element) =>
        Number(element.style.getPropertyValue("--encounter-blend")),
      );
  await page.mouse.wheel(0, handoffScroll - 450);
  await delay(850);
  const handoff = await readHandoff();
  assert.ok(
    handoff > 0.05 && handoff < 0.95,
    "the wheel stops within the handoff",
  );
  await delay(600);
  assert.equal(
    await readHandoff(),
    handoff,
    "a stopped scroll must not advance to the close shot",
  );
  await page.mouse.wheel(0, 450 - handoffScroll);
  await delay(850);
  assert.equal(
    await readHandoff(),
    0,
    "reverse scroll must reverse the handoff",
  );
  mark("scroll-linked handoff stays at the wheel position and reverses", {
    handoff,
  });
  await page.mouse.wheel(0, Math.round(travelDistance * 0.52) - 450);
  await delay(1500);
  const near = await camera(page);
  assert.ok(near[2] < 11.3);
  await screenshot(page, "scroll-approach.png");
  await screenshot(page, "journey-03-station.png");
  await page.mouse.wheel(0, -travelDistance);
  await delay(1500);
  const far = await camera(page);
  assert.ok(Math.abs(far[2] - 12) < 0.02);
  mark("reversible scroll", { near, far });

  await page.mouse.wheel(0, travelDistance + 1000);
  await delay(1600);
  const endViewport = await page.locator(".world-viewport").boundingBox();
  assert.equal(endViewport.y, 0);
  assert.equal(endViewport.height, 900);
  assert.equal(
    await page.locator(".scene-journal").getAttribute("inert"),
    null,
  );
  await screenshot(page, "journey-04-logs.png");
  await page.locator(".scene-journal-post").first().click();
  await page.locator(".prose h1").waitFor();
  await page.getByRole("button", { name: "返回观测站" }).click();
  await page.locator(".content-panel").waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => scrollY), travelDistance);
  await page.goBack();
  await page.locator(".prose h1").waitFor();
  await page.goForward();
  await page.locator(".content-panel").waitFor({ state: "detached" });
  assert.equal(
    await page.locator(".world-viewport").getAttribute("data-journey-stage"),
    "logs",
  );
  await page.getByRole("button", { name: "01远望", exact: true }).click();
  await delay(1800);
  assert.equal(await page.evaluate(() => scrollY), 0);
  assert.equal(
    await page
      .locator(".hero-copy")
      .evaluate((e) => getComputedStyle(e).opacity),
    "1",
  );
  mark(
    "continuous journey: longer range, scene retained at end, article and history return",
    { travelDistance, earlyProgress },
  );

  await page.getByRole("button", { name: "03日志", exact: true }).click();
  await page.locator(".scene-journal-post").first().click();
  await page.locator(".article-panel h1").waitFor();
  await page.getByRole("link", { name: "首页", exact: true }).click();
  await page.locator(".content-panel").waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => scrollY), 0);
  const articlesLink = page.getByRole("link", { name: "文章", exact: true });
  await articlesLink.click();
  await page.getByRole("button", { name: "返回观测站" }).click();
  await articlesLink.click();
  await delay(720);
  assert.equal(await page.locator(".content-panel").isVisible(), true);
  assert.equal(
    await page
      .locator(".content-panel")
      .evaluate((e) => getComputedStyle(e).opacity),
    "1",
  );
  await page.getByRole("button", { name: "返回观测站" }).click();
  await page.locator(".content-panel").waitFor({ state: "detached" });
  mark("Home keeps its destination and reopening cancels the previous exit");

  const stone = page.locator(".monolith-control");
  await stone.hover();
  await delay(500);
  await page.mouse.down();
  await delay(220);
  await page.mouse.up();
  await phase(page, "idle");
  await delay(300);
  mark("early release cancels");
  await page.mouse.down();
  await delay(200);
  // Failure injection: native focus changes are not represented by headless tab activation.
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await phase(page, "idle");
  await page.mouse.up();
  await delay(300);
  mark("blur event cancels");
  await page.mouse.down();
  await delay(200);
  await screenshot(page, "02-charging.png");
  await phase(page, "awakening");
  await page.mouse.up();
  await delay(850);
  await screenshot(page, "wake-wave.png");
  await phase(page, "awake");
  await delay(300);
  await screenshot(page, "03-awakened.png");
  const effects = JSON.parse(
    await page.locator("canvas").getAttribute("data-effects"),
  );
  assert.deepEqual(effects.lamps, [1, 1, 1]);
  assert.equal(effects.stars, 1);
  assert.equal(await stone.isDisabled(), true);
  await phase(page, "awake");
  mark("complete ritual and no reentry", effects);

  const lamp = page.locator('.world-label[data-category="notes"]');
  await lamp.hover();
  await page.locator(".hover-preview").waitFor();
  await screenshot(page, "lamp-preview.png");
  await lamp.click();
  await page.getByRole("heading", { name: "学习笔记", exact: true }).waitFor();
  assert.match(page.url(), /category=notes/);
  mark("lamp preview does not block category");
  await page.locator(".article-row").first().click();
  await page.locator(".prose h1").waitFor();
  await delay(900);
  await screenshot(page, "04-reading.png");
  await screenshot(page, "reading-redesign-desktop.png");
  const articleBounds = await page.locator(".article-panel").boundingBox();
  const bodyBounds = await page
    .locator(".reading-layout > .prose")
    .boundingBox();
  const tocBounds = await page.locator(".desktop-reading-toc").boundingBox();
  assert.equal(articleBounds.x, 0);
  assert.equal(articleBounds.width, 1440);
  assert.ok(articleBounds.y >= 230 && articleBounds.y <= 300);
  assert.ok(tocBounds.x > bodyBounds.x + bodyBounds.width);
  await page.locator(".article-body p").first().click({ clickCount: 3 });
  assert.ok((await page.evaluate(() => getSelection().toString())).length > 5);
  mark("reference 07 full-width reading and selectable text", {
    articleBounds,
    bodyBounds,
    tocBounds,
  });
  const articleUrl = page.url();
  await page.locator(".panel-toc button").last().click();
  await delay(600);
  assert.ok(
    (await page.locator(".panel-scroll").evaluate((e) => e.scrollTop)) > 0,
  );
  mark("HTML article and table of contents");
  await page.goBack();
  await page.getByRole("heading", { name: "学习笔记", exact: true }).waitFor();
  await page.goForward();
  await page.locator(".prose h1").waitFor();
  assert.equal(page.url(), articleUrl);
  await page.getByRole("button", { name: "返回观测站" }).click();
  await page.locator(".content-panel").waitFor({ state: "detached" });
  assert.equal(
    await page.locator(".paint-lamp.is-active").getAttribute("data-hotspot"),
    "notes",
  );
  await page.mouse.move(1000, 650);
  await delay(150);
  await page.mouse.wheel(0, 230);
  await delay(1400);
  const oldY = await page.evaluate(() => scrollY);
  assert.equal(oldY, 230);
  await page.locator('.world-label[data-category="practice"]').click();
  await page.locator(".article-row").first().click();
  await page.locator(".prose h1").waitFor();
  await page.getByRole("button", { name: "返回观测站" }).click();
  await page.locator(".content-panel").waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => scrollY), oldY);
  assert.equal(
    await page.locator(".paint-lamp.is-active").getAttribute("data-hotspot"),
    "practice",
  );
  mark("history and scene scroll/category restoration", { scrollY: oldY });
  await page.mouse.wheel(0, -230);
  await delay(900);
  await page.getByRole("button", { name: "搜索日志" }).click();
  await page.getByRole("searchbox").fill("复杂");
  assert.equal(await page.locator(".article-row").count(), 1);
  await page.getByRole("searchbox").fill("no-result-xy123");
  await page.locator(".empty-message").waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".content-panel").waitFor({ state: "detached" });
  await page.getByRole("link", { name: "归档", exact: true }).click();
  assert.equal(await page.locator(".article-row").count(), 4);
  await page.getByRole("link", { name: "关于", exact: true }).click();
  await page.locator(".panel-about").waitFor();
  mark("search, empty result, archive and about");
  await context.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await mobile.newPage();
  observe(phone);
  await ready(phone);
  await delay(700);
  assert.equal(
    await phone.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await screenshot(phone, "mobile-390.png");
  await phone.getByRole("button", { name: "03日志", exact: true }).tap();
  await delay(1800);
  await screenshot(phone, "journey-mobile-logs.png");
  const mobileEnd = await phone.evaluate(() => scrollY);
  await phone.locator(".scene-journal-post").first().tap();
  await phone.locator(".prose h1").waitFor();
  await phone.getByRole("button", { name: "返回观测站" }).tap();
  await phone.locator(".content-panel").waitFor({ state: "detached" });
  assert.equal(await phone.evaluate(() => scrollY), mobileEnd);
  await phone.getByRole("button", { name: "01远望", exact: true }).tap();
  await delay(1800);
  assert.equal(await phone.evaluate(() => scrollY), 0);
  mark("touch journey, in-scene reading and reverse return");
  const cdp = await mobile.newCDPSession(phone);
  const box = await phone.locator(".mobile-wake").boundingBox();
  const finger = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: finger,
  });
  await delay(220);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await phase(phone, "idle");
  await delay(300);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: finger,
  });
  await delay(1200);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await phase(phone, "awake");
  await screenshot(phone, "mobile-awake.png");
  mark("touch cancel and complete hold");
  await phone.getByRole("button", { name: "实践记录", exact: true }).tap();
  await phone.locator(".article-row").first().tap();
  await phone.locator(".prose h1").waitFor();
  await delay(700);
  await screenshot(phone, "mobile-reading.png");
  await screenshot(phone, "reading-redesign-mobile.png");
  await phone.locator(".mobile-reading-toc summary").tap();
  await phone.locator(".mobile-reading-toc button").last().tap();
  await delay(600);
  assert.equal(
    await phone.locator(".mobile-reading-toc").getAttribute("open"),
    null,
  );
  assert.ok(
    (await phone.locator(".panel-scroll").evaluate((e) => e.scrollTop)) > 0,
  );
  assert.equal(
    await phone.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await phone.getByRole("button", { name: "返回观测站" }).tap();
  await phone.locator(".content-panel").waitFor({ state: "detached" });
  await phone.setViewportSize({ width: 320, height: 740 });
  await ready(phone);
  await delay(600);
  assert.equal(
    await phone.evaluate(() => document.documentElement.scrollWidth),
    320,
  );
  await screenshot(phone, "mobile-320.png");
  await phone.getByRole("button", { name: "更多导航" }).tap();
  await phone.locator(".mobile-menu").getByRole("link", { name: "关于" }).tap();
  await phone.locator(".panel-about").waitFor();
  mark("390/320 mobile reading, menu and viewport fit");
  await mobile.close();

  const reduced = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  const quiet = await reduced.newPage();
  observe(quiet);
  await ready(quiet);
  const initialStone = await quiet
    .locator('[data-hotspot="stone"]')
    .boundingBox();
  await quiet.mouse.move(50, 500);
  await quiet.mouse.wheel(0, 200);
  await delay(600);
  assert.deepEqual(
    await quiet.locator('[data-hotspot="stone"]').boundingBox(),
    initialStone,
  );
  await quiet.locator(".monolith-control").focus();
  await quiet.keyboard.press("Enter");
  await phase(quiet, "awake");
  await quiet.getByRole("link", { name: "文章", exact: true }).click();
  await quiet.locator(".article-row").first().click();
  await quiet.locator(".prose h1").waitFor();
  await quiet.getByRole("button", { name: "返回观测站" }).click();
  await quiet.locator(".content-panel").waitFor({ state: "detached" });
  mark("reduced motion and keyboard equivalent");
  await reduced.close();

  const fallback = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await fallback.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /webgl/.test(type) ? null : get.call(this, type, ...args);
    };
  });
  const flat = await fallback.newPage();
  flat.setDefaultTimeout(8000);
  // Three reports the intentionally unavailable context to console; it must be handled, never a pageerror.
  flat.on("pageerror", (e) => results.errors.push(String(e)));
  await flat.goto(base);
  await flat.locator('[data-scene-mode="fallback"]').waitFor();
  assert.match(await flat.locator(".world-caption").innerText(), /静态插画/);
  await flat.getByRole("link", { name: "阅读日志", exact: true }).click();
  await flat.locator(".article-row").first().click();
  await flat.locator(".prose h1").waitFor();
  mark("WebGL unavailable: truthful fallback and reading");
  await fallback.close();

  const plain = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const direct = await plain.newPage();
  await direct.goto(`${base}/journal/small-questions/`);
  assert.equal(await direct.locator("h1").innerText(), "把复杂问题拆小一点");
  await screenshot(direct, "standalone-mobile.png");
  mark("independent HTML address without JavaScript");
  await plain.close();
  assert.deepEqual(results.errors, []);
  mark("no unhandled script or shader compilation errors");
} catch (error) {
  results.failure = String(error);
  throw error;
} finally {
  await writeFile(
    resolve(output, "browser-results.json"),
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
