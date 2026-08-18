// Иконка 512×512 и обложка 800×470 для черновика Яндекс Игр.
// Собираются из игровых SVG-иконок и палитры игры — это оригинальные
// промо-материалы, а не кадры экрана (скриншоты в иконке/обложке запрещены).
//
//   node test/promo.mjs        # нужен http-сервер на :8347
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = 'store';

// вытаскиваем нужные SVG прямо из ui.js, чтобы промо не разъезжалось с игрой
const ui = await readFile('ui.js', 'utf8');
const icon = id => {
    const m = ui.match(new RegExp('^' + id + ':`(<svg[\\s\\S]*?</svg>)`', 'm'));
    if (!m) throw new Error('иконка не найдена: ' + id);
    return m[1];
};

const SPROUT = icon('comp');      // росток с листьями — образ игры
const COIN = icon('coin');
const CROPS_ROW = ['carrot', 'tomato', 'cabbage', 'pumpkin', 'berry'].map(icon);
const HEN = icon('hen');

const page404 = `
<!doctype html><meta charset="utf-8">
<style>
@font-face { font-family:'Neucha'; src:url('../fonts/neucha-lat.woff2') format('woff2'); font-display:block; }
@font-face { font-family:'Nunito'; src:url('../fonts/nunito-lat.woff2') format('woff2'); font-display:block; }
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#fff; }

/* поле как в игре: мягкая клетка на зелёном */
.field {
    background:
        repeating-conic-gradient(rgba(255,255,255,.07) 0% 25%, transparent 0% 50%) 0 0 / 88px 88px,
        linear-gradient(160deg, #b5d38c 0%, #a3c87b 55%, #93bb6c 100%);
}

/* ---- иконка 512×512: строго квадрат, без скруглений ----
   фон тёплый, а не зелёный: иначе зелёный росток сливается и иконка «пропадает» */
#icon { width:512px; height:512px; position:relative; overflow:hidden;
    background:linear-gradient(168deg, #ffe9a8 0%, #fdf3d6 48%, #f7e6bd 100%); }
#icon .sun { position:absolute; width:520px; height:520px; left:-120px; top:-210px;
    background:radial-gradient(circle, rgba(255,255,255,.85), rgba(255,255,255,0) 64%); }
#icon .hill { position:absolute; left:-16%; bottom:58px; width:132%; height:21%;
    background:linear-gradient(180deg, #a8cc80, #8fb968); border-radius:50% 50% 0 0; }
#icon .hill::after { content:''; position:absolute; inset:0;
    background:repeating-conic-gradient(rgba(255,255,255,.09) 0% 25%, transparent 0% 50%) 0 0 / 74px 74px;
    border-radius:50% 50% 0 0; }
#icon .soil { position:absolute; left:0; bottom:0; width:100%; height:72px; background:#8a6749; }
#icon .soil::before { content:''; position:absolute; inset:0 0 auto 0; height:16px; background:#a07a52; }
#icon .sprout { position:absolute; left:50%; bottom:52px; transform:translateX(-50%);
    width:400px; height:400px; filter:drop-shadow(0 12px 16px rgba(70,56,38,.32)); }
#icon .sprout svg { width:100%; height:100%; }
#icon .coin { position:absolute; right:26px; top:26px; width:124px; height:124px;
    filter:drop-shadow(0 6px 10px rgba(70,56,38,.28)); }
#icon .coin svg { width:100%; height:100%; }

/* ---- обложка 800×470 (своя на каждый язык) ---- */
.cover { width:800px; height:470px; position:relative; overflow:hidden; margin-bottom:24px; }
.cover .sun { position:absolute; width:560px; height:560px; right:-150px; top:-250px;
    background:radial-gradient(circle, rgba(255,255,255,.45), rgba(255,255,255,0) 62%); }
.cover .soil { position:absolute; left:0; bottom:0; width:100%; height:74px; background:#8a6749; }
.cover .soil::before { content:''; position:absolute; inset:0 0 auto 0; height:15px; background:#a07a52; }
.cover .left { position:absolute; left:52px; top:132px; width:390px; }
.cover h1 { font-family:'Neucha', cursive; font-size:72px; line-height:1; color:#fdf8ec;
    text-shadow:0 4px 0 #6f8a4f, 0 8px 18px rgba(60,48,32,.35); letter-spacing:.5px; }
.cover p  { margin-top:16px; font-family:'Nunito', sans-serif; font-weight:800; font-size:24px;
    color:#4a3d2d; text-shadow:0 1px 0 rgba(255,255,255,.55); }
.cover .art { position:absolute; right:24px; bottom:74px; width:360px; height:290px; }
.cover .art .big { position:absolute; right:26px; bottom:0; width:196px; height:196px;
    filter:drop-shadow(0 10px 12px rgba(70,56,38,.28)); }
.cover .art .big svg { width:100%; height:100%; }
.cover .row { position:absolute; right:0; top:6px; display:flex; gap:12px; }
.cover .row i { width:62px; height:62px; display:block;
    filter:drop-shadow(0 5px 7px rgba(70,56,38,.26)); }
.cover .row i svg { width:100%; height:100%; }
</style>

<div id="icon" class="field">
    <div class="sun"></div><div class="hill"></div>
    <div class="soil"></div>
    <div class="coin">${COIN}</div>
    <div class="sprout">${SPROUT}</div>
</div>

${[['ru', 'Выращивай свою ферму'], ['en', 'Grow your own farm']].map(([lg, sub]) => `
<div class="cover field" id="cover-${lg}">
    <div class="sun"></div>
    <div class="soil"></div>
    <div class="left">
        <h1>Tiny Sprout</h1>
        <p>${sub}</p>
    </div>
    <div class="art">
        <div class="row">${CROPS_ROW.map(s => `<i>${s}</i>`).join('')}</div>
        <div class="big">${HEN}</div>
    </div>
</div>`).join('')}
`;

await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/_promo.html`, page404);

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 900, height: 1100 } });
await page.goto('http://localhost:8347/store/_promo.html');
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

const made = [`${OUT}/icon-512.png`];
await page.locator('#icon').screenshot({ path: made[0] });
for (const lg of ['ru', 'en']) {
    const p = `${OUT}/cover-800x470-${lg}.png`;
    await page.locator('#cover-' + lg).screenshot({ path: p });
    made.push(p);
}
await browser.close();
await rm(`${OUT}/_promo.html`, { force: true });   // временная разметка, в репозитории не нужна
console.log('saved:\n  ' + made.join('\n  '));
