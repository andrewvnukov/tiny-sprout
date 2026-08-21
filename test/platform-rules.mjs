// Требования площадки, по которым чаще всего заворачивают релиз:
//   п. 1.19 — GameReady должен уйти ДО того, как игра доступна для действий
//   п. 2.14 — язык определяется автоматически через SDK, на первом же кадре
//   п. 8.2.3 — тексты соответствуют выбранному языку (никакой кириллицы в en)
import { chromium } from 'playwright';

const BASE = 'http://localhost:8347/';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXE });

let failed = 0;
const ok = (name, cond, extra) => {
    console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : ''));
    if (!cond) failed++;
};

// Мок SDK. sdkDelay — задержка YaGames.init(), чтобы проверить фолбэк-ветку.
const MOCK = ({ lang, sdkDelay, noSdk }) => {
    const log = [];
    window.__ev = log;
    // Ключевой замер: был ли интерфейс уже доступен в САМ момент вызова ready().
    // Наблюдатель за DOM для этого не годится — он подключается позже и может
    // пропустить сам переход, показав ложно «правильный» порядок.
    const stamp = e => log.push({
        e, t: performance.now(),
        uiLive: !!(document.body && document.body.classList.contains('ready')),
    });

    if (noSdk) return;
    // Считаем обращения к ysdk.environment.i18n.lang: дебаг-панель площадки
    // помечает игру «I18N is not used» именно по отсутствию чтения свойства.
    window.__i18nReads = 0;
    const i18n = {};
    Object.defineProperty(i18n, 'lang', {
        get() { window.__i18nReads++; return lang; },
        enumerable: true,
    });
    const sdk = {
        environment: { i18n },
        getPlayer: () => Promise.resolve({
            isAuthorized: () => true, getData: () => Promise.resolve({}), setData: () => Promise.resolve(),
        }),
        isAvailableMethod: () => Promise.resolve(true),
        auth: { openAuthDialog: () => Promise.resolve() },
        features: { LoadingAPI: { ready: () => stamp('game-ready') } },
        leaderboards: { setScore: () => Promise.resolve(), getEntries: () => Promise.resolve({ userRank: 0, entries: [] }) },
    };
    window.YaGames = { init: () => new Promise(r => setTimeout(() => r(sdk), sdkDelay || 0)) };
};

async function launch(opts) {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 760 } });
    const page = await ctx.newPage();
    await page.route('https://yandex.ru/**', r => r.abort());
    await page.addInitScript(MOCK, opts);
    await page.goto(BASE);                       // без ?lang — только автоопределение
    await page.waitForFunction(() => window.render_game_to_text && (() => {
        try { return !!JSON.parse(window.render_game_to_text()).plots; } catch (e) { return false; }
    })(), null, { timeout: 30000 });
    await page.waitForTimeout(600);
    return { ctx, page };
}

// ---------- п. 1.19: порядок GameReady ----------
{
    const { ctx, page } = await launch({ lang: 'ru' });
    const ev = await page.evaluate(() => __ev);
    const ready = ev.find(x => x.e === 'game-ready');
    ok('GameReady отправлен ровно один раз', ev.filter(x => x.e === 'game-ready').length === 1, ev);
    ok('в момент GameReady интерфейс ещё не был доступен', !!ready && ready.uiLive === false, ready);
    ok('после запуска интерфейс доступен',
       await page.evaluate(() => document.body.classList.contains('ready')));
    await ctx.close();
}

// ---------- п. 1.19: небыстрый SDK — игра ждёт его, а не стартует раньше ----------
{
    const { ctx, page } = await launch({ lang: 'en', sdkDelay: 6000 });
    const ev = await page.evaluate(() => __ev);
    const ready = ev.find(x => x.e === 'game-ready');
    ok('медленный SDK: сигнал доставлен', !!ready, ev);
    ok('медленный SDK: порядок не нарушен', !!ready && ready.uiLive === false, ready);
    ok('медленный SDK: язык взят с платформы', await page.evaluate(() => LANG) === 'en');
    await ctx.close();
}

// ---------- п. 2.14: язык берётся из SDK, а не из браузера ----------
for (const [sdkLang, want] of [['en', 'en'], ['ru', 'ru'], ['tr', 'en'], ['kk', 'ru']]) {
    const { ctx, page } = await launch({ lang: sdkLang });
    ok(`SDK lang=${sdkLang} -> ${want}`, await page.evaluate(() => LANG) === want,
       await page.evaluate(() => LANG));
    await ctx.close();
}

// ---------- п. 2.14: язык платформы читается на каждом запуске ----------
// Дебаг-панель площадки показывает «I18N is not used», если игра ни разу не
// обратилась к ysdk.environment.i18n.lang — даже когда язык в итоге берётся
// из сохранённого выбора игрока.
{
    const { ctx, page } = await launch({ lang: 'ru' });
    ok('обычный запуск: свойство прочитано',
       await page.evaluate(() => __i18nReads) >= 1,
       await page.evaluate(() => __i18nReads));
    await ctx.close();
}
{
    const ctx = await browser.newContext({ viewport: { width: 900, height: 760 } });
    const page = await ctx.newPage();
    await page.route('https://yandex.ru/**', r => r.abort());
    // у игрока уже есть ручной выбор языка — он победит, но SDK всё равно должен быть опрошен
    await page.addInitScript(() => {
        try { localStorage.setItem('tsprout_lang', 'en'); } catch (e) {}
    });
    await page.addInitScript(MOCK, { lang: 'ru' });
    await page.goto(BASE);
    await page.waitForFunction(() => typeof LANG !== 'undefined' && window.render_game_to_text, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    ok('при сохранённом выборе свойство всё равно прочитано',
       await page.evaluate(() => __i18nReads) >= 1,
       await page.evaluate(() => __i18nReads));
    ok('ручной выбор игрока при этом сохраняет приоритет',
       await page.evaluate(() => LANG) === 'en');
    await ctx.close();
}
{
    const { ctx, page } = await launch({ lang: 'ru' });
    // ?lang= в адресе — тоже не повод пропускать опрос платформы
    await page.goto(BASE + '?lang=en');
    await page.waitForFunction(() => typeof LANG !== 'undefined' && window.render_game_to_text, null, { timeout: 30000 });
    await page.waitForTimeout(600);
    ok('при ?lang= свойство всё равно прочитано',
       await page.evaluate(() => __i18nReads) >= 1,
       await page.evaluate(() => __i18nReads));
    await ctx.close();
}

// ---------- п. 2.14: автоопределение не «залипает» между заходами ----------
{
    const ctx = await browser.newContext({ viewport: { width: 900, height: 760 } });
    const page = await ctx.newPage();
    await page.route('https://yandex.ru/**', r => r.abort());
    await page.addInitScript(MOCK, { lang: 'en' });
    await page.goto(BASE);
    await page.waitForFunction(() => typeof LANG !== 'undefined' && window.render_game_to_text, null, { timeout: 25000 });
    await page.waitForTimeout(600);
    ok('первый заход: en с платформы', await page.evaluate(() => LANG) === 'en');
    ok('автоязык не записан в localStorage',
       await page.evaluate(() => localStorage.getItem('tsprout_lang')) === null);

    // тот же браузер, но игрок сменил язык платформы на русский
    await page.addInitScript(MOCK, { lang: 'ru' });
    await page.goto(BASE);
    await page.waitForFunction(() => typeof LANG !== 'undefined' && window.render_game_to_text, null, { timeout: 25000 });
    await page.waitForTimeout(600);
    ok('второй заход следует за платформой, а не за прошлым выбором',
       await page.evaluate(() => LANG) === 'ru', await page.evaluate(() => LANG));
    await ctx.close();
}

// ---------- п. 8.2.3: в английской локали нет кириллицы ----------
{
    const { ctx, page } = await launch({ lang: 'en' });
    // разворачиваем состояние и обходим все панели, собирая видимый текст
    const found = await page.evaluate(() => {
        S.coins = 1e15;
        buyZone(); buyZone();
        for (let i = 0; i < MAXPLOTS + 4; i++) buyPlot();
        for (let i = 0; i < CROPS.length; i++) { S.crops[i] = true; S.disc[i] = true; }
        for (const a of ANIMALS) for (let i = 0; i < a.max; i++) buyAnimal(a.id);
        for (const w of ['harv', 'sow', 'seller']) buyWorker(w);
        for (const u of ['fert', 'comp', 'wh', 'gold']) buyUp(u);
        S.plots.forEach((p, i) => { p.c = i % CROPS.length; p.t = cropGrow(CROPS[p.c]); });
        for (let i = 0; i < 8; i++) harvestPlot(i);
        S.seeds = 12; S.lifeEarned = 9e6;
        renderHud(); renderTut();

        const bad = [];
        const scan = where => {
            document.querySelectorAll('.ui, .ui *').forEach(el => {
                if (el.children.length) return;                 // только листья
                const t = (el.textContent || '').trim();
                if (t && /[А-Яа-яЁё]/.test(t)) bad.push(where + ': ' + t.slice(0, 60));
            });
        };
        scan('HUD');
        const panels = [
            ['cropSheet', () => renderCropPick()],
            ['barnSheet', () => renderBarn()],
            ['orderSheet', () => { orderTab = 'orders'; renderOrders(); }],
            ['orderSheet', () => { orderTab = 'quests'; renderOrders(); }],
            ['albumSheet', () => { albumTab = 'coll'; renderAlbum(); }],
            ['albumSheet', () => { albumTab = 'ach'; renderAlbum(); }],
            ['albumSheet', () => { albumTab = 'rank'; renderAlbum(); }],
        ];
        for (const [id, render] of panels) { closeAllSheets(); openSheet(id); render(); scan(id); }
        for (const tab of ['seeds', 'ups', 'work', 'anim']) {
            closeAllSheets(); shopTab = tab; openSheet('shopSheet'); renderShop(); scan('shop/' + tab);
        }
        closeAllSheets();
        showPrestige(); scan('prestige'); closeModal('prestigeModal');
        showOfflineModal(5000, 3, 3600); scan('offline'); closeModal('offlineModal');
        openModal('soundModal'); scan('settings'); closeModal('soundModal');
        return bad;
    });
    ok('в английской локали нет русского текста', found.length === 0, found.slice(0, 8));
    await ctx.close();
}

// ---------- п. 8.2.3: кириллицы нет и в тексте, нарисованном на канвасе ----------
// Проверка DOM сюда не достаёт: таблички зон и всплывающий текст рисует
// LittleJS через drawText, поэтому перехватываем сам вызов.
{
    const { ctx, page } = await launch({ lang: 'en' });
    const found = await page.evaluate(async () => {
        const seen = new Set();
        const orig = window.drawText;
        window.drawText = function (text, ...rest) {
            if (typeof text === 'string' && text) seen.add(text);
            return orig.apply(this, [text, ...rest]);
        };
        // состояние, в котором видны таблички закрытых зон и всплывашки
        S.coins = 5e5;
        S.plots.forEach(p => { p.c = 0; p.t = 999; });
        harvestPlot(0);
        // даём отрисоваться нескольким кадрам
        await new Promise(r => setTimeout(r, 1200));
        window.drawText = orig;
        return [...seen].filter(t => /[А-Яа-яЁё]/.test(t));
    });
    ok('на канвасе нет русского текста в английской локали', found.length === 0, found);
    await ctx.close();
}

// ---------- п. 5.1.3: название игры одинаково везде ----------
{
    const { ctx, page } = await launch({ lang: 'en' });
    const title = await page.title();
    ok('title = Tiny Sprout', title === 'Tiny Sprout', title);
    await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
