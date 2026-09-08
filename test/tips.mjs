// Контекстные подсказки: рассказывают про ролик x2 и про работников.
// Показываются один раз, в подходящий момент, не навязываются.
import { chromium } from 'playwright';

const BASE = 'http://localhost:8347/';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXE });

let failed = 0;
const ok = (name, cond, extra) => {
    console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  ' + JSON.stringify(extra) : ''));
    if (!cond) failed++;
};

async function launch(save) {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 800 } });
    const page = await ctx.newPage();
    await page.route('https://yandex.ru/**', r => r.abort());
    if (save) await page.addInitScript(s => { try { localStorage.setItem('tinysprout', s); } catch (e) {} }, save);
    await page.goto(BASE);
    await page.waitForFunction(() => window.render_game_to_text && (() => {
        try { return !!JSON.parse(window.render_game_to_text()).plots; } catch (e) { return false; }
    })(), null, { timeout: 25000 });
    await page.waitForTimeout(600);
    return { ctx, page };
}
const shown = page => page.evaluate(() => ({
    open: document.getElementById('tip').style.display !== 'none',
    id: tipNow && tipNow.id,
    text: document.getElementById('tipText').textContent.trim(),
}));

// ---------- во время обучения подсказок нет ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async () => {
        S.tut = 1; S.cnt.sold = 5; S.coins = 1e6;
        tipTick();
        await new Promise(r => setTimeout(r, 200));
        return document.getElementById('tip').style.display !== 'none';
    });
    ok('пока идёт обучение, подсказок нет', res === false);
    await ctx.close();
}

// ---------- подсказка про ролик после первой продажи ----------
{
    const { ctx, page } = await launch();
    await page.evaluate(() => { S.tut = 3; S.cnt.sold = 0; tipTick(); });
    const before = await shown(page);
    ok('до первой продажи не показываем', before.open === false, before);

    await page.evaluate(() => { S.cnt.sold = 1; tipTick(); });
    const after = await shown(page);
    ok('после продажи появляется подсказка про ролик', after.open && after.id === 'ad', after);
    ok('текст говорит про удвоение', /вдвое|twice/i.test(after.text), after.text);
    await ctx.close();
}

// ---------- подсказка исчезает по действию игрока и больше не возвращается ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async () => {
        S.tut = 3; S.cnt.sold = 1;
        tipTick();
        const opened = document.getElementById('tip').style.display !== 'none';
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));
        const closed = document.getElementById('tip').style.display === 'none';
        tipTick();                                   // попытка показать снова
        await new Promise(r => setTimeout(r, 100));
        return { opened, closed, again: document.getElementById('tip').style.display !== 'none', flag: !!S.tips.ad };
    });
    ok('подсказка снимается тапом', res.opened && res.closed, res);
    ok('повторно не показывается', res.again === false && res.flag, res);
    await ctx.close();
}

// ---------- сама исчезает по таймеру ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(async () => {
        S.tut = 3; S.cnt.sold = 1;
        TIP_SHOW_MS_TEST: ;
        tipTick();
        const opened = document.getElementById('tip').style.display !== 'none';
        closeTip();                                   // эмулируем срабатывание таймера
        return { opened, closed: document.getElementById('tip').style.display === 'none' };
    });
    ok('подсказка закрывается сама', res.opened && res.closed, res);
    await ctx.close();
}

// ---------- подсказка про работников: только когда по карману ----------
{
    const { ctx, page } = await launch();
    const poor = await page.evaluate(async () => {
        S.tut = 3; S.cnt.sold = 1; S.tips.ad = true;      // первая уже показана
        S.coins = 10; S.workers.harv = 0;
        tipTick();
        return document.getElementById('tip').style.display !== 'none';
    });
    ok('без денег на работника не дразним', poor === false);

    const rich = await page.evaluate(async () => {
        S.coins = workerCost(WORKERS[0], 0);
        tipTick();
        return { open: document.getElementById('tip').style.display !== 'none', id: tipNow && tipNow.id };
    });
    ok('когда работник по карману — подсказываем', rich.open && rich.id === 'work', rich);
    await ctx.close();
}

// ---------- уже нанятому работнику не подсказываем ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(() => {
        S.tut = 3; S.cnt.sold = 1; S.tips.ad = true;
        S.coins = 1e6; S.workers.harv = 2;               // работник уже есть
        tipTick();
        return document.getElementById('tip').style.display !== 'none';
    });
    ok('нанявшему работника подсказка не нужна', res === false);
    await ctx.close();
}

// ---------- не показываем поверх открытой панели ----------
{
    const { ctx, page } = await launch();
    const res = await page.evaluate(() => {
        S.tut = 3; S.cnt.sold = 1;
        openSheet('shopSheet');
        tipTick();
        return document.getElementById('tip').style.display !== 'none';
    });
    ok('поверх открытой панели подсказки нет', res === false);
    await ctx.close();
}

// ---------- старый сейв без поля tips ----------
{
    const old = JSON.stringify({ v: 1, coins: 9e5, seeds: 3, tut: 3, lifeEarned: 5e5,
        cnt: { harvests: 50, sold: 40, planted: 60, orders: 2, taps: 10, aprods: 3,
               goldens: 1, prestiges: 0, cropsAll: 0, plotsAll: 0, animAll: 0 },
        workers: { harv: 0, sow: 0, seller: 0 }, time: Date.now() });
    const { ctx, page } = await launch(old);
    const res = await page.evaluate(() => {
        const t = typeof S.tips;
        // при загрузке такого сейва открывается окно серии — подсказка ждёт его,
        // это ожидаемо, поэтому закрываем и только затем проверяем
        const blocked = (tipTick(), document.getElementById('tip').style.display !== 'none');
        closeAllSheets(); closeModal('streakModal');
        tipTick();
        return { type: t, blocked, open: document.getElementById('tip').style.display !== 'none' };
    });
    ok('старый сейв получает поле tips', res.type === 'object', res);
    ok('под открытым окном подсказка ждёт', res.blocked === false, res);
    ok('после закрытия окна подсказка показывается', res.open, res);
    await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
