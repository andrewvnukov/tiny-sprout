// Межстраничная реклама: показывается по простою и в естественных паузах,
// но не должна приедаться и не должна ловить игрока посреди действия.
import { chromium } from 'playwright';

const BASE = 'http://localhost:8347/';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXE });

let failed = 0;
const ok = (name, cond, extra) => {
    console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : ''));
    if (!cond) failed++;
};

const MOCK = ({ wasShown = true, canShortcut = false } = {}) => {
    window.__ads = { full: 0, rewarded: 0, audio: [], shortcutPrompts: 0 };
    window.YaGames = { init: () => Promise.resolve({
        environment: { i18n: { lang: 'ru' } },
        getPlayer: () => Promise.resolve({
            isAuthorized: () => true, getData: () => Promise.resolve({}), setData: () => Promise.resolve(),
        }),
        isAvailableMethod: () => Promise.resolve(true),
        auth: { openAuthDialog: () => Promise.resolve() },
        features: { LoadingAPI: { ready: () => {} } },
        leaderboards: { setScore: () => Promise.resolve(), getEntries: () => Promise.resolve({ userRank: 0, entries: [] }) },
        shortcut: {
            canShowPrompt: () => Promise.resolve({ canShow: canShortcut }),
            showPrompt: () => { window.__ads.shortcutPrompts++; return Promise.resolve({ outcome: 'accepted' }); },
        },
        adv: {
            showFullscreenAdv: ({ callbacks }) => {
                window.__ads.full++;
                setTimeout(() => {
                    callbacks.onOpen && callbacks.onOpen();
                    window.__ads.audio.push(window.__audioState());
                    callbacks.onClose && callbacks.onClose(wasShown);
                }, 30);
            },
            showRewardedVideo: ({ callbacks }) => {
                window.__ads.rewarded++;
                setTimeout(() => {
                    callbacks.onOpen && callbacks.onOpen();
                    callbacks.onRewarded && callbacks.onRewarded();
                    callbacks.onClose && callbacks.onClose(true);
                }, 30);
            },
        },
    })};
};

async function launch(opts) {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 } });
    const page = await ctx.newPage();
    await page.route('https://yandex.ru/**', r => r.abort());
    await page.addInitScript(MOCK, opts);
    await page.goto(BASE);
    await page.waitForFunction(() => window.render_game_to_text && (() => {
        try { return !!JSON.parse(window.render_game_to_text()).plots; } catch (e) { return false; }
    })(), null, { timeout: 25000 });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
        window.__audioState = () => {
            try { return (typeof audioContext !== 'undefined' && audioContext) ? audioContext.state : 'none'; }
            catch (e) { return 'none'; }
        };
        // помощник: сделать вид, что игрок давно бездействует и пауза выдержана
        window.__idle = () => { lastInputAt = Date.now() - AD_IDLE_S * 1000 - 1000; nextAdAt = 0; };
    });
    return { ctx, page };
}

// ---------- в начале сессии рекламы нет ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async () => {
        lastInputAt = Date.now() - AD_IDLE_S * 1000 - 5000;   // игрок бездействует…
        idleAdTick();                                          // …но сессия только началась
        await new Promise(r => setTimeout(r, 200));
        return { shown: __ads.full, warmupLeft: nextAdAt > Date.now() };
    });
    ok('в прогреве сессии реклама не показывается', res.shown === 0 && res.warmupLeft, res);
    await ctx.close();
}

// ---------- активная игра рекламу не прерывает ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async () => {
        nextAdAt = 0;
        lastInputAt = Date.now();          // игрок только что нажимал
        idleAdTick();
        await new Promise(r => setTimeout(r, 200));
        return __ads.full;
    });
    ok('во время активной игры реклама не показывается', res === 0, { shown: res });
    await ctx.close();
}

// ---------- простой -> показ ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async () => {
        S.musVol = 0.5; audioResume();
        await new Promise(r => setTimeout(r, 250));
        __idle(); idleAdTick();
        await new Promise(r => setTimeout(r, 300));
        return { shown: __ads.full, audio: __ads.audio };
    });
    ok('после простоя реклама показана', res.shown === 1, res);
    ok('§4.7 звук на время ролика заглушён', res.audio[0] !== 'running', res.audio);
    await ctx.close();
}

// ---------- пауза между показами ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async () => {
        __idle(); idleAdTick();
        await new Promise(r => setTimeout(r, 300));
        const after = { shown: __ads.full, gapS: Math.round((nextAdAt - Date.now()) / 1000) };
        // сразу пробуем ещё раз, продолжая бездействовать
        lastInputAt = Date.now() - AD_IDLE_S * 1000 - 1000;
        idleAdTick(); idleAdTick(); idleAdTick();
        await new Promise(r => setTimeout(r, 300));
        after.total = __ads.full;
        return after;
    });
    ok('повторные попытки в паузу не показывают рекламу', res.total === 1, res);
    ok('пауза между показами близка к AD_GAP_S', res.gapS >= 180, res);
    await ctx.close();
}

// ---------- если платформа показ не отдала, ждём меньше ----------
{
    const { ctx, page } = await launch({ wasShown: false });
    const gap = await page.evaluate(async () => {
        __idle(); idleAdTick();
        await new Promise(r => setTimeout(r, 300));
        return Math.round((nextAdAt - Date.now()) / 1000);
    });
    ok('при wasShown:false пауза короче', gap > 0 && gap <= 60, { gapS: gap });
    await ctx.close();
}

// ---------- не поверх открытых панелей ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async () => {
        openSheet('shopSheet');
        __idle(); idleAdTick();
        await new Promise(r => setTimeout(r, 250));
        return __ads.full;
    });
    ok('поверх открытой панели рекламы нет', res === 0, { shown: res });
    await ctx.close();
}

// ---------- не перебиваем оплаченный рекламой буст ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async () => {
        S.boostUntil = Date.now() + 120000;
        __idle(); idleAdTick();
        await new Promise(r => setTimeout(r, 250));
        return __ads.full;
    });
    ok('во время буста за rewarded рекламы нет', res === 0, { shown: res });
    await ctx.close();
}

// ---------- rewarded отодвигает межстраничную ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async () => {
        nextAdAt = 0;
        document.getElementById('growBtn').click();     // добровольный ролик
        await new Promise(r => setTimeout(r, 300));
        const gapS = Math.round((nextAdAt - Date.now()) / 1000);
        lastInputAt = Date.now() - AD_IDLE_S * 1000 - 1000;
        idleAdTick();
        await new Promise(r => setTimeout(r, 250));
        return { rewarded: __ads.rewarded, full: __ads.full, gapS };
    });
    ok('сразу после rewarded межстраничной нет', res.rewarded === 1 && res.full === 0, res);
    await ctx.close();
}

// ---------- ярлык на главный экран ----------
{
    const { ctx, page } = await launch({ canShortcut: true });
    const res = await page.evaluate(async () => {
        const seeds0 = S.seeds;
        shortcutOffer();
        await new Promise(r => setTimeout(r, 300));
        const opened = document.getElementById('shortcutModal').classList.contains('open');
        document.getElementById('shortcutGo').click();
        await new Promise(r => setTimeout(r, 300));
        return { opened, prompts: __ads.shortcutPrompts, gained: S.seeds - seeds0, asked: S.scAsked, done: S.scDone };
    });
    ok('карточка ярлыка показана', res.opened, res);
    ok('нативный промпт вызван по нажатию', res.prompts === 1, res);
    ok('за установку выдана награда', res.gained === 1 && res.done, res);
    await ctx.close();
}
{
    const { ctx, page } = await launch({ canShortcut: true });
    const res = await page.evaluate(async () => {
        S.scAsked = true;                 // уже предлагали
        shortcutOffer();
        await new Promise(r => setTimeout(r, 300));
        return document.getElementById('shortcutModal').classList.contains('open');
    });
    ok('повторно ярлык не навязывается', res === false);
    await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
