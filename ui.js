'use strict';
// ============================================================
// ui.js — DOM-интерфейс: HUD, панели, туториал, модалки
// ============================================================

const EMOJI = {
    wheat:'🌾', carrot:'🥕', potato:'🥔', cabbage:'🥬', tomato:'🍅', cuke:'🥒',
    corn:'🌽', berry:'🍓', pumpkin:'🎃', melon:'🍉', grape:'🍇', pine:'🍍',
    egg:'🥚', milk:'🥛', wool:'🧶',
    hen:'🐔', cow:'🐄', sheep:'🐑',
    harv:'🧺', sow:'👨‍🌾', tract:'🚜',
    fert:'💩', comp:'🌱', wh:'🏚️', gold:'✨',
};
const $ = id => document.getElementById(id);
let uiTouch = 0;
let shopTab = 'seeds', orderTab = 'orders', albumTab = 'coll';

function uiBlocked() {
    return performance.now() - uiTouch < 350 ||
        document.querySelector('.sheet.open, .modal.open') !== null;
}

// ---------- Инициализация ----------
function initUI() {
    document.body.classList.add('ready');
    // любой тап по DOM-интерфейсу блокирует поле
    for (const el of document.querySelectorAll('.ui'))
        el.addEventListener('pointerdown', () => uiTouch = performance.now());

    $('barnFab').onclick   = () => { openSheet('barnSheet'); renderBarn(); if (S.tut===2) renderTut(); };
    $('orderFab').onclick  = () => { openSheet('orderSheet'); renderOrders(); };
    $('shopFab').onclick   = () => { openSheet('shopSheet'); renderShop(); };
    $('albumFab').onclick  = () => { openSheet('albumSheet'); renderAlbum(); };
    $('prestigeFab').onclick = showPrestige;
    $('cropBtn').onclick   = () => { shopTab = 'seeds'; openSheet('shopSheet'); renderShop(); };
    $('boostBtn').onclick  = adBoost;
    $('growBtn').onclick   = adGrowAll;
    $('muteBtn').onclick   = () => { toggleMute(); renderHud(); };
    $('overlay').onclick   = closeAllSheets;
    for (const b of document.querySelectorAll('.close'))
        b.onclick = closeAllSheets;
    for (const b of document.querySelectorAll('#shopSheet .tab'))
        b.onclick = () => { shopTab = b.dataset.tab; sfx('click'); renderShop(); };
    for (const b of document.querySelectorAll('#orderSheet .tab'))
        b.onclick = () => { orderTab = b.dataset.tab; sfx('click'); renderOrders(); };
    for (const b of document.querySelectorAll('#albumSheet .tab'))
        b.onclick = () => { albumTab = b.dataset.tab; sfx('click'); renderAlbum(); };
    $('sellAllBtn').onclick = sellAll;
    $('prestigeGo').onclick = () => { doPrestige(); closeModal('prestigeModal'); };
    for (const b of document.querySelectorAll('.modal .close2'))
        b.onclick = () => closeModal(b.closest('.modal').id);

    setInterval(uiTick, 500);
}
function uiTick() {
    if (!booted) return;
    renderHud();
    if ($('barnSheet').classList.contains('open')) renderBarn();
    if ($('orderSheet').classList.contains('open')) renderOrders();
    if ($('shopSheet').classList.contains('open')) renderShop();
    if (S.tut < 3) posTut();
}

// ---------- Панели ----------
function openSheet(id) {
    closeAllSheets();
    $(id).classList.add('open');
    $('overlay').classList.add('open');
    sfx('click');
}
function closeAllSheets() {
    for (const s of document.querySelectorAll('.sheet.open')) s.classList.remove('open');
    $('overlay').classList.remove('open');
}
function closeModal(id) { $(id).classList.remove('open'); }
function openModal(id) { $(id).classList.add('open'); }

// ---------- HUD ----------
function renderHud() {
    $('coinChip').textContent = fmt(S.coins) + ' 🪙';
    $('seedChip').textContent = fmt(S.seeds) + ' ✨';
    $('ipsChip').textContent  = (S.ips >= .5 ? fmt(S.ips) : '0') + '/с';
    $('seedChip').style.display = (S.seeds > 0 || pendingSeeds() > 0 || S.cnt.prestiges > 0) ? '' : 'none';

    const c = CROPS[S.lastCrop];
    $('cropBtn').innerHTML = 'Сажаем: ' + EMOJI[c.id] + ' <b>' + c.name + '</b> ▾';

    // буст
    if (boostOn()) {
        $('boostBtn').classList.add('on');
        $('boostBtn').textContent = '🚀 x2 · ' + Math.ceil((S.boostUntil-Date.now())/1000) + 'с';
    } else {
        $('boostBtn').classList.remove('on');
        $('boostBtn').textContent = '📺 Доход x2';
    }
    // дорастить
    const cd = Math.ceil((S.adGrowAt - Date.now())/1000);
    $('growBtn').disabled = cd > 0;
    $('growBtn').textContent = cd > 0 ? '🌱 ' + cd + 'с' : '📺 Дорастить всё';

    $('muteBtn').textContent = S.mute ? '🔇' : '🔊';

    // бейджи
    const tot = storeTotal();
    $('barnBadge').textContent = tot;
    $('barnBadge').style.display = tot ? '' : 'none';
    const ordReady = S.orders.filter(o => (S.store[CROPS[o.crop].id]||0) >= o.qty).length
        + S.quests.filter(q => !q.claimed && qProg(q) >= q.n).length;
    $('orderBadge').textContent = ordReady;
    $('orderBadge').style.display = ordReady ? '' : 'none';
    const ps = pendingSeeds();
    $('prestigeFab').style.display = (ps > 0 || S.cnt.prestiges > 0) ? '' : 'none';
    $('prestigeBadge').textContent = '+' + ps;
    $('prestigeBadge').style.display = ps > 0 ? '' : 'none';
}

// ---------- Магазин ----------
function renderShop() {
    for (const b of document.querySelectorAll('#shopSheet .tab'))
        b.classList.toggle('on', b.dataset.tab === shopTab);
    const box = $('shopList');
    let h = '';
    if (shopTab === 'seeds') {
        CROPS.forEach((c, i) => {
            const un = S.crops[i];
            const zoneOk = c.zone < S.zones;
            const sel = i === S.lastCrop;
            h += `<div class="row ${sel?'sel':''}">
                <div class="ic">${EMOJI[c.id]}</div>
                <div class="info"><b>${c.name}</b>
                <small>${fmtTime(cropGrow(c))} · семя ${fmt(c.seed)} · продажа ${fmt(Math.round(c.sell*sellMult()))} 🪙</small></div>
                ${un
                    ? (sel ? '<span class="tag">выбрано</span>' : `<button class="btn" onclick="buyCrop(${i})">сажать</button>`)
                    : (zoneOk
                        ? `<button class="btn ${S.coins>=c.unlock?'':'no'}" onclick="buyCrop(${i})">🔓 ${fmt(c.unlock)}</button>`
                        : `<span class="tag lock">🔒 ${ZONES[c.zone].name}</span>`)}
            </div>`;
        });
    } else if (shopTab === 'ups') {
        for (const u of UPS) {
            const lvl = S.up[u.id];
            const cost = upCost(u, lvl);
            h += `<div class="row">
                <div class="ic">${EMOJI[u.id]}</div>
                <div class="info"><b>${u.name} <em>ур.${lvl}</em></b><small>${u.desc}</small></div>
                <button class="btn ${S.coins>=cost?'':'no'}" onclick="buyUp('${u.id}')">${fmt(cost)} 🪙</button>
            </div>`;
        }
    } else if (shopTab === 'work') {
        for (const w of WORKERS) {
            const lvl = S.workers[w.id];
            const maxed = lvl >= w.max;
            const cost = workerCost(w, lvl);
            h += `<div class="row">
                <div class="ic">${EMOJI[w.id]}</div>
                <div class="info"><b>${w.name} <em>${lvl ? 'ур.'+lvl : ''}</em></b><small>${w.desc}</small></div>
                ${maxed ? '<span class="tag">макс</span>'
                        : `<button class="btn ${S.coins>=cost?'':'no'}" onclick="buyWorker('${w.id}')">${fmt(cost)} 🪙</button>`}
            </div>`;
        }
    } else {
        for (const a of ANIMALS) {
            const n = S.animals[a.id];
            const maxed = n >= a.max;
            const cost = animalCost(a, n);
            const pr = APRODS[a.prod];
            h += `<div class="row">
                <div class="ic">${EMOJI[a.id]}</div>
                <div class="info"><b>${a.name} <em>x${n}</em></b>
                <small>${EMOJI[pr.id]} ${pr.name} каждые ${fmtTime(a.every)} · цена ${fmt(Math.round(pr.sell*sellMult()))} 🪙</small></div>
                ${maxed ? '<span class="tag">макс</span>'
                        : `<button class="btn ${S.coins>=cost?'':'no'}" onclick="buyAnimal('${a.id}')">${fmt(cost)} 🪙</button>`}
            </div>`;
        }
    }
    box.innerHTML = h;
}

// ---------- Склад ----------
function renderBarn() {
    const tot = storeTotal(), cap = whCap();
    $('barnCap').innerHTML = `Склад: <b>${tot} / ${cap}</b>`;
    $('barnBar').style.width = Math.min(100, tot/cap*100) + '%';
    const box = $('barnList');
    const ids = Object.keys(S.store);
    if (!ids.length) { box.innerHTML = '<div class="empty">Пусто. Собери урожай с грядок!</div>'; return; }
    let h = '';
    for (const id of ids) {
        const c = CROPS.find(x=>x.id===id) || APRODS.find(x=>x.id===id);
        h += `<div class="row">
            <div class="ic">${EMOJI[id]}</div>
            <div class="info"><b>${c.name} x${S.store[id]}</b><small>${fmt(priceOf(id))} 🪙 за штуку</small></div>
            <button class="btn" onclick="sellStore('${id}',1)">1</button>
            <button class="btn" onclick="sellStore('${id}')">все · ${fmt(priceOf(id)*S.store[id])} 🪙</button>
        </div>`;
    }
    box.innerHTML = h;
}

// ---------- Заказы и квесты ----------
function renderOrders() {
    for (const b of document.querySelectorAll('#orderSheet .tab'))
        b.classList.toggle('on', b.dataset.tab === orderTab);
    const box = $('orderList');
    let h = '';
    if (orderTab === 'orders') {
        S.orders.forEach((o, k) => {
            const c = CROPS[o.crop];
            const have = S.store[c.id]||0;
            const ok = have >= o.qty;
            h += `<div class="row">
                <div class="ic">${EMOJI[c.id]}</div>
                <div class="info"><b>${c.name} x${o.qty}</b>
                <small>есть ${have}/${o.qty} · награда ${fmt(o.reward)} 🪙${o.seed ? ' +✨' : ''}</small></div>
                <button class="btn ${ok?'':'no'}" onclick="fulfillOrder(${k})">сдать</button>
                <button class="btn ghost" onclick="skipOrder(${k})">↻</button>
            </div>`;
        });
    } else {
        S.quests.forEach((q, k) => {
            const p = qProg(q);
            const done = p >= q.n;
            h += `<div class="row">
                <div class="ic">${q.claimed ? '✅' : done ? '🎁' : '📋'}</div>
                <div class="info"><b>${q.name}</b>
                <small>${Math.min(p,q.n)}/${q.n} · ${fmt(q.reward)} 🪙</small>
                <div class="qbar"><i style="width:${Math.min(100,p/q.n*100)}%"></i></div></div>
                ${q.claimed ? '<span class="tag">✓</span>'
                            : `<button class="btn ${done?'':'no'}" onclick="claimQuest(${k})">забрать</button>`}
            </div>`;
        });
        const allDone = S.quests.every(q=>q.claimed);
        h += `<div class="row chest">
            <div class="ic">${S.chestClaimed ? '✅' : '🧰'}</div>
            <div class="info"><b>Сундук дня</b><small>Выполни все 3 квеста · монеты + ✨семя</small></div>
            ${S.chestClaimed ? '<span class="tag">✓</span>'
                             : `<button class="btn ${allDone?'':'no'}" onclick="claimChest()">открыть</button>`}
        </div>`;
    }
    box.innerHTML = h;
}

// ---------- Альбом ----------
function renderAlbum() {
    for (const b of document.querySelectorAll('#albumSheet .tab'))
        b.classList.toggle('on', b.dataset.tab === albumTab);
    const box = $('albumList');
    let h = '';
    if (albumTab === 'coll') {
        h += '<div class="grid">';
        CROPS.forEach((c, i) => {
            h += S.disc[i]
                ? `<div class="cell"><div class="big">${EMOJI[c.id]}</div><small>${c.name}</small></div>`
                : `<div class="cell dark"><div class="big">?</div><small>???</small></div>`;
        });
        h += '</div><div class="hint">Открыто культур: ' + S.disc.filter(x=>x).length + ' / ' + CROPS.length + '</div>';
    } else {
        for (const a of ACHS) {
            const got = !!S.ach[a.id];
            const p = Math.min(S.cnt[a.cnt], a.n);
            h += `<div class="row ${got?'':'dim'}">
                <div class="ic">${got?'🏆':'🔒'}</div>
                <div class="info"><b>${a.name}</b><small>${a.desc} · ${got?'получено':p+'/'+a.n} · +${a.seed} ✨</small></div>
            </div>`;
        }
    }
    box.innerHTML = h;
}
function albumFlash() { /* хук на будущее — вспышка в альбоме */ }

// ---------- Престиж ----------
function showPrestige() {
    const p = pendingSeeds();
    $('prestigeInfo').innerHTML = `
        <p>Начни <b>новый сезон</b>: ферма, монеты и улучшения сбросятся,<br>
        а ты получишь <b class="gold">+${p} ✨ золотых семян</b>.</p>
        <p>Каждое семя даёт <b>+10% к доходу навсегда</b>.<br>
        Сейчас у тебя ${S.seeds} ✨ (бонус +${S.seeds*10}%).</p>
        <p><small>Заработано за сезон: ${fmt(S.seasonEarned)} 🪙.<br>
        Следующее семя: ${fmt(SEED_BASE*Math.pow(seedsFromEarned(S.seasonEarned)+1,2))} 🪙 за сезон.</small></p>`;
    $('prestigeGo').disabled = p <= 0;
    $('prestigeGo').textContent = p > 0 ? '🌟 Новый сезон (+' + p + ' ✨)' : 'Пока рано…';
    openModal('prestigeModal');
    sfx('click');
}

// ---------- Офлайн-модалка ----------
function showOfflineModal(pay, t) {
    $('offlineInfo').innerHTML = `Пока тебя не было (${fmtTime(t)}),<br>ферма заработала <b>${fmt(pay)} 🪙</b>!`;
    $('offlineTake').onclick = () => { takeOffline(1); closeModal('offlineModal'); };
    $('offlineX2').onclick = () => showRewarded(() => { takeOffline(2); closeModal('offlineModal'); });
    openModal('offlineModal');
}

// ---------- Туториал ----------
const TUT_TEXT = [
    'Тапни по грядке,<br>чтобы посадить 🌾',
    'Подожди чуть-чуть…<br>и собери урожай!',
    'Открой склад 📦<br>и продай урожай',
    '',
];
function renderTut() {
    const el = $('tut');
    if (S.tut >= 3) { el.style.display = 'none'; return; }
    el.style.display = '';
    $('tutText').innerHTML = TUT_TEXT[S.tut];
    posTut();
}
function posTut() {
    const el = $('tut');
    if (S.tut >= 3 || el.style.display === 'none') return;
    let x, y;
    if (S.tut <= 1) {
        const p = worldToScreen(plotPos(0).add(vec2(0, 1.1)));
        x = p.x; y = p.y;
        el.classList.remove('side');
    } else {
        const r = $('barnFab').getBoundingClientRect();
        x = r.left - 10; y = r.top + r.height/2;
        el.classList.add('side');
    }
    el.style.left = Math.max(95, Math.min(innerWidth-95, x)) + 'px';
    el.style.top  = Math.max(30, y) + 'px';
}

// ---------- Тост ----------
let toastT = null;
function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), 2200);
}
