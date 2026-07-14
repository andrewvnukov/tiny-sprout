import { chromium } from 'playwright';
const URL = 'http://localhost:8347/poc-iso.html';
const browser = await chromium.launch();
// мобильный
let page = await browser.newPage({ viewport: { width: 420, height: 800 }, deviceScaleFactor: 2 });
await page.goto(URL);
await page.waitForTimeout(1500);
await page.screenshot({ path: 'test/shots/poc-mobile.png' });
// зум-ин + пан (проверяем читаемость вблизи)
await page.mouse.wheel(0, -400);
await page.waitForTimeout(200);
await page.mouse.move(210, 400); await page.mouse.down();
await page.mouse.move(120, 500, { steps: 8 }); await page.mouse.up();
await page.waitForTimeout(600);
await page.screenshot({ path: 'test/shots/poc-mobile-zoom.png' });
await page.close();
// десктоп
page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
await page.goto(URL);
await page.waitForTimeout(1500);
await page.screenshot({ path: 'test/shots/poc-desktop.png' });
await browser.close();
console.log('POC shots done');
