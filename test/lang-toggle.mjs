// Переключатель языка: меняем ru → en в настройках, проверяем, что выбор
// применился и пережил перезагрузку, а прогресс не потерялся.
import { chromium } from 'playwright';

const BASE = 'http://localhost:8347/';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
const page = await ctx.newPage();

const ready = () => page.waitForFunction(() => window.render_game_to_text && (() => {
    try { return !!JSON.parse(window.render_game_to_text()).plots; } catch (e) { return false; }
})(), null, { timeout: 15000 });

await page.goto(BASE + '?lang=ru');
await ready();
await page.waitForTimeout(400);

// даём прогресс, чтобы проверить сохранность
await page.evaluate(() => { S.coins = 123456; for (let i = 0; i < 4; i++) buyPlot(); persist(true); renderHud(); });
const before = await page.evaluate(() => JSON.parse(render_game_to_text()).plots.length);
console.log('ru  cropBtn:', (await page.textContent('#cropBtn')).trim(), '| plots:', before);

// открываем настройки и жмём Eng
await page.evaluate(() => openModal('soundModal'));
await page.waitForTimeout(200);
await page.click('.langBtn[data-lang="en"]');
await ready();
await page.waitForTimeout(400);

const afterLang = await page.evaluate(() => LANG);
const after = await page.evaluate(() => JSON.parse(render_game_to_text()).plots.length);
const coins = await page.evaluate(() => Math.floor(S.coins));
console.log('en  cropBtn:', (await page.textContent('#cropBtn')).trim(),
            '| LANG:', afterLang, '| plots:', after, '| coins:', coins,
            '| url:', new URL(page.url()).search || '(no query)');

// перезагрузка без ?lang — выбор должен сохраниться
await page.goto(BASE);
await ready();
await page.waitForTimeout(300);
console.log('reload LANG:', await page.evaluate(() => LANG),
            '| cropBtn:', (await page.textContent('#cropBtn')).trim());

const ok = afterLang === 'en' && after === before && coins > 100000;
console.log(ok ? 'PASS: язык переключился, прогресс цел' : 'FAIL');
await browser.close();
process.exit(ok ? 0 : 1);
