// Устойчивость: возвращение после долгого отсутствия и повреждённые сейвы.
// Оба пути молчаливые — игрок не пишет баг-репорт, он просто не возвращается.
import { chromium } from 'playwright';

const BASE = 'http://localhost:8347/';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXE });

let failed = 0;
const ok = (name, cond, extra) => {
    console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : ''));
    if (!cond) failed++;
};

// развитая ферма со всеми работниками: худший случай по объёму досчёта
const save = extra => JSON.stringify(Object.assign({
    v: 1, coins: 5e5, seeds: 12, tut: 3, lifeEarned: 4e6, seasonEarned: 4e6,
    ips: 400, bestIps: 400, lastCrop: 2, zones: 3,
    crops: new Array(12).fill(true), disc: new Array(12).fill(true),
    plots: Array.from({ length: 24 }, () => ({ c: 2, t: 0, g: false })),
    store: {}, up: { fert: 5, comp: 5, wh: 8, gold: 3 },
    workers: { harv: 5, sow: 5, seller: 5 },
    animals: { hen: 4, cow: 3, sheep: 2 }, animT: { hen: 0, cow: 0, sheep: 0 },
    orders: [], ordTok: 3, ordTokT: Date.now(), quests: [], qday: '',
    cnt: { harvests: 900, sold: 900, planted: 900, orders: 30, taps: 50, aprods: 80,
           goldens: 20, prestiges: 1, cropsAll: 0, plotsAll: 0, animAll: 0 },
    ach: {}, streak: 2, streakDay: new Date().toISOString().slice(0, 10),
    tips: { ad: true, work: true }, reviewAsked: true, scAsked: true,
    time: Date.now() - 12 * 3600 * 1000,
}, extra));

// запуск с мок-SDK, который считает обращения к облаку
async function launch(raw, withSdk) {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 800 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.route('https://yandex.ru/**', r => r.abort());
    await page.addInitScript(([s, sdk]) => {
        try { localStorage.setItem('tinysprout', s); } catch (e) {}
        window.__cloud = 0; window.__ls = 0;
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) { if (k === 'tinysprout') window.__ls++; return set.call(this, k, v); };
        if (!sdk) return;
        window.YaGames = { init: () => Promise.resolve({
            environment: { i18n: { lang: 'ru' }, payload: null },
            features: { LoadingAPI: { ready() {} } },
            getPlayer: () => Promise.resolve({
                getData: () => Promise.resolve({}),
                setData: () => { window.__cloud++; return Promise.resolve(); },
                isAuthorized: () => true, getUniqueID: () => 'u1',
            }),
            adv: { showRewardedVideo: o => {
                const c = o.callbacks || {};
                c.onOpen && c.onOpen(); c.onRewarded && c.onRewarded(); c.onClose && c.onClose();
            } },
            leaderboards: { setScore: () => Promise.resolve(), getEntries: () => Promise.resolve({ entries: [] }) },
            isAvailableMethod: () => Promise.resolve(true),
            shortcut: { canShowPrompt: () => Promise.resolve({ canShow: false }) },
            feedback: { canReview: () => Promise.resolve({ value: false }) },
        }) };
    }, [raw, !!withSdk]);
    const t0 = Date.now();
    await page.goto(BASE);
    let booted = true;
    try { await page.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 30000 }); }
    catch (e) { booted = false; }
    const bootMs = Date.now() - t0;
    await page.waitForTimeout(700);
    return { ctx, page, errs, booted, bootMs };
}

// ---------- досчёт офлайна не должен жечь лимит облачных сохранений ----------
{
    const { ctx, page, booted, bootMs, errs } = await launch(save(), true);
    ok('после 12 ч офлайна игра запускается', booted, { bootMs, errs: errs.slice(0, 1) });
    const r = await page.evaluate(() => ({
        cloud: window.__cloud, ls: window.__ls,
        pops: pops.length, floats: floats.length,
        coins: Math.floor(S.coins), modal: !!document.querySelector('#offlineModal.open'),
    }));
    // лимит платформы — 100 запросов setData за 5 минут; раньше здесь было ~2900
    ok('досчёт не спамит облако', r.cloud <= 5, r);
    ok('досчёт не спамит localStorage', r.ls <= 5, r);
    // частицы копятся до первой отрисовки: за ночь их набегало 180 тысяч
    ok('частицы не копятся за офлайн', r.pops < 500 && r.floats < 500, r);
    ok('запуск быстрый, платформа не ждёт', bootMs < 8000, { bootMs });
    ok('сводка показана', r.modal, r);
    ok('офлайн начислил монеты', r.coins > 5e5, r);
    await ctx.close();
}

// ---------- квесты дня нельзя выполнить, пока тебя нет ----------
{
    const { ctx, page } = await launch(save(), true);
    const r = await page.evaluate(() => ({
        quests: S.quests.map(q => ({ id: q.id, prog: qProg(q), n: q.n })),
        chest: S.chestClaimed,
    }));
    const done = r.quests.filter(q => q.prog >= q.n).length;
    ok('офлайн не выполняет квесты дня за игрока', done === 0, r);
    ok('прогресс квестов не уходит в минус', r.quests.every(q => q.prog >= 0), r);
    await ctx.close();
}

// ---------- живой прогресс квестов переживает отлучку ----------
{
    const day = new Date().toISOString().slice(0, 10);
    // квест «продай 20» уже наполовину сделан вживую: 900 продаж при базе 890
    const raw = save({ qday: day, quests: [
        { id: 'sell', cnt: 'sold', name: 'Продай овощей', n: 20, start: 890, claimed: false, reward: 500 },
        { id: 'tap', cnt: 'taps', name: 'Ускорь грядки тапом', n: 10, start: 45, claimed: false, reward: 500 },
        { id: 'order', cnt: 'orders', name: 'Выполни заказов', n: 2, start: 30, claimed: false, reward: 500 },
    ] });
    const { ctx, page } = await launch(raw, true);
    const r = await page.evaluate(() => S.quests.map(q => ({ id: q.id, prog: qProg(q), n: q.n })));
    const sell = r.find(q => q.id === 'sell');
    ok('набранный вживую прогресс сохраняется', sell && sell.prog === 10, r);
    ok('но офлайн его не досыпает', sell && sell.prog < sell.n, r);
    await ctx.close();
}

// ---------- битый сейв не должен запирать игру навсегда ----------
for (const [name, raw] of [
    ['мусор вместо JSON',        'not json at all'],
    ['null в обязательных полях', '{"coins":"много","plots":null,"cnt":5,"up":"x","workers":null}'],
    ['пустой объект',            '{}'],
    ['массив вместо объекта',    '[1,2,3]'],
]) {
    const { ctx, page, booted, errs } = await launch(raw, false);
    ok('битый сейв не ломает запуск: ' + name, booted, errs.slice(0, 1));
    if (booted) {
        const r = await page.evaluate(() => ({ coins: S.coins, plots: S.plots.length, crops: S.crops.length }));
        ok('  подставлено чистое состояние: ' + name,
            typeof r.coins === 'number' && r.plots >= 1 && r.crops === 12, r);
    }
    await ctx.close();
}

// ---------- сейв из будущей версии (культур больше) ----------
{
    const raw = save({ lastCrop: 99, plots: [{ c: 99, t: 5, g: true }, { c: 3, t: 2, g: false }],
                       crops: new Array(40).fill(true), store: { unobtainium: 500, wheat: 3 },
                       workers: { harv: 0, sow: 0, seller: 0 }, animals: { hen: 99, cow: 0, sheep: 0 },
                       time: Date.now() });
    const { ctx, page, booted, errs } = await launch(raw, false);
    ok('сейв из будущей версии не ломает запуск', booted, errs.slice(0, 1));
    const r = await page.evaluate(() => ({
        lastCrop: S.lastCrop, crops: S.crops.length, plot0: S.plots[0].c, plot1: S.plots[1].c,
        store: S.store, hen: S.animals.hen,
    }));
    ok('неизвестная культура не превращается в самую дорогую', r.lastCrop === 0 && r.plot0 === -1, r);
    ok('таблица культур не растёт под чужой сейв', r.crops === 12, r);
    ok('годная грядка уцелела', r.plot1 === 3, r);
    ok('неизвестный товар со склада убран', !r.store.unobtainium && r.store.wheat === 3, r);
    ok('число животных подрезано до предела', r.hen === 4, r);
    await ctx.close();
}

// ---------- часы устройства ушли вперёд ----------
{
    const { ctx, page } = await launch(save({ time: Date.now() + 30 * 86400000 }), false);
    const r = await page.evaluate(() => ({ coins: Math.floor(S.coins), modal: !!document.querySelector('.modal.open') }));
    ok('сейв «из будущего» не начисляет доход', r.coins === 5e5, r);
    ok('и не показывает сводку', r.modal === false, r);
    await ctx.close();
}

// ---------- потолок 12 часов ----------
{
    const { ctx, page } = await launch(save({ time: Date.now() - 30 * 86400000 }), false);
    const info = await page.evaluate(() => document.getElementById('offlineInfo').textContent);
    ok('месяц отсутствия считается как 12 часов', /12/.test(info), info);
    await ctx.close();
}

// ---------- кнопки роликов не предлагают пустую награду ----------
{
    const raw = save({ time: Date.now(), plots: [{ c: -1, t: 0, g: false }],
                       workers: { harv: 0, sow: 0, seller: 0 } });
    const { ctx, page } = await launch(raw, false);
    const r = await page.evaluate(() => {
        renderHud();
        const nothing = { grow: $('growBtn').disabled, growable: growable() };
        // грядка с созревшим урожаем — дорастить всё равно нечего
        S.plots = [{ c: 0, t: 999, g: false }];
        renderHud();
        const ripe = $('growBtn').disabled;
        // а вот растущую грядку дорастить можно
        S.plots = [{ c: 0, t: 0, g: false }];
        renderHud();
        const growing = $('growBtn').disabled;
        // пока идёт буст, кнопка ролика заперта
        S.boostUntil = Date.now() + 60000;
        renderHud();
        const boosted = $('boostBtn').disabled;
        S.boostUntil = 0;
        renderHud();
        return { nothing, ripe, growing, boosted, boostFree: $('boostBtn').disabled };
    });
    ok('пустое поле — «дорастить» заперто', r.nothing.grow && !r.nothing.growable, r);
    ok('всё созрело — «дорастить» заперто', r.ripe, r);
    ok('есть что растить — кнопка открыта', r.growing === false, r);
    ok('во время буста ролик x2 не предлагается повторно', r.boosted, r);
    ok('после буста кнопка снова доступна', r.boostFree === false, r);
    await ctx.close();
}

// ---------- продление за ролик тоже не дарит квесты ----------
{
    const { ctx, page } = await launch(save(), true);
    const r = await page.evaluate(async () => {
        const before = S.quests.map(q => qProg(q));
        const coins0 = S.coins;
        offlineBonus();
        await new Promise(r => setTimeout(r, 200));
        return { before, after: S.quests.map(q => qProg(q)), grew: S.coins > coins0,
                 cloud: window.__cloud, pops: pops.length };
    });
    ok('«продолжить x2» начисляет доход', r.grew, r);
    ok('«продолжить x2» не двигает квесты', JSON.stringify(r.before) === JSON.stringify(r.after), r);
    ok('«продолжить x2» не спамит облако', r.cloud <= 6, r);
    await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
