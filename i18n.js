'use strict';
// ============================================================
// i18n.js — локализация ru/en
//
// Ключ перевода — сама русская строка. Русский рендерится «как есть»,
// поэтому пропущенный ключ деградирует в оригинал, а не в пустоту.
// Подстановки: T('{name} — открыто!', { name: T(c.name) })
// ============================================================

let LANG = 'ru';

const EN = {
    // ---------- культуры ----------
    'Пшеница':'Wheat', 'Морковь':'Carrot', 'Картофель':'Potato', 'Капуста':'Cabbage',
    'Помидор':'Tomato', 'Огурец':'Cucumber', 'Кукуруза':'Corn', 'Клубника':'Strawberry',
    'Тыква':'Pumpkin', 'Арбуз':'Watermelon', 'Виноград':'Grapes', 'Ананас':'Pineapple',

    // ---------- продукты животных / животные ----------
    'Яйцо':'Egg', 'Молоко':'Milk', 'Шерсть':'Wool',
    'Курица':'Hen', 'Корова':'Cow', 'Овца':'Sheep',

    // ---------- зоны ----------
    'Поле':'Field', 'Огород':'Garden', 'Теплица':'Greenhouse',

    // ---------- работники ----------
    'Сборщик':'Harvester', 'Сам собирает готовый урожай':'Harvests ripe crops by itself',
    'Сеятель':'Sower', 'Сам засевает пустые грядки':'Sows empty plots by itself',
    'Продавец':'Trader',
    'Стоит у прилавка и сам продаёт урожай со склада за монеты':
        'Mans the stall and sells produce from the barn for coins',

    // ---------- улучшения ----------
    'Удобрение':'Fertilizer', '+20% к скорости роста':'+20% growth speed',
    'Компост':'Compost',      '+25% к цене урожая':'+25% crop price',
    'Погреб':'Cellar',        '+60 к вместимости склада':'+60 barn capacity',
    'Золотые ростки':'Golden Sprouts', '+шанс золотого урожая (x5)':'+chance of a golden harvest (x5)',

    // ---------- квесты дня ----------
    'Собери урожай':'Harvest crops', 'Продай овощей':'Sell produce',
    'Посади растений':'Plant crops',  'Выполни заказов':'Complete orders',
    'Ускорь грядки тапом':'Speed up plots by tapping', 'Собери у животных':'Collect from animals',

    // ---------- достижения ----------
    'Первый урожай':'First Harvest',      'Собери 1 урожай':'Harvest once',
    'Жнец':'Reaper',                      'Собери 100 урожаев':'Harvest 100 times',
    'Комбайнёр':'Combine Driver',         'Собери 1000 урожаев':'Harvest 1000 times',
    'Легенда полей':'Legend of the Fields','Собери 5000 урожаев':'Harvest 5000 times',
    'Торговец':'Merchant',                'Продай 500 овощей':'Sell 500 items',
    'Магнат рынка':'Market Tycoon',       'Продай 5000 овощей':'Sell 5000 items',
    'Надёжный партнёр':'Reliable Partner','Выполни 10 заказов':'Complete 10 orders',
    'Оптовик':'Wholesaler',               'Выполни 100 заказов':'Complete 100 orders',
    'Ботаник':'Botanist',                 'Открой все культуры':'Unlock every crop',
    'Латифундист':'Landowner',            'Выкупи все грядки':'Buy every plot',
    'Зоопарк':'Petting Zoo',              'Заведи всех животных':'Collect every animal',
    'Мидас':'Midas',                      'Собери 50 золотых урожаев':'Harvest 50 golden crops',
    'Новый сезон':'New Season',           'Соверши первый престиж':'Start your first new season',
    'Старожил':'Old-Timer',               'Соверши 5 престижей':'Start 5 new seasons',

    // ---------- панели / статика ----------
    'Что сажать?':'What to plant?',
    'Тап по грядке сажает выбранную культуру':'Tap a plot to plant the selected crop',
    'Магазин':'Shop', 'Семена':'Seeds', 'Улучшения':'Upgrades', 'Техника':'Workers', 'Животные':'Animals',
    'Склад':'Barn', 'Продать всё':'Sell all',
    'Заказы':'Orders', 'Квесты дня':'Daily quests',
    'Альбом':'Album', 'Коллекция':'Collection', 'Достижения':'Achievements', 'Рейтинг':'Leaderboard',
    'Звук':'Sound', 'Эффекты':'Effects', 'Музыка':'Music', 'Язык':'Language', 'Готово':'Done',
    'Позже':'Later', 'С возвращением!':'Welcome back!',
    'Забрать x2':'Claim x2', 'Забрать':'Claim',

    // ---------- HUD / кнопки ----------
    'Доход x2':'x2 income', 'Дорастить всё':'Grow all',
    'купить':'buy', 'семя':'seed',
    'выбрано':'selected', 'сажать':'plant', 'открыть':'unlock',
    'макс':'max', 'ур.':'lv.', 'все':'all', 'сдать':'deliver',
    'забрать':'claim', 'открыть сундук':'open',
    'получено':'earned', 'Отлично':'Great', 'Продолжить x2':'Continue x2',

    // ---------- подсказки HUD ----------
    'Монеты — покупай семена, грядки, технику и животных. Зарабатывай, продавая урожай.':
        'Coins — buy seeds, plots, workers and animals. Earn them by selling your produce.',
    'Золотые семена — награда за «Новый сезон». Дают постоянный бонус к доходу.':
        'Golden seeds — the reward for a New Season. They give a permanent income bonus.',

    // ---------- выбор культуры ----------
    'семя {n} {coin}':'seed {n} {coin}',

    // ---------- магазин ----------
    '{time} · семя {seed} · продажа {sell} {coin}':'{time} · seed {seed} · sells for {sell} {coin}',
    'ур.{lvl}':'lv.{lvl}',
    'открыть · {n}':'unlock · {n}',
    '{prod} каждые {time} · цена {price} {coin}':'{prod} every {time} · price {price} {coin}',
    'собирает урожай раз в {n} c':'harvests once every {n}s',
    'сажает растение раз в {n} c':'plants once every {n}s',
    'продаёт до {q} товаров раз в {n} c':'sells up to {q} items every {n}s',
    'Работники автоматизируют ферму: сеятель сажает, сборщик собирает, продавец продаёт склад за монеты. Благодаря им ферма работает и приносит доход даже офлайн.':
        'Workers automate the farm: the sower plants, the harvester gathers, the trader sells the barn for coins. Thanks to them the farm keeps earning even offline.',

    // ---------- склад ----------
    'Склад: <b>{tot} / {cap}</b>':'Barn: <b>{tot} / {cap}</b>',
    'Склад: 0 / 60':'Barn: 0 / 60',       // стартовое значение в разметке
    'Пусто. Собери урожай с грядок!':'Empty. Go harvest your plots!',
    '{n} {coin} за штуку':'{n} {coin} each',

    // ---------- заказы / квесты ----------
    'Новый заказ скоро…':'New order soon…',
    'появляются до {n} в час':'up to {n} appear per hour',
    'есть {have}/{qty} · награда {n} {coin}':'have {have}/{qty} · reward {n} {coin}',
    'Сундук дня':'Daily chest',
    'Выполни все 3 квеста · монеты + семя {seed}':'Complete all 3 quests · coins + a seed {seed}',

    // ---------- альбом ----------
    'Открыто культур: {n} / {max}':'Crops unlocked: {n} / {max}',
    'Рейтинг доступен в приложении Яндекс Игр.':'The leaderboard is available on Yandex Games.',
    'Загрузка рейтинга…':'Loading leaderboard…',
    'Пока пусто. Собери золотые семена и стань первым!':
        'Nothing here yet. Collect golden seeds and be the first!',
    'Игрок':'Player', 'ты':'you',
    'Не удалось загрузить рейтинг.':'Could not load the leaderboard.',
    'Обновить':'Retry',
    'Ты вне рейтинга':'You are not ranked',
    'Войди, чтобы занять место и сохранить результат.':
        'Sign in to take your place and save your score.',
    'Войти':'Sign in',
    'Твой результат появится в рейтинге после первого золотого семени.':
        'Your score will appear once you earn your first golden seed.',

    // ---------- престиж ----------
    'Начни <b>новый сезон</b>: ферма, монеты и улучшения сбросятся,<br>а ты получишь <b class="gold">+{p} {seed} золотых семян</b>.':
        'Start a <b>new season</b>: the farm, coins and upgrades reset,<br>and you get <b class="gold">+{p} {seed} golden seeds</b>.',
    'Каждое семя даёт <b>+10% к доходу навсегда</b>.<br>Сейчас у тебя {n} {seed} (бонус +{b}%).':
        'Each seed gives <b>+10% income forever</b>.<br>You now have {n} {seed} (bonus +{b}%).',
    'Всего заработано: {all} {coin}.<br>До следующего семени: {next} {coin}.':
        'Earned in total: {all} {coin}.<br>To the next seed: {next} {coin}.',
    'Новый сезон (+{p})':'New Season (+{p})',
    'Пока рано…':'Not yet…',

    // ---------- офлайн ----------
    'продавец наторговал <b>{n} {coin}</b>':'the trader earned <b>{n} {coin}</b>',
    'ничего не изменилось':'nothing changed',
    'и ':'and ',

    // ---------- офлайн-сводка ----------
    'Тебя не было {t}. Ферма работала:':'You were away for {t}. The farm kept working:',
    'Продавец наторговал':'Trader earned',
    'Склад заполнился — работники простаивали. Расширь погреб, чтобы за ночь копилось больше.':
        'The barn filled up and the workers idled. Expand the cellar to store more overnight.',
    'Другие квесты закончились':'No other quests left',
    'Пока тебя нет, ферма наработает ≈{n} {coin} за {t}':
        'While you are away the farm earns ≈{n} {coin} over {t}',

    // ---------- ежедневная серия ----------
    'Ты вернулся!':'Welcome back!',
    'Серия заходов: <b>{d}</b> подряд. Не пропусти завтра — награда растёт.':
        'Streak: <b>{d}</b> days in a row. Come back tomorrow — the reward keeps growing.',
    'Заходи каждый день — награда будет расти.':'Come back every day — the reward keeps growing.',
    'День {d}: +{n} монет':'Day {d}: +{n} coins',
    'День {d}: +{n} монет и +{s} {seed}':'Day {d}: +{n} coins and +{s} {seed}',

    // ---------- офлайн-подсказка на складе ----------
    'Пока тебя нет, продавец наторгует ≈{n} {coin} за {t}':
        'While you are away the trader earns ≈{n} {coin} over {t}',
    'Наймите продавца — и ферма будет приносить монеты, пока вас нет.':
        'Hire a trader and the farm will earn coins while you are away.',
    'Сменить за ролик':'Reroll for an ad',
    'Сундук: +{n} монет и +{s} золотых семян!':'Chest: +{n} coins and +{s} golden seeds!',

    // ---------- ярлык на главный экран ----------
    'Ферма под рукой':'Your farm, one tap away',
    'Добавь ярлык на главный экран — и возвращайся к ферме в одно касание.':
        'Add a shortcut to your home screen and come back to the farm in one tap.',
    'За установку — <b class="gold">+{n} {seed}</b>.':'You get <b class="gold">+{n} {seed}</b> for it.',
    'Добавить':'Add',
    'Ярлык добавлен! +{n} золотое семя':'Shortcut added! +{n} golden seed',

    // ---------- туториал ----------
    'Тапни по грядке,<br>чтобы посадить {icon}':'Tap a plot<br>to plant {icon}',
    'Подожди чуть-чуть…<br>и собери урожай!':'Wait a moment…<br>then harvest it!',
    'Открой склад {icon}<br>и продай урожай':'Open the barn {icon}<br>and sell your produce',

    // ---------- тосты ----------
    'Не хватает монет!':'Not enough coins!',
    'Семена стоят {n} монет':'Seeds cost {n} coins',
    'Склад полон! Продай урожай.':'Barn is full! Sell your produce.',
    'Новая грядка!':'New plot!',
    '{name} — открыто!':'{name} — unlocked!',
    'Сначала открой зону «{zone}»':'Unlock the {zone} area first',
    '{name} приступает к работе!':'{name} starts working!',
    '{name} — уровень {lvl}':'{name} — level {lvl}',
    '{name} поселилась на ферме!':'{name} has joined the farm!',
    '+{n} монет':'+{n} coins',
    'Не хватает: {name} x{qty}':'Not enough: {name} x{qty}',
    '+1 золотое семя!':'+1 golden seed!',
    'Заказ выполнен! +{n} монет':'Order complete! +{n} coins',
    'Смена заданий: лимит {max} за 2 часа':'Order rerolls: limit {max} per 2 hours',
    'Квест выполнен! +{n} монет':'Quest complete! +{n} coins',
    'Сундук: +{n} монет и +1 золотое семя!':'Chest: +{n} coins and +1 golden seed!',
    'Достижение «{name}»: +{n} зол. сем.':'Achievement "{name}": +{n} golden seeds',
    'Новый сезон! +{p} золотых семян':'New Season! +{p} golden seeds',
    'Доход x2 на {n} минуты!':'x2 income for {n} minutes!',
    'Всё выросло!':'Everything has grown!',
    '+{n} на склад':'+{n} to the barn',
    'Ничего нового':'Nothing new',
    'Новый сезон!':'New Season!',

    // ---------- форматирование ----------
    '@units':'K,M,B,T',
    '@sec':'s', '@ssec':'s', '@min':'min', '@hour':'h',
};

// Служебные ключи (@…) не имеют русского «оригинала» — задаём их явно.
const RU = {
    '@units':'К,М,Б,Т',
    '@sec':'сек', '@ssec':'с', '@min':'мин', '@hour':'ч',
};

const DICT = { ru: RU, en: EN };

// Перевод. key — русская строка; vars — подстановки {name}.
function T(key, vars) {
    const d = DICT[LANG];
    let s = (d && d[key] != null) ? d[key] : key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
}

// Язык: сохранённый выбор → Yandex SDK → язык браузера → ru.
// Яндекс требует автоопределение; ru/be/kk/uk/uz ведём на русский, остальных — на английский.
const RU_LOCALES = ['ru', 'be', 'kk', 'uk', 'uz'];
function pickLang(code) {
    const c = String(code || '').slice(0, 2).toLowerCase();
    return RU_LOCALES.indexOf(c) >= 0 ? 'ru' : 'en';
}
function detectLang(sdk) {
    // Язык платформы читаем ВСЕГДА и первым делом, даже если ниже победит
    // сохранённый выбор игрока. Если выйти раньше, обращения к
    // ysdk.environment.i18n.lang не произойдёт вовсе — и дебаг-панель площадки
    // покажет «I18N is not used», то есть автоопределение будет считаться
    // нереализованным (п. 2.14).
    let platform = null;
    try {
        const l = sdk && sdk.environment && sdk.environment.i18n && sdk.environment.i18n.lang;
        if (l) platform = pickLang(l);
    } catch (e) {}

    try {
        const q = new URLSearchParams(location.search).get('lang');
        if (q === 'ru' || q === 'en') return q;          // явный оверрайд (тесты, скриншоты)
    } catch (e) {}
    try {
        const saved = localStorage.getItem('tsprout_lang');
        if (saved === 'ru' || saved === 'en') return saved;
    } catch (e) {}
    if (platform) return platform;
    return pickLang((navigator.languages && navigator.languages[0]) || navigator.language);
}
// remember — только для явного выбора игрока. Автоопределённый язык сохранять
// нельзя: он осел бы в localStorage и на следующем заходе перекрыл язык
// платформы, то есть автоопределение фактически работало бы один раз.
function setLang(l, remember) {
    LANG = (l === 'en') ? 'en' : 'ru';
    try { document.documentElement.lang = LANG; } catch (e) {}
    if (remember) { try { localStorage.setItem('tsprout_lang', LANG); } catch (e) {} }
}

// Статический текст в index.html помечен data-t — переводим одним проходом.
function applyStaticT() {
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        const txt = T(key);
        // элементы с иконкой внутри: заменяем только текстовый хвост
        const icon = el.querySelector(':scope > .fico, :scope > .ci');
        if (icon) { el.innerHTML = icon.outerHTML + txt; }
        else el.textContent = txt;
    });
}
