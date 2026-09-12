// Скриншоты для черновика Яндекс Игр.
//   desktop 1920×1080 (1280×720 @1.5)   mobile 1080×1920 (360×640 @3)
// Обе локали. Геймплей занимает почти весь кадр — требование площадки (≥70%).
//
//   node test/store-shots.mjs        # нужен http-сервер на :8347
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const BASE = 'http://localhost:8347/';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = 'store/screenshots';

const FORMS = {
    desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 },
    mobile:  { viewport: { width: 360,  height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

// богатая ферма: все зоны и грядки, разные культуры на разных стадиях, животные
const SETUP = () => {
    // сначала «безлимит», иначе дорогие покупки молча проваливаются
    // (24-я грядка стоит ~4·10^8, а витринный баланс мы ставим в самом конце)
    S.coins = 1e15;
    S.seeds = 14; S.lifeEarned = 9.5e6; S.claimedSeeds = 14;
    S.cnt.prestiges = 2;
    buyZone(); buyZone();
    for (let i = 0; i < MAXPLOTS + 4; i++) buyPlot();
    for (let i = 0; i < CROPS.length; i++) { S.crops[i] = true; S.disc[i] = true; }
    for (const a of ANIMALS) for (let i = 0; i < a.max; i++) buyAnimal(a.id);   // полные загоны
    for (let i = 0; i < 3; i++) buyWorker('harv');
    for (let i = 0; i < 2; i++) buyWorker('sow');
    buyWorker('seller');
    for (let i = 0; i < 4; i++) buyUp('fert');
    for (let i = 0; i < 3; i++) buyUp('wh');
    // грядки: в основном спелые — так они выглядят живо и разнообразно
    S.plots.forEach((p, i) => {
        p.c = i % CROPS.length;
        const g = cropGrow(CROPS[p.c]);
        p.t = [g, g, g, g * 0.8, g, g * 0.55][i % 6];
        p.g = i % 6 === 2;
    });
    S.store = { wheat: 12, carrot: 9, potato: 6, tomato: 4, egg: 5, milk: 2 };
    S.tut = 3;
    S.coins = 4.2e6;             // витринный баланс
    renderHud(); renderTut();
};

// тосты достижений от SETUP не должны попадать в кадр
const HIDE_TOAST = () => {
    const t = document.getElementById('toast');
    if (t) { t.classList.remove('show'); t.textContent = ''; }
};

// Кадры подобраны под реальные габариты мира: грядки x −9.9…4.3, y −7.9…−0.7,
// дом (−11.4, −0.7), пруд (0, −9.4).
// camScale — device-пиксели на юнит мира (mainCanvasSize уже с учётом DPR),
// поэтому у мобильного кадра числа выше: 1080×1920 против 1920×1080.
// Потолок: camMax = 72·min(2, DPR) — 108 на десктопе, 144 на мобиле.
const CAMS = {
    desktop: [
        { name: '1-farm',    cam: { x: -3.6, y: -4.3, s: 84 } },    // вся ферма целиком
        { name: '2-beds',    cam: { x: -2.8, y: -4.2, s: 104 } },   // грядки крупно
        { name: '3-animals', cam: { x: -8.0, y: -6.2, s: 92 } },    // загоны
    ],
    mobile: [
        { name: '1-farm',    cam: { x: -3.8, y: -4.3, s: 92 } },
        { name: '2-beds',    cam: { x: -2.6, y: -4.0, s: 124 } },
        { name: '3-animals', cam: { x: -8.2, y: -5.9, s: 92 } },
    ],
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE });
const shots = [];

for (const [form, opts] of Object.entries(FORMS)) {
    for (const lang of ['ru', 'en']) {
        const ctx = await browser.newContext({ ...opts, locale: lang === 'en' ? 'en-US' : 'ru-RU' });
        const page = await ctx.newPage();
        const errs = [];
        page.on('pageerror', e => errs.push(e.message));

        await page.goto(BASE + '?lang=' + lang);
        await page.waitForFunction(() => window.render_game_to_text && (() => {
            try { return !!JSON.parse(window.render_game_to_text()).plots; } catch (e) { return false; }
        })(), null, { timeout: 20000 });
        await page.waitForTimeout(600);
        await page.evaluate(SETUP);
        await page.waitForTimeout(600);

        for (const { name, cam } of CAMS[form]) {
            await page.evaluate(c => { camX = c.x; camY = c.y; camScale = c.s; applyCam(); }, cam);
            await page.waitForTimeout(500);
            await page.evaluate(HIDE_TOAST);
            const path = `${OUT}/${form}-${lang}-${name}.png`;
            await page.screenshot({ path });
            shots.push(path);
        }

        // четвёртый кадр — открытая витрина магазина поверх фермы
        await page.evaluate(c => { camX = c.x; camY = c.y; camScale = c.s; applyCam(); }, CAMS[form][0].cam);
        await page.evaluate(() => { shopTab = 'seeds'; openSheet('shopSheet'); renderShop(); });
        await page.waitForTimeout(600);
        await page.evaluate(HIDE_TOAST);
        const p4 = `${OUT}/${form}-${lang}-4-shop.png`;
        await page.screenshot({ path: p4 });
        shots.push(p4);

        const real = errs.filter(e => !/No parent to post message|appId from environment|YandexGamesSDKEnvironment/.test(e));
        if (real.length) console.log(`!! ${form}/${lang} errors:`, real.join('; '));
        await ctx.close();
    }
}
await browser.close();
console.log('saved', shots.length, 'screenshots to', OUT);
