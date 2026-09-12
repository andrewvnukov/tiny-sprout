// Лидерборд против мок-SDK Яндекса: настоящий SDK из песочницы недоступен,
// поэтому window.YaGames подменяется до загрузки скриптов игры.
//
// Проверяем: оба поколения API, авторизацию, лимит записи, кэш чтения,
// ветку ошибки и экранирование имён игроков.
import { chromium } from 'playwright';

const BASE = 'http://localhost:8347/';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXE });

const MOCK = ({ authed, api, failEntries, canWrite }) => {
    const calls = { setScore: [], getEntries: 0, authDialog: 0, includeUser: [] };
    window.__lb = calls;
    let isAuth = authed;
    const player = {
        isAuthorized: () => isAuth,
        getData: () => Promise.resolve({}),
        setData: () => Promise.resolve(),
    };
    const payload = () => ({
        userRank: isAuth ? 3 : 0,
        entries: [
            { rank: 1, score: 42, player: { publicName: 'Аня',  getAvatarSrc: () => '' } },
            { rank: 2, score: 30, player: { publicName: '<img src=x onerror=window.__pwned=1>', getAvatarSrc: () => '' } },
            { rank: 3, score: 12, player: { publicName: 'Me',   getAvatarSrc: () => '' } },
        ],
    });
    const put = (n, s) => { calls.setScore.push({ n, s, t: Date.now() }); return Promise.resolve(); };
    const get = (n, o) => {
        calls.getEntries++; calls.includeUser.push(!!(o && o.includeUser));
        return failEntries ? Promise.reject(new Error('boom')) : Promise.resolve(payload());
    };
    const sdk = {
        getPlayer: () => Promise.resolve(player),
        isAvailableMethod: () => Promise.resolve(canWrite),
        auth: { openAuthDialog: () => { calls.authDialog++; isAuth = true; return Promise.resolve(); } },
        features: {},
    };
    if (api === 'new') sdk.leaderboards = { setScore: put, getEntries: get };
    else sdk.getLeaderboards = () => Promise.resolve({ setLeaderboardScore: put, getLeaderboardEntries: get });
    window.YaGames = { init: () => Promise.resolve(sdk) };
};

let failed = 0;
const ok = (name, cond, extra) => {
    console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : ''));
    if (!cond) failed++;
};

async function open(opts) {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 760 } });
    const page = await ctx.newPage();
    // настоящий SDK всё равно подменён моком, а ожидание его таймаута
    // растягивает загрузку страницы на десятки секунд
    await page.route('https://yandex.ru/**', r => r.abort());
    await page.addInitScript(MOCK, { canWrite: true, ...opts });
    await page.goto(BASE + '?lang=' + (opts.lang || 'ru'));
    await page.waitForFunction(() => window.render_game_to_text && (() => {
        try { return !!JSON.parse(window.render_game_to_text()).plots; } catch (e) { return false; }
    })(), null, { timeout: 20000 });
    await page.waitForTimeout(500);
    return { ctx, page };
}
const openRank = page => page.evaluate(() => {
    openSheet('albumSheet'); albumTab = 'rank'; renderAlbum();
});

// ---------- 1. актуальный API, авторизованный игрок ----------
{
    const { ctx, page } = await open({ authed: true, api: 'new' });
    ok('new API: лидерборд поднялся', await page.evaluate(() => !!lbBoard && lbAuthed && lbCanWrite));

    await page.evaluate(() => { S.seeds = 7; submitScore(); });
    await page.waitForTimeout(300);
    ok('new API: счёт отправлен через setScore',
       await page.evaluate(() => __lb.setScore.length === 1 && __lb.setScore[0].s === 7 && __lb.setScore[0].n === 'goldenSeeds'),
       await page.evaluate(() => __lb.setScore));

    await openRank(page);
    await page.waitForTimeout(600);
    const rows = await page.$$eval('#albumList .row', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    ok('выдача отрисована (3 строки)', rows.length === 3, rows);
    ok('своё место подсвечено', await page.$$eval('#albumList .row.sel', e => e.length) === 1);
    ok('имя игрока экранировано', await page.evaluate(() => !window.__pwned && !document.querySelector('#albumList img[src="x"]')));
    ok('кнопки входа нет у авторизованного', await page.$('#lbLogin') === null);
    await ctx.close();
}

// ---------- 2. устаревший API getLeaderboards() ----------
{
    const { ctx, page } = await open({ authed: true, api: 'old' });
    ok('old API: лидерборд поднялся', await page.evaluate(() => !!lbBoard));
    await page.evaluate(() => { S.seeds = 3; submitScore(); });
    await page.waitForTimeout(300);
    ok('old API: счёт ушёл через setLeaderboardScore',
       await page.evaluate(() => __lb.setScore.some(c => c.s === 3)));
    await openRank(page);
    await page.waitForTimeout(600);
    ok('old API: выдача отрисована', await page.$$eval('#albumList .row', e => e.length) === 3);
    await ctx.close();
}

// ---------- 3. неавторизованный игрок ----------
{
    const { ctx, page } = await open({ authed: false, api: 'new' });
    ok('без авторизации счёт не отправляется',
       await page.evaluate(() => { S.seeds = 5; submitScore(); return __lb.setScore.length === 0; }));

    await openRank(page);
    await page.waitForTimeout(600);
    ok('предложен вход', await page.$('#lbLogin') !== null);
    ok('includeUser выключен для гостя',
       await page.evaluate(() => __lb.includeUser.every(v => v === false)),
       await page.evaluate(() => __lb.includeUser));

    await page.click('#lbLogin');
    await page.waitForTimeout(800);
    ok('окно авторизации открыто', await page.evaluate(() => __lb.authDialog === 1));
    ok('после входа счёт отправлен', await page.evaluate(() => __lb.setScore.length >= 1 && lbAuthed));
    ok('после входа includeUser включён', await page.evaluate(() => __lb.includeUser.slice(-1)[0] === true));
    ok('кнопка входа исчезла', await page.$('#lbLogin') === null);
    await ctx.close();
}

// ---------- 4. лимит записи: не чаще ~1 раза в секунду ----------
{
    const { ctx, page } = await open({ authed: true, api: 'new' });
    await page.evaluate(() => { __lb.setScore.length = 0;
        for (let i = 1; i <= 8; i++) { S.seeds = i; submitScore(); } });
    await page.waitForTimeout(400);
    const burst = await page.evaluate(() => __lb.setScore.length);
    ok('всплеск изменений не заспамил API', burst === 1, { writes: burst });
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => __lb.setScore);
    ok('отложенная запись догнала последнее значение',
       after.length === 2 && after[after.length - 1].s === 8, after);
    await ctx.close();
}

// ---------- 5. кэш чтения ----------
{
    const { ctx, page } = await open({ authed: true, api: 'new' });
    await openRank(page); await page.waitForTimeout(500);
    await page.evaluate(() => { closeAllSheets(); openSheet('albumSheet'); albumTab = 'rank'; renderAlbum(); });
    await page.waitForTimeout(500);
    await page.evaluate(() => { closeAllSheets(); openSheet('albumSheet'); albumTab = 'rank'; renderAlbum(); });
    await page.waitForTimeout(500);
    ok('повторные открытия берут кэш', await page.evaluate(() => __lb.getEntries === 1),
       await page.evaluate(() => __lb.getEntries));
    await ctx.close();
}

// ---------- 6. ошибка выдачи ----------
{
    const { ctx, page } = await open({ authed: true, api: 'new', failEntries: true, lang: 'en' });
    await openRank(page);
    await page.waitForTimeout(600);
    ok('ошибка показана, а не «пусто»',
       (await page.textContent('#albumList')).includes('Could not load'));
    ok('есть кнопка повтора', await page.$('#lbRetry') !== null);
    await ctx.close();
}

// ---------- 7. платформа без записи в лидерборд ----------
{
    const { ctx, page } = await open({ authed: true, api: 'new', canWrite: false });
    ok('setScore не зовётся, если метод недоступен',
       await page.evaluate(() => { S.seeds = 9; submitScore(); return !lbCanWrite && __lb.setScore.length === 0; }));
    await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
