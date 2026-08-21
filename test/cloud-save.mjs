// Облачные сохранения (тумблер в черновике включён).
// Проверяем: прогресс уходит в player.setData, при уходе со страницы запись
// дожимается флагом flush, а обычная игра не жжёт лимит (100 запросов / 5 мин).
import { chromium } from 'playwright';

const BASE = 'http://localhost:8347/';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXE });

let failed = 0;
const ok = (name, cond, extra) => {
    console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : ''));
    if (!cond) failed++;
};

// Мок хранит облако отдельно от localStorage, чтобы их нельзя было перепутать.
const MOCK = ({ cloud }) => {
    const calls = [];
    window.__save = calls;
    let store = cloud ? { save: cloud } : {};
    const player = {
        isAuthorized: () => true,
        getData: () => Promise.resolve(store),
        setData: (d, flush) => { calls.push({ flush: !!flush, bytes: (d.save || '').length }); store = d; return Promise.resolve(); },
    };
    window.YaGames = { init: () => Promise.resolve({
        environment: { i18n: { lang: 'ru' } },
        getPlayer: () => Promise.resolve(player),
        isAvailableMethod: () => Promise.resolve(true),
        auth: { openAuthDialog: () => Promise.resolve() },
        features: { LoadingAPI: { ready: () => {} } },
        leaderboards: { setScore: () => Promise.resolve(), getEntries: () => Promise.resolve({ userRank: 0, entries: [] }) },
    })};
};

async function launch(opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
    const page = await ctx.newPage();
    await page.route('https://yandex.ru/**', r => r.abort());
    await page.addInitScript(MOCK, opts);
    await page.goto(BASE);
    await page.waitForFunction(() => window.render_game_to_text && (() => {
        try { return !!JSON.parse(window.render_game_to_text()).plots; } catch (e) { return false; }
    })(), null, { timeout: 25000 });
    await page.waitForTimeout(500);
    return { ctx, page };
}

// ---------- прогресс уходит в облако ----------
{
    const { ctx, page } = await launch();
    await page.evaluate(() => { __save.length = 0; S.coins = 777777; buyPlot(); });
    await page.waitForTimeout(400);
    const calls = await page.evaluate(() => __save);
    ok('покупка отправляется в облако', calls.length >= 1, calls);
    ok('сейв укладывается в лимит 200 КБ', calls.every(c => c.bytes < 200 * 1024),
       calls.map(c => c.bytes));
    ok('обычная запись поставлена в очередь, а не форсирована',
       calls.every(c => c.flush === false), calls);
    await ctx.close();
}

// ---------- уход со страницы дожимает запись ----------
{
    const { ctx, page } = await launch();
    await page.evaluate(() => { __save.length = 0; S.coins = 424242; buyPlot(); });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(400);
    const calls = await page.evaluate(() => __save);
    ok('при сворачивании запись отправлена немедленно',
       calls.some(c => c.flush === true), calls);
    await ctx.close();
}

// ---------- частое сворачивание не жжёт лимит ----------
{
    const { ctx, page } = await launch();
    await page.evaluate(() => { __save.length = 0; });
    for (let i = 0; i < 10; i++) {
        await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            Object.defineProperty(document, 'hidden', { value: false, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
        });
    }
    await page.waitForTimeout(500);
    const flushes = await page.evaluate(() => __save.filter(c => c.flush).length);
    ok('десять сворачиваний подряд дают один форсированный запрос', flushes === 1, { flushes });
    await ctx.close();
}

// ---------- облачный сейв приоритетнее локального ----------
{
    const cloud = JSON.stringify({ v: 1, coins: 987654, seeds: 42, plots: [{ c: -1, t: 0, g: false }] });
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
    const page = await ctx.newPage();
    await page.route('https://yandex.ru/**', r => r.abort());
    // кладём заведомо другой прогресс в localStorage до запуска игры
    await page.addInitScript(c => {
        try { localStorage.setItem('tinysprout', JSON.stringify({ v: 1, coins: 111, seeds: 0 })); } catch (e) {}
    });
    await page.addInitScript(MOCK, { cloud });
    await page.goto(BASE);
    await page.waitForFunction(() => window.render_game_to_text && (() => {
        try { return !!JSON.parse(window.render_game_to_text()).plots; } catch (e) { return false; }
    })(), null, { timeout: 25000 });
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => ({ coins: Math.floor(S.coins), seeds: S.seeds }));
    ok('при запуске берётся облачный сейв, а не локальный', st.coins === 987654 && st.seeds === 42, st);
    await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
