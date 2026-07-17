import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 460, height: 820 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => { if(!/No parent|appId|Yandex/.test(e.message)) errs.push(e.message); });
await page.goto('http://localhost:8347/');
await page.waitForFunction(() => window.render_game_to_text && (()=>{try{return !!JSON.parse(render_game_to_text()).plots}catch(e){return false}})(), null, { timeout: 15000 });
await page.waitForTimeout(600);

// buy animals + tractor
await page.evaluate(() => {
    S.coins += 5e6;
    buyAnimal('hen'); buyAnimal('cow'); buyAnimal('sheep');
    buyWorker('tract');
});
await page.waitForTimeout(400);

// camera over the cow/sheep pens, zoomed in
await page.evaluate(() => {
    const g = isoWorld(1.2, 10);          // ~cow pen
    camX = g.x; camY = g.y; camScale = camMax; applyCam();
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'test/shots/art-animals.png' });

// trigger tractor, camera to field
await page.evaluate(() => { camX = FIELD_CX; camY = FIELD_CY; camScale = Math.min(camMax, 60); applyCam(); fxTractor(); });
await page.waitForTimeout(1400);
await page.screenshot({ path: 'test/shots/art-tractor.png' });

// sound modal — sliders should be centered (50)
await page.click('#muteBtn');
await page.waitForTimeout(300);
const sliders = await page.evaluate(() => ({ sfx: +sfxSlider.value, mus: +musSlider.value, open: soundModal.classList.contains('open') }));
console.log('sound modal:', JSON.stringify(sliders));
await page.screenshot({ path: 'test/shots/art-sound.png' });
await page.click('#soundModal .close2');
await page.waitForTimeout(200);

// tooltip on coin chip
await page.click('#coinChip');
await page.waitForTimeout(250);
const tip = await page.evaluate(() => ({ shown: hudTip.classList.contains('show'), text: hudTip.textContent.slice(0,24) }));
console.log('tooltip:', JSON.stringify(tip));
await page.screenshot({ path: 'test/shots/art-tip.png' });

console.log('errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close();
