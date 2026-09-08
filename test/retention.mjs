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

// ---------- награды не раздувают престиж ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async () => {
        S.tut = 3; S.bestIps = 50; S.streakDay = '';
        S.quests.forEach(q => q.claimed = true); S.chestClaimed = false;
        const life0 = S.lifeEarned, ips0 = S.ips;
        claimStreak(1);
        claimChest(1);
        return { life: S.lifeEarned - life0, ips: S.ips - ips0, coins: Math.floor(S.coins) > 0 };
    });
    ok('подарки не идут в престиж (lifeEarned)', res.life === 0, res);
    ok('подарки не раздувают доход в секунду', res.ips === 0, res);
    ok('монеты при этом начислены', res.coins, res);
    await ctx.close();
}

// ---------- офлайн: короткие отлучки не отчитываем ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async ({ min, report }) => {
        S.workers.harv = 4; S.workers.sow = 4; S.workers.seller = 4;
        S.plots.forEach(p => { p.c = 0; p.t = 999; });
        const short = { c: Math.floor(S.coins), s: storeTotal() };
        S.time = Date.now() - (report - 600) * 1000;      // отлучка меньше порога сводки
        offlineCheck();
        const shownShort = document.getElementById('offlineModal').classList.contains('open');
        const grewShort = Math.floor(S.coins) > short.c || storeTotal() > short.s;

        S.time = Date.now() - (report + 3600) * 1000;     // а теперь долгая
        offlineCheck();
        const shownLong = document.getElementById('offlineModal').classList.contains('open');
        return { shownShort, grewShort, shownLong,
                 rows: document.querySelectorAll('#offlineList .offRow').length,
                 text: document.getElementById('offlineInfo').textContent.trim() };
    }, { min: 60, report: 5 * 3600 });
    ok('короткая отлучка не показывает сводку', res.shownShort === false, res);
    ok('но доход за неё всё равно начислен', res.grewShort, res);
    ok('после долгой отлучки сводка появляется', res.shownLong, res);
    ok('в сводке перечислено, что принесли работники', res.rows > 0, res);
    await ctx.close();
}

// ---------- прогноз офлайна ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(() => {
        S.ips = 100;
        S.workers.harv = 0; S.workers.sow = 0; S.workers.seller = 3;
        const sellerOnly = offlineForecast();
        S.workers.harv = 2; S.workers.sow = 2;
        const full = offlineForecast();
        openSheet('barnSheet'); renderBarn();
        const withFull = document.getElementById('barnOffline').textContent.trim();
        S.workers.seller = 0; renderBarn();
        const without = document.getElementById('barnOffline').textContent.trim();
        return { sellerOnly, full, withFull, without };
    });
    ok('без полного набора работников прогноз не обещаем', res.sellerOnly === 0, res);
    ok('с полным набором прогноз есть', res.full > 0 && res.withFull.length > 0, res);
    ok('без работников строка пустая, а не нытьё', res.without === '', res);
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
