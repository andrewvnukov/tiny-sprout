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
// заселим ферму: монеты, зоны, грядки, животные, работники
await page.evaluate(() => { S.coins += 5e6; for (let i=0;i<20;i++) buyPlot(); buyZone(); for (let i=0;i<8;i++) buyPlot(); buyZone(); for (let i=0;i<8;i++) buyPlot();
  buyAnimal('hen'); buyAnimal('hen'); buyAnimal('cow'); buyAnimal('sheep'); buyWorker('harv'); buyWorker('sow');
  for (const p of S.plots) { p.c = Math.floor(Math.random()*3); p.t = 999; } });
await page.evaluate(() => { for (let z=0; z<2; z++) advanceTime(1); });
await page.waitForTimeout(800);
await page.screenshot({ path: 'test/shots/iso-desktop-full.png' });
// зум-аут, чтобы увидеть весь мир
await page.mouse.move(640, 360);
for (let i=0;i<4;i++){ await page.mouse.wheel(0, 300); await page.waitForTimeout(80); }
await page.waitForTimeout(600);
await page.screenshot({ path: 'test/shots/iso-desktop-zoomout.png' });
// пан вниз, к животным
await page.mouse.move(640, 300); await page.mouse.down();
await page.mouse.move(640, 560, { steps: 10 }); await page.mouse.up();
await page.waitForTimeout(500);
await page.screenshot({ path: 'test/shots/iso-desktop-pan.png' });
await browser.close();
console.log('iso shots done; errors:', errs.length ? errs.join('\n') : 'none');
