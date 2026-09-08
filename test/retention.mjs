// Возвращаемость и добровольная реклама:
//   серия ежедневных заходов, прогноз офлайн-дохода, запрос оценки,
//   новые rewarded-слоты (сундук x2, серия x2, смена задания за ролик).
import { chromium } from 'playwright';

const BASE = 'http://localhost:8347/';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXE });

let failed = 0;
const ok = (name, cond, extra) => {
    console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : ''));
    if (!cond) failed++;
};

const MOCK = ({ canReview = true } = {}) => {
    window.__t = { rewarded: 0, reviewChecks: 0, reviewRequests: 0, full: 0 };
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
        feedback: {
            canReview: () => { window.__t.reviewChecks++; return Promise.resolve(canReview ? { value: true } : { value: false, reason: 'GAME_RATED' }); },
            requestReview: () => { window.__t.reviewRequests++; return Promise.resolve({ feedbackSent: true }); },
        },
        adv: {
            showFullscreenAdv: ({ callbacks }) => { window.__t.full++; setTimeout(() => callbacks.onClose && callbacks.onClose(true), 20); },
            showRewardedVideo: ({ callbacks }) => {
                window.__t.rewarded++;
                setTimeout(() => {
                    callbacks.onRewarded && callbacks.onRewarded();
                    callbacks.onClose && callbacks.onClose(true);
                }, 20);
            },
        },
    })};
};

async function launch(opts) {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 760 } });
    const page = await ctx.newPage();
    await page.route('https://yandex.ru/**', r => r.abort());
    await page.addInitScript(MOCK, opts || {});
    await page.goto(BASE);
    await page.waitForFunction(() => window.render_game_to_text && (() => {
        try { return !!JSON.parse(window.render_game_to_text()).plots; } catch (e) { return false; }
    })(), null, { timeout: 25000 });
    await page.waitForTimeout(600);
    return { ctx, page };
}
const yday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const dayBefore2 = () => new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

// ---------- новичку окно серии не показывается ----------
{
    const { ctx, page } = await launch();
    const open = await page.evaluate(() => document.getElementById('streakModal').classList.contains('open'));
    ok('новичка не встречаем окном «ты вернулся»', open === false);
    await ctx.close();
}

// ---------- серия растёт день за днём ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(({ y }) => {
        S.tut = 3; S.bestIps = 10;
        S.streak = 4; S.streakDay = y;             // вчера был 4-й день
        const next = streakNextIndex();
        const c0 = Math.floor(S.coins);
        claimStreak(1);
        return { next, streak: S.streak, gained: Math.floor(S.coins) - c0, day: S.streakDay };
    }, { y: yday() });
    ok('серия продолжается со следующего дня', res.next.streak === 5 && res.streak === 5, res);
    ok('монеты начислены', res.gained > 0, res);
    ok('дата получения записана', res.day === new Date().toISOString().slice(0, 10), res);
    await ctx.close();
}

// ---------- пропуск дня обнуляет серию ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(({ d2 }) => {
        S.tut = 3; S.streak = 6; S.streakDay = d2;   // заходил позавчера
        claimStreak(1);
        return S.streak;
    }, { d2: dayBefore2() });
    ok('пропущенный день обнуляет серию', res === 1, { streak: res });
    await ctx.close();
}

// ---------- в один день награда одна ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(() => {
        S.tut = 3; S.bestIps = 10; S.streakDay = '';
        claimStreak(1);
        const after1 = Math.floor(S.coins);
        claimStreak(1);                              // повторно в тот же день
        return { after1, after2: Math.floor(S.coins), streak: S.streak };
    });
    ok('повторно за день награду не выдают', res.after1 === res.after2 && res.streak === 1, res);
    await ctx.close();
}

// ---------- 7-й день даёт семена ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(({ y }) => {
        S.tut = 3; S.bestIps = 10; S.streak = 6; S.streakDay = y;
        const s0 = S.seeds;
        claimStreak(1);
        return { i: (S.streak - 1) % STREAK_DAYS, seeds: S.seeds - s0 };
    }, { y: yday() });
    ok('седьмой день даёт золотые семена', res.i === 6 && res.seeds === 2, res);
    await ctx.close();
}

// ---------- серия x2 за ролик ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async () => {
        S.tut = 3; S.bestIps = 10; S.streakDay = '';
        showStreakModal();
        await new Promise(r => setTimeout(r, 200));
        const c0 = Math.floor(S.coins);
        document.getElementById('streakX2').click();
        await new Promise(r => setTimeout(r, 300));
        return { rewarded: __t.rewarded, gained: Math.floor(S.coins) - c0, streak: S.streak };
    });
    ok('серия x2 показывает ролик и удваивает награду',
       res.rewarded === 1 && res.gained > 0 && res.streak === 1, res);
    await ctx.close();
}

// ---------- сундук x2 ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async () => {
        S.bestIps = 10;
        S.quests.forEach(q => q.claimed = true);
        S.chestClaimed = false;
        const s0 = S.seeds, c0 = Math.floor(S.coins);
        adChest();
        await new Promise(r => setTimeout(r, 300));
        return { rewarded: __t.rewarded, seeds: S.seeds - s0, coins: Math.floor(S.coins) - c0, claimed: S.chestClaimed };
    });
    ok('сундук x2 даёт двойную награду за ролик',
       res.rewarded === 1 && res.seeds === 2 && res.coins > 0 && res.claimed, res);
    await ctx.close();
}

// ---------- смена задания за ролик сверх лимита ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async () => {
        ensureOrders();
        S.ordSkipT = Date.now(); S.ordSkipN = SKIP_MAX;    // лимит исчерпан
        const before = JSON.stringify(S.orders[0]);
        adSkipOrder(0);
        await new Promise(r => setTimeout(r, 300));
        return { rewarded: __t.rewarded, changed: JSON.stringify(S.orders[0]) !== before, skips: S.ordSkipN };
    });
    ok('сверх лимита заказ меняется за ролик', res.rewarded === 1 && res.changed, res);
    ok('ролик не тратит лимит бесплатных смен', res.skips === 4, res);
    await ctx.close();
}

// ---------- прогноз офлайна ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(() => {
        S.workers.seller = 0; S.ips = 100;
        const noSeller = offlineForecast();
        S.workers.seller = 2;
        const withSeller = offlineForecast();
        openSheet('barnSheet'); renderBarn();
        return { noSeller, withSeller, text: document.getElementById('barnOffline').textContent.trim() };
    });
    ok('без продавца офлайн-дохода не обещаем', res.noSeller === 0, res);
    ok('с продавцом показываем прогноз', res.withSeller > 0 && res.text.length > 0, res);
    await ctx.close();
}

// ---------- оценка игры ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async () => {
        S.cnt.prestiges = 0;
        maybeAskReview();
        await new Promise(r => setTimeout(r, 200));
        const early = __t.reviewRequests;
        S.cnt.prestiges = 1;                         // первый сезон позади
        maybeAskReview();
        await new Promise(r => setTimeout(r, 300));
        return { early, after: __t.reviewRequests, asked: S.reviewAsked };
    });
    ok('до первого сезона оценку не просим', res.early === 0, res);
    ok('после первого сезона запрос отправлен', res.after === 1 && res.asked, res);
    await ctx.close();
}
{
    const { ctx, page } = await launch({ canReview: false });
    const res = await page.evaluate(async () => {
        S.cnt.prestiges = 1;
        let fellBack = false;
        maybeAskReview(() => { fellBack = true; });
        await new Promise(r => setTimeout(r, 300));
        return { requests: __t.reviewRequests, checks: __t.reviewChecks, fellBack };
    });
    ok('если оценка недоступна — requestReview не зовём', res.requests === 0 && res.checks === 1, res);
    ok('вместо неё срабатывает запасной сценарий', res.fellBack, res);
    await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
