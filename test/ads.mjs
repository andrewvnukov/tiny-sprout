// Вся реклама в игре — только добровольная (rewarded). Проверяем каждый слот:
// ролик показывается, звук на время ролика глушится, награда доходит,
// и нигде не осталось принудительной межстраничной рекламы.
import { chromium } from 'playwright';

const BASE = 'http://localhost:8347/';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXE });

let failed = 0;
const ok = (name, cond, extra) => {
    console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : ''));
    if (!cond) failed++;
};

const MOCK = () => {
    window.__ads = { rewarded: 0, full: 0, audioAtAd: [] };
    window.YaGames = { init: () => Promise.resolve({
        environment: { i18n: { lang: 'ru' } },
        getPlayer: () => Promise.resolve({
            isAuthorized: () => true, getData: () => Promise.resolve({}), setData: () => Promise.resolve(),
        }),
        isAvailableMethod: () => Promise.resolve(true),
        auth: { openAuthDialog: () => Promise.resolve() },
        features: { LoadingAPI: { ready: () => {} } },
        leaderboards: { setScore: () => Promise.resolve(), getEntries: () => Promise.resolve({ userRank: 0, entries: [] }) },
        shortcut: { canShowPrompt: () => Promise.resolve({ canShow: false }), showPrompt: () => Promise.resolve({}) },
        feedback: { canReview: () => Promise.resolve({ value: false, reason: 'GAME_RATED' }), requestReview: () => Promise.resolve({}) },
        adv: {
            // если её кто-то позовёт — тест это заметит
            showFullscreenAdv: ({ callbacks }) => {
                window.__ads.full++;
                setTimeout(() => callbacks && callbacks.onClose && callbacks.onClose(true), 20);
            },
            showRewardedVideo: ({ callbacks }) => {
                window.__ads.rewarded++;
                setTimeout(() => {
                    callbacks.onOpen && callbacks.onOpen();
                    window.__ads.audioAtAd.push(window.__audioState());
                    callbacks.onRewarded && callbacks.onRewarded();
                    callbacks.onClose && callbacks.onClose(true);
                }, 25);
            },
        },
    })};
};

async function launch() {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 760 } });
    const page = await ctx.newPage();
    await page.route('https://yandex.ru/**', r => r.abort());
    await page.addInitScript(MOCK);
    await page.goto(BASE);
    await page.waitForFunction(() => window.render_game_to_text && (() => {
        try { return !!JSON.parse(window.render_game_to_text()).plots; } catch (e) { return false; }
    })(), null, { timeout: 25000 });
    await page.waitForTimeout(600);
    await page.evaluate(async () => {
        window.__audioState = () => {
            try { return (typeof audioContext !== 'undefined' && audioContext) ? audioContext.state : 'none'; }
            catch (e) { return 'none'; }
        };
        S.musVol = 0.5; audioResume();
        await new Promise(r => setTimeout(r, 250));
    });
    return { ctx, page };
}

// Каждый слот: действие -> ожидаемый эффект
const SLOTS = [
    ['буст «Доход x2»', async page => page.evaluate(async () => {
        const before = boostOn();
        adBoost();
        await new Promise(r => setTimeout(r, 400));
        return { ok: !before && boostOn() };
    })],
    ['«Дорастить всё»', async page => page.evaluate(async () => {
        S.plots.forEach(p => { p.c = 0; p.t = 0; });
        adGrowAll();
        await new Promise(r => setTimeout(r, 400));
        return { ok: S.plots.every(p => p.c < 0 || p.t >= cropGrow(CROPS[p.c])), cd: S.adGrowAt > Date.now() };
    })],
    ['офлайн «Продолжить x2»', async page => page.evaluate(async () => {
        S.workers.harv = 3; S.workers.sow = 3; S.workers.seller = 3;
        S.plots.forEach(p => { p.c = 0; p.t = 999; });
        offlineT = 3600;
        const c0 = Math.floor(S.coins), s0 = storeTotal();
        showRewarded(() => offlineBonus());
        await new Promise(r => setTimeout(r, 400));
        return { ok: Math.floor(S.coins) > c0 || storeTotal() > s0 };
    })],
    ['серия «Забрать x2»', async page => page.evaluate(async () => {
        S.tut = 3; S.bestIps = 10; S.streakDay = '';
        const c0 = Math.floor(S.coins);
        showRewarded(() => claimStreak(2));
        await new Promise(r => setTimeout(r, 400));
        return { ok: Math.floor(S.coins) > c0 && S.streak === 1 };
    })],
    ['сундук x2', async page => page.evaluate(async () => {
        S.bestIps = 10;
        S.quests.forEach(q => q.claimed = true);
        S.chestClaimed = false;
        const s0 = S.seeds;
        adChest();
        await new Promise(r => setTimeout(r, 400));
        return { ok: S.seeds - s0 === 2 && S.chestClaimed };
    })],
    ['смена заказа', async page => page.evaluate(async () => {
        // открываем все культуры: с одной пшеницей новый заказ может случайно
        // совпасть со старым, и проверка «изменилось» ловила бы совпадение
        S.crops = S.crops.map(() => true);
        ensureOrders();
        const before = JSON.stringify(S.orders[0]);
        adSkipOrder(0);
        await new Promise(r => setTimeout(r, 400));
        return { ok: JSON.stringify(S.orders[0]) !== before };
    })],
    ['смена квеста дня', async page => page.evaluate(async () => {
        ensureQuests();
        const before = S.quests[0].id;
        adRerollQuest(0);
        await new Promise(r => setTimeout(r, 400));
        return { ok: S.quests[0].id !== before && !S.quests[0].claimed };
    })],
];

for (const [name, run] of SLOTS) {
    const { ctx, page } = await launch();
    const before = await page.evaluate(() => __ads.rewarded);
    const res = await run(page);
    const after = await page.evaluate(() => ({ n: __ads.rewarded, audio: __ads.audioAtAd }));
    ok(`${name}: ролик показан`, after.n === before + 1, after.n);
    ok(`${name}: награда выдана`, res.ok, res);
    ok(`${name}: звук на время ролика заглушён`, after.audio.every(a => a !== 'running'), after.audio);
    await ctx.close();
}

// ---------- смена задания больше не лимитируется ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async () => {
        S.crops = S.crops.map(() => true);
        ensureOrders();
        const seen = new Set();
        for (let i = 0; i < 6; i++) {
            adSkipOrder(0);
            await new Promise(r => setTimeout(r, 120));
            seen.add(JSON.stringify(S.orders[0]));
        }
        return { rewarded: __ads.rewarded, variants: seen.size };
    });
    ok('шесть смен подряд проходят без лимита', res.rewarded === 6, res);
    await ctx.close();
}

// ---------- принудительной рекламы не осталось ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async () => {
        // сидим без действий заметно дольше прежнего порога простоя
        await new Promise(r => setTimeout(r, 4000));
        return { full: __ads.full, hasIdle: typeof idleAdTick, hasBreak: typeof breakAd };
    });
    ok('межстраничная не показывается сама', res.full === 0, res);
    ok('код принудительной рекламы удалён',
       res.hasIdle === 'undefined' && res.hasBreak === 'undefined', res);
    await ctx.close();
}

// ---------- кулдаун «дорастить всё» стал короче ----------
{
    const { ctx, page } = await launch();
    const cd = await page.evaluate(() => AD_GROW_CD);
    ok('кулдаун «дорастить всё» ≤ 60 c', cd <= 60, { AD_GROW_CD: cd });
    await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
