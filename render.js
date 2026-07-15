'use strict';
// ============================================================
// render.js — изометрический мир (процедурный), тёплая пастель.
// Контент лежит на ромбической сетке (isoWorld из game.js),
// глубина = gx+gy (дальше рисуем раньше). Камера пан/зум.
// ============================================================

const _hexCache = {};
function C(hex) { return _hexCache[hex] || (_hexCache[hex] = new Color().setHex(hex)); }
const _shadeCache = {};
function D(hex, k) {
    const key = hex + '|' + k;
    return _shadeCache[key] || (_shadeCache[key] = new Color().setHex(hex).scale(k, 1));
}
const SHADOW = new Color(.28, .24, .14, .22);
const INKT = '#5b4a3a';

// ромб-полигон (верхняя грань плитки), центр в pos
function isoTile(pos, hw, hh, col) {
    drawPoly([vec2(0, hh), vec2(hw, 0), vec2(0, -hh), vec2(-hw, 0)], col, 0, undefined, pos);
}
function quad(pos, a, b, c, d, col) { drawPoly([a, b, c, d], col, 0, undefined, pos); }
function L2(a, b, t) { return vec2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); }

// ---------- Занятость клеток + декор (строго по сетке) ----------
let decor = null, OCC = null;
const cellKey = (gx, gy) => gx + ',' + gy;
function buildOcc() {
    OCC = new Set();
    for (let i = 0; i < MAXPLOTS; i++) { const g = plotGrid(i); OCC.add(cellKey(g.gx, g.gy)); }
    for (const [gx, gy] of PATH_CELLS) OCC.add(cellKey(gx, gy));
    for (const b of [BARN_G, HOUSE_G, POND_G])                  // здания занимают 3×3
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) OCC.add(cellKey(b.gx + dx, b.gy + dy));
    for (let gx = 0; gx <= 3; gx++) for (let gy = 9; gy <= 10; gy++) OCC.add(cellKey(gx, gy)); // загон
}
const cellFree = (gx, gy) => !OCC.has(cellKey(gx, gy));
function initWorldDecor() {
    buildOcc();
    const R = (a, b) => a + Math.random() * (b - a);
    const cells = [];
    for (let gx = -5; gx <= 8; gx++) for (let gy = -4; gy <= 8; gy++) if (cellFree(gx, gy)) cells.push([gx, gy]);
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    let idx = 0;
    const mk = (n, f) => { const o = []; for (let k = 0; k < n && idx < cells.length; k++) o.push(f(cells[idx++])); return o; };
    decor = {
        clouds: Array.from({ length: 5 }, () => ({ x: R(-16, 16), y: R(3, 8), s: R(.9, 1.7), v: R(.05, .14) })),
        flowers: mk(14, c => ({ gx: c[0], gy: c[1], s: R(.1, .15), h: ['#eda3b4', '#f2d98a', '#f7f2e4', '#c3a8dd'][Math.floor(R(0, 4))] })),
        grass:   mk(20, c => ({ gx: c[0], gy: c[1], s: R(.16, .26) })),
        stones:  mk(6,  c => ({ gx: c[0], gy: c[1], s: R(.12, .22) })),
        trees: [],
        btf: Array.from({ length: 4 }, () => ({ x: R(-8, 2), y: R(-5, 0), p: R(0, 9) })),
    };
    for (let gx = -3; gx <= 6; gx++) if (cellFree(gx, -3)) decor.trees.push({ gx, gy: -3, s: R(.85, 1.15) }); // ряд деревьев сзади
}

// ---------- Эффекты ----------
const floats = [];
const pops = [];
let tractorT = -99, tractorRow = 0;
let prestigeT = 0;

function addFloat(p, txt, col) { floats.push({ p: p.copy(), txt, col, t: 1.2 }); }
function fxHarvest(i, ci, golden) {
    const p = plotPos(i), c = CROPS[ci];
    addFloat(p.add(vec2(0, .8)), golden ? '+5!' : '+1', golden ? '#e9b949' : '#fff');
    for (let k = 0; k < (golden ? 10 : 5); k++)
        pops.push({ p: p.add(vec2(0, .3)), v: vec2((Math.random() - .5) * 3, Math.random() * 3 + 1),
                    col: golden ? '#efd07a' : c.hue, t: .7, r: .09 + Math.random() * .08 });
}
function fxTap(i) {
    const p = plotPos(i);
    pops.push({ p: p.add(vec2((Math.random() - .5) * .8, .4)), v: vec2(0, 1.6), col: '#c3dd9a', t: .5, r: .08 });
}
function fxTractor() { tractorT = 0; tractorRow = Math.floor(Math.random() * Math.max(1, S.plots.length) / 4) | 0; }
function fxPrestige() {
    prestigeT = 2;
    for (let k = 0; k < 60; k++)
        pops.push({ p: vec2(FIELD_CX + (Math.random() - .5) * 12, FIELD_CY + Math.random() * 8), v: vec2((Math.random() - .5) * 4, Math.random() * 4),
                    col: ['#efd07a', '#eda3b4', '#a8cc80', '#c3a8dd'][k % 4], t: 1.5 + Math.random(), r: .1 + Math.random() * .1 });
}

// ---------- Мир ----------
function renderWorld() {
    const tl = screenToWorld(vec2(0, 0)), br = screenToWorld(mainCanvasSize);
    const L = tl.x, Rt = br.x, T = tl.y, B = br.y;              // T>B (y вверх)
    const midX = (L + Rt) / 2, midY = (T + B) / 2, w = Rt - L + 2, h = T - B + 2;

    // луг-подложка
    drawRect(vec2(midX, midY), vec2(w, h), C('#9cc06a'));
    drawGroundTiles(L, Rt, T, B);
    drawPathCells();

    // облака (фон, без сортировки)
    for (const c of decor.clouds) {
        c.x += c.v * timeDelta; if (c.x > Rt + 4) c.x = L - 4;
        const p = vec2(c.x, c.y);
        drawEllipse(p, vec2(1.6 * c.s, .55 * c.s), C('#ffffff'));
        drawEllipse(p.add(vec2(.8 * c.s, .18 * c.s)), vec2(1 * c.s, .45 * c.s), C('#ffffff'));
        drawEllipse(p.add(vec2(-.7 * c.s, .14 * c.s)), vec2(.9 * c.s, .4 * c.s), C('#fbfbf4'));
    }

    // ---- сборка списка с сортировкой по глубине ----
    const items = [];
    const push = (gx, gy, fn, bias = 0) => items.push({ d: gx + gy + bias, fn });

    // зоны-участки (рисуем как фон каждой зоны — низкий приоритет)
    for (let z = 0; z < ZONES.length; z++) {
        if (z <= S.zones) { const zz = z; push(0, zoneCenterGrid(zz).gy, () => drawZoneRegion(zz), -6); }
    }
    // деревья (задний план)
    for (const t of decor.trees) push(t.gx, t.gy, () => drawTree(isoWorld(t.gx, t.gy), t.s));
    // постройки
    push(HOUSE_G.gx, HOUSE_G.gy, () => drawHouseIso(isoWorld(HOUSE_G.gx, HOUSE_G.gy), false));
    push(BARN_G.gx, BARN_G.gy, () => drawHouseIso(isoWorld(BARN_G.gx, BARN_G.gy), true));
    push(POND_G.gx, POND_G.gy, () => drawPondIso(isoWorld(POND_G.gx, POND_G.gy)));
    // декор на земле
    for (const g of decor.grass) push(g.gx, g.gy, () => drawGrassTuft(isoWorld(g.gx, g.gy), g.s));
    for (const s of decor.stones) push(s.gx, s.gy, () => drawStone(isoWorld(s.gx, s.gy), s.s));
    for (const f of decor.flowers) push(f.gx, f.gy, () => drawFlower(isoWorld(f.gx, f.gy), f.s, f.h));
    // грядки
    for (let i = 0; i < S.plots.length; i++) { const g = plotGrid(i); push(g.gx, g.gy, () => { drawBedIso(plotPos(i)); if (S.plots[i].c >= 0) drawCrop(plotPos(i), S.plots[i]); }); }
    // призрачная грядка «+»
    const owned = S.plots.length, maxNow = ZONES.slice(0, S.zones).reduce((s, z) => s + z.plots, 0);
    if (owned < maxNow) { const g = plotGrid(owned); push(g.gx, g.gy, () => drawGhostPlot(owned)); }
    // табличка следующей зоны
    if (S.zones < ZONES.length) { const g = zoneCenterGrid(S.zones); push(g.gx, g.gy, () => drawZoneSign(S.zones), .5); }
    // животные и работники
    pushAnimals(push);
    pushWorkers(push);

    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.fn();

    drawTractor();
    drawParticles();
}

let _GT = null;                                 // переиспользуемые вершины ромба (без аллокаций в цикле)
function drawGroundTiles(L, Rt, T, B) {
    if (!_GT) _GT = [vec2(0, IH), vec2(IW, 0), vec2(0, -IH), vec2(-IW, 0)];
    const cA = C('#98bd66'), cB = C('#a1c66e');
    // границы grid из углов вида, но не шире области фермы
    const toG = (X, Y) => ({ gx: (X / IW - Y / IH) / 2, gy: (-Y / IH - X / IW) / 2 });
    const cs = [toG(L, T), toG(Rt, T), toG(L, B), toG(Rt, B)];
    let gxmin = 1e9, gxmax = -1e9, gymin = 1e9, gymax = -1e9;
    for (const c of cs) { gxmin = Math.min(gxmin, c.gx); gxmax = Math.max(gxmax, c.gx); gymin = Math.min(gymin, c.gy); gymax = Math.max(gymax, c.gy); }
    gxmin = Math.max(-10, Math.floor(gxmin) - 1); gxmax = Math.min(10, Math.ceil(gxmax) + 1);
    gymin = Math.max(-8, Math.floor(gymin) - 1);  gymax = Math.min(14, Math.ceil(gymax) + 1);
    for (let gx = gxmin; gx <= gxmax; gx++)
        for (let gy = gymin; gy <= gymax; gy++)
            drawPoly(_GT, (gx + gy) & 1 ? cA : cB, 0, undefined, isoWorld(gx, gy));
}

// ---------- Зоны, тропинки ----------
function drawZoneRegion(z) {
    const g = zoneCenterGrid(z);
    const unlocked = z < S.zones;
    // участок 4×2 плитки, чуть иной оттенок / блеклый для закрытой
    for (let cx = -2; cx <= 1; cx++) for (let ry = -1; ry <= 0; ry++) {
        const p = isoWorld(g.gx + cx + .5, g.gy + ry + .5);
        isoTile(p, IW, IH, unlocked ? (z === 2 ? C('#b3d089') : C('#a9c97e')) : new Color(.55, .62, .42, .5));
    }
}
function drawPathCells() {
    // грунтовые тропинки-разделители между зонами, строго по клеткам
    for (const [gx, gy] of PATH_CELLS) {
        const p = isoWorld(gx, gy);
        isoTile(p, IW * .98, IH * .98, C('#c9b083'));
        isoTile(p, IW * .84, IH * .84, C('#d3bd93'));
    }
}

// ---------- Постройки (изо-объём) ----------
function drawHouseIso(pos, isBarn) {
    const hw = IW * 1.25, hh = IH * 1.25, Hh = isBarn ? 2.2 : 1.9, roofH = isBarn ? 1.3 : 1.55;
    const wall = isBarn ? '#cf6a4c' : '#f0dcb0', wallSide = isBarn ? '#b6573c' : '#dcc493';
    // тень
    drawEllipse(pos.add(vec2(0, -hh * .6)), vec2(hw * 1.3, hh * .8), SHADOW);
    // угловые точки основания
    const Lp = vec2(-hw, 0), Bt = vec2(0, -hh), Rp = vec2(hw, 0);
    // стены (2 передние грани)
    quad(pos, Lp, Bt, Bt.add(vec2(0, Hh)), Lp.add(vec2(0, Hh)), C(wallSide));
    quad(pos, Bt, Rp, Rp.add(vec2(0, Hh)), Bt.add(vec2(0, Hh)), C(wall));
    // швы досок
    for (let k = 1; k < 4; k++) {
        const a = L2(Lp, Bt, k / 4), b = L2(Bt, Rp, k / 4);
        drawLine(pos.add(a), pos.add(a.add(vec2(0, Hh))), .03, new Color(0, 0, 0, .08));
        drawLine(pos.add(b), pos.add(b.add(vec2(0, Hh))), .03, new Color(0, 0, 0, .08));
    }
    // дверь/окно на правой грани (между Bt' и Rp')
    const bt2 = Bt.add(vec2(0, Hh)), rp2 = Rp.add(vec2(0, Hh));
    if (isBarn) {
        const d0 = L2(Bt, Rp, .28), d1 = L2(Bt, Rp, .74);
        quad(pos, d0, d1, L2(bt2, rp2, .74).add(vec2(0, -Hh * .18)), L2(bt2, rp2, .28).add(vec2(0, -Hh * .18)), C('#7e3826'));
        drawLine(pos.add(d0), pos.add(L2(bt2, rp2, .74).add(vec2(0, -Hh * .18))), .05, C('#f0dcb0'));
        drawLine(pos.add(d1), pos.add(L2(bt2, rp2, .28).add(vec2(0, -Hh * .18))), .05, C('#f0dcb0'));
    } else {
        const d0 = L2(Bt, Rp, .2), d1 = L2(Bt, Rp, .42);
        quad(pos, d0, d1, d1.add(vec2(0, Hh * .62)), d0.add(vec2(0, Hh * .62)), C('#9c7139'));
        drawCircle(pos.add(d1.add(vec2(-.06, Hh * .32))), .05, C('#ffd95e'));
        const w0 = L2(Bt, Rp, .58), w1 = L2(Bt, Rp, .8);
        quad(pos, w0.add(vec2(0, Hh * .34)), w1.add(vec2(0, Hh * .34)), w1.add(vec2(0, Hh * .66)), w0.add(vec2(0, Hh * .66)), C('#bfe4ec'));
        drawLine(pos.add(L2(w0, w1, .5).add(vec2(0, Hh * .34))), pos.add(L2(w0, w1, .5).add(vec2(0, Hh * .66))), .03, C('#f0dcb0'));
    }
    // крыша: 2 передних ската + свес
    const apex = vec2(0, Hh + roofH);
    const Lp2 = Lp.add(vec2(0, Hh)), eaveL = Lp2.add(vec2(-hw * .12, hh * .06)), eaveBt = bt2.add(vec2(0, -hh * .12));
    drawPoly([eaveL, eaveBt, apex], C(isBarn ? '#a84e34' : '#c05f3d'), 0, undefined, pos);
    drawPoly([eaveBt, rp2.add(vec2(hw * .12, hh * .06)), apex], C(isBarn ? '#cf6a4c' : '#e07a53'), 0, undefined, pos);
    drawLine(pos.add(eaveBt), pos.add(apex), .04, new Color(1, 1, 1, .35));
    // труба + дым (дом)
    if (!isBarn) {
        const ch = vec2(-hw * .4, Hh + roofH * .5);
        drawRect(pos.add(ch), vec2(.22, .5), C('#a85f42'));
        for (let k = 0; k < 3; k++) { const t = (time * .5 + k * .33) % 1;
            drawCircle(pos.add(ch.add(vec2(Math.sin(t * 6) * .2, .3 + t * 1.4))), (.08 + t * .18), new Color(1, 1, 1, .4 * (1 - t))); }
    }
}

function drawPondIso(pos) {
    const hw = IW * 1.6, hh = IH * 1.6;
    isoTile(pos, hw * 1.12, hh * 1.12, C('#c9b071'));
    isoTile(pos, hw, hh, C('#54bcd0'));
    isoTile(pos, hw * .62, hh * .62, C('#7fd6e6'));
    for (let i = 0; i < 4; i++) { const ph = time * 1.4 + i * 1.3;
        drawEllipse(pos.add(vec2(Math.sin(ph) * hw * .4, Math.cos(ph * .7) * hh * .4)), vec2(.18, .07), new Color(1, 1, 1, .4)); }
    for (const [ox, oy] of [[-.4, .1], [.35, -.15]])
        drawEllipse(pos.add(vec2(ox * hw, oy * hh)), vec2(.24, .12), C('#5aa03e'));
}

function drawTree(p, s) {
    drawEllipse(p.add(vec2(.1 * s, -.28 * s)), vec2(.5 * s, .18 * s), SHADOW);
    drawRect(p.add(vec2(0, .3 * s)), vec2(.16 * s, .6 * s), C('#9a7a58'));
    drawCircle(p.add(vec2(0, .95 * s)), .95 * s, C('#6f9c5c'));
    drawCircle(p.add(vec2(-.24 * s, 1.12 * s)), .58 * s, C('#7fac68'));
    drawCircle(p.add(vec2(.26 * s, .86 * s)), .54 * s, C('#679455'));
    drawCircle(p.add(vec2(-.12 * s, 1.28 * s)), .32 * s, C('#8fbc76'));
}
function drawGrassTuft(p, s) {
    const sway = Math.sin(time * 1.4 + p.x * 2) * .04;
    drawLine(p, p.add(vec2(-.06 + sway, s)), .045, C('#8aad5c'));
    drawLine(p, p.add(vec2(.07 + sway, s * .82)), .045, C('#96b869'));
    drawLine(p, p.add(vec2(sway, s * 1.05)), .04, C('#7fa451'));
}
function drawStone(p, s) {
    drawEllipse(p.add(vec2(0, -.02)), vec2(s * 1.2, s * .7), SHADOW);
    drawEllipse(p, vec2(s * 1.15, s * .72), C('#a8a795'));
    drawEllipse(p.add(vec2(-.03, s * .16)), vec2(s * .8, s * .48), C('#bcbaa8'));
}
function drawFlower(p, s, h) {
    drawLine(p, p.add(vec2(0, .18)), .04, C('#8aab68'));
    const c = p.add(vec2(0, .24));
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + p.x;
        drawCircle(c.add(vec2(Math.cos(a), Math.sin(a)).scale(s * .9)), s * 1.15, C(h)); }
    drawCircle(c, s * .9, C('#f2d98a'));
}

// ---------- Грядки ----------
function drawBedIso(pos) {
    // короб чуть меньше клетки — по краям видна трава (грядки строго на квадратах)
    const hw = IW * .88, hh = IH * .88, dep = .4;
    drawEllipse(pos.add(vec2(0, -hh * .55)), vec2(hw * 1.05, hh * .55), SHADOW);
    const Lp = vec2(-hw, 0), Bt = vec2(0, -hh), Rp = vec2(hw, 0);
    // боковые доски короба
    quad(pos, Lp, Bt, Bt.add(vec2(0, -dep)), Lp.add(vec2(0, -dep)), C('#9c7139'));
    quad(pos, Bt, Rp, Rp.add(vec2(0, -dep)), Bt.add(vec2(0, -dep)), C('#c99a5f'));
    // верхняя рамка
    isoTile(pos, hw, hh, C('#dbb884'));
    // земля
    const iw = hw * .76, ih = hh * .76;
    isoTile(pos, iw, ih, C('#7a5334'));
    // борозды (вдоль оси +gx)
    const ed = vec2(hw, -hh).scale(.5), pv = vec2(hw, hh);
    for (let k = -1; k <= 1; k++) {
        const off = pv.scale(k * .22);
        drawLine(pos.add(off.subtract(ed.scale(.6))), pos.add(off.add(ed.scale(.6))), .05, C('#5f3f26'));
    }
}
function drawGhostPlot(idx) {
    const pos = plotPos(idx), cost = plotCost(idx - 1), can = S.coins >= cost;
    isoTile(pos, IW, IH, new Color(.95, .9, .78, .18));
    isoTile(pos, IW * .82, IH * .82, new Color(.45, .36, .25, .16));
    drawText('+', pos.add(vec2(0, .16)), .8, new Color(.32, .25, .18, .7));
    drawCoin(pos.add(vec2(-.3 - fmt(cost).length * .1, -.5)), .26);
    drawText(fmt(cost), pos.add(vec2(.16, -.46)), .38, can ? C('#4e7e3e') : C('#b0604a'));
}
function drawCrop(pos, p) {
    const c = CROPS[p.c], gt = cropGrow(c), k = Math.min(1, p.t / gt), ready = k >= 1;
    const bob = ready ? Math.sin(time * 3 + pos.x) * .05 : 0;
    const o = pos.add(vec2(0, IH * .1 + bob));
    if (k < .3) {
        const s = .3 + k;
        drawLine(o, o.add(vec2(0, .32 * s)), .05, C('#6da057'));
        drawEllipse(o.add(vec2(-.1, .32 * s)), vec2(.13 * s, .08 * s), C('#8fbf68'));
        drawEllipse(o.add(vec2(.1, .32 * s)), vec2(.13 * s, .08 * s), C('#9cc973'));
    } else drawCropArt(o, p.c, .45 + .55 * k);
    if (p.g && k > .3) {
        const tw = .5 + Math.sin(time * 5 + pos.x * 2) * .5;
        drawStar(o.add(vec2(.66, .7)), .1 + .05 * tw);
        drawStar(o.add(vec2(-.7, .46)), .08 + .04 * (1 - tw));
    }
    if (!ready) {
        const by = pos.add(vec2(0, -IH - .18));
        drawRect(by, vec2(1.4, .16), new Color(1, 1, 1, .4));
        drawRect(by, vec2(1.32, .1), new Color(.4, .34, .24, .25));
        drawRect(by.add(vec2(-(1.32 - 1.32 * k) / 2, 0)), vec2(1.32 * k, .1), C('#8fc167'));
    } else {
        const t = 1 + Math.sin(time * 4) * .08, bp = pos.add(vec2(.85, .78));
        drawCircle(bp, .4 * t, C('#fffdf4'));
        drawText('!', bp.add(vec2(0, .02)), .38 * t, C('#e0a83e'));
    }
}
function drawStar(p, r) {
    for (let k = 0; k < 4; k++)
        drawPoly([vec2(-r * .35, 0), vec2(r * .35, 0), vec2(0, r * 1.9)], C('#f2d98a'), 0, undefined, p, k * Math.PI / 2 + Math.PI / 4);
    drawCircle(p, r * .7, C('#f7e6a0'));
}
function drawCoin(p, d) {
    drawCircle(p, d, C('#d9a93e'));
    drawCircle(p.add(vec2(-.02 * d, .04 * d)), d * .8, C('#efc75f'));
    drawCircle(p, d * .44, new Color(0, 0, 0, 0), d * .1, C('#d9a93e'));
}

// культура: мягкие формы (тёмный низ + светлый верх + блик)
function blob(o, dx, dy, rx, ry, base) {
    drawEllipse(o.add(vec2(dx, dy)), vec2(rx, ry), D(base, .82));
    drawEllipse(o.add(vec2(dx - rx * .08, dy + ry * .12)), vec2(rx * .88, ry * .85), C(base));
    drawEllipse(o.add(vec2(dx - rx * .3, dy + ry * .4)), vec2(rx * .24, ry * .16), new Color(1, 1, 1, .35));
}
function drawCropArt(o, ci, s) {
    const c = CROPS[ci], top = C(c.top), body = C(c.hue);
    switch (c.id) {
    case 'wheat':
        for (let k = -2; k <= 2; k++) { const x = k * .28, hgt = (.72 + Math.abs(k) * .06) * s;
            drawLine(o.add(vec2(x, 0)), o.add(vec2(x + .06, hgt)), .05, C('#cdb162'));
            drawEllipse(o.add(vec2(x + .06, hgt)), vec2(.11 * s, .22 * s), D(c.hue, .85));
            drawEllipse(o.add(vec2(x + .04, hgt + .03)), vec2(.09 * s, .19 * s), body); }
        break;
    case 'carrot':
        for (let k = -1; k <= 1; k++) { const b = o.add(vec2(k * .62, .16));
            drawPoly([vec2(-.16, 0), vec2(.16, 0), vec2(0, -.46 * s)], D(c.hue, .85), 0, undefined, b);
            drawPoly([vec2(-.12, -.02), vec2(.1, -.02), vec2(-.02, -.4 * s)], body, 0, undefined, b);
            drawLine(b, b.add(vec2(-.09, .4 * s + .1)), .06, top);
            drawLine(b, b.add(vec2(.1, .36 * s + .1)), .06, D(c.top, .88)); }
        break;
    case 'potato':
        drawEllipse(o.add(vec2(0, .32 * s)), vec2(.7 * s, .4 * s), C('#84a95e'));
        drawEllipse(o.add(vec2(-.1, .36 * s)), vec2(.5 * s, .32 * s), C('#94b96c'));
        blob(o, -.4, .08, .24 * s, .17 * s, c.hue); blob(o, .38, .06, .26 * s, .18 * s, c.hue);
        break;
    case 'cabbage':
        blob(o, 0, .32 * s, .5 * s, .46 * s, c.hue);
        drawEllipse(o.add(vec2(-.34 * s, .3 * s)), vec2(.2 * s, .36 * s), C(c.top));
        drawEllipse(o.add(vec2(.34 * s, .3 * s)), vec2(.2 * s, .36 * s), C(c.top));
        drawEllipse(o.add(vec2(0, .5 * s)), vec2(.26 * s, .2 * s), new Color(1, 1, 1, .25));
        break;
    case 'tomato':
        drawEllipse(o.add(vec2(0, .36 * s)), vec2(.56 * s, .5 * s), C('#84a95e'));
        blob(o, -.26, .3 * s, .19 * s, .18 * s, c.hue); blob(o, .26, .42 * s, .19 * s, .18 * s, c.hue); blob(o, 0, .16, .18 * s, .17 * s, c.hue);
        break;
    case 'cuke':
        drawEllipse(o.add(vec2(0, .32 * s)), vec2(.58 * s, .4 * s), C('#84a95e'));
        blob(o, -.3, .14, .32 * s, .13 * s, c.hue); blob(o, .32, .2, .3 * s, .12 * s, c.hue);
        break;
    case 'corn':
        drawLine(o, o.add(vec2(0, .95 * s)), .08, C('#6da057'));
        drawEllipse(o.add(vec2(-.22, .45 * s)), vec2(.32 * s, .11 * s), C(c.top));
        drawEllipse(o.add(vec2(.22, .62 * s)), vec2(.32 * s, .11 * s), D(c.top, .9));
        drawEllipse(o.add(vec2(.13, .36 * s)), vec2(.18 * s, .34 * s), D(c.hue, .85));
        drawEllipse(o.add(vec2(.11, .38 * s)), vec2(.15 * s, .3 * s), body);
        drawEllipse(o.add(vec2(.06, .46 * s)), vec2(.05 * s, .12 * s), new Color(1, 1, 1, .35));
        break;
    case 'berry':
        drawEllipse(o.add(vec2(0, .26 * s)), vec2(.62 * s, .34 * s), C('#84a95e'));
        for (const [x, y] of [[-.36, .12], [.32, .16], [0, .36 * s]]) { const b = o.add(vec2(x, y));
            drawPoly([vec2(-.13, .1), vec2(.13, .1), vec2(0, -.18)], D(c.hue, .85), 0, undefined, b);
            drawPoly([vec2(-.1, .09), vec2(.1, .09), vec2(0, -.14)], body, 0, undefined, b);
            drawCircle(b.add(vec2(-.03, .02)), .025, new Color(1, 1, 1, .5)); }
        break;
    case 'pumpkin':
        blob(o, 0, .3 * s, .58 * s, .42 * s, c.hue);
        drawEllipse(o.add(vec2(0, .3 * s)), vec2(.26 * s, .4 * s), C('#f0a45a'));
        drawEllipse(o.add(vec2(-.3 * s, .3 * s)), vec2(.14 * s, .36 * s), D(c.hue, .9));
        drawRect(o.add(vec2(0, .74 * s)), vec2(.1, .16 * s), C('#7d915c'));
        break;
    case 'melon':
        blob(o, 0, .34 * s, .5 * s, .46 * s, c.hue);
        for (let k = -1; k <= 1; k++) drawEllipse(o.add(vec2(k * .26 * s, .32 * s)), vec2(.08 * s, .42 * s), C('#2f5c3c'));
        break;
    case 'grape':
        drawRect(o.add(vec2(0, .44 * s)), vec2(.9 * s, .07), C('#b08a5e'));
        for (const [x, y] of [[0, .1], [-.16, .26], [.16, .26], [0, .42]]) {
            drawCircle(o.add(vec2(x * s, y * s)), .16 * s, D(c.hue, .82));
            drawCircle(o.add(vec2((x - .02) * s, (y + .02) * s)), .14 * s, C(c.hue)); }
        drawEllipse(o.add(vec2(.22 * s, .56 * s)), vec2(.17 * s, .1 * s), C(c.top));
        break;
    case 'pine':
        drawEllipse(o.add(vec2(0, .36 * s)), vec2(.32 * s, .44 * s), D(c.hue, .82));
        drawEllipse(o.add(vec2(-.02, .38 * s)), vec2(.28 * s, .4 * s), body);
        drawLine(o.add(vec2(-.2 * s, .22 * s)), o.add(vec2(.2 * s, .52 * s)), .035, C('#c89a2e'));
        drawLine(o.add(vec2(-.2 * s, .46 * s)), o.add(vec2(.2 * s, .24 * s)), .035, C('#c89a2e'));
        for (let k = -1; k <= 1; k++) drawPoly([vec2(-.08, 0), vec2(.08, 0), vec2(k * .13, .36 * s)], C(c.top), 0, undefined, o.add(vec2(k * .1, .74 * s)));
        break;
    }
}

// ---------- Животные (чиби) ----------
const animEnts = [];
function syncAnimals() {
    const want = [];
    for (const a of ANIMALS) for (let k = 0; k < S.animals[a.id]; k++) want.push(a.id);
    while (animEnts.length > want.length) animEnts.pop();
    while (animEnts.length < want.length) {
        const gx = .2 + Math.random() * 2.6, gy = 9 + Math.random();
        animEnts.push({ id: want[animEnts.length], gx, gy, dir: Math.random() < .5 ? 1 : -1, v: .3 + Math.random() * .3, ph: Math.random() * 9 });
    }
    for (let i = 0; i < want.length; i++) animEnts[i].id = want[i];
}
function pushAnimals(push) {
    syncAnimals();
    // загон (front-left)
    if (animEnts.length) push(0, 9.5, drawPaddockFence, -.2);
    for (const a of animEnts) {
        a.gx += a.dir * a.v * timeDelta * .5;
        if (a.gx > 3.2) a.dir = -1; if (a.gx < -.2) a.dir = 1;
        push(a.gx, a.gy, () => {
            const bob = Math.abs(Math.sin(time * 4 + a.ph)) * .06;
            const p = isoWorld(a.gx, a.gy).add(vec2(0, .06 + bob));
            drawEllipse(isoWorld(a.gx, a.gy).add(vec2(0, -.04)), vec2(.5, .16), SHADOW);
            if (a.id === 'hen') drawHen(p, a.dir); else if (a.id === 'cow') drawCow(p, a.dir); else drawSheep(p, a.dir);
        });
    }
}
function drawPaddockFence() {
    // лёгкий штакетник по фронтальной грани загона
    for (let gx = -.2; gx <= 3.4; gx += .6) {
        const p = isoWorld(gx, 10.6);
        drawRect(p.add(vec2(0, .28)), vec2(.1, .5), C('#efe4cb'));
    }
    drawEllipse(isoWorld(.2, 9), vec2(.5, .26), C('#e2c878'));
    drawEllipse(isoWorld(.2, 9).add(vec2(-.08, .1)), vec2(.34, .18), C('#eed88f'));
}
function drawHen(p, dir) {
    drawEllipse(p.add(vec2(0, .2)), vec2(.36, .3), C('#f7ecd4'));
    drawEllipse(p.add(vec2(-.12 * dir, .16)), vec2(.2, .16), C('#eddfc0'));
    drawCircle(p.add(vec2(.16 * dir, .4)), .26, C('#f7ecd4'));
    drawCircle(p.add(vec2(.13 * dir, .55)), .07, C('#e26a5a'));
    drawCircle(p.add(vec2(.2 * dir, .57)), .06, C('#e26a5a'));
    drawPoly([vec2(0, -.04), vec2(.15 * dir, .02), vec2(0, .07)], C('#eb9c4a'), 0, undefined, p.add(vec2(.36 * dir, .38)));
    drawCircle(p.add(vec2(.24 * dir, .44)), .035, C('#4a3b2e'));
    drawCircle(p.add(vec2(.17 * dir, .36)), .05, new Color(.95, .66, .6, .55));
    drawRect(p.add(vec2(-.05, -.03)), vec2(.04, .1), C('#eb9c4a'));
    drawRect(p.add(vec2(.08, -.03)), vec2(.04, .1), C('#eb9c4a'));
}
function drawCow(p, dir) {
    drawEllipse(p.add(vec2(0, .26)), vec2(.62, .42), C('#f7f2e4'));
    drawEllipse(p.add(vec2(-.16, .34)), vec2(.22, .15), C('#c9b8a4'));
    drawEllipse(p.add(vec2(.18, .14)), vec2(.16, .11), C('#c9b8a4'));
    drawCircle(p.add(vec2(.5 * dir, .48)), .3, C('#f7f2e4'));
    drawEllipse(p.add(vec2(.56 * dir, .38)), vec2(.17, .11), C('#f2c4b4'));
    drawCircle(p.add(vec2(.48 * dir, .72)), .07, C('#e0d2ba'));
    drawCircle(p.add(vec2(.66 * dir, .68)), .07, C('#e0d2ba'));
    drawEllipse(p.add(vec2(.3 * dir, .6)), vec2(.1, .06), C('#e8dcc4'));
    drawCircle(p.add(vec2(.44 * dir, .52)), .04, C('#4a3b2e'));
    drawCircle(p.add(vec2(.6 * dir, .52)), .04, C('#4a3b2e'));
    drawCircle(p.add(vec2(.34 * dir, .44)), .05, new Color(.95, .66, .6, .5));
    drawRect(p.add(vec2(-.3, -.02)), vec2(.14, .16), C('#e8dcc4'));
    drawRect(p.add(vec2(.3, -.02)), vec2(.14, .16), C('#e8dcc4'));
}
function drawSheep(p, dir) {
    for (const [x, y, r] of [[0, .24, .42], [-.3, .3, .3], [.3, .3, .3], [-.16, .44, .28], [.16, .44, .28]])
        drawCircle(p.add(vec2(x, y)), r * 1.15, C('#f2ecdd'));
    drawCircle(p.add(vec2(0, .3)), .4, C('#faf6ea'));
    drawCircle(p.add(vec2(.4 * dir, .34)), .2, C('#d9c2ad'));
    drawCircle(p.add(vec2(.34 * dir, .5)), .12, C('#f2ecdd'));
    drawCircle(p.add(vec2(.38 * dir, .38)), .035, C('#4a3b2e'));
    drawCircle(p.add(vec2(.47 * dir, .38)), .035, C('#4a3b2e'));
    drawCircle(p.add(vec2(.42 * dir, .28)), .045, new Color(.95, .66, .6, .5));
    drawRect(p.add(vec2(-.2, -.02)), vec2(.1, .14), C('#c9b8a4'));
    drawRect(p.add(vec2(.2, -.02)), vec2(.1, .14), C('#c9b8a4'));
}

// ---------- Работники ----------
const workerEnts = { harv: null, sow: null };
function pushWorkers(push) {
    for (const id of ['harv', 'sow']) {
        if (!S.workers[id]) { workerEnts[id] = null; continue; }
        let e = workerEnts[id];
        if (!e) e = workerEnts[id] = { p: isoWorld(id === 'harv' ? -2 : 2, 1), t: null, ph: Math.random() * 9 };
        if (!e.t || (Math.abs(e.p.x - e.t.x) < .2 && Math.abs(e.p.y - e.t.y) < .2)) {
            const i = Math.floor(Math.random() * S.plots.length);
            e.t = plotPos(i).add(vec2(id === 'harv' ? 1.4 : -1.4, .1));
        }
        const sp = 1.6 * timeDelta;
        e.p = e.p.add(vec2(Math.sign(e.t.x - e.p.x) * Math.min(sp, Math.abs(e.t.x - e.p.x)), Math.sign(e.t.y - e.p.y) * Math.min(sp, Math.abs(e.t.y - e.p.y))));
        const gy = -e.p.y / IH;  // приблизительная глубина
        const cap = id;
        push(0, gy, () => drawWorker(e, cap), .3);
    }
}
function drawWorker(e, id) {
    const bob = Math.abs(Math.sin(time * 6 + e.ph)) * .06;
    const p = e.p.add(vec2(0, bob));
    const shirt = id === 'harv' ? '#e29070' : '#7fa3c9';
    drawEllipse(e.p.add(vec2(0, -.04)), vec2(.32, .1), SHADOW);
    drawEllipse(p.add(vec2(0, .26)), vec2(.28, .32), D(shirt, .85));
    drawEllipse(p.add(vec2(-.02, .28)), vec2(.25, .3), C(shirt));
    drawCircle(p.add(vec2(0, .76)), .3, C('#f6d7b2'));
    drawCircle(p.add(vec2(-.09, .78)), .032, C('#4a3b2e'));
    drawCircle(p.add(vec2(.09, .78)), .032, C('#4a3b2e'));
    drawCircle(p.add(vec2(-.16, .7)), .05, new Color(.95, .66, .6, .55));
    drawCircle(p.add(vec2(.16, .7)), .05, new Color(.95, .66, .6, .55));
    drawEllipse(p.add(vec2(0, .94)), vec2(.36, .11), C('#e2c878'));
    drawEllipse(p.add(vec2(0, 1)), vec2(.2, .13), C('#eed88f'));
    drawEllipse(p.add(vec2(0, .94)), vec2(.36, .04), C('#d0b264'));
    if (id === 'harv') { drawEllipse(p.add(vec2(.32, .24)), vec2(.16, .11), C('#c9a578')); drawEllipse(p.add(vec2(.32, .29)), vec2(.13, .06), C('#8a6749')); }
    else { drawEllipse(p.add(vec2(-.3, .24)), vec2(.13, .17), C('#d9c8a8')); drawEllipse(p.add(vec2(-.3, .33)), vec2(.09, .05), C('#b8a37c')); }
}
function drawTractor() {
    if (!S.workers.tract || tractorT < 0 || tractorT > 3) return;
    tractorT += timeDelta;
    const prog = tractorT / 3;
    const gy = tractorRow * 1 + 0.5;
    const gx = -3 + prog * 6;
    const p = isoWorld(gx, gy).add(vec2(0, .1));
    drawEllipse(p.add(vec2(0, -.05)), vec2(.95, .16), SHADOW);
    drawRect(p.add(vec2(-.1, .48)), vec2(1.24, .58), C('#c96a54'));
    drawRect(p.add(vec2(-.12, .54)), vec2(1.16, .42), C('#d97b64'));
    drawRect(p.add(vec2(.25, .95)), vec2(.62, .48), C('#a4c9cc'));
    drawRect(p.add(vec2(.25, .97)), vec2(.5, .36), C('#cfe6e6'));
    drawCircle(p.add(vec2(-.5, .14)), .36, C('#6b5748'));
    drawCircle(p.add(vec2(-.5, .14)), .16, C('#e7d6b8'));
    drawCircle(p.add(vec2(.5, .1)), .24, C('#6b5748'));
    drawCircle(p.add(vec2(.5, .1)), .1, C('#e7d6b8'));
    if (Math.random() < .3) pops.push({ p: p.add(vec2(-.72, 1.05)), v: vec2(-.3, .8), col: '#d9d4c8', t: .8, r: .1 });
}

// ---------- Табличка зоны ----------
function drawZoneSign(z) {
    const zone = ZONES[z], base = zoneSignPos(z), y0 = base.y, can = S.coins >= zone.unlock;
    const p = vec2(base.x, y0 + 1);
    drawEllipse(vec2(base.x, y0 + .15), vec2(1.5, .28), SHADOW);
    drawRect(p.add(vec2(0, -.45)), vec2(.2, .9), C('#a9835c'));
    drawRect(p, vec2(4.6, 1.4), C('#b08a5e'));
    drawRect(p.add(vec2(0, .06)), vec2(4.6, 1.26), C('#cca87a'));
    drawRect(p.add(vec2(0, .56)), vec2(4.6, .12), C('#dbbb8e'));
    const lp = p.add(vec2(-1.72, .22));
    drawCircle(lp.add(vec2(0, .14)), .3, new Color(0, 0, 0, 0), .07, C('#8a6749'));
    drawRect(lp, vec2(.4, .34), C('#8a6749'));
    drawCircle(lp.add(vec2(0, .02)), .09, C('#cca87a'));
    drawText(zone.name, p.add(vec2(.35, .3)), .5, C(INKT));
    drawCoin(p.add(vec2(-.75 - fmt(zone.unlock).length * .12, -.34)), .32);
    drawText(fmt(zone.unlock), p.add(vec2(.25, -.3)), .42, can ? C('#4e7e3e') : C('#b0604a'));
}

// ---------- Частицы, всплывашки, бабочки ----------
function drawParticles() {
    for (let i = pops.length - 1; i >= 0; i--) {
        const q = pops[i];
        q.t -= timeDelta;
        if (q.t <= 0) { pops.splice(i, 1); continue; }
        q.p = q.p.add(q.v.scale(timeDelta));
        q.v = q.v.add(vec2(0, -4 * timeDelta));
        drawCircle(q.p, q.r * Math.min(1, q.t * 2), C(q.col).scale(1, Math.min(1, q.t * 2)));
    }
    for (const b of decor.btf) {
        b.p += timeDelta;
        const p = vec2(b.x + Math.sin(b.p * .7) * 2.5, b.y + Math.sin(b.p * 1.3) * 1.2);
        const f = Math.sin(b.p * 14) * .09;
        drawEllipse(p.add(vec2(-.07, 0)), vec2(.1, .14 + f), C('#eda3b4'));
        drawEllipse(p.add(vec2(.07, 0)), vec2(.1, .14 - f), C('#f2bcc9'));
        drawEllipse(p, vec2(.03, .1), C('#8a7460'));
    }
}
function renderWorldUI() {
    for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i];
        f.t -= timeDelta;
        if (f.t <= 0) { floats.splice(i, 1); continue; }
        f.p = f.p.add(vec2(0, timeDelta * 1.2));
        drawText(f.txt, f.p, .55, C(f.col).scale(1, Math.min(1, f.t * 2)), .04, new Color(.3, .24, .18, Math.min(1, f.t * 2) * .6));
    }
    if (prestigeT > 0) {
        prestigeT -= timeDelta;
        const c = vec2(camX, camY + 3);
        drawStar(c.add(vec2(-3, 0)), .4); drawStar(c.add(vec2(3, 0)), .4);
        drawText('Новый сезон!', c, 1.15, C('#e9b949'), .07, new Color(.42, .3, .1, .5));
    }
}
