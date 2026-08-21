// Чеклист площадки перед первой публикацией — пункты, проверяемые кодом.
//   §1.6  контекстное меню отключено в игровой области
//   §1.3  звук паузится при потере фокуса
//   §4.7  звук паузится на время рекламного ролика
//   §4.5  rewarded показывается только по явному действию игрока
//   §1.15 нет просадок производительности
//   §1.14 нет JS-ошибок при загрузке
import { chromium } from 'playwright';

const BASE = 'http://localhost:8347/';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXE });

let failed = 0;
const ok = (name, cond, extra) => {
    console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : ''));
    if (!cond) failed++;
};

// Мок SDK с рекламой: фиксируем порядок колбэков и состояние звука.
const MOCK = () => {
    window.__ad = { shown: 0, audio: [] };
    window.YaGames = { init: () => Promise.resolve({
        environment: { i18n: { lang: 'ru' } },
        getPlayer: () => Promise.resolve({
            isAuthorized: () => true, getData: () => Promise.resolve({}), setData: () => Promise.resolve(),
        }),
        isAvailableMethod: () => Promise.resolve(true),
        auth: { openAuthDialog: () => Promise.resolve() },
        features: { LoadingAPI: { ready: () => {} } },
        leaderboards: { setScore: () => Promise.resolve(), getEntries: () => Promise.resolve({ userRank: 0, entries: [] }) },
        adv: {
            // проигрываем полный жизненный цикл ролика
            showRewardedVideo: ({ callbacks }) => {
                window.__ad.shown++;
                setTimeout(() => {
                    callbacks.onOpen && callbacks.onOpen();
                    window.__ad.audio.push(['open', window.__audioState()]);
                    setTimeout(() => {
                        callbacks.onRewarded && callbacks.onRewarded();
                        callbacks.onClose && callbacks.onClose();
                        window.__ad.audio.push(['close', window.__audioState()]);
                    }, 120);
                }, 40);
            },
        },
    })};
};

async function launch() {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await page.route('https://yandex.ru/**', r => r.abort());
    await page.addInitScript(MOCK);
    await page.goto(BASE);
    await page.waitForFunction(() => window.render_game_to_text && (() => {
        try { return !!JSON.parse(window.render_game_to_text()).plots; } catch (e) { return false; }
    })(), null, { timeout: 25000 });
    await page.waitForTimeout(600);
    // помощник: текущее состояние аудиоконтекста
    await page.evaluate(() => {
        window.__audioState = () => {
            try { return (typeof audioContext !== 'undefined' && audioContext) ? audioContext.state : 'none'; }
            catch (e) { return 'none'; }
        };
    });
    return { ctx, page, errs };
}

// ---------- §1.6 контекстное меню ----------
{
    const { ctx, page } = await launch();
    const prevented = await page.evaluate(() => {
        const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        document.body.dispatchEvent(e);
        return e.defaultPrevented;
    });
    ok('§1.6 контекстное меню подавлено', prevented);
    await ctx.close();
}

// ---------- §1.3 звук паузится при потере фокуса ----------
{
    const { ctx, page } = await launch();
    const st = await page.evaluate(async () => {
        S.musVol = 0.5; audioResume();
        await new Promise(r => setTimeout(r, 300));
        const before = __audioState();
        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
        await new Promise(r => setTimeout(r, 300));
        return { before, after: __audioState() };
    });
    ok('§1.3 при сворачивании звук не остаётся активным', st.after !== 'running', st);
    await ctx.close();
}

// ---------- §4.7 звук паузится на время ролика + §4.5 только по действию ----------
{
    const { ctx, page } = await launch();
    const before = await page.evaluate(() => __ad.shown);
    ok('§4.5 реклама не показывается сама по себе', before === 0, { shown: before });

    const res = await page.evaluate(async () => {
        S.musVol = 0.5; audioResume();
        await new Promise(r => setTimeout(r, 300));
        document.getElementById('boostBtn').click();      // явное действие игрока
        await new Promise(r => setTimeout(r, 500));
        return { shown: __ad.shown, audio: __ad.audio, boost: boostOn() };
    });
    ok('§4.5 ролик показан по нажатию кнопки', res.shown === 1, res);
    const atOpen = (res.audio.find(a => a[0] === 'open') || [])[1];
    ok('§4.7 во время ролика звук заглушён', atOpen !== 'running', res.audio);
    ok('награда выдана после просмотра', res.boost === true);
    await ctx.close();
}

// ---------- §1.15 производительность ----------
{
    const { ctx, page } = await launch();
    const fps = await page.evaluate(async () => {
        // разворачиваем ферму целиком — максимальная нагрузка на отрисовку
        S.coins = 1e15; buyZone(); buyZone();
        for (let i = 0; i < MAXPLOTS + 4; i++) buyPlot();
        for (const a of ANIMALS) for (let i = 0; i < a.max; i++) buyAnimal(a.id);
        S.plots.forEach((p, i) => { p.c = i % CROPS.length; p.t = cropGrow(CROPS[p.c]); });
        await new Promise(r => setTimeout(r, 400));
        return await new Promise(res => {
            let frames = 0; const t0 = performance.now();
            const step = () => {
                camX += 0.1; if (camX > 6) camX = -12; applyCam();
                frames++;
                if (performance.now() - t0 < 2500) requestAnimationFrame(step);
                else res(Math.round(frames / ((performance.now() - t0) / 1000)));
            };
            requestAnimationFrame(step);
        });
    });
    ok('§1.15 частота кадров при панорамировании полной фермы', fps >= 45, { fps });
    await ctx.close();
}

// ---------- §1.14 нет JS-ошибок ----------
{
    const { ctx, page, errs } = await launch();
    await page.waitForTimeout(1500);
    const real = errs.filter(e => !/yandex\.ru|favicon|ERR_CONNECTION|ERR_FAILED/.test(e));
    ok('§1.14 консоль чистая при загрузке', real.length === 0, real);
    await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
