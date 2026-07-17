'use strict';
// ============================================================
// data.js — таблицы контента и формулы баланса
// ============================================================

const INK = '#4a3628';              // чернильный контур (стиль Мур-Луг)
const INKC = new Color().setHex('#4a3628');

// ---------- Культуры ----------
// grow: сек роста, seed: цена посадки, sell: цена продажи,
// unlock: цена открытия (0 = открыта), zone: нужная зона
const CROPS = [
    { id:'wheat',  name:'Пшеница',   grow:8,    seed:5,     sell:12,     unlock:0,       zone:0, hue:'#e8c95a', top:'#f2df8e' },
    { id:'carrot', name:'Морковь',   grow:15,   seed:12,    sell:32,     unlock:100,     zone:0, hue:'#e8813a', top:'#7fbf4d' },
    { id:'potato', name:'Картофель', grow:30,   seed:30,    sell:85,     unlock:400,     zone:0, hue:'#c9a06a', top:'#6faf5a' },
    { id:'cabbage',name:'Капуста',   grow:60,   seed:70,    sell:210,    unlock:1500,    zone:0, hue:'#9fd06a', top:'#b8e08a' },
    { id:'tomato', name:'Помидор',   grow:120,  seed:160,   sell:520,    unlock:5000,    zone:0, hue:'#e2503a', top:'#6faf5a' },
    { id:'cuke',   name:'Огурец',    grow:210,  seed:400,   sell:1350,   unlock:15000,   zone:1, hue:'#4e9e46', top:'#7fbf4d' },
    { id:'corn',   name:'Кукуруза',  grow:360,  seed:900,   sell:3300,   unlock:40000,   zone:1, hue:'#f0c93e', top:'#8fce5f' },
    { id:'berry',  name:'Клубника',  grow:600,  seed:2000,  sell:7800,   unlock:100000,  zone:1, hue:'#e04658', top:'#5fae52' },
    { id:'pumpkin',name:'Тыква',     grow:900,  seed:4500,  sell:19000,  unlock:250000,  zone:1, hue:'#e8923a', top:'#6faf5a' },
    { id:'melon',  name:'Арбуз',     grow:1500, seed:10000, sell:47000,  unlock:600000,  zone:2, hue:'#3e8e4e', top:'#8fce5f' },
    { id:'grape',  name:'Виноград',  grow:2400, seed:22000, sell:115000, unlock:1500000, zone:2, hue:'#8f5fb8', top:'#6faf5a' },
    { id:'pine',   name:'Ананас',    grow:3600, seed:50000, sell:290000, unlock:4000000, zone:2, hue:'#e8b83a', top:'#4e9e46' },
];

// ---------- Продукты животных ----------
const APRODS = [
    { id:'egg',  name:'Яйцо',   sell:70,   hue:'#f5ead0' },
    { id:'milk', name:'Молоко', sell:800,  hue:'#f8f4ea' },
    { id:'wool', name:'Шерсть', sell:4500, hue:'#e8e2d4' },
];

// ---------- Животные ----------
// cost растёт с каждым купленным: cost * 2.5^n, max 4 каждого
const ANIMALS = [
    { id:'hen',   name:'Курица', cost:2000,   every:60,  prod:0, max:4 },
    { id:'cow',   name:'Корова', cost:30000,  every:180, prod:1, max:4 },
    { id:'sheep', name:'Овца',   cost:180000, every:480, prod:2, max:4 },
];

// ---------- Зоны ----------
const ZONES = [
    { id:'field',  name:'Поле',    unlock:0,      plots:8 },
    { id:'garden', name:'Огород',  unlock:25000,  plots:8 },
    { id:'green',  name:'Теплица', unlock:500000, plots:8 },
];
const MAXPLOTS = ZONES.reduce((s,z)=>s+z.plots, 0);

// ---------- Работники / техника ----------
// harv: сборщик (авто-сбор), sow: сеятель (авто-посадка), tract: трактор (цикл сбор+посев всего)
const WORKERS = [
    { id:'harv',  name:'Сборщик Ося',  desc:'Сам собирает готовый урожай', cost:5000,   costMul:3.5, max:6 },
    { id:'sow',   name:'Сеятель Сеня', desc:'Сам засевает пустые грядки',  cost:12000,  costMul:3.5, max:6 },
    { id:'tract', name:'Трактор',      desc:'Раз в цикл собирает и засевает всё поле', cost:150000, costMul:4, max:5 },
];

// ---------- Улучшения (бесконечные, за монеты) ----------
const UPS = [
    { id:'fert', name:'Удобрение',      desc:'+20% к скорости роста',        cost:200,  costMul:2.6 },
    { id:'comp', name:'Компост',        desc:'+25% к цене урожая',           cost:300,  costMul:2.8 },
    { id:'wh',   name:'Погреб',         desc:'+60 к вместимости склада',     cost:150,  costMul:2.2 },
    { id:'gold', name:'Золотые ростки', desc:'+шанс золотого урожая (x5)',   cost:1000, costMul:3.2 },
];

// ---------- Формулы ----------
const WH_BASE = 60;                                    // базовый склад
const plotCost   = n => Math.round(40 * Math.pow(2.05, n));           // n = куплено грядок сверх первой
const upCost     = (u, lvl) => Math.round(u.cost * Math.pow(u.costMul, lvl));
const workerCost = (w, lvl) => Math.round(w.cost * Math.pow(w.costMul, lvl));
const animalCost = (a, n)   => Math.round(a.cost * Math.pow(2.5, n));

const growMult  = () => Math.pow(1.2, S.up.fert);       // делитель времени роста
const sellMult  = () => (1 + .25*S.up.comp) * (1 + .1*S.seeds) * (boostOn() ? 2 : 1);
const goldChance= () => 1 - Math.pow(.94, S.up.gold);   // асимптота к 100%
const whCap     = () => WH_BASE + 60*S.up.wh;
const cropGrow  = c => c.grow / growMult();
const cropSell  = (c, golden) => Math.round(c.sell * sellMult() * (golden ? 5 : 1));

// скорость работников: интервал между действиями, сек
const harvEvery  = () => S.workers.harv  ? 6 / Math.pow(1.5, S.workers.harv-1)  : 0;
const sowEvery   = () => S.workers.sow   ? 7 / Math.pow(1.5, S.workers.sow-1)   : 0;
const tractEvery = () => S.workers.tract ? 90 / Math.pow(1.35, S.workers.tract-1) : 0;

// ---------- Престиж ----------
const SEED_BASE = 60000;   // seasonEarned для 1-го семени
const seedsFromEarned = e => Math.floor(Math.sqrt(e / SEED_BASE));
// престиж открывается только после покупки теплицы (последней зоны)
const prestigeUnlocked = () => S.zones >= ZONES.length || S.cnt.prestiges > 0;
const pendingSeeds = () => prestigeUnlocked() ? Math.max(0, seedsFromEarned(S.seasonEarned) - S.seasonSeeds) : 0;

// ---------- Заказы ----------
const ORDER_MULT = 1.6;    // цена заказа против рынка
const ORDER_SLOTS = 3;
function rollOrder() {
    const open = CROPS.map((c,i)=>i).filter(i => S.crops[i]);
    const i = open[Math.floor(Math.random()*open.length)];
    const c = CROPS[i];
    const qty = 3 + Math.floor(Math.random()*8);
    return { crop:i, qty, reward: Math.round(c.sell * sellMult() * qty * ORDER_MULT),
             seed: Math.random() < .12 ? 1 : 0 };  // редкий бонус — золотое семя
}

// ---------- Квесты дня ----------
const QPOOL = [
    { id:'harvest', name:'Собери урожай',       n:[15, 40, 80],  cnt:'harvests' },
    { id:'sell',    name:'Продай овощей',       n:[20, 50, 120], cnt:'sold' },
    { id:'plant',   name:'Посади растений',     n:[15, 40, 80],  cnt:'planted' },
    { id:'order',   name:'Выполни заказов',     n:[2, 4, 7],     cnt:'orders' },
    { id:'tap',     name:'Ускорь грядки тапом', n:[10, 25, 50],  cnt:'taps' },
    { id:'animal',  name:'Собери у животных',   n:[3, 8, 15],    cnt:'aprods' },
];
const questReward = tier => Math.max(100, Math.round(S.bestIps * 60 * (tier+1)));
const chestReward = () => ({ coins: Math.max(500, Math.round(S.bestIps * 300)), seed: 1 });

// ---------- Достижения (награда — золотые семена) ----------
const ACHS = [
    { id:'h1',    name:'Первый урожай',    desc:'Собери 1 урожай',            cnt:'harvests', n:1,    seed:1 },
    { id:'h100',  name:'Жнец',             desc:'Собери 100 урожаев',         cnt:'harvests', n:100,  seed:1 },
    { id:'h1000', name:'Комбайнёр',        desc:'Собери 1000 урожаев',        cnt:'harvests', n:1000, seed:2 },
    { id:'h5000', name:'Легенда полей',    desc:'Собери 5000 урожаев',        cnt:'harvests', n:5000, seed:3 },
    { id:'s500',  name:'Торговец',         desc:'Продай 500 овощей',          cnt:'sold',     n:500,  seed:1 },
    { id:'s5000', name:'Магнат рынка',     desc:'Продай 5000 овощей',         cnt:'sold',     n:5000, seed:2 },
    { id:'o10',   name:'Надёжный партнёр', desc:'Выполни 10 заказов',         cnt:'orders',   n:10,   seed:1 },
    { id:'o100',  name:'Оптовик',          desc:'Выполни 100 заказов',        cnt:'orders',   n:100,  seed:2 },
    { id:'crops', name:'Ботаник',          desc:'Открой все культуры',        cnt:'cropsAll', n:1,    seed:3 },
    { id:'plots', name:'Латифундист',      desc:'Выкупи все грядки',          cnt:'plotsAll', n:1,    seed:2 },
    { id:'anim',  name:'Зоопарк',          desc:'Заведи всех животных',       cnt:'animAll',  n:1,    seed:2 },
    { id:'gold5', name:'Мидас',            desc:'Собери 50 золотых урожаев',  cnt:'goldens',  n:50,   seed:2 },
    { id:'p1',    name:'Новый сезон',      desc:'Соверши первый престиж',     cnt:'prestiges',n:1,    seed:2 },
    { id:'p5',    name:'Старожил',         desc:'Соверши 5 престижей',        cnt:'prestiges',n:5,    seed:3 },
];

// ---------- Офлайн ----------
const OFFLINE_RATE = .5;          // доля от дохода
const OFFLINE_CAP  = 4*3600;      // сек

// ---------- Реклама ----------
const BOOST_MIN = 3;              // буст x2, минут
const AD_GROW_CD = 300;           // «дорастить всё», сек кулдаун

// ---------- Форматирование чисел ----------
function fmt(n) {
    n = Math.floor(n);
    if (n < 1000) return '' + n;
    const units = ['К','М','Б','Т'];
    let u = -1;
    let x = n;
    while (x >= 1000 && u < units.length-1) { x /= 1000; u++; }
    return (x >= 100 ? Math.floor(x) : x.toFixed(1).replace('.0','')) + units[u];
}
function fmtTime(s) {
    s = Math.ceil(s);
    if (s < 60) return s + ' сек';
    if (s < 3600) return Math.floor(s/60) + ' мин' + (s%60 ? ' ' + s%60 + 'с' : '');
    return Math.floor(s/3600) + ' ч ' + Math.floor(s%3600/60) + ' мин';
}
