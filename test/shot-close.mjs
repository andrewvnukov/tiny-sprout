import { chromium } from 'playwright';
const URL = 'http://localhost:8347/';
const browser = await chromium.launch();
const errs = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
page.on('console', m => m.type() === 'error' && errs.push(m.text()));
page.on('pageerror', e => errs.push(e.message));
await page.goto(URL);
await page.waitForFunction(() => window.render_game_to_text && (() => { try { return !!JSON.parse(window.render_game_to_text()).plots; } catch(e) { return false; } })(), null, { timeout: 15000 });
await page.waitForTimeout(700);
await page.evaluate(() => { S.coins += 5e6; for (let i=0;i<20;i++) buyPlot(); buyZone(); for (let i=0;i<8;i++) buyPlot();
  buyAnimal('hen'); buyAnimal('cow'); buyAnimal('sheep');
  for (const p of S.plots) { p.c = Math.floor(Math.random()*3); p.t = 999; } });
await page.waitForTimeout(500);
// крупный план дома
await page.evaluate(() => { camX = -9.9; camY = -1.5; camScale = 70; applyCam(); });
await page.waitForTimeout(400);
await page.screenshot({ path: 'test/shots/iso-close-house.png' });
// крупный план грядок
await page.evaluate(() => { camX = 0; camY = -1; camScale = 70; applyCam(); });
await page.waitForTimeout(400);
await page.screenshot({ path: 'test/shots/iso-close-beds.png' });
// крупный план загона
await page.evaluate(() => { camX = -8; camY = -7.5; camScale = 60; applyCam(); });
await page.waitForTimeout(400);
await page.screenshot({ path: 'test/shots/iso-close-paddock.png' });
// FPS во время пана
const fps = await page.evaluate(() => new Promise(res => {
  let frames = 0, t0 = performance.now();
  const step = () => {
    camX += 0.12; if (camX > 8) camX = -14; applyCam();
    frames++;
    if (performance.now() - t0 < 2000) requestAnimationFrame(step);
    else res(Math.round(frames / ((performance.now() - t0) / 1000)));
  };
  requestAnimationFrame(step);
}));
console.log('FPS while panning:', fps);
await browser.close();
const real = errs.filter(e => !/No parent to post message|appId from environment|YandexGamesSDKEnvironment/.test(e));
console.log('close shots done; errors:', real.length ? real.join('\n') : 'none');
