// Playwright-смоук: загрузка, туториал-цикл (посадить→вырастить→собрать→продать),
// покупки, работники, заказы, престиж — через тест-хуки render_game_to_text/advanceTime.
import { chromium } from 'playwright';

const URL = 'http://localhost:8347/';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
// шум Yandex SDK вне платформы — не наша ошибка
const sdkNoise = t => /No parent to post message|appId from environment|YandexGamesSDKEnvironment/.test(t);
page.on('console', m => m.type() === 'error' && !sdkNoise(m.text()) && errors.push(m.text()));
page.on('pageerror', e => !sdkNoise(e.message) && errors.push(e.message));

const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const adv = ms => page.evaluate(m => window.advanceTime(m), ms);
const shot = name => page.screenshot({ path: `test/shots/${name}.png` });
let fails = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + name); if (!cond) fails++; };

await page.goto(URL);
await page.waitForFunction(() => window.render_game_to_text && (() => { try { return !!JSON.parse(window.render_game_to_text()).plots; } catch(e) { return false; } })(), null, { timeout: 15000 });
await page.waitForTimeout(800);
await shot('01-boot');

let s = await state();
check('boot: 1 plot, 25 coins', s.plots.length === 1 && s.coins === 25);
check('boot: tutorial at step 0', s.tut === 0);

// клик по первой грядке — посадить пшеницу
const plotXY = await page.evaluate(() => { const p = worldToScreen(plotPos(0)); return { x: p.x, y: p.y }; });
await page.mouse.click(plotXY.x, plotXY.y);
await page.waitForTimeout(200);
s = await state();
check('plant: wheat planted, coins spent', s.plots[0].crop === 'wheat' && s.coins === 20);
check('plant: tut advanced to 1', s.tut === 1);

// вырастить (пшеница 8с) и собрать кликом
await adv(9000);
s = await state();
check('grow: wheat ready', s.plots[0].ready === true);
await shot('02-ready');
await page.mouse.click(plotXY.x, plotXY.y);
await page.waitForTimeout(200);
s = await state();
check('harvest: wheat in store', (s.store.wheat || 0) >= 1 && s.plots[0].crop === null);
check('harvest: tut advanced to 2', s.tut === 2);

// открыть склад и продать всё
await page.click('#barnFab');
await page.waitForTimeout(300);
await shot('03-barn');
await page.click('#sellAllBtn');
await page.waitForTimeout(200);
s = await state();
check('sell: coins grew, store empty', s.coins > 20 && s.storeTotal === 0);
check('sell: tut done', s.tut === 3);
await page.click('#overlay', { force: true });
await page.waitForTimeout(300);

// экономика через хуки: заработать и купить грядки/культуры/работников
await page.evaluate(() => { S.coins += 5e6; });
await page.evaluate(() => { for (let i = 0; i < 10; i++) buyPlot(); });
s = await state();
check('plots: bought up to zone cap (8)', s.plots.length === 8);
await page.evaluate(() => buyZone());
await page.evaluate(() => { for (let i = 0; i < 10; i++) buyPlot(); });
s = await state();
check('zone2 open: 16 plots', s.zones === 2 && s.plots.length === 16);

await page.evaluate(() => { buyCrop(1); buyCrop(2); buyCrop(3); });
s = await state();
check('crops: carrot selected after unlock', s.lastCrop === 'potato' || s.lastCrop === 'cabbage');
await page.evaluate(() => { buyWorker('sow'); buyWorker('harv'); });
s = await state();
check('workers hired', s.workers.sow === 1 && s.workers.harv === 1);

// авто-цикл: сеятель сажает, сборщик собирает
await adv(8000);
s = await state();
const planted = s.plots.filter(p => p.crop).length;
check('sower planted something', planted > 0);
await adv(120000);
await adv(120000);
s = await state();
check('harvester collected to store', s.storeTotal > 0);
await shot('04-automation');

// заказы
await page.evaluate(() => { const o = S.orders[0]; S.store[CROPS[o.crop].id] = o.qty; });
const coinsBefore = (await state()).coins;
await page.evaluate(() => fulfillOrder(0));
s = await state();
check('order fulfilled: reward paid', s.coins > coinsBefore && s.cnt.orders === 1);

// животные
await page.evaluate(() => { S.coins += 1e6; buyAnimal('hen'); });
await adv(70000);
s = await state();
check('hen produced egg', (s.store.egg || 0) >= 1);

// улучшения
await page.evaluate(() => buyUp('fert'));
s = await state();
check('upgrade fert lvl 1', s.up.fert === 1);

// престиж
await page.evaluate(() => { S.seasonEarned = 1e6; });
s = await state();
check('prestige pending seeds > 0', s.pendingSeeds > 0);
await page.evaluate(() => doPrestige());
s = await state();
check('prestige reset: 1 plot, seeds granted', s.plots.length === 1 && s.seeds > 0 && s.cnt.prestiges === 1);
await shot('05-after-prestige');

// сейв-цикл
await page.evaluate(() => persist(true));
const seeds = s.seeds;
await page.reload();
await page.waitForFunction(() => { try { return !!JSON.parse(window.render_game_to_text()).plots; } catch(e) { return false; } }, null, { timeout: 15000 });
await page.waitForTimeout(600);
s = await state();
check('save/load: seeds survive reload', s.seeds === seeds && s.cnt.prestiges === 1);
await shot('06-reloaded');

console.log('\nConsole errors: ' + (errors.length ? '\n' + errors.join('\n') : 'none'));
console.log(fails ? `\n${fails} FAILURES` : '\nALL PASS');
await browser.close();
process.exit(fails || errors.length ? 1 : 0);
