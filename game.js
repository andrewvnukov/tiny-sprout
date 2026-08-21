'use strict';
// ============================================================
// game.js — состояние, симуляция, экономика, сейвы, Yandex SDK
// ============================================================

// ---------- Глобальное состояние ----------
let S = null;
let ysdk = null;
const LB_NAME = 'goldenSeeds';         // техническое имя лидерборда в консоли Яндекс Игр
let lbBoard = null;                    // нормализованный API: { setScore, getEntries }
let lbPlayer = null;                   // объект игрока (нужен для isAuthorized)
let lbAuthed = false;                  // авторизован ли игрок: без этого запись и своё место недоступны
let lbCanWrite = false;                // доступен ли leaderboards.setScore на этой платформе
let _lbLast = -1, _lbWroteAt = 0, _lbTimer = 0;
let _lbCache = null, _lbCacheAt = 0;
let earnAcc = 0, ipsTimer = 0;
let harvT = 0, sowT = 0, sellT = 0;   // таймеры работников (не сохраняются)
let saveT = 0;
let booted = false;

function freshState() {
    return {
        v: 1,
        coins: 25, seeds: 0,
        seasonEarned: 0, seasonSeeds: 0, lifeEarned: 0, claimedSeeds: 0,
        ips: 0, bestIps: 0,
        mute: false, tut: 0,
        lastCrop: 0,
        crops: CROPS.map((c,i) => i === 0),
        disc:  CROPS.map((c,i) => i === 0),   // открытые за всю игру (альбом)
        plots: [{ c:-1, t:0, g:false }],
        zones: 1,
        store: {},
        up: { fert:0, comp:0, wh:0, gold:0 },
        workers: { harv:0, sow:0, seller:0 },
        animals: { hen:0, cow:0, sheep:0 },
        animT: { hen:0, cow:0, sheep:0 },
        orders: [],
        ordTok: ORDER_SLOTS, ordTokT: Date.now(),  // «ведро» появления заказов
        ordSkipT: 0, ordSkipN: 0,                   // окно/счётчик смен заданий
        quests: [], qday: '', chestClaimed: false,
        ach: {},
        cnt: { harvests:0, sold:0, planted:0, orders:0, taps:0, aprods:0, goldens:0, prestiges:0,
               cropsAll:0, plotsAll:0, animAll:0 },
        boostUntil: 0, adGrowAt: 0,
        sfxVol: .5, musVol: .5,     // громкость эффектов и музыки (0..1, 0.5 = базовая)
        time: Date.now(),
    };
}

const boostOn = () => S.boostUntil > Date.now();
const storeTotal = () => Object.values(S.store).reduce((a,b)=>a+b, 0);
const todayStr = () => new Date().toISOString().slice(0,10);

// ---------- Сейвы ----------
const SAVE_KEY = 'tinysprout';
// flush=false (значение по умолчанию у SDK) — запись копится и уходит пачкой,
// это бережёт лимит облачных сохранений (100 запросов за 5 минут). Минус в том,
// что накопленное может не успеть уйти, если игрок закрывает вкладку, — поэтому
// при уходе со страницы дожимаем немедленно, см. flushSave().
function persist(force, flush) {
    if (!booted) return;
    if (!force && saveT > 0) return;
    saveT = 10;
    S.time = Date.now();
    const raw = JSON.stringify(S);
    try { localStorage.setItem(SAVE_KEY, raw); } catch(e) {}
    if (ysdk) {
        try { ysdk.getPlayer().then(p => p.setData({ save: raw }, !!flush)).catch(()=>{}); } catch(e) {}
    }
    submitScore();   // обновить очки в лидерборде, если изменились
}
// Немедленная отправка в облако при сворачивании/закрытии. Ограничена по
// частоте: переключение вкладок туда-сюда не должно жечь лимит запросов.
let _flushedAt = 0;
function flushSave() {
    if (!booted || !ysdk) return;
    if (Date.now() - _flushedAt < 3000) return;
    _flushedAt = Date.now();
    persist(true, true);
}
function restore(raw) {
    const f = freshState();
    if (!raw) return f;
    try {
        const d = JSON.parse(raw);
        // осторожное слияние: недостающие поля берём из свежего состояния
        for (const k in f)
            if (d[k] !== undefined) f[k] = d[k];
        for (const k in f.up)      if (typeof f.up[k] !== 'number') f.up[k] = 0;
        for (const k in f.workers) if (typeof f.workers[k] !== 'number') f.workers[k] = 0;
        // миграция: трактор заменён продавцом — переносим уровни
        if (typeof f.workers.seller !== 'number') f.workers.seller = (typeof f.workers.tract === 'number' ? f.workers.tract : 0);
        delete f.workers.tract;
        for (const k in f.animals) if (typeof f.animals[k] !== 'number') f.animals[k] = 0;
        const c = freshState().cnt;
        f.cnt = Object.assign(c, f.cnt);
        // миграция на суммарную модель престижа: у старых сейвов нет claimedSeeds —
        // выставляем «уже выдано» по текущему lifeEarned, чтобы не подарить пачку семян
        if (typeof d.claimedSeeds !== 'number') f.claimedSeeds = seedsFromEarned(f.lifeEarned);
        while (f.crops.length < CROPS.length) f.crops.push(false);
        while (f.disc.length < CROPS.length) f.disc.push(false);
        if (!f.plots.length) f.plots = [{ c:-1, t:0, g:false }];
        return f;
    } catch(e) { return f; }
}

// ---------- Лидерборд (Яндекс Игры): сумма золотых семян ----------
// Лимиты платформы: запись — не чаще 1 раза в секунду, чтение — 20 запросов
// за 5 минут. Поэтому запись троттлится, а выдача кэшируется.
const LB_WRITE_MS = 1200;      // минимальный интервал между setScore
const LB_CACHE_MS = 30000;     // сколько живёт кэш выдачи
const LB_TOP = 15;             // 1..20 по документации
const LB_AROUND = 5;           // 1..10 по документации

// Приводим оба поколения API к одному виду: актуальное — ysdk.leaderboards
// (setScore/getEntries), устаревшее — ysdk.getLeaderboards()
// (setLeaderboardScore/getLeaderboardEntries).
function lbApi(sdk) {
    try {
        if (sdk.leaderboards && sdk.leaderboards.setScore)
            return Promise.resolve(sdk.leaderboards);
        if (typeof sdk.getLeaderboards === 'function')
            return Promise.resolve(sdk.getLeaderboards()).then(o => o && {
                setScore:   (n, s, e) => o.setLeaderboardScore(n, s, e),
                getEntries: (n, opt)  => o.getLeaderboardEntries(n, opt),
            });
    } catch(e) {}
    return Promise.resolve(null);
}
// isAvailableMethod возвращает Promise<Boolean>; на старых сборках его может не быть
function lbAvailable(name) {
    try {
        if (typeof ysdk.isAvailableMethod !== 'function') return Promise.resolve(true);
        return Promise.resolve(ysdk.isAvailableMethod(name)).catch(() => false);
    } catch(e) { return Promise.resolve(false); }
}
function lbCheckAuth() {
    try {
        return ysdk.getPlayer().then(p => {
            lbPlayer = p;
            // getMode() устарел, но остаётся запасным вариантом
            if (typeof p.isAuthorized === 'function') return !!p.isAuthorized();
            if (typeof p.getMode === 'function') return p.getMode() !== 'lite';
            return true;
        }).catch(() => false);
    } catch(e) { return Promise.resolve(false); }
}
function initLeaderboard() {
    if (!ysdk) return Promise.resolve(false);
    return Promise.all([lbApi(ysdk), lbAvailable('leaderboards.setScore'), lbCheckAuth()])
        .then(([api, canWrite, authed]) => {
            lbBoard = api || null;
            lbCanWrite = !!canWrite;
            lbAuthed = !!authed;
            if (lbBoard && lbAuthed && lbCanWrite) submitScore(true);
            return !!lbBoard;
        })
        .catch(() => false);
}
// Показываем окно авторизации: неавторизованный игрок не может ни писать
// результат, ни видеть своё место в выдаче.
function lbLogin(cb) {
    cb = cb || (() => {});
    if (!ysdk || !ysdk.auth || typeof ysdk.auth.openAuthDialog !== 'function') { cb(false); return; }
    ysdk.auth.openAuthDialog()
        .then(() => lbCheckAuth())
        .then(a => {
            lbAuthed = !!a;
            _lbCache = null;                 // выдача теперь другая — со своим местом
            if (lbAuthed) submitScore(true);
            cb(lbAuthed);
        })
        .catch(() => cb(false));             // игрок закрыл окно — это не ошибка
}
function submitScore(force) {
    if (!lbBoard || !S || !lbAuthed || !lbCanWrite) return;
    const sc = Math.max(0, S.seeds | 0);     // счёт должен быть неотрицательным
    // с нулём в таблице делать нечего: семена только копятся, поэтому 0 бывает
    // лишь до первого семени — иначе рейтинг забился бы пустыми записями
    if (sc <= 0) return;
    if (!force && sc === _lbLast) return;
    const wait = LB_WRITE_MS - (Date.now() - _lbWroteAt);
    if (wait > 0) {                          // упёрлись в лимит — отправим чуть позже
        clearTimeout(_lbTimer);
        _lbTimer = setTimeout(() => submitScore(true), wait + 50);
        return;
    }
    _lbLast = sc;
    _lbWroteAt = Date.now();
    try {
        const r = lbBoard.setScore(LB_NAME, sc);
        if (r && r.catch) r.catch(() => { _lbLast = -1; });   // дадим повторить позже
    } catch(e) { _lbLast = -1; }
}
// cb получает { entries, userRank } либо { error } — UI различает причины,
// чтобы не показывать «пусто» там, где на самом деле нужна авторизация.
function fetchLeaderboard(cb, fresh) {
    if (!lbBoard) { cb({ error: 'unavailable' }); return; }
    if (!fresh && _lbCache && Date.now() - _lbCacheAt < LB_CACHE_MS) { cb(_lbCache); return; }
    try {
        // includeUser только для авторизованных: иначе запрос отвергается
        lbBoard.getEntries(LB_NAME, {
            includeUser: lbAuthed, quantityAround: LB_AROUND, quantityTop: LB_TOP,
        }).then(res => {
            _lbCache = res; _lbCacheAt = Date.now();
            cb(res);
        }).catch(() => cb({ error: 'fail' }));
    } catch(e) { cb({ error: 'fail' }); }
}

// ---------- Экономика ----------
function earn(a) {
    S.coins += a;
    S.seasonEarned += a;
    S.lifeEarned += a;
    earnAcc += a;
}
function spend(a) {
    if (S.coins < a) { sfx('error'); toast(T('Не хватает монет!')); return false; }
    S.coins -= a;
    return true;
}

// ---------- Грядки ----------
function plantPlot(i, ci, silent) {
    const c = CROPS[ci];
    if (!S.crops[ci] || S.plots[i].c >= 0) return false;
    if (S.coins < c.seed) { if (!silent) { sfx('error'); toast(T('Семена стоят {n} монет', { n: fmt(c.seed) })); } return false; }
    S.coins -= c.seed;
    S.plots[i] = { c: ci, t: 0, g: Math.random() < goldChance() };
    S.cnt.planted++;
    if (!silent) sfx('plant');
    if (S.tut === 0) { S.tut = 1; renderTut(); }
    persist();
    return true;
}
function harvestPlot(i, silent) {
    const p = S.plots[i];
    if (p.c < 0) return false;
    const c = CROPS[p.c];
    if (p.t < cropGrow(c)) return false;
    const qty = p.g ? 5 : 1;
    if (storeTotal() + qty > whCap()) { if (!silent) { sfx('error'); toast(T('Склад полон! Продай урожай.')); } return false; }
    S.store[c.id] = (S.store[c.id]||0) + qty;
    S.cnt.harvests++;
    if (p.g) { S.cnt.goldens++; if (!silent) sfx('golden'); }
    else if (!silent) sfx('harvest');
    fxHarvest(i, p.c, p.g);
    S.plots[i] = { c:-1, t:0, g:false };
    if (S.tut === 1) { S.tut = 2; renderTut(); }
    persist();
    return true;
}
function tapPlot(i) {
    const p = S.plots[i];
    if (p.c < 0) { plantPlot(i, S.lastCrop); return; }
    const c = CROPS[p.c];
    if (p.t >= cropGrow(c)) { harvestPlot(i); return; }
    p.t += 1.5;                    // тап слегка ускоряет рост
    S.cnt.taps++;
    sfx('tap');
    fxTap(i);
}
function buyPlot() {
    const owned = S.plots.length;
    const maxNow = ZONES.slice(0, S.zones).reduce((s,z)=>s+z.plots, 0);
    if (owned >= maxNow) return;
    const cost = plotCost(owned - 1);
    if (!spend(cost)) return;
    S.plots.push({ c:-1, t:0, g:false });
    sfx('buy');
    toast(T('Новая грядка!'));
    if (S.plots.length >= MAXPLOTS) S.cnt.plotsAll = 1;
    persist(true);
}
function buyZone() {
    if (S.zones >= ZONES.length) return;
    const z = ZONES[S.zones];
    if (!spend(z.unlock)) return;
    S.zones++;
    sfx('chest');
    toast(T('{name} — открыто!', { name: T(z.name) }));
    persist(true);
}

// ---------- Магазин ----------
function buyCrop(i) {
    const c = CROPS[i];
    if (S.crops[i]) { S.lastCrop = i; renderShop(); renderHud(); sfx('click'); return; }
    if (c.zone >= S.zones) { sfx('error'); toast(T('Сначала открой зону «{zone}»', { zone: T(ZONES[c.zone].name) })); return; }
    if (!spend(c.unlock)) return;
    S.crops[i] = true;
    S.disc[i] = true;
    S.lastCrop = i;
    if (S.crops.every(x=>x)) S.cnt.cropsAll = 1;
    sfx('buy');
    toast(T('{name} — открыто!', { name: T(c.name) }));
    albumFlash(i);
    persist(true);
    renderShop(); renderHud();
}
function buyUp(id) {
    const u = UPS.find(x=>x.id===id);
    if (!spend(upCost(u, S.up[id]))) return;
    S.up[id]++;
    sfx('buy');
    persist(true);
    renderShop(); renderHud();
}
function buyWorker(id) {
    const w = WORKERS.find(x=>x.id===id);
    if (S.workers[id] >= w.max) return;
    if (!spend(workerCost(w, S.workers[id]))) return;
    S.workers[id]++;
    sfx('buy');
    toast(S.workers[id] === 1 ? T('{name} приступает к работе!', { name: T(w.name) })
                             : T('{name} — уровень {lvl}', { name: T(w.name), lvl: S.workers[id] }));
    persist(true);
    renderShop(); renderHud();
}
function buyAnimal(id) {
    const a = ANIMALS.find(x=>x.id===id);
    if (S.animals[id] >= a.max) return;
    if (!spend(animalCost(a, S.animals[id]))) return;
    S.animals[id]++;
    if (ANIMALS.every(x => S.animals[x.id] > 0)) S.cnt.animAll = 1;
    sfx('animal');
    toast(T('{name} поселилась на ферме!', { name: T(a.name) }));
    persist(true);
    renderShop(); renderHud();
}

// ---------- Склад / продажа ----------
function priceOf(id) {
    const c = CROPS.find(x=>x.id===id);
    if (c) return Math.round(c.sell * sellMult());
    const a = APRODS.find(x=>x.id===id);
    return a ? Math.round(a.sell * sellMult()) : 0;
}
function sellStore(id, n) {
    const have = S.store[id]||0;
    n = Math.min(n||have, have);
    if (!n) return;
    const got = priceOf(id) * n;
    S.store[id] -= n;
    if (!S.store[id]) delete S.store[id];
    earn(got);
    S.cnt.sold += n;
    sfx('sell');
    toast(T('+{n} монет', { n: fmt(got) }));
    if (S.tut === 2) { S.tut = 3; renderTut(); }
    persist();
    renderBarn(); renderHud();
}
function sellAll() {
    let got = 0, n = 0;
    for (const id in S.store) { got += priceOf(id) * S.store[id]; n += S.store[id]; }
    if (!n) return;
    S.store = {};
    earn(got);
    S.cnt.sold += n;
    sfx('sell');
    toast(T('+{n} монет', { n: fmt(got) }));
    if (S.tut === 2) { S.tut = 3; renderTut(); }
    persist();
    renderBarn(); renderHud();
}

// ---------- Заказы ----------
// «ведро» появления: копится ORDERS_PER_HOUR токенов/час, потолок = ORDER_SLOTS.
function regenOrderTokens() {
    const now = Date.now();
    if (!S.ordTokT) S.ordTokT = now;
    if (typeof S.ordTok !== 'number') S.ordTok = ORDER_SLOTS;
    S.ordTok = Math.min(ORDER_SLOTS, S.ordTok + (now - S.ordTokT) * (ORDERS_PER_HOUR / 3600000));
    S.ordTokT = now;
}
// пустые слоты (null) заполняются только пока есть токены — заказы не бесконечны
function ensureOrders() {
    regenOrderTokens();
    if (!Array.isArray(S.orders)) S.orders = [];
    while (S.orders.length < ORDER_SLOTS) S.orders.push(null);
    for (let k = 0; k < ORDER_SLOTS; k++)
        if (!S.orders[k] && S.ordTok >= 1) { S.orders[k] = rollOrder(); S.ordTok -= 1; }
}
function skipsLeft() {
    if (!S.ordSkipT || Date.now() - S.ordSkipT >= SKIP_WINDOW_MS) return SKIP_MAX;
    return Math.max(0, SKIP_MAX - (S.ordSkipN || 0));
}
function fulfillOrder(k) {
    const o = S.orders[k];
    if (!o) return;
    const c = CROPS[o.crop];
    if ((S.store[c.id]||0) < o.qty) { sfx('error'); toast(T('Не хватает: {name} x{qty}', { name: T(c.name), qty: o.qty })); return; }
    S.store[c.id] -= o.qty;
    if (!S.store[c.id]) delete S.store[c.id];
    earn(o.reward);
    if (o.seed) { S.seeds += o.seed; toast(T('+1 золотое семя!')); }
    S.cnt.orders++;
    S.cnt.sold += o.qty;
    S.orders[k] = null;            // слот освобождён; новый придёт по «ведру» появления
    ensureOrders();
    sfx('order');
    toast(T('Заказ выполнен! +{n} монет', { n: fmt(o.reward) }));
    persist(true);
    renderOrders(); renderHud();
}
function skipOrder(k) {
    if (!S.orders[k]) return;
    const now = Date.now();
    if (!S.ordSkipT || now - S.ordSkipT >= SKIP_WINDOW_MS) { S.ordSkipT = now; S.ordSkipN = 0; }
    if (S.ordSkipN >= SKIP_MAX) { sfx('error'); toast(T('Смена заданий: лимит {max} за 2 часа', { max: SKIP_MAX })); return; }
    S.ordSkipN++;
    S.orders[k] = rollOrder();     // смена в том же слоте — «ведро» появления не тратим
    sfx('click');
    persist(true);
    renderOrders();
}

// ---------- Квесты дня ----------
function questTier() { return S.bestIps < 50 ? 0 : S.bestIps < 1000 ? 1 : 2; }
function ensureQuests() {
    const day = todayStr();
    if (S.qday === day && S.quests.length) return;
    S.qday = day;
    S.chestClaimed = false;
    const pool = QPOOL.slice();
    S.quests = [];
    const tier = questTier();
    for (let i = 0; i < 3; i++) {
        const q = pool.splice(Math.floor(Math.random()*pool.length), 1)[0];
        S.quests.push({ id:q.id, cnt:q.cnt, name:q.name, n:q.n[tier], start:S.cnt[q.cnt], claimed:false, reward:questReward(tier) });
    }
    persist(true);
}
function qProg(q) { return Math.min(q.n, S.cnt[q.cnt] - q.start); }
function claimQuest(k) {
    const q = S.quests[k];
    if (q.claimed || qProg(q) < q.n) return;
    q.claimed = true;
    earn(q.reward);
    sfx('quest');
    toast(T('Квест выполнен! +{n} монет', { n: fmt(q.reward) }));
    persist(true);
    renderOrders(); renderHud();
}
function claimChest() {
    if (S.chestClaimed || !S.quests.every(q=>q.claimed)) return;
    S.chestClaimed = true;
    const r = chestReward();
    earn(r.coins);
    S.seeds += r.seed;
    sfx('chest');
    toast(T('Сундук: +{n} монет и +1 золотое семя!', { n: fmt(r.coins) }));
    persist(true);
    renderOrders(); renderHud();
}

// ---------- Достижения ----------
function checkAch() {
    for (const a of ACHS) {
        if (S.ach[a.id]) continue;
        if (S.cnt[a.cnt] >= a.n) {
            S.ach[a.id] = true;
            S.seeds += a.seed;
            sfx('chest');
            toast(T('Достижение «{name}»: +{n} зол. сем.', { name: T(a.name), n: a.seed }));
            persist(true);
            renderHud();
        }
    }
}

// ---------- Престиж ----------
function doPrestige() {
    const p = pendingSeeds();
    if (p <= 0) return;
    S.seeds += p;
    S.claimedSeeds = seedsClaimed() + p;   // фиксируем выданные семена (lifeEarned не сбрасываем)
    S.cnt.prestiges++;
    const keep = S;
    S.coins = 25;
    S.seasonEarned = 0;
    S.seasonSeeds = 0;
    S.crops = CROPS.map((c,i)=>i===0);
    S.lastCrop = 0;
    S.plots = [{ c:-1, t:0, g:false }];
    S.zones = 1;
    S.store = {};
    S.up = { fert:0, comp:0, wh:0, gold:0 };
    S.workers = { harv:0, sow:0, seller:0 };
    S.animals = { hen:0, cow:0, sheep:0 };
    S.animT = { hen:0, cow:0, sheep:0 };
    S.orders = [];
    S.ordTok = ORDER_SLOTS; S.ordTokT = Date.now();
    S.boostUntil = 0;
    ensureOrders();
    sfx('prestige');
    toast(T('Новый сезон! +{p} золотых семян', { p }));
    fxPrestige();
    persist(true);
    closeAllSheets();
    renderHud();
    checkAch();
}

// ---------- Реклама (rewarded) ----------
function showRewarded(cb) {
    if (ysdk && ysdk.adv) {
        try {
            ysdk.adv.showRewardedVideo({ callbacks: {
                onRewarded: cb,
                onError: () => cb(),   // локально/ошибка — награду всё равно даём
            }});
            return;
        } catch(e) {}
    }
    cb();  // вне платформы — сразу награда
}
function adBoost() {
    if (boostOn()) return;
    showRewarded(() => {
        S.boostUntil = Date.now() + BOOST_MIN*60000;
        sfx('chest');
        toast(T('Доход x2 на {n} минуты!', { n: BOOST_MIN }));
        persist(true);
        renderHud();
    });
}
function adGrowAll() {
    if (Date.now() < S.adGrowAt) return;
    showRewarded(() => {
        for (const p of S.plots)
            if (p.c >= 0) p.t = cropGrow(CROPS[p.c]);
        S.adGrowAt = Date.now() + AD_GROW_CD*1000;
        sfx('chest');
        toast(T('Всё выросло!'));
        persist(true);
        renderHud();
    });
}

// ---------- Симуляция ----------
function simulate(dt) {
    // рост
    for (const p of S.plots)
        if (p.c >= 0) p.t = Math.min(p.t + dt, cropGrow(CROPS[p.c]));

    // сборщик — готовый урожай на склад (while: при большом dt/офлайне срабатывает несколько раз)
    if (S.workers.harv) {
        harvT -= dt;
        let it = 0;
        while (harvT <= 0 && it++ < 300) {
            harvT += harvEvery();
            let acted = false;
            for (let i = 0; i < S.plots.length; i++) {
                const p = S.plots[i];
                if (p.c >= 0 && p.t >= cropGrow(CROPS[p.c])) { acted = harvestPlot(i, true); break; }
            }
            if (!acted) { harvT = harvEvery(); break; }   // нечего собрать или склад полон
        }
    }
    // сеятель — засевает пустые грядки выбранной культурой
    if (S.workers.sow) {
        sowT -= dt;
        let it = 0;
        while (sowT <= 0 && it++ < 300) {
            sowT += sowEvery();
            let acted = false;
            for (let i = 0; i < S.plots.length; i++)
                if (S.plots[i].c < 0) { acted = plantPlot(i, S.lastCrop, true); break; }
            if (!acted) { sowT = sowEvery(); break; }
        }
    }
    // продавец: продаёт урожай со склада за монеты (можно зарабатывать и офлайн)
    if (S.workers.seller) {
        sellT -= dt;
        let it = 0;
        while (sellT <= 0 && it++ < 300) {
            sellT += sellEvery();
            let left = sellQty(), got = 0;
            const ids = Object.keys(S.store).sort((a, b) => priceOf(b) - priceOf(a));  // сначала дорогие
            for (const id of ids) {
                if (left <= 0) break;
                const take = Math.min(left, S.store[id]);
                if (take <= 0) continue;
                S.store[id] -= take; if (!S.store[id]) delete S.store[id];
                got += priceOf(id) * take; S.cnt.sold += take; left -= take;
            }
            if (got > 0) earn(got); else { sellT = sellEvery(); break; }   // склад пуст — ждём
        }
    }
    // животные
    for (const a of ANIMALS) {
        const n = S.animals[a.id];
        if (!n) continue;
        S.animT[a.id] += dt * n;
        while (S.animT[a.id] >= a.every) {
            S.animT[a.id] -= a.every;
            const pr = APRODS[a.prod];
            if (storeTotal() + 1 <= whCap()) {
                S.store[pr.id] = (S.store[pr.id]||0) + 1;
                S.cnt.aprods++;
            }
        }
    }
    // доход в секунду (EMA)
    ipsTimer += dt;
    if (ipsTimer >= 15) {
        const cur = earnAcc / ipsTimer;
        S.ips = S.ips * .5 + cur * .5;
        S.bestIps = Math.max(S.bestIps, S.ips);
        earnAcc = 0; ipsTimer = 0;
    }
    saveT -= dt;
    ensureQuests();
    ensureOrders();   // фоновая докрутка «ведра» появления заказов
    checkAch();
}

// ---------- Изометрическая раскладка (строгая целочисленная сетка) ----------
const IW = 1.42, IH = 0.72;                       // половина ромба плитки (world)
function isoWorld(gx, gy) { return vec2((gx - gy) * IW, -(gx + gy) * IH); }
// грядки: 3 зоны по 8 (4×2 клетки), стопкой в глубину, ряд-разделитель между зонами
function plotGrid(i) {
    const z = Math.floor(i / 8), li = i % 8;
    return { gx: li % 4, gy: Math.floor(li / 4) + z * 3 };
}
function plotPos(i) { const g = plotGrid(i); return isoWorld(g.gx, g.gy); }
function zoneCenterGrid(z) { return { gx: 1.5, gy: z * 3 + 0.5 }; }
function zoneSignPos(z) { const g = zoneCenterGrid(z); return isoWorld(g.gx, g.gy); }
// постройки/пруд — на своих клетках (используются рендером)
const BARN_G  = { gx: -4, gy: 0 };
const HOUSE_G = { gx: -4, gy: 4 };
const POND_G  = { gx: 6, gy: 6 };
const PATH_CELLS = [];
for (let gx = 0; gx <= 3; gx++) { PATH_CELLS.push([gx, 2]); PATH_CELLS.push([gx, 5]); }
PATH_CELLS.push([-2, 0], [-2, 1], [-1, 1], [-1, 2]);   // от ворот амбара к полю
PATH_CELLS.push([-2, 5], [-1, 5]);               // от двери дома к полю
const FIELD_CX = -2.84, FIELD_CY = -3.6;          // центр поля (world)

// ---------- Камера: пан + зум (прямые pointer-события, якорные) ----------
let camX = FIELD_CX, camY = FIELD_CY, camScale = 30, camMin = 14, camMax = 72;
function initCamera() {
    const cw = mainCanvasSize.x, ch = mainCanvasSize.y;
    // макс.зум привязан к разрешению bake (PPU=72). На плотных экранах даём
    // запас на приближение (до 2×PPU) — иначе места для зума почти нет.
    camMax = 72 * Math.min(2, window.devicePixelRatio || 1);
    camMin = Math.max(10, Math.min(cw / 30, ch / 20));
    camScale = Math.max(camMin, Math.min(camMax, Math.min(cw / 18, ch / 14)));
    camX = FIELD_CX; camY = FIELD_CY;
    applyCam();
}
function clampCam() {
    camX = Math.max(-14, Math.min(8, camX));
    camY = Math.max(-10, Math.min(3, camY));
    camScale = Math.max(camMin, Math.min(camMax, camScale));
}
function applyCam() { clampCam(); setCameraPos(vec2(camX, camY)); setCameraScale(camScale); }

// перевод указателя (clientX/Y → canvas-пиксели → мир)
function ptrCanvas(cx, cy) {
    const r = mainCanvas.getBoundingClientRect();
    return vec2((cx - r.left) / r.width * mainCanvasSize.x, (cy - r.top) / r.height * mainCanvasSize.y);
}
function ptrWorld(cx, cy) { return screenToWorld(ptrCanvas(cx, cy)); }

const _ptrs = new Map();
const PAN_DEAD = 12;   // мёртвая зона (CSS-px): движение меньше = тап, карта не едет
let _tapId = null, _tapMoved = 0, _pinchDist = 0;
function initCameraInput() {
    const cvs = document.querySelectorAll('canvas');
    const el = cvs[cvs.length - 1] || mainCanvas;
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
}
function twoDist() { const a = [..._ptrs.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
function twoMid() { const a = [..._ptrs.values()]; return ptrCanvas((a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2); }
function onDown(e) {
    try { e.target.setPointerCapture(e.pointerId); } catch (x) {}
    _ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (_ptrs.size === 1) { _tapId = e.pointerId; _tapMoved = 0; }
    else { _tapId = null; if (_ptrs.size === 2) _pinchDist = twoDist(); }
    if (booted && !musicOn) startMusic();
}
function onMove(e) {
    const p = _ptrs.get(e.pointerId); if (!p) return;
    const ox = p.x, oy = p.y; p.x = e.clientX; p.y = e.clientY;
    if (_ptrs.size >= 2) {                        // якорный зум-щипок
        _tapId = null;
        const nd = twoDist();
        if (_pinchDist > 0 && nd > 0) {
            const mid = twoMid(), wB = screenToWorld(mid);
            camScale = Math.max(camMin, Math.min(camMax, camScale * nd / _pinchDist));
            setCameraScale(camScale);
            const wA = screenToWorld(mid);
            camX += wB.x - wA.x; camY += wB.y - wA.y; applyCam();
        }
        _pinchDist = nd;
    } else if (_tapId === e.pointerId) {          // якорный пан — только за пределами мёртвой зоны
        _tapMoved += Math.abs(e.clientX - ox) + Math.abs(e.clientY - oy);
        if (_tapMoved <= PAN_DEAD) return;        // ещё тап — карту не двигаем
        const wP = ptrWorld(ox, oy), wN = ptrWorld(e.clientX, e.clientY);
        camX += wP.x - wN.x; camY += wP.y - wN.y; applyCam();
    }
}
function onUp(e) {
    const tap = (_tapId === e.pointerId && _tapMoved <= PAN_DEAD);
    _ptrs.delete(e.pointerId);
    if (_ptrs.size < 2) _pinchDist = 0;
    if (_ptrs.size === 0) _tapId = null;
    if (booted && tap && !uiBlocked()) pickAt(e.clientX, e.clientY);
}
function onWheel(e) {
    e.preventDefault();
    const mid = ptrCanvas(e.clientX, e.clientY), wB = screenToWorld(mid);
    camScale = Math.max(camMin, Math.min(camMax, camScale * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    setCameraScale(camScale);
    const wA = screenToWorld(mid);
    camX += wB.x - wA.x; camY += wB.y - wA.y; applyCam();
}
function pickAt(cx, cy) {
    const m = ptrWorld(cx, cy);
    const owned = S.plots.length, maxNow = ZONES.slice(0, S.zones).reduce((s, z) => s + z.plots, 0);
    let best = null, bd = 1e9;
    const consider = (id, p) => { const d = Math.abs(m.x - p.x) / IW + Math.abs(m.y - p.y) / IH; if (d < bd) { bd = d; best = id; } };
    for (let i = 0; i < owned; i++) consider(i, plotPos(i));
    if (owned < maxNow) consider('+', plotPos(owned));
    if (best !== null && bd < 1.1) { best === '+' ? buyPlot() : tapPlot(best); return; }
    if (S.zones < ZONES.length) {
        const sp = zoneSignPos(S.zones);
        if (Math.abs(m.x - sp.x) < 1.7 && m.y > sp.y - .3 && m.y < sp.y + 1.4) buyZone();
    }
}

// ---------- Офлайн: работники собирают урожай на склад (монеты авто НЕ капают) ----------
let offlineT = 0;
// прогоняем обычный sim крупными шагами: рост, сбор урожая работниками на склад
// (с лимитом склада), производство животных. Доход/с (ips) офлайн не меняем.
function fastForward(t) {
    const ips = S.ips, best = S.bestIps;
    let rem = t, g = 0;
    while (rem > 0 && g++ < 2000) { simulate(Math.min(15, rem)); rem -= 15; }
    S.ips = ips; S.bestIps = best;
}
function offlineCheck() {
    const dt = Math.max(0, (Date.now() - S.time) / 1000);
    if (dt < 60) return;
    offlineT = Math.min(dt, OFFLINE_CAP);
    const c0 = Math.floor(S.coins), st0 = storeTotal();
    fastForward(offlineT);
    const coins = Math.floor(S.coins) - c0;      // продавец наторговал
    const store = storeTotal() - st0;            // работники собрали на склад
    if (coins > 0 || store > 0) showOfflineModal(coins, store, offlineT);
}
// «продолжить» (реклама): ещё столько же времени работы
function offlineBonus() {
    const c0 = Math.floor(S.coins), st0 = storeTotal();
    fastForward(offlineT);
    const coins = Math.floor(S.coins) - c0, store = storeTotal() - st0;
    sfx(coins > 0 || store > 0 ? 'coin' : 'error');
    toast(coins > 0 ? T('+{n} монет', { n: fmt(coins) })
        : store > 0 ? T('+{n} на склад', { n: store })
        : T('Ничего нового'));
    persist(true);
    renderHud(); renderBarn();
}

// ---------- Цикл LittleJS ----------
function gameInit() {
    // ВАЖНО: S здесь ещё может быть null — boot() приходит позже (после SDK/фолбэка)
    setFontDefault('Neucha, sans-serif');
    try { document.fonts.load('20px Neucha'); } catch(e) {}
    // не глушим touch глобально — иначе DOM-кнопки не жмутся на телефоне;
    // прокрутку страницы держит touch-action:none в CSS
    try { setInputPreventDefault(false); } catch(e) {}
    initCamera();
    initCameraInput();
    initWorldDecor();
}
function gameUpdate() {
    if (!booted) return;
    simulate(timeDelta);
}
function gameUpdatePost() { applyCam(); }
function gameRender() { if (booted) renderWorld(); }
function gameRenderPost() { if (booted) renderWorldUI(); }

// ---------- Тест-хуки (Playwright) ----------
window.render_game_to_text = () => JSON.stringify({
    // координаты: мир LittleJS, y вверх, поле от y=0 (низ) до горизонта y=14.6
    coins: Math.floor(S.coins), seeds: S.seeds, ips: +S.ips.toFixed(1),
    seasonEarned: Math.floor(S.seasonEarned), pendingSeeds: pendingSeeds(),
    plots: S.plots.map((p,i)=>({ i, crop: p.c<0?null:CROPS[p.c].id, ready: p.c>=0 && p.t>=cropGrow(CROPS[p.c]), t:+p.t.toFixed(1), golden:p.g })),
    zones: S.zones, lastCrop: CROPS[S.lastCrop].id,
    store: S.store, storeTotal: storeTotal(), whCap: whCap(),
    up: S.up, workers: S.workers, animals: S.animals,
    orders: S.orders.filter(Boolean).map(o=>({ crop: CROPS[o.crop].id, qty:o.qty, reward:o.reward })),
    quests: S.quests.map(q=>({ id:q.id, prog:qProg(q), n:q.n, claimed:q.claimed })),
    cnt: S.cnt, boost: boostOn(), tut: S.tut,
});
window.advanceTime = ms => { simulate(ms/1000); renderHud(); };

// ---------- Загрузка ----------
// GameReady: платформа требует, чтобы сигнал готовности уходил ДО того, как
// игра станет доступна для действий игрока. Поэтому ready() вызывается в конце
// boot(), но перед показом интерфейса, и ровно один раз на любом пути запуска.
// Если игра поднялась по фолбэку, SDK ещё нет — тогда сигнал уходит позже,
// как только SDK ответит; _readyWanted помнит, что игра уже готова.
let _readyWanted = false, _readySent = false;
function signalReady() {
    _readyWanted = true;
    if (_readySent) return;
    try {
        const api = ysdk && ysdk.features && ysdk.features.LoadingAPI;
        if (api && typeof api.ready === 'function') { api.ready(); _readySent = true; }
    } catch(e) { _readySent = true; }   // повторять бессмысленно
}
// SDK ответил уже после запуска по фолбэку — уточняем язык по данным платформы
function applySdkLang() {
    if (!booted) return;
    const l = detectLang(ysdk);
    if (l === LANG) return;
    setLang(l);
    applyStaticT();
    renderHud();
    renderTut();
}
function boot(raw) {
    setLang(detectLang(ysdk));   // до initUI: вся статика и рендеры уже на нужном языке
    applyStaticT();
    S = restore(raw);
    setSoundVolume(1);   // мастер фиксирован; громкости масштабируем в sfx()/музыке
    ensureOrders();
    ensureQuests();
    booted = true;
    initUI();
    offlineCheck();
    renderHud();
    renderTut();
    persist(true);
    signalReady();                            // сначала сообщаем платформе…
    document.body.classList.add('ready');     // …и только потом открываем UI
}
(function start() {
    setShowSplashScreen(false);
    // 2D-режим: статичный мир печётся в offscreen-канвас и рисуется одним
    // drawImage, поверх — немного примитивов; порядок отрисовки сохраняется
    setGLEnable(false);
    setTilesPixelated(false);   // сглаживание drawImage запечённого мира (не пиксель-арт)
    // рендерим в НАТИВНОМ разрешении экрана. По умолчанию LittleJS рисует в
    // 1× CSS-пикселях (canvasPixelRatio=1), и на плотных мобильных экранах
    // (DPR 2–3) браузер растягивает кадр = «пиксели». Ставим реальный DPR
    // (ограничен 3 ради fill-rate) и снимаем потолок 1920×1080.
    setCanvasPixelRatio(Math.min(3, window.devicePixelRatio || 1));
    setCanvasMaxSize(vec2(4096, 4096));
    engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost);
    const localRaw = (() => { try { return localStorage.getItem(SAVE_KEY); } catch(e) { return null; } })();
    let done = false;
    const fallback = () => { if (!done) { done = true; boot(localRaw); } };
    if (window.YaGames) {
        // Ждём SDK, а не стартуем по короткому таймауту: до его ответа неизвестен
        // язык платформы, а игра, ставшая доступной раньше сигнала GameReady,
        // нарушает требования. Пока мы молчим, площадка держит свой лоадер.
        // Таймаут — только страховка от намертво зависшего SDK.
        setTimeout(fallback, 15000);
        YaGames.init().then(sdk => {
            ysdk = sdk;
            return sdk.getPlayer().then(p => p.getData(['save'])).then(d => {
                if (!done) {
                    done = true;
                    boot(d && d.save ? d.save : localRaw);   // boot сам отправит GameReady
                } else {
                    // фолбэк уже поднял игру на локальном сейве: досылаем сигнал
                    // готовности и уточняем язык, раз платформа наконец ответила
                    if (_readyWanted) signalReady();
                    applySdkLang();
                }
                initLeaderboard();
            });
        }).catch(fallback);
    } else fallback();
})();
