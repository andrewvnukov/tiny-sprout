// Проверка локализации: грузим игру в обеих локалях и снимаем ключевые тексты UI.
import { chromium } from 'playwright';

const URL = 'http://localhost:8347/';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXE });

for (const lang of ['ru', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', m => m.type() === 'error' && errs.push(m.text()));
    page.on('pageerror', e => errs.push(e.message));

    await page.goto(URL + '?lang=' + lang);
    await page.waitForFunction(() => window.render_game_to_text && (() => {
        try { return !!JSON.parse(window.render_game_to_text()).plots; } catch (e) { return false; }
    })(), null, { timeout: 15000 });
    await page.waitForTimeout(500);

    // наполняем состояние, чтобы отрисовались все панели
    await page.evaluate(() => {
        S.coins += 5e6; for (let i = 0; i < 12; i++) buyPlot();
        buyAnimal('hen'); buyWorker('harv'); buyUp('fert');
        for (const p of S.plots) { p.c = 0; p.t = 999; }
        for (let i = 0; i < 6; i++) harvestPlot(i);
        renderHud();
    });

    const out = { lang };
    out.cropBtn  = await page.textContent('#cropBtn');
    out.boostBtn = await page.textContent('#boostBtn');
    out.growBtn  = await page.textContent('#growBtn');
    out.tut      = await page.textContent('#tutText');

    await page.evaluate(() => { openSheet('shopSheet'); renderShop(); });
    out.shopTabs = await page.$$eval('#shopSheet .tab', els => els.map(e => e.textContent.trim()));
    out.shopRow1 = (await page.textContent('#shopList .row')).replace(/\s+/g, ' ').trim();

    await page.evaluate(() => { shopTab = 'work'; renderShop(); });
    out.workerRow = (await page.textContent('#shopList .row')).replace(/\s+/g, ' ').trim();

    await page.evaluate(() => { closeAllSheets(); openSheet('barnSheet'); renderBarn(); });
    out.barnCap = (await page.textContent('#barnCap')).replace(/\s+/g, ' ').trim();
    out.barnRow = (await page.textContent('#barnList .row')).replace(/\s+/g, ' ').trim();

    await page.evaluate(() => { closeAllSheets(); openSheet('orderSheet'); renderOrders(); });
    out.orderRow = (await page.textContent('#orderList .row')).replace(/\s+/g, ' ').trim();

    await page.evaluate(() => { closeAllSheets(); openSheet('albumSheet'); albumTab = 'ach'; renderAlbum(); });
    out.achRow = (await page.textContent('#albumList .row')).replace(/\s+/g, ' ').trim();

    await page.evaluate(() => { closeAllSheets(); S.lifeEarned = 5e6; showPrestige(); });
    out.prestige = (await page.textContent('#prestigeInfo')).replace(/\s+/g, ' ').trim().slice(0, 160);

    console.log(JSON.stringify(out, null, 1));
    const real = errs.filter(e => !/No parent to post message|appId from environment|YandexGamesSDKEnvironment/.test(e));
    console.log(lang + ' errors:', real.length ? real.join('\n') : 'none');
    console.log('---');
    await ctx.close();
}
await browser.close();
