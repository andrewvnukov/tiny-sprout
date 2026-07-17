'use strict';
// ============================================================
// render.js — изометрический мир, тёплая пастель.
// Статичный мир (земля, тропинки, постройки, короба грядок,
// деревья, декор) ПЕЧЁТСЯ ОДИН РАЗ в offscreen-канвас и каждый
// кадр рисуется одним drawImage — скролл ровный, без генерации.
// Поверх — только динамика: культуры, животные, работники,
// частицы, дым, рябь. Глубина = gx+gy (дальше — раньше).
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

// ромб-полигон (верхняя грань плитки), центр в pos — для динамики
function isoTile(pos, hw, hh, col) {
    drawPoly([vec2(0, hh), vec2(hw, 0), vec2(0, -hh), vec2(-hw, 0)], col, 0, undefined, pos);
}

// ---------- Константы мира ----------
const PPU = 72;                                   // px на world-единицу в запечённом канвасе (высокое — без пикселей при зуме)
const WX0 = -35.5, WX1 = 30.5, WY0 = -18.5, WY1 = 14.5; // границы запечённого мира (world)
// стиль по зонам — новая зона выглядит иначе
const ZONE_STYLE = [
    { plate: '#a9c97e', wood: '#c99a5f', woodLo: '#9c7139', woodHi: '#e2ba79', soil: '#7a5334' }, // Поле
    { plate: '#9ec06a', wood: '#b58048', woodLo: '#875b31', woodHi: '#d3a25e', soil: '#6b4529' }, // Огород
    { plate: '#bcd6a4', wood: '#cdb389', woodLo: '#a3895f', woodHi: '#ecd9b0', soil: '#67503a' }, // Теплица
];
const TILE_GX0 = -10, TILE_GX1 = 10, TILE_GY0 = -8, TILE_GY1 = 14;
const BED_DEP = .34;                              // высота короба грядки (world)
const BLD = { half: 2, foot: .3, wall: 2.0, roof: 1.8 }; // постройка: 2×2 клетки, размеры в world
const PONDC = () => isoWorld(POND_G.gx + .5, POND_G.gy + .5);
// отдельный загон под каждый вид (границы в grid-координатах)
const PADDOCK = {
    hen:   { x0: -3.4, x1: -1.7, y0: 8.2, y1: 9.9 },
    cow:   { x0: -0.2, x1: 2.1,  y0: 9.2, y1: 11.0 },
    sheep: { x0: 3.0,  x1: 5.3,  y0: 9.2, y1: 11.0 },
};
// вид забора по типу (hW/pwW — в world-единицах; используется и для запечки, и для динамики)
const PEN_LOOK = {
    hen:   { railsN: [.72],    rail: '#efe4cb', post: '#efe4cb', cap: '#e7d9b8', hW: .30, pwW: .05 },
    cow:   { railsN: [.4, .82], rail: '#a97f48', post: '#8a6238', cap: null,     hW: .42, pwW: .07 },
    sheep: { railsN: [.6],     rail: '#c9b393', post: '#b8935c', cap: '#d9c8a8', hW: .34, pwW: .06 },
};
// точка дыма над трубой дома (world)
function chimneyPos() {
    const cc = isoWorld(HOUSE_G.gx + .5, HOUSE_G.gy + .5);
    return cc.add(vec2(-IW, BLD.foot + BLD.wall + BLD.roof * .5 + .45));
}

// детерминированный шум (декор не «пересеивается» при перепечке)
function rnd(s) { s = Math.sin(s * 127.1 + 311.7) * 43758.5; return s - Math.floor(s); }

// ---------- Занятость клеток + декор (строго по сетке) ----------
let decor = null, OCC = null;
const cellKey = (gx, gy) => gx + ',' + gy;
function buildOcc() {
    OCC = new Set();
    for (let i = 0; i < MAXPLOTS; i++) { const g = plotGrid(i); OCC.add(cellKey(g.gx, g.gy)); }
    for (const [gx, gy] of PATH_CELLS) OCC.add(cellKey(gx, gy));
    for (const b of [BARN_G, HOUSE_G, POND_G])                  // 2×2 клетки + кольцо
        for (let dx = -1; dx <= 2; dx++) for (let dy = -1; dy <= 2; dy++) OCC.add(cellKey(b.gx + dx, b.gy + dy));
    for (const k in PADDOCK) { const p = PADDOCK[k];            // загоны
        for (let gx = Math.floor(p.x0); gx <= Math.ceil(p.x1); gx++)
            for (let gy = Math.floor(p.y0); gy <= Math.ceil(p.y1); gy++) OCC.add(cellKey(gx, gy));
    }
}
const cellFree = (gx, gy) => !OCC.has(cellKey(gx, gy));
// активная зона фермы (сюда деревья не ставим)
const inCore = (gx, gy) => gx > -6.5 && gx < 8 && gy > -2.5 && gy < 12;
function initWorldDecor() {
    buildOcc();
    const R = (a, b) => a + Math.random() * (b - a);
    // клетки под мелкий декор — по всей карте, кроме занятых
    const cells = [];
    for (let gx = -11; gx <= 11; gx++) for (let gy = -8; gy <= 12; gy++) if (cellFree(gx, gy)) cells.push([gx, gy]);
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    let idx = 0;
    const mk = (n, f) => { const o = []; for (let k = 0; k < n && idx < cells.length; k++) o.push(f(cells[idx++])); return o; };
    decor = {
        clouds: Array.from({ length: 6 }, () => ({ x: R(-18, 18), y: R(3, 9), s: R(.9, 1.7), v: R(.05, .14) })),
        flowers: mk(34, c => ({ gx: c[0], gy: c[1], s: R(.8, 1.25), h: ['#eda3b4', '#f2d98a', '#f7f2e4', '#c3a8dd', '#f0a860'][Math.floor(R(0, 5))] })),
        grass:   mk(46, c => ({ gx: c[0], gy: c[1], s: R(.8, 1.35) })),
        stones:  mk(14, c => ({ gx: c[0], gy: c[1], s: R(.7, 1.3) })),
        trees: [],
        btf: Array.from({ length: 5 }, () => ({ x: R(-8, 4), y: R(-5, 2), p: R(0, 9) })),
    };
    // деревья вразброс по всей опушке (дробные координаты — не в ряд)
    for (let n = 0; n < 46; n++) {
        const gx = R(-11, 12), gy = R(-9, 13);
        if (inCore(gx, gy)) continue;
        decor.trees.push({ gx, gy, s: R(.78, 1.28) });
    }
}

// ============================================================
// Запечка статичного мира (raw Canvas2D — градиенты, штрихи)
// ============================================================
let worldCanvas = null, worldSig = '';
function worldSigNow() {
    return S.zones + ':' + S.plots.length + ':' +
        (S.animals.hen > 0 ? 'h' : '') + (S.animals.cow > 0 ? 'c' : '') + (S.animals.sheep > 0 ? 's' : '');
}
function buildWorld() {
    worldSig = worldSigNow();
    if (!worldCanvas) worldCanvas = document.createElement('canvas');
    const W = Math.round((WX1 - WX0) * PPU), H = Math.round((WY1 - WY0) * PPU);
    worldCanvas.width = W; worldCanvas.height = H;
    const x = worldCanvas.getContext('2d');
    const TW = IW * PPU, TH = IH * PPU, z = TW / 42;   // z ≈ масштаб констант пруф-концепта
    x.lineCap = 'round'; x.lineJoin = 'round';

    // мир → канвас (y мира вверх, канваса вниз)
    const P = (wx, wy) => ({ x: (wx - WX0) * PPU, y: (WY1 - wy) * PPU });
    const G = (gx, gy) => P((gx - gy) * IW, -(gx + gy) * IH);

    // --- локальные помощники ---
    function rhombusPath(cx, cy, w, h) {
        x.beginPath(); x.moveTo(cx, cy - h); x.lineTo(cx + w, cy); x.lineTo(cx, cy + h); x.lineTo(cx - w, cy); x.closePath();
    }
    function rhombus(cx, cy, w, h, fill) { rhombusPath(cx, cy, w, h); x.fillStyle = fill; x.fill(); }
    function quad(a, b, c, d, fill) {
        x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.lineTo(c.x, c.y); x.lineTo(d.x, d.y); x.closePath();
        x.fillStyle = fill; x.fill();
    }
    function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
    function seg(x0, y0, x1, y1) { x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); }
    function ell(cx, cy, rx, ry) { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fill(); }
    function softShadow(cx, cy, rx, ry, a = .18) {
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, rx);
        g.addColorStop(0, `rgba(40,30,15,${a})`); g.addColorStop(1, 'rgba(40,30,15,0)');
        x.save(); x.translate(cx, cy); x.scale(1, ry / rx); x.beginPath(); x.arc(0, 0, rx, 0, 7); x.fillStyle = g; x.fill(); x.restore();
    }
    const COL = {
        soil: '#7a5334', soilHi: '#916441', furrow: '#5a3a22',
        wood: '#c99a5f', woodHi: '#e2ba79', woodLo: '#9c7139', woodSeam: '#8a6231',
        wall: '#f0dcb0', wallSide: '#d8bd88', plankSeam: '#c9a86f',
        stone: '#b7ad98', stoneHi: '#d0c7b2', stoneLo: '#948b78',
        path: '#cbb083', pathLo: '#b6996b', pebble: '#a68a5e',
        grassBlade: '#6ba03e',
    };

    // ---------- земля ----------
    x.fillStyle = '#9cc06a'; x.fillRect(0, 0, W, H);
    for (let gx = TILE_GX0; gx <= TILE_GX1; gx++)
        for (let gy = TILE_GY0; gy <= TILE_GY1; gy++) {
            const s = G(gx, gy);
            rhombus(s.x, s.y, TW * 1.02, TH * 1.02, (gx + gy) & 1 ? '#98bd66' : '#a1c66e');
        }
    // растворяем шахматку в цвет луга к краям запечённой области
    {
        const c0 = G(1.5, 3.5);                    // центр фермы
        const g = x.createRadialGradient(c0.x, c0.y, 10 * PPU, c0.x, c0.y, 24 * PPU);
        g.addColorStop(0, 'rgba(156,192,106,0)'); g.addColorStop(1, '#9cc06a');
        x.fillStyle = g; x.fillRect(0, 0, W, H);
    }
    // мягкая пятнистость луга
    for (let i = 0; i < 10; i++) {
        const s = G(rnd(i * 7) * 16 - 8, rnd(i * 13) * 18 - 6);
        const g = x.createRadialGradient(s.x, s.y, 0, s.x, s.y, 230 * z);
        g.addColorStop(0, i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(55,105,40,.07)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.beginPath(); x.arc(s.x, s.y, 230 * z, 0, 7); x.fill();
    }

    // ---------- участки зон (плиты под грядки, каждая зона своего вида) ----------
    for (let zi = 0; zi < ZONES.length && zi <= S.zones; zi++) {
        const unlocked = zi < S.zones;
        for (let cx = 0; cx <= 3; cx++) for (let gy = zi * 3; gy <= zi * 3 + 1; gy++) {
            const s = G(cx, gy);
            rhombus(s.x, s.y, TW * 1.02, TH * 1.02, unlocked ? ZONE_STYLE[zi].plate : 'rgba(228,234,200,.28)');
        }
        if (!unlocked) {                            // пунктир «будущего участка»
            const A = G(-.5, zi * 3 - .5), Bc = G(3.5, zi * 3 - .5), Cc = G(3.5, zi * 3 + 1.5), Dd = G(-.5, zi * 3 + 1.5);
            x.setLineDash([8 * z, 6 * z]);
            x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2 * z;
            x.beginPath(); x.moveTo(A.x, A.y); x.lineTo(Bc.x, Bc.y); x.lineTo(Cc.x, Cc.y); x.lineTo(Dd.x, Dd.y); x.closePath(); x.stroke();
            x.setLineDash([]);
        }
    }

    // ---------- тропинки с камешками ----------
    for (const [gx, gy] of PATH_CELLS) {
        const s = G(gx, gy);
        rhombus(s.x, s.y, TW * 1.02, TH * 1.02, COL.pathLo);
        rhombus(s.x, s.y, TW * .9, TH * .9, COL.path);
        x.fillStyle = COL.pebble;
        for (let i = 0; i < 6; i++) {
            const a = rnd(gx * 31 + gy * 17 + i), b = rnd(gx * 13 + gy * 41 + i * 3);
            ell(s.x + (a - .5) * TW * 1.1, s.y + (b - .5) * TH * 1.1, 2.4 * z, 1.4 * z);
        }
    }

    // ---------- травинки (кроме занятых клеток) ----------
    x.strokeStyle = COL.grassBlade; x.lineWidth = 1.3 * z; x.globalAlpha = .6;
    for (let gx = TILE_GX0 + 1; gx < TILE_GX1; gx++)
        for (let gy = TILE_GY0 + 1; gy < TILE_GY1; gy++) {
            if (!cellFree(gx, gy)) continue;
            const r = rnd(gx * 57 + gy * 131);
            if (r > .5) continue;
            const s = G(gx + rnd(r) - .5, gy + rnd(r * 3) - .5);
            for (let k = -1; k <= 1; k++)
                seg(s.x + k * 2.4 * z, s.y, s.x + k * 2.4 * z + (r - .5) * 3 * z, s.y - 5.5 * z);
        }
    x.globalAlpha = 1;

    // ---------- объекты с сортировкой по глубине ----------
    const items = [];
    const put = (d, fn) => items.push({ d, fn });

    // деревья: тень, ствол и крона из ОДНОЙ опорной точки (низ клетки)
    function tree(t) {
        const s = G(t.gx, t.gy), k = t.s * z;
        softShadow(s.x + 2 * k, s.y + 1.5 * k, 20 * k, 7.5 * k, .22);
        x.fillStyle = '#9a7a58'; x.fillRect(s.x - 3.4 * k, s.y - 30 * k, 6.8 * k, 31 * k);
        x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(s.x + .6 * k, s.y - 30 * k, 2.8 * k, 31 * k);
        x.fillStyle = '#679455'; ell(s.x, s.y - 44 * k, 24 * k, 24 * k);
        x.fillStyle = '#6f9c5c'; ell(s.x + 10 * k, s.y - 40 * k, 14 * k, 14 * k);
        x.fillStyle = '#7fac68'; ell(s.x - 9 * k, s.y - 52 * k, 15 * k, 15 * k);
        x.fillStyle = '#8fbc76'; ell(s.x - 4 * k, s.y - 58 * k, 9 * k, 9 * k);
        // пара «яблок» света
        x.fillStyle = 'rgba(255,255,255,.15)'; ell(s.x - 12 * k, s.y - 55 * k, 5 * k, 4 * k);
    }
    for (const t of decor.trees) put(t.gx + t.gy, () => tree(t));

    // короб грядки: НИЗ по границе клетки, борта растут вверх; цвет — по зоне
    function bedBox(gx, gy, zi) {
        const zs = ZONE_STYLE[zi] || ZONE_STYLE[0];
        const s = G(gx, gy), w = TW * .99, h = TH * .99, dep = BED_DEP * PPU;
        const L = { x: s.x - w, y: s.y }, B = { x: s.x, y: s.y + h }, R = { x: s.x + w, y: s.y }, Tt = { x: s.x, y: s.y - h };
        softShadow(s.x, s.y + h * .5, w * 1.12, h * .8, .15);
        quad(L, B, { x: B.x, y: B.y - dep }, { x: L.x, y: L.y - dep }, zs.woodLo);
        quad(B, R, { x: R.x, y: R.y - dep }, { x: B.x, y: B.y - dep }, zs.wood);
        x.strokeStyle = COL.woodSeam; x.lineWidth = 1.2 * z;
        for (let i = 1; i < 4; i++) {
            const t = i / 4, p1 = lerp(L, B, t), p2 = lerp(B, R, t);
            seg(p1.x, p1.y - dep * .12, p1.x, p1.y - dep * .88);
            seg(p2.x, p2.y - dep * .12, p2.x, p2.y - dep * .88);
        }
        rhombus(s.x, s.y - dep, w, h, zs.woodHi);
        x.fillStyle = zs.woodLo;
        for (const c of [L, B, R]) x.fillRect(c.x - 2.3 * z, c.y - dep - 3.4 * z, 4.6 * z, dep + 4.4 * z);
        x.fillRect(Tt.x - 2.3 * z, Tt.y - dep - 3.4 * z, 4.6 * z, dep + 3.4 * z);
        rhombus(s.x, s.y - dep, w * .74, h * .74, zs.soil);
        x.fillStyle = COL.soilHi;
        for (let i = 0; i < 12; i++) {
            const a = rnd(gx * 7 + i) - .5, b = rnd(gy * 9 + i * 2) - .5;
            const wx = (a + b) * w * .6, wy = (b - a) * h * .6;
            ell(s.x + wx, s.y - dep + wy, 1.3 * z, .9 * z);
        }
        x.strokeStyle = COL.furrow; x.lineWidth = 2 * z;
        for (let k = -1; k <= 1; k++) {
            const ox = w * k * .22, oy = -h * k * .22;
            seg(s.x + ox - w * .32, s.y - dep + oy - h * .32, s.x + ox + w * .32, s.y - dep + oy + h * .32);
        }
        // теплица: лёгкие «арки» над грядкой — визуально отличает зону
        if (zi === 2) {
            x.strokeStyle = 'rgba(150,205,220,.5)'; x.lineWidth = 1.6 * z;
            const top = { x: s.x, y: s.y - dep - 20 * z };
            x.beginPath(); x.moveTo(L.x + 4 * z, L.y - dep); x.quadraticCurveTo(top.x, top.y, R.x - 4 * z, R.y - dep); x.stroke();
        }
    }
    for (let i = 0; i < S.plots.length; i++) { const g = plotGrid(i); put(g.gx + g.gy, () => bedBox(g.gx, g.gy, Math.floor(i / 8))); }

    // постройка 2×2 клетки: низ ромба точно по линиям сетки
    function bldg(g, isBarn) {
        const s = G(g.gx + .5, g.gy + .5);
        const bw = 2 * TW, bh = 2 * TH;
        const wallH = BLD.wall * PPU, roofH = BLD.roof * PPU, foot = BLD.foot * PPU;
        softShadow(s.x + bw * .06, s.y + bh * .45, bw * 1.15, bh * .95, .24);
        const B = { x: s.x, y: s.y + bh }, L = { x: s.x - bw, y: s.y }, R = { x: s.x + bw, y: s.y };
        // каменный фундамент
        quad(L, B, { x: B.x, y: B.y - foot }, { x: L.x, y: L.y - foot }, COL.stoneLo);
        quad(B, R, { x: R.x, y: R.y - foot }, { x: B.x, y: B.y - foot }, COL.stone);
        x.fillStyle = COL.stoneHi;
        for (let i = 0; i < 9; i++) { const p = lerp(B, R, rnd(g.gx * 5 + i)); ell(p.x, p.y - foot * .5, 3.2 * z, 1.9 * z); }
        // стены
        const wL = { x: L.x, y: L.y - foot }, wB = { x: B.x, y: B.y - foot }, wR = { x: R.x, y: R.y - foot };
        quad(wL, wB, { x: wB.x, y: wB.y - wallH }, { x: wL.x, y: wL.y - wallH }, isBarn ? '#a84a33' : COL.wallSide);
        quad(wB, wR, { x: wR.x, y: wR.y - wallH }, { x: wB.x, y: wB.y - wallH }, isBarn ? '#c9553c' : COL.wall);
        // швы досок
        x.strokeStyle = isBarn ? 'rgba(120,40,25,.5)' : COL.plankSeam; x.lineWidth = 1.2 * z;
        for (let i = 1; i < 6; i++) {
            const t = i / 6, a = lerp(wL, wB, t), b = lerp(wB, wR, t);
            seg(a.x, a.y, a.x, a.y - wallH);
            seg(b.x, b.y, b.x, b.y - wallH);
        }
        const faceB = t => lerp(wB, wR, t);
        if (isBarn) {
            // большие ворота с X-раскосами
            const d0 = faceB(.26), d1 = faceB(.74);
            const t0 = { x: d0.x, y: d0.y - wallH * .8 }, t1 = { x: d1.x, y: d1.y - wallH * .8 };
            quad(d0, d1, t1, t0, '#7e3826');
            x.strokeStyle = '#f0dcb0'; x.lineWidth = 3 * z;
            seg(d0.x, d0.y, t1.x, t1.y); seg(d1.x, d1.y, t0.x, t0.y);
            const md = faceB(.5); seg(md.x, md.y, md.x, md.y - wallH * .8);
            // сеновал-оконце под крышей
            const h0 = faceB(.42), h1 = faceB(.58);
            quad({ x: h0.x, y: h0.y - wallH * .88 }, { x: h1.x, y: h1.y - wallH * .88 },
                 { x: h1.x, y: h1.y - wallH * 1.02 }, { x: h0.x, y: h0.y - wallH * 1.02 }, '#5f2a1c');
        } else {
            // дверь: рама + дощатое полотно + ручка + ступенька
            const f0 = faceB(.19), f1 = faceB(.45), d0 = faceB(.215), d1 = faceB(.425);
            quad(f0, f1, { x: f1.x, y: f1.y - wallH * .64 }, { x: f0.x, y: f0.y - wallH * .64 }, '#8a6238');
            quad(d0, d1, { x: d1.x, y: d1.y - wallH * .58 }, { x: d0.x, y: d0.y - wallH * .58 }, '#a97f48');
            x.strokeStyle = 'rgba(80,50,20,.35)'; x.lineWidth = 1.2 * z;
            for (const t of [1 / 3, 2 / 3]) {
                const dp = lerp(d0, d1, t);
                seg(dp.x, dp.y - 2 * z, dp.x, dp.y - wallH * .55);
            }
            const hnd = lerp(d0, d1, .82);
            x.fillStyle = '#f6dc94'; ell(hnd.x, hnd.y - wallH * .3, 1.9 * z, 1.9 * z);
            x.fillStyle = '#c98f36'; ell(hnd.x, hnd.y - wallH * .3, 1 * z, 1 * z);
            // каменная ступенька перед дверью
            const st = lerp(d0, d1, .5);
            x.fillStyle = COL.stoneHi; ell(st.x, st.y + 2.5 * z, 8 * z, 3 * z);
            x.fillStyle = COL.stone; ell(st.x + 3 * z, st.y + 3.2 * z, 4 * z, 1.8 * z);
            // окно: крест, ставни, ящик с цветами
            const w0 = faceB(.6), w1 = faceB(.82), wy = -wallH * .48;
            quad({ x: w0.x, y: w0.y + wy }, { x: w1.x, y: w1.y + wy },
                 { x: w1.x, y: w1.y + wy - wallH * .3 }, { x: w0.x, y: w0.y + wy - wallH * .3 }, '#bfe4ec');
            x.strokeStyle = '#f0dcb0'; x.lineWidth = 2.4 * z;
            const wc = lerp(w0, w1, .5);
            seg(wc.x, wc.y + wy, wc.x, wc.y + wy - wallH * .3);
            seg(w0.x, w0.y + wy - wallH * .15, w1.x, w1.y + wy - wallH * .15);
            x.strokeStyle = '#c9a86f'; x.lineWidth = 2 * z;
            x.strokeRect(w0.x - 1 * z, w0.y + wy - wallH * .3, (w1.x - w0.x) + 2 * z, wallH * .3 + (w1.y - w0.y));
            x.fillStyle = '#a2793f'; x.fillRect(wc.x - 9 * z, wc.y + wy - 1 * z, 18 * z, 4 * z);
            for (let i = 0; i < 3; i++) {
                x.fillStyle = ['#ff9ec2', '#ffd95e', '#c79bff'][i];
                ell(wc.x + (i - 1) * 6 * z, wc.y + wy - 2.4 * z, 2.2 * z, 2.2 * z);
            }
        }
        // крыша с черепицей
        const ry = -wallH - foot, apex = { x: s.x, y: s.y + ry - roofH };
        const eL = { x: L.x, y: L.y + ry }, eB = { x: B.x, y: B.y + ry }, eR = { x: R.x, y: R.y + ry };
        shingle(eL, eB, apex, isBarn ? '#8f3f2a' : '#bd5c3a', true);
        shingle(eB, eR, apex, isBarn ? '#b5533a' : '#e07a53', false);
        x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 2.4 * z;
        const rh = lerp(eB, apex, .12);
        seg(rh.x, rh.y, apex.x, apex.y);
        x.strokeStyle = isBarn ? '#8f3f2a' : '#bd5c3a'; x.lineWidth = 3 * z;
        x.beginPath(); x.moveTo(eL.x, eL.y); x.lineTo(eB.x, eB.y); x.lineTo(eR.x, eR.y); x.stroke();
        // труба (только дом; дым — динамика)
        if (!isBarn) {
            const chx = s.x - bw * .5, chy = s.y + ry - roofH * .5;
            x.fillStyle = '#a85f42'; x.fillRect(chx - 6 * z, chy - 16 * z, 12 * z, 24 * z);
            x.fillStyle = '#8a4a30'; x.fillRect(chx - 7.2 * z, chy - 19 * z, 14.4 * z, 5 * z);
        }
    }
    function shingle(e0, e1, apex, base, left) {
        quad(e0, e1, apex, e0, base);
        x.save();
        x.beginPath(); x.moveTo(e0.x, e0.y); x.lineTo(e1.x, e1.y); x.lineTo(apex.x, apex.y); x.closePath(); x.clip();
        const rows = 5;
        for (let r = 1; r <= rows; r++) {
            const t = r / (rows + 1), a = lerp(e0, apex, t), b = lerp(e1, apex, t);
            x.strokeStyle = left ? 'rgba(90,35,20,.45)' : 'rgba(120,50,30,.4)'; x.lineWidth = 1.5 * z;
            seg(a.x, a.y, b.x, b.y);
            for (let c1 = 0; c1 <= 6; c1++) {
                const p = lerp(a, b, c1 / 6 + (r % 2 ? .5 / 6 : 0));
                seg(p.x, p.y, p.x, p.y - 3.4 * z);
            }
        }
        x.strokeStyle = left ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.28)'; x.lineWidth = 4 * z;
        const h0 = lerp(e0, apex, .06), h1 = lerp(e1, apex, .06);
        seg(h0.x, h0.y, h1.x, h1.y);
        x.restore();
    }
    put(BARN_G.gx + BARN_G.gy + 1, () => bldg(BARN_G, true));
    put(HOUSE_G.gx + HOUSE_G.gy + 1, () => bldg(HOUSE_G, false));

    // пруд 2×2 клетки: кромка по линиям сетки, вода с градиентом глубины
    function pond() {
        const s = G(POND_G.gx + .5, POND_G.gy + .5), w = 2 * TW, h = 2 * TH;
        rhombus(s.x, s.y, w, h, '#b79a63');
        rhombus(s.x, s.y, w * .93, h * .93, '#c9b071');
        x.save(); rhombusPath(s.x, s.y, w * .84, h * .84); x.clip();
        const g = x.createRadialGradient(s.x, s.y, 2, s.x, s.y, w * .84);
        g.addColorStop(0, '#93e4f0'); g.addColorStop(.6, '#4fc0d6'); g.addColorStop(1, '#2f9fb8');
        x.fillStyle = g; x.fillRect(s.x - w, s.y - h, w * 2, h * 2);
        x.restore();
        // кувшинки
        x.fillStyle = '#4f9436';
        for (const [ox, oy] of [[-.35, -.15], [.3, .25], [.02, -.38]]) {
            x.beginPath(); x.ellipse(s.x + ox * w * .8, s.y + oy * h * .8, 7 * z, 4 * z, 0, .4, 6.6); x.fill();
        }
        // камешки по берегу
        x.fillStyle = COL.pebble;
        for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2 + rnd(i) * .5;
            ell(s.x + Math.cos(a) * w * .95, s.y + Math.sin(a) * h * .95, 2.6 * z, 1.6 * z);
        }
    }
    put(POND_G.gx + POND_G.gy + 1, () => pond());

    // декор
    function flower(f) {
        const s = G(f.gx + rnd(f.gx * 3 + f.gy) * .5 - .25, f.gy + rnd(f.gy * 5 + f.gx) * .5 - .25), k = f.s * z;
        x.strokeStyle = '#5aa03e'; x.lineWidth = 1.7 * z;
        seg(s.x, s.y, s.x + 1.5 * k, s.y - 9 * k);
        x.fillStyle = f.h;
        for (let p = 0; p < 5; p++) {
            const a = p / 5 * 6.28;
            ell(s.x + 1.5 * k + Math.cos(a) * 3.2 * k, s.y - 9 * k + Math.sin(a) * 3.2 * k, 2.2 * k, 2.2 * k);
        }
        x.fillStyle = '#ffd95e'; ell(s.x + 1.5 * k, s.y - 9 * k, 1.9 * k, 1.9 * k);
    }
    function tuft(g) {
        const s = G(g.gx + rnd(g.gx * 9 + g.gy) * .5 - .25, g.gy + rnd(g.gy * 7 + g.gx) * .5 - .25), k = g.s * z;
        x.strokeStyle = '#7fa451'; x.lineWidth = 1.9 * z;
        for (let i = -1; i <= 1; i++)
            seg(s.x + i * 3 * k, s.y, s.x + i * 3 * k + rnd(g.gx + i) * 3 * k - 1.5 * k, s.y - 9 * k);
    }
    function stone(st) {
        const s = G(st.gx, st.gy), k = st.s * z;
        softShadow(s.x, s.y + 1.5 * k, 9 * k, 3.6 * k, .16);
        x.fillStyle = COL.stoneLo; ell(s.x, s.y - 2.4 * k, 7 * k, 4.6 * k);
        x.fillStyle = COL.stoneHi; ell(s.x - 1.2 * k, s.y - 4 * k, 3.6 * k, 2.3 * k);
    }
    for (const f of decor.flowers) put(f.gx + f.gy, () => flower(f));
    for (const g of decor.grass) put(g.gx + g.gy, () => tuft(g));
    for (const s of decor.stones) put(s.gx + s.gy, () => stone(s));

    // ---------- загоны: у каждого вида свой стиль ----------
    function penGround(pd, fill) {
        const A = G(pd.x0, pd.y0), B = G(pd.x1, pd.y0), Cc = G(pd.x1, pd.y1), Dd = G(pd.x0, pd.y1);
        x.fillStyle = fill;
        x.beginPath(); x.moveTo(A.x, A.y); x.lineTo(B.x, B.y); x.lineTo(Cc.x, Cc.y); x.lineTo(Dd.x, Dd.y); x.closePath(); x.fill();
    }
    function fenceRun(a, b, o, n) {
        x.strokeStyle = o.rail; x.lineWidth = 2.2 * z;
        for (const rh of o.rails) seg(a.x, a.y - o.h * rh, b.x, b.y - o.h * rh);
        for (let i = 0; i <= n; i++) { const t = i / n, px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t;
            x.fillStyle = o.post; x.fillRect(px - o.pw, py - o.h, o.pw * 2, o.h);
            if (o.cap) { x.fillStyle = o.cap; ell(px, py - o.h, o.pw * 1.3, o.pw); } }
    }
    function penFencesBack(pd, o) {                             // только задние рёбра (до строений)
        const A = G(pd.x0, pd.y0), B = G(pd.x1, pd.y0), Dd = G(pd.x0, pd.y1);
        const nx = Math.max(2, Math.round((pd.x1 - pd.x0) * 2.2)), ny = Math.max(2, Math.round((pd.y1 - pd.y0) * 2.2));
        fenceRun(A, B, o, nx); fenceRun(A, Dd, o, ny);
    }
    function penDo(id, groundFill, structFn) {
        const pd = PADDOCK[id], lk = PEN_LOOK[id];
        const o = { h: lk.hW * PPU, rails: lk.railsN, rail: lk.rail, post: lk.post, pw: lk.pwW * PPU, cap: lk.cap };
        penGround(pd, groundFill);
        penFencesBack(pd, o);                                   // задний забор — за строением
        structFn(pd);                                          // курятник/корыто поверх заднего забора
    }
    function coop(pd) {                                          // курятник
        const c = G(pd.x0 + .55, pd.y0 + .62), cw = TW * .52, ch = TH * .52, wallH = 23 * z, roofH = 16 * z;
        softShadow(c.x, c.y + ch * .5, cw * 1.3, ch, .2);
        const B0 = { x: c.x, y: c.y + ch }, L0 = { x: c.x - cw, y: c.y }, R0 = { x: c.x + cw, y: c.y };
        quad(L0, B0, { x: B0.x, y: B0.y - wallH }, { x: L0.x, y: L0.y - wallH }, '#d9b98a');
        quad(B0, R0, { x: R0.x, y: R0.y - wallH }, { x: B0.x, y: B0.y - wallH }, '#ecd3a6');
        x.strokeStyle = 'rgba(120,90,50,.3)'; x.lineWidth = 1 * z;
        for (let i = 1; i < 3; i++) { const p = lerp(B0, R0, i / 3); seg(p.x, p.y, p.x, p.y - wallH); }
        const eB = lerp(B0, R0, .5);
        x.fillStyle = '#b8935c'; x.beginPath(); x.moveTo(eB.x - 3.5 * z, eB.y); x.lineTo(eB.x + 3.5 * z, eB.y); x.lineTo(eB.x + 6 * z, eB.y + 8 * z); x.lineTo(eB.x - 1 * z, eB.y + 8 * z); x.closePath(); x.fill();
        x.fillStyle = '#5a4632'; ell(eB.x, eB.y - wallH * .36, 4.4 * z, 5.4 * z);
        x.fillStyle = '#3f3020'; ell(eB.x, eB.y - wallH * .3, 2.8 * z, 3.4 * z);
        const apex = { x: c.x, y: c.y - wallH - roofH }, eL = { x: L0.x, y: L0.y - wallH }, eR = { x: R0.x, y: R0.y - wallH }, eBt = { x: B0.x, y: B0.y - wallH };
        quad(eL, eBt, apex, eL, '#a84a33'); quad(eBt, eR, apex, eBt, '#c9553c');
        x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 2 * z; seg(eBt.x, eBt.y, apex.x, apex.y);
    }
    function trough(pd, water) {                                 // корыто/кормушка
        const t = G(pd.x0 + .55, pd.y0 + .55), tw = TW * .5, th = TH * .5, dep = 7 * z;
        quad({ x: t.x - tw, y: t.y }, { x: t.x, y: t.y + th }, { x: t.x, y: t.y + th - dep }, { x: t.x - tw, y: t.y - dep }, '#9c7139');
        quad({ x: t.x, y: t.y + th }, { x: t.x + tw, y: t.y }, { x: t.x + tw, y: t.y - dep }, { x: t.x, y: t.y + th - dep }, '#b8935c');
        rhombus(t.x, t.y - dep * .4, tw * .82, th * .82, water ? '#7fd0e0' : '#eed88f');
        if (water) rhombus(t.x, t.y - dep * .4, tw * .5, th * .5, '#a6e4ee');
    }
    function hayBale(pd) {                                       // тюк сена
        const h = G(pd.x1 - .5, pd.y0 + .5);
        softShadow(h.x, h.y + 3 * z, 15 * z, 6 * z, .16);
        x.fillStyle = '#e2c878'; x.fillRect(h.x - 11 * z, h.y - 15 * z, 22 * z, 15 * z);
        x.strokeStyle = '#cdae63'; x.lineWidth = 1.2 * z;
        for (let i = 1; i < 4; i++) seg(h.x - 11 * z, h.y - 15 * z + i * 3.6 * z, h.x + 11 * z, h.y - 15 * z + i * 3.6 * z);
        x.strokeStyle = '#b8935c'; x.lineWidth = 2 * z; x.strokeRect(h.x - 4 * z, h.y - 15 * z, 3 * z, 15 * z);
    }
    function penBush(pd) {                                       // кустик у овец
        const b = G(pd.x1 - .5, pd.y0 + .5);
        softShadow(b.x, b.y + 2 * z, 12 * z, 5 * z, .16);
        x.fillStyle = '#6f9c5c'; ell(b.x, b.y - 6 * z, 11 * z, 9 * z);
        x.fillStyle = '#7fac68'; ell(b.x - 4 * z, b.y - 9 * z, 6 * z, 5 * z);
        x.fillStyle = '#e88ba4'; ell(b.x + 3 * z, b.y - 8 * z, 2 * z, 2 * z);
        x.fillStyle = '#f2d98a'; ell(b.x - 2 * z, b.y - 4 * z, 1.8 * z, 1.8 * z);
    }
    // передний забор рисуется динамически (в renderWorld) — чтобы животные прятались ЗА ним
    if (S.animals.hen > 0)   put(PADDOCK.hen.x1 + PADDOCK.hen.y1,   () => penDo('hen',   '#cdbd93', pd => coop(pd)));
    if (S.animals.cow > 0)   put(PADDOCK.cow.x1 + PADDOCK.cow.y1,   () => penDo('cow',   '#a7c56e', pd => { trough(pd, true); hayBale(pd); }));
    if (S.animals.sheep > 0) put(PADDOCK.sheep.x1 + PADDOCK.sheep.y1, () => penDo('sheep', '#a7c56e', pd => { trough(pd, false); penBush(pd); }));

    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.fn();
}

// ---------- Эффекты ----------
const floats = [];
const pops = [];
let tractorT = -99, tractorRow = 0;
let prestigeT = 0;

function addFloat(p, txt, col) { floats.push({ p: p.copy(), txt, col, t: 1.2 }); }
function fxHarvest(i, ci, golden) {
    const p = plotPos(i), c = CROPS[ci];
    addFloat(p.add(vec2(0, 1)), golden ? '+5!' : '+1', golden ? '#e9b949' : '#fff');
    for (let k = 0; k < (golden ? 10 : 5); k++)
        pops.push({ p: p.add(vec2(0, BED_DEP + .2)), v: vec2((Math.random() - .5) * 3, Math.random() * 3 + 1),
                    col: golden ? '#efd07a' : c.hue, t: .7, r: .09 + Math.random() * .08 });
}
function fxTap(i) {
    const p = plotPos(i);
    pops.push({ p: p.add(vec2((Math.random() - .5) * .8, BED_DEP + .2)), v: vec2(0, 1.6), col: '#c3dd9a', t: .5, r: .08 });
}
function fxTractor() { tractorT = 0; tractorRow = Math.floor(Math.random() * Math.max(1, S.plots.length) / 4) | 0; }
function fxPrestige() {
    prestigeT = 2;
    for (let k = 0; k < 60; k++)
        pops.push({ p: vec2(FIELD_CX + (Math.random() - .5) * 12, FIELD_CY + Math.random() * 8), v: vec2((Math.random() - .5) * 4, Math.random() * 4),
                    col: ['#efd07a', '#eda3b4', '#a8cc80', '#c3a8dd'][k % 4], t: 1.5 + Math.random(), r: .1 + Math.random() * .1 });
}

// ============================================================
// Кадр: подложка → готовый мир (drawImage) → динамика
// ============================================================
function renderWorld() {
    if (!worldCanvas || worldSig !== worldSigNow()) buildWorld();

    const tl = screenToWorld(vec2(0, 0)), br = screenToWorld(mainCanvasSize);
    const L = tl.x, Rt = br.x, T = tl.y, B = br.y;              // T>B (y вверх)
    drawRect(vec2((L + Rt) / 2, (T + B) / 2), vec2(Rt - L + 2, T - B + 2), C('#9cc06a'));

    // статичный мир: рисуем ТОЛЬКО видимый кусок запечённого канваса
    // (иначе на большом PPU семплинг всего атласа роняет fps)
    mainContext.imageSmoothingEnabled = true;
    const cx0 = Math.max(WX0, L), cx1 = Math.min(WX1, Rt);
    const cy0 = Math.max(WY0, B), cy1 = Math.min(WY1, T);
    if (cx1 > cx0 && cy1 > cy0) {
        const sx = (cx0 - WX0) * PPU, sy = (WY1 - cy1) * PPU, sw = (cx1 - cx0) * PPU, sh = (cy1 - cy0) * PPU;
        const d0 = worldToScreen(vec2(cx0, cy1)), d1 = worldToScreen(vec2(cx1, cy0));
        mainContext.drawImage(worldCanvas, sx, sy, sw, sh, d0.x, d0.y, d1.x - d0.x, d1.y - d0.y);
    }

    // облака
    for (const c of decor.clouds) {
        c.x += c.v * timeDelta; if (c.x > Rt + 4) c.x = L - 4;
        const p = vec2(c.x, c.y);
        drawEllipse(p, vec2(1.6 * c.s, .55 * c.s), C('#ffffff'));
        drawEllipse(p.add(vec2(.8 * c.s, .18 * c.s)), vec2(1 * c.s, .45 * c.s), C('#ffffff'));
        drawEllipse(p.add(vec2(-.7 * c.s, .14 * c.s)), vec2(.9 * c.s, .4 * c.s), C('#fbfbf4'));
    }
    // рябь на пруду
    const pc = PONDC();
    for (let i = 0; i < 4; i++) {
        const ph = time * 1.4 + i * 1.3;
        drawEllipse(pc.add(vec2(Math.sin(ph) * IW * 1.1, Math.cos(ph * .7) * IH * 1.1)),
            vec2(.2, .07), new Color(1, 1, 1, .35 + .2 * Math.sin(ph * 2)));
    }
    // дым из трубы дома
    const ch = chimneyPos();
    for (let k = 0; k < 3; k++) {
        const t = (time * .5 + k * .33) % 1;
        drawCircle(ch.add(vec2(Math.sin(t * 6) * .2, t * 1.5)), .1 + t * .2, new Color(1, 1, 1, .4 * (1 - t)));
    }

    // ---- динамика с сортировкой по глубине ----
    const items = [];
    const push = (gx, gy, fn, bias = 0) => items.push({ d: gx + gy + bias, fn });

    for (let i = 0; i < S.plots.length; i++) {
        const g = plotGrid(i);
        if (S.plots[i].c >= 0) push(g.gx, g.gy, () => drawCrop(plotPos(i), S.plots[i]));
    }
    const owned = S.plots.length, maxNow = ZONES.slice(0, S.zones).reduce((s, z) => s + z.plots, 0);
    if (owned < maxNow) { const g = plotGrid(owned); push(g.gx, g.gy, () => drawGhostPlot(owned)); }
    if (S.zones < ZONES.length) { const g = zoneCenterGrid(S.zones); push(g.gx, g.gy, () => drawZoneSign(S.zones), .5); }
    pushAnimals(push);
    pushWorkers(push);
    // передний забор загонов — поверх животных (они прячутся за ним)
    for (const id of ['hen', 'cow', 'sheep'])
        if (S.animals[id] > 0) { const pd = PADDOCK[id]; push(pd.x1, pd.y1, () => drawPenFront(id), .06); }

    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.fn();

    drawTractor();
    drawParticles();
}

// передний забор загона (world-координаты) — динамика для корректной перекрытия
function drawPenFront(id) {
    const pd = PADDOCK[id], lk = PEN_LOOK[id];
    const cc = isoWorld(pd.x1, pd.y1), dd = isoWorld(pd.x0, pd.y1), bb = isoWorld(pd.x1, pd.y0);
    const edge = (aa, bx, n) => {
        for (const rh of lk.railsN) drawLine(aa.add(vec2(0, lk.hW * rh)), bx.add(vec2(0, lk.hW * rh)), .05, C(lk.rail));
        for (let i = 0; i <= n; i++) { const p = aa.add(bx.subtract(aa).scale(i / n));
            drawRect(p.add(vec2(0, lk.hW * .5)), vec2(lk.pwW * 2, lk.hW), C(lk.post));
            if (lk.cap) drawCircle(p.add(vec2(0, lk.hW)), lk.pwW * 1.35, C(lk.cap)); }
    };
    const nx = Math.max(2, Math.round((pd.x1 - pd.x0) * 2.2)), ny = Math.max(2, Math.round((pd.y1 - pd.y0) * 2.2));
    edge(dd, cc, nx); edge(bb, cc, ny);
}

// ---------- Грядки: динамика (культуры) ----------
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
    const o = pos.add(vec2(0, BED_DEP));            // растение статично сидит на грядке
    if (k < .35) drawSprout(o, k);
    else drawCropArt(o, p.c, .45 + .55 * k);
    if (p.g && k > .3) {
        const tw = .5 + Math.sin(time * 5 + pos.x * 2) * .5;
        drawStar(o.add(vec2(.66, .7)), .1 + .05 * tw);
        drawStar(o.add(vec2(-.7, .46)), .08 + .04 * (1 - tw));
    }
    if (!ready) {
        const by = pos.add(vec2(0, -IH - .16));
        drawRect(by, vec2(1.4, .16), new Color(1, 1, 1, .4));
        drawRect(by, vec2(1.32, .1), new Color(.4, .34, .24, .25));
        drawRect(by.add(vec2(-(1.32 - 1.32 * k) / 2, 0)), vec2(1.32 * k, .1), C('#8fc167'));
    } else {
        const t = 1 + Math.sin(time * 4) * .08, bp = pos.add(vec2(.85, .95));
        drawCircle(bp, .4 * t, C('#fffdf4'));
        drawText('!', bp.add(vec2(0, .02)), .38 * t, C('#e0a83e'));
    }
}
// росток: изогнутый стебель + листья-овалы (не «палочка»)
function drawSprout(o, k) {
    const s = .5 + k * 2, sway = Math.sin(time * 2 + o.x * 2) * .05;
    drawLine(o, o.add(vec2(sway, .36 * s)), .05, C('#4f9436'));
    const n = 2 + Math.round(k * 8);
    for (let i = 0; i < n; i++) {
        const t = .3 + i / n * .7, side = i % 2 ? 1 : -1;
        drawEllipse(o.add(vec2(sway * t + side * .11 * s, .36 * s * t)),
            vec2(.13 * s, .06 * s), C(i % 2 ? '#6fb84a' : '#5ea63c'), side * .5);
    }
    drawEllipse(o.add(vec2(sway + .04, .34 * s)), vec2(.05 * s, .025 * s), new Color(1, 1, 1, .25));
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
// спрайты некоторых культур (готовые PNG). Пока картинка не загрузилась — рисуем вектор.
const CROP_IMG = {};
for (const id of ['pumpkin', 'cabbage', 'melon', 'cuke']) { const im = new Image(); im.src = 'art/' + id + '.png'; CROP_IMG[id] = im; }
const cropImgReady = img => img && img.complete && img.naturalWidth > 0;
function drawCropImg(o, img, s) {
    const hW = 1.25 * s;                                          // высота спрайта, world-единицы
    const b = worldToScreen(o), up = worldToScreen(o.add(vec2(0, hW)));
    const h = b.y - up.y, w = h * (img.naturalWidth / img.naturalHeight);
    mainContext.imageSmoothingEnabled = true;
    mainContext.drawImage(img, b.x - w / 2, up.y, w, h);         // низ спрайта — в основании растения
}
// спрайт с наклоном, пивот — по ЦЕНТРУ (для лежащих плодов)
function drawImgRotC(o, img, hW, ang) {
    const b = worldToScreen(o), up = worldToScreen(o.add(vec2(0, hW)));
    const h = b.y - up.y, w = h * (img.naturalWidth / img.naturalHeight);
    const ctx = mainContext;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
}
// огурцы ЛЕЖАТ на грядке среди листвы; листья двумя слоями (часть под, часть над),
// огурцы низко — не выходят за землю грядки.
function drawCukeVine(o, s) {
    const img = CROP_IMG.cuke, sw = Math.sin(time * 1.5 + o.x * 2.2) * .03;
    const leaf = (dx, dy, rx, ry, ang, col) => drawEllipse(o.add(vec2(dx * s + sw, dy * s)), vec2(rx * s, ry * s), C(col), ang);
    const cuke = (dx, dy, ang, hW) => drawImgRotC(o.add(vec2(dx * s + sw, dy * s)), img, hW * s, ang);   // ~π/2 = лежит
    // нижний слой листвы (под огурцами)
    leaf(-.28, .12, .17, .1, .5, '#4f8f3f'); leaf(.28, .1, .17, .1, -.5, '#4f8f3f');
    leaf(0, .16, .2, .11, 0, '#5c9e48');     leaf(-.12, .2, .15, .09, .3, '#67ab52');
    // огурцы лежат, низко, в пределах грядки
    cuke(-.15, .12, 1.45, .4); cuke(.17, .16, 1.78, .38); cuke(.0, .09, 1.3, .36);
    // верхний слой листвы (поверх огурцов)
    leaf(.14, .22, .16, .1, -.4, '#67ab52'); leaf(-.2, .19, .15, .09, .5, '#5c9e48');
    leaf(.03, .24, .14, .085, .1, '#72b45a');
}
function drawCropArt(o, ci, s) {
    const c = CROPS[ci], top = C(c.top), body = C(c.hue);
    if (c.id === 'cuke' && cropImgReady(CROP_IMG.cuke)) { drawCukeVine(o, s); return; }  // куст огурцов
    const spr = CROP_IMG[c.id];
    if (cropImgReady(spr)) { drawCropImg(o, spr, s); return; }   // одиночный плод (тыква/капуста/арбуз)
    const wind = Math.sin(time * 1.5 + o.x * 2.2);   // лёгкий ветер — только для ботвы/стеблей
    switch (c.id) {
    case 'wheat': {                                  // высокие колосья качаются целиком
        const sw = wind * .06;
        for (let k = -2; k <= 2; k++) { const xx = k * .24, hgt = (.72 + Math.abs(k) * .05) * s, tip = xx + .05 + sw * hgt;
            drawLine(o.add(vec2(xx, .04)), o.add(vec2(tip, hgt)), .05, C('#cdb162'));
            drawEllipse(o.add(vec2(tip, hgt)), vec2(.1 * s, .2 * s), D(c.hue, .85));
            drawEllipse(o.add(vec2(tip - .02, hgt + .03)), vec2(.08 * s, .17 * s), body); }
        break; }
    case 'carrot': {                                 // корнеплод статичен, ботва качается
        const sw = wind * .08;
        for (let k = -1; k <= 1; k++) { const b = o.add(vec2(k * .34, 0));
            drawLine(b.add(vec2(0, .06)), b.add(vec2(-.13 + sw, .52 * s)), .05, top);
            drawLine(b.add(vec2(0, .06)), b.add(vec2(.12 + sw, .47 * s)), .05, D(c.top, .9));
            drawLine(b.add(vec2(0, .06)), b.add(vec2(-.01 + sw, .56 * s)), .05, top);
            drawEllipse(b.add(vec2(0, .09)), vec2(.16 * s, .15 * s), D(c.hue, .8));
            drawEllipse(b.add(vec2(-.02, .12)), vec2(.12 * s, .11 * s), body);
            drawEllipse(b.add(vec2(-.05, .15)), vec2(.045 * s, .03 * s), new Color(1, 1, 1, .45)); }
        break; }
    case 'potato': {                                 // клубни ПОД землёй — видно только ботву
        const sw = wind * .05;
        drawLine(o.add(vec2(-.04, .02)), o.add(vec2(-.12 + sw, .5 * s)), .045, C('#5f9e4a'));
        drawLine(o.add(vec2(.04, .02)), o.add(vec2(.14 + sw, .46 * s)), .045, C('#5f9e4a'));
        drawEllipse(o.add(vec2(sw, .32 * s)), vec2(.42 * s, .3 * s), C('#5f9e4a'));
        drawEllipse(o.add(vec2(-.22 + sw, .4 * s)), vec2(.2 * s, .16 * s), C('#72b25a'));
        drawEllipse(o.add(vec2(.22 + sw, .42 * s)), vec2(.2 * s, .16 * s), C('#72b25a'));
        drawEllipse(o.add(vec2(sw * .6, .5 * s)), vec2(.24 * s, .2 * s), C('#86c46b'));
        for (const [lx, ly, a] of [[-.38, .3, .5], [.38, .32, -.5], [-.16, .56, .3], [.18, .54, -.3]])
            drawEllipse(o.add(vec2(lx + sw, ly * s)), vec2(.13 * s, .07 * s), C('#5f9e4a'), a);
        for (const [fx, fy] of [[-.12, .48], [.15, .52]]) { const b = o.add(vec2(fx + sw, fy * s));  // цветки картофеля
            drawCircle(b, .04 * s, new Color(1, 1, 1, .9)); drawCircle(b, .018 * s, C('#f0c95e')); }
        break; }
    case 'cabbage': {                                // кочан с острыми внешними листьями, плотно прилегают
        // острые листья веером — рисуем ДО кочана, он перекроет их основания (= прилегают, не отдельно)
        const leaf = (a, len, col) => drawPoly([vec2(-.1 * s, 0), vec2(.1 * s, 0), vec2(0, len)], col, 0, undefined, o.add(vec2(0, .32 * s)), a);
        for (const [a, len] of [[-1.2, .46], [-.78, .54], [-.32, .48], [.32, .48], [.78, .54], [1.2, .46]]) {
            leaf(a, len * s, D(c.top, .82));
            leaf(a, len * .78 * s, C(c.top));        // светлая середина листа — деталь и жилка
        }
        // кочан из перекрывающихся долей
        blob(o, 0, .38 * s, .4 * s, .4 * s, c.hue);
        drawEllipse(o.add(vec2(-.18 * s, .38 * s)), vec2(.19 * s, .32 * s), D(c.hue, .86), .16);
        drawEllipse(o.add(vec2(.18 * s, .38 * s)), vec2(.19 * s, .32 * s), D(c.hue, .86), -.16);
        drawEllipse(o.add(vec2(0, .36 * s)), vec2(.18 * s, .34 * s), C(c.hue));
        // светлая свёрнутая сердцевина
        drawEllipse(o.add(vec2(0, .42 * s)), vec2(.11 * s, .16 * s), D(c.top, 1.06));
        drawEllipse(o.add(vec2(0, .5 * s)), vec2(.055 * s, .06 * s), D(c.top, 1.12));
        break; }
    case 'tomato': {                                 // куст с гроздью помидоров — качается
        const sw = wind * .06;
        // листва: несколько перекрывающихся эллипсов = объёмный куст (не отдельный кружок)
        drawEllipse(o.add(vec2(sw, .34 * s)), vec2(.5 * s, .4 * s), C('#4f9444'));
        drawEllipse(o.add(vec2(-.26 + sw, .5 * s)), vec2(.24 * s, .19 * s), C('#63a851'));
        drawEllipse(o.add(vec2(.24 + sw, .52 * s)), vec2(.24 * s, .19 * s), C('#63a851'));
        drawEllipse(o.add(vec2(sw, .64 * s)), vec2(.26 * s, .22 * s), C('#7cbd63'));
        for (const [lx, ly, a] of [[-.44, .34, .5], [.44, .36, -.5], [-.22, .68, .35], [.24, .66, -.35]])
            drawEllipse(o.add(vec2(lx + sw, ly * s)), vec2(.14 * s, .07 * s), C('#4f9444'), a);  // листики по краям
        // помидоры сидят В кусте: тело + блик + зелёный чашелистик-звёздочка сверху
        for (const [tx, ty, tr] of [[-.22, .22, .17], [.24, .3, .17], [.03, .12, .19], [-.03, .44, .15]]) {
            const b = o.add(vec2(tx + sw * .5, ty * s));
            drawCircle(b, tr * s, D(c.hue, .78));
            drawCircle(b.add(vec2(-.02 * s, .02 * s)), (tr - .022) * s, body);
            drawCircle(b.add(vec2(-.05 * s, -.05 * s)), tr * .3 * s, new Color(1, 1, 1, .5));
            drawPoly([vec2(-.06, 0), vec2(.06, 0), vec2(0, .11)], C('#4f9444'), 0, undefined, b.add(vec2(0, tr * s)));
        }
        break; }
    case 'cuke': {                                   // стелющийся куст, из которого торчат огурцы
        const sw = wind * .04;
        // низкая широкая листва у земли (стелется — не вертикальное «туловище»)
        drawEllipse(o.add(vec2(sw, .16 * s)), vec2(.58 * s, .22 * s), C('#4f8f3f'));
        drawEllipse(o.add(vec2(-.28 + sw, .24 * s)), vec2(.2 * s, .12 * s), C('#67ab52'), .25);
        drawEllipse(o.add(vec2(.26 + sw, .22 * s)), vec2(.2 * s, .12 * s), C('#67ab52'), -.25);
        drawLine(o.add(vec2(.44 + sw, .22 * s)), o.add(vec2(.56 + sw, .38 * s)), .022, C('#5f9e4a'));  // усик
        // огурцы: крупные, вытянутые, РАЗНОЙ длины и под разными углами (не симметрично),
        // с пупырышками и светлым брюшком — так читается именно огурец, а не человечек
        for (const [cx, cy, rot, ln] of [[-.02, .32, .95, .3], [.27, .4, -.4, .25], [-.3, .38, .38, .2]]) {
            const b = o.add(vec2(cx + sw * .4, cy * s));
            drawEllipse(b, vec2(.1 * s, ln * s), D(c.hue, .72), rot);
            drawEllipse(b.add(vec2(.02 * s, 0)), vec2(.078 * s, (ln - .03) * s), body, rot);
            drawEllipse(b.add(vec2(.03 * s, 0)), vec2(.026 * s, (ln - .09) * s), C('#8fce5f'), rot);  // брюшко
            for (const t of [-.55, -.2, .15, .5]) {                                                   // пупырышки вдоль
                const L = t * ln * s;
                drawCircle(b.add(vec2(-L * Math.sin(rot), L * Math.cos(rot))), .014 * s, D(c.hue, .6));
            }
        }
        break; }
    case 'corn': {                                   // высокий стебель качается целиком
        const sw = wind * .06;
        drawLine(o.add(vec2(0, .04)), o.add(vec2(sw, .95 * s)), .08, C('#6da057'));
        drawEllipse(o.add(vec2(-.2 + sw * .5, .5 * s)), vec2(.3 * s, .1 * s), C(c.top), .2);
        drawEllipse(o.add(vec2(.2 + sw * .7, .66 * s)), vec2(.3 * s, .1 * s), D(c.top, .9), -.2);
        drawEllipse(o.add(vec2(.12 + sw * .5, .42 * s)), vec2(.17 * s, .32 * s), D(c.hue, .85));
        drawEllipse(o.add(vec2(.1 + sw * .5, .44 * s)), vec2(.14 * s, .28 * s), body);
        drawEllipse(o.add(vec2(.05 + sw * .5, .52 * s)), vec2(.05 * s, .11 * s), new Color(1, 1, 1, .35));
        break; }
    case 'berry':                                    // низкий кустик с клубникой у земли
        drawEllipse(o.add(vec2(0, .32 * s)), vec2(.54 * s, .3 * s), C('#5fae52'));
        drawEllipse(o.add(vec2(-.24, .42 * s)), vec2(.17 * s, .15 * s), C('#6faf5a'));
        drawEllipse(o.add(vec2(.24, .42 * s)), vec2(.17 * s, .15 * s), C('#6faf5a'));
        for (const [xx, yy] of [[-.28, .14], [.28, .16], [.02, .26]]) { const b = o.add(vec2(xx, yy));
            drawEllipse(b, vec2(.14 * s, .16 * s), D(c.hue, .85));
            drawEllipse(b.add(vec2(-.02, .02)), vec2(.11 * s, .13 * s), body);
            drawCircle(b.add(vec2(-.04, .03)), .02, new Color(1, 1, .9, .7));
            drawCircle(b.add(vec2(.04, .07)), .02, new Color(1, 1, .9, .7));
            drawPoly([vec2(-.08, 0), vec2(.08, 0), vec2(0, -.11)], C(c.top), 0, undefined, b.add(vec2(0, .15 * s))); }
        break;
    case 'pumpkin': {                                // тыква: борозды строго на теле, силуэт — круглый шар
        blob(o, 0, .28 * s, .58 * s, .4 * s, c.hue);
        drawEllipse(o.add(vec2(0, .28 * s)), vec2(.24 * s, .37 * s), C('#f4b36a'));   // светлая центральная долька
        for (const gx of [-.3, -.12, .12, .3]) {                                      // борозды-рёбра (внутри силуэта)
            const hy = .4 * Math.sqrt(Math.max(0, 1 - (gx / .5) ** 2)) * .9;
            drawEllipse(o.add(vec2(gx * s, .28 * s)), vec2(.02 * s, hy * s), D(c.hue, .74));
        }
        drawEllipse(o.add(vec2(-.08, .34 * s)), vec2(.09 * s, .18 * s), new Color(1, 1, 1, .1));   // блик
        drawRect(o.add(vec2(.02, .64 * s)), vec2(.08, .12 * s), C('#6f8a4f'));                      // черенок
        break; }
    case 'melon': {                                  // арбуз: полосы на теле, силуэт — круглый шар
        blob(o, 0, .28 * s, .52 * s, .4 * s, '#63b45c');
        for (const dx of [-.26, -.13, 0, .13, .26]) {
            const hy = .4 * Math.sqrt(Math.max(0, 1 - (dx / .44) ** 2)) * .92;
            drawEllipse(o.add(vec2(dx * s, .28 * s)), vec2(.042 * s, hy * s), C('#2f6b3c'));
        }
        drawEllipse(o.add(vec2(-.14 * s, .4 * s)), vec2(.1 * s, .12 * s), new Color(1, 1, 1, .16));  // блик
        break; }
    case 'grape': {                                  // виноград: одревесневший стебель, лист и гроздь
        drawLine(o.add(vec2(.05, .12)), o.add(vec2(-.01, .78 * s)), .045, C('#7a5a3c'));   // стебель
        drawLine(o.add(vec2(-.01, .7 * s)), o.add(vec2(.16, .82 * s)), .03, C('#8a6749'));  // веточка к листу
        drawEllipse(o.add(vec2(.24, .84 * s)), vec2(.2 * s, .13 * s), C(c.top), -.3);        // лист
        for (const [ex, ey] of [[.12, .78], [.34, .9], [.28, .74]])
            drawLine(o.add(vec2(.24, .84 * s)), o.add(vec2(ex, ey * s)), .014, D(c.top, .78)); // жилки листа
        drawLine(o.add(vec2(-.01, .56 * s)), o.add(vec2(-.18, .64 * s)), .02, C('#8a6749'));  // усик
        for (const [xx, yy] of [[-.17, .5], [0, .52], [.17, .5], [-.09, .38], [.09, .38], [0, .26], [-.04, .14]]) {
            drawCircle(o.add(vec2(xx * s, yy * s)), .12 * s, D(c.hue, .78));
            drawCircle(o.add(vec2((xx - .03) * s, (yy + .03) * s)), .1 * s, C(c.hue));
            drawCircle(o.add(vec2((xx - .05) * s, (yy + .05) * s)), .028 * s, new Color(1, 1, 1, .4)); }
        break; }
    case 'pine':                                     // ананас с хохолком, низ в земле
        drawEllipse(o.add(vec2(0, .3 * s)), vec2(.3 * s, .4 * s), D(c.hue, .82));
        drawEllipse(o.add(vec2(-.02, .32 * s)), vec2(.26 * s, .36 * s), body);
        drawLine(o.add(vec2(-.18 * s, .2 * s)), o.add(vec2(.18 * s, .48 * s)), .03, C('#c89a2e'));
        drawLine(o.add(vec2(-.18 * s, .44 * s)), o.add(vec2(.18 * s, .22 * s)), .03, C('#c89a2e'));
        for (let k = -1; k <= 1; k++) drawPoly([vec2(-.07, 0), vec2(.07, 0), vec2(k * .12, .34 * s)], C(c.top), 0, undefined, o.add(vec2(k * .1, .66 * s)));
        break;
    }
}

// ---------- Животные (детализированные чиби) ----------
const animEnts = [];
function spawnIn(pd) {
    return { gx: pd.x0 + .2 + Math.random() * (pd.x1 - pd.x0 - .4),
             gy: pd.y0 + .2 + Math.random() * (pd.y1 - pd.y0 - .4) };
}
function syncAnimals() {
    const want = [];
    for (const a of ANIMALS) for (let k = 0; k < S.animals[a.id]; k++) want.push(a.id);
    while (animEnts.length > want.length) animEnts.pop();
    while (animEnts.length < want.length) {
        const id = want[animEnts.length], sp = spawnIn(PADDOCK[id]);
        animEnts.push({ id, gx: sp.gx, gy: sp.gy, dir: Math.random() < .5 ? 1 : -1, v: .25 + Math.random() * .3, ph: Math.random() * 9 });
    }
    for (let i = 0; i < want.length; i++)
        if (animEnts[i].id !== want[i]) { animEnts[i].id = want[i]; const sp = spawnIn(PADDOCK[want[i]]); animEnts[i].gx = sp.gx; animEnts[i].gy = sp.gy; }
}
function pushAnimals(push) {
    syncAnimals();
    for (const a of animEnts) {
        const pd = PADDOCK[a.id];
        a.gx += a.dir * a.v * timeDelta * .4;
        if (a.gx > pd.x1 - .2) { a.gx = pd.x1 - .2; a.dir = -1; }
        if (a.gx < pd.x0 + .2) { a.gx = pd.x0 + .2; a.dir = 1; }
        push(a.gx, a.gy, () => {
            const gp = isoWorld(a.gx, a.gy);
            const bob = Math.abs(Math.sin(time * 4 + a.ph)) * .05;
            drawEllipse(gp.add(vec2(0, -.02)), vec2(a.id === 'hen' ? .34 : .55, .15), SHADOW);
            const p = gp.add(vec2(0, bob));
            if (a.id === 'hen') drawHen(p, a.dir); else if (a.id === 'cow') drawCow(p, a.dir); else drawSheep(p, a.dir);
        });
    }
}
// чиби: большая голова, прижатая к телу, два глаза с бликами, румянец
function drawHen(p, dir) {
    drawLine(p.add(vec2(-.05, 0)), p.add(vec2(-.05, .12)), .035, C('#eda63f'));
    drawLine(p.add(vec2(.07, 0)), p.add(vec2(.07, .12)), .035, C('#eda63f'));
    // хвостик — прижат к телу
    drawEllipse(p.add(vec2(-.22 * dir, .32)), vec2(.14, .1), C('#e6dcc6'), dir * .5);
    drawEllipse(p.add(vec2(0, .26)), vec2(.28, .23), C('#f6efdf'));
    drawEllipse(p.add(vec2(-.08 * dir, .24)), vec2(.12, .08), C('#eee4cd'), -dir * .3);
    // голова — большая, глубоко сидит на теле
    drawCircle(p.add(vec2(.06 * dir, .46)), .24, C('#f6efdf'));
    for (let i = 0; i < 3; i++)
        drawCircle(p.add(vec2((-.02 + i * .08) * dir, .7 - Math.abs(i - 1) * .02)), .05, C('#e2725a'));
    drawPoly([vec2(-.04, .035), vec2(.09 * dir, -.01), vec2(-.04, -.05)], C('#eda63f'), 0, undefined, p.add(vec2(.28 * dir, .44)));
    drawCircle(p.add(vec2(.24 * dir, .34)), .04, C('#e2725a'));
    drawCircle(p.add(vec2(0, .5)), .045, C('#4a3b2e'));
    drawCircle(p.add(vec2(.17 * dir, .5)), .045, C('#4a3b2e'));
    drawCircle(p.add(vec2(.015 * dir, .515)), .016, C('#ffffff'));
    drawCircle(p.add(vec2(.185 * dir, .515)), .016, C('#ffffff'));
    drawCircle(p.add(vec2(-.09 * dir, .41)), .045, new Color(.95, .66, .6, .55));
    drawCircle(p.add(vec2(.25 * dir, .43)), .04, new Color(.95, .66, .6, .55));
}
function drawCow(p, dir) {
    // ноги — круглые «капсулы», прикреплены под телом. Вид сбоку: ближняя пара
    // выражена, дальняя темнее и выше (создаёт глубину), а не 4 квадрата в ряд.
    for (const ox of [.05, -.11]) {                    // дальняя пара (в глубине)
        drawLine(p.add(vec2(ox * dir, .27)), p.add(vec2(ox * dir, .1)), .1, C('#d3c4a8'));
        drawCircle(p.add(vec2(ox * dir, .1)), .053, C('#6f5d4a'));
    }
    for (const ox of [.2, -.26]) {                     // ближняя пара
        drawLine(p.add(vec2(ox * dir, .3)), p.add(vec2(ox * dir, .04)), .125, C('#efe6d2'));
        drawCircle(p.add(vec2(ox * dir, .3)), .062, C('#efe6d2'));   // округлый верх у тела
        drawCircle(p.add(vec2(ox * dir, .04)), .066, C('#8a7460'));  // округлое копыто
    }
    // хвостик — короткий, прижат к боку
    drawLine(p.add(vec2(-.46 * dir, .44)), p.add(vec2(-.56 * dir, .26)), .035, C('#ece2cd'));
    drawCircle(p.add(vec2(-.57 * dir, .24)), .045, C('#8a7460'));
    // тело — крупное, голова не перекрывает его целиком
    drawEllipse(p.add(vec2(-.06 * dir, .4)), vec2(.5, .32), C('#f5f0e4'));
    drawEllipse(p.add(vec2(-.28 * dir, .46)), vec2(.15, .11), C('#d9c9ae'), .3);
    drawEllipse(p.add(vec2(-.04 * dir, .24)), vec2(.12, .08), C('#d9c9ae'), -.2);
    // голова
    drawEllipse(p.add(vec2(.32 * dir, .56)), vec2(.26, .23), C('#f5f0e4'));
    // ушки — по бокам, горизонтальные
    drawEllipse(p.add(vec2(.1 * dir, .64)), vec2(.09, .055), C('#ece2cd'), .25 * dir);
    drawEllipse(p.add(vec2(.54 * dir, .64)), vec2(.09, .055), C('#ece2cd'), -.25 * dir);
    // рожки — маленькие круглые бугорки
    drawCircle(p.add(vec2(.22 * dir, .77)), .05, C('#d9c9a8'));
    drawCircle(p.add(vec2(.42 * dir, .77)), .05, C('#d9c9a8'));
    // морда
    drawEllipse(p.add(vec2(.36 * dir, .46)), vec2(.19, .12), C('#f3c1b4'));
    drawCircle(p.add(vec2(.29 * dir, .46)), .028, C('#d59685'));
    drawCircle(p.add(vec2(.43 * dir, .46)), .028, C('#d59685'));
    drawCircle(p.add(vec2(.22 * dir, .62)), .05, C('#4a3b2e'));
    drawCircle(p.add(vec2(.44 * dir, .62)), .05, C('#4a3b2e'));
    drawCircle(p.add(vec2(.237 * dir, .637)), .018, C('#ffffff'));
    drawCircle(p.add(vec2(.457 * dir, .637)), .018, C('#ffffff'));
    drawCircle(p.add(vec2(.14 * dir, .52)), .045, new Color(.95, .66, .6, .5));
    drawCircle(p.add(vec2(.52 * dir, .53)), .04, new Color(.95, .66, .6, .5));
}
function drawSheep(p, dir) {
    // ноги — круглые «капсулы» с копытцем, а не квадраты
    for (const ox of [.16, -.16]) {
        drawLine(p.add(vec2(ox, .2)), p.add(vec2(ox, .02)), .085, C('#c9b8a4'));
        drawCircle(p.add(vec2(ox, .02)), .05, C('#8a7460'));
    }
    for (const [x, y, r] of [[-.24, .32, .2], [.24, .32, .2], [0, .28, .22], [-.14, .46, .2], [.14, .46, .2], [0, .5, .2]])
        drawCircle(p.add(vec2(x, y)), r * 1.12, C('#f2ecdd'));
    drawCircle(p.add(vec2(0, .38)), .3, C('#faf6ea'));
    // мордочка — выдвинута из шерсти, хорошо видна
    drawEllipse(p.add(vec2(.28 * dir, .48)), vec2(.21, .18), C('#d9c2ad'));
    drawEllipse(p.add(vec2(.1 * dir, .58)), vec2(.09, .05), C('#c8ad94'), -.5 * dir);
    // чубчик
    drawCircle(p.add(vec2(.2 * dir, .66)), .11, C('#f2ecdd'));
    drawCircle(p.add(vec2(.33 * dir, .64)), .09, C('#faf6ea'));
    drawCircle(p.add(vec2(.2 * dir, .52)), .042, C('#4a3b2e'));
    drawCircle(p.add(vec2(.37 * dir, .52)), .042, C('#4a3b2e'));
    drawCircle(p.add(vec2(.214 * dir, .534)), .015, C('#ffffff'));
    drawCircle(p.add(vec2(.384 * dir, .534)), .015, C('#ffffff'));
    drawEllipse(p.add(vec2(.28 * dir, .43)), vec2(.035, .025), C('#b09272'));
    drawCircle(p.add(vec2(.13 * dir, .44)), .04, new Color(.95, .66, .6, .5));
    drawCircle(p.add(vec2(.43 * dir, .45)), .035, new Color(.95, .66, .6, .5));
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
// минималистичный «мипл»: единый силуэт, всё прижато друг к другу
function drawWorker(e, id) {
    const bob = Math.abs(Math.sin(time * 6 + e.ph)) * .05;
    const p = e.p.add(vec2(0, bob));
    const shirt = id === 'harv' ? '#e29070' : '#7fa3c9';
    drawEllipse(e.p.add(vec2(0, -.02)), vec2(.3, .1), SHADOW);
    // ручки — за корпусом, прижаты к бокам
    drawEllipse(p.add(vec2(-.23, .28)), vec2(.08, .14), D(shirt, .85), .4);
    drawEllipse(p.add(vec2(.23, .28)), vec2(.08, .14), D(shirt, .85), -.4);
    // инструмент — прижат к ручке
    if (id === 'harv') { drawEllipse(p.add(vec2(.3, .22)), vec2(.14, .1), C('#c9a578')); drawEllipse(p.add(vec2(.3, .26)), vec2(.11, .05), C('#8a6749')); }
    else { drawEllipse(p.add(vec2(-.3, .22)), vec2(.11, .15), C('#d9c8a8')); drawEllipse(p.add(vec2(-.3, .3)), vec2(.08, .04), C('#b8a37c')); }
    // корпус-капелька
    drawEllipse(p.add(vec2(0, .3)), vec2(.26, .32), C(shirt));
    // голова — глубоко сидит на корпусе
    drawCircle(p.add(vec2(0, .62)), .25, C('#f6d7b2'));
    // шляпа
    drawEllipse(p.add(vec2(0, .76)), vec2(.33, .1), C('#e2c878'));
    drawEllipse(p.add(vec2(0, .82)), vec2(.18, .11), C('#eed88f'));
    // лицо
    drawCircle(p.add(vec2(-.08, .62)), .032, C('#4a3b2e'));
    drawCircle(p.add(vec2(.08, .62)), .032, C('#4a3b2e'));
    drawCircle(p.add(vec2(-.15, .55)), .045, new Color(.95, .66, .6, .55));
    drawCircle(p.add(vec2(.15, .55)), .045, new Color(.95, .66, .6, .55));
}
function drawTractor() {
    if (!S.workers.tract || tractorT < 0 || tractorT > 3) return;
    tractorT += timeDelta;
    const prog = tractorT / 3;
    const gy = tractorRow * 1 + 0.5;
    const gx = -3 + prog * 6;
    const p = isoWorld(gx, gy).add(vec2(0, .1));
    drawEllipse(p.add(vec2(0, -.05)), vec2(.98, .16), SHADOW);
    // заднее большое колесо: шина, обод, диск, ступица, болты
    drawCircle(p.add(vec2(-.52, .2)), .42, C('#4b4239'));
    drawCircle(p.add(vec2(-.52, .2)), .34, C('#5c5346'));
    drawCircle(p.add(vec2(-.52, .2)), .21, C('#e7d6b8'));
    drawCircle(p.add(vec2(-.52, .2)), .075, C('#b8a37c'));
    for (let i = 0; i < 6; i++) {
        const an = i / 6 * 6.283;
        drawCircle(p.add(vec2(-.52 + Math.cos(an) * .13, .2 + Math.sin(an) * .13)), .022, C('#b8a37c'));
    }
    // переднее малое колесо
    drawCircle(p.add(vec2(.66, .12)), .24, C('#4b4239'));
    drawCircle(p.add(vec2(.66, .12)), .12, C('#e7d6b8'));
    drawCircle(p.add(vec2(.66, .12)), .045, C('#b8a37c'));
    // рама
    drawRect(p.add(vec2(.08, .32)), vec2(1.34, .16), C('#7a4436'));
    // корпус и капот
    drawRect(p.add(vec2(.02, .56)), vec2(1.32, .5), C('#c96a54'));
    drawRect(p.add(vec2(.02, .6)),  vec2(1.24, .4), C('#d97b64'));
    drawRect(p.add(vec2(.58, .48)), vec2(.42, .34), C('#c96a54'));   // «нос» ниже
    // решётка радиатора + фара
    drawRect(p.add(vec2(.79, .46)), vec2(.09, .3), C('#5a3228'));
    for (let i = 0; i < 3; i++) drawLine(p.add(vec2(.73, .37 + i * .1)), p.add(vec2(.85, .37 + i * .1)), .02, C('#8a5a3c'));
    drawCircle(p.add(vec2(.74, .64)), .06, C('#f6e08a'));
    drawCircle(p.add(vec2(.74, .64)), .03, C('#fff4c2'));
    // крыло над задним колесом
    drawRect(p.add(vec2(-.5, .58)), vec2(.66, .12), C('#a4503c'));
    // кабина: рама, стекло, крыша
    drawRect(p.add(vec2(-.34, .98)), vec2(.66, .56), C('#b85c48'));
    drawRect(p.add(vec2(-.34, 1.02)), vec2(.5, .42), C('#bfe0ea'));
    drawLine(p.add(vec2(-.34, .82)), p.add(vec2(-.34, 1.24)), .03, C('#9ec4d0'));
    drawRect(p.add(vec2(-.34, 1.32)), vec2(.8, .11), C('#8a4032'));
    // выхлопная труба + дымок
    drawRect(p.add(vec2(.42, 1.04)), vec2(.08, .52), C('#6b5748'));
    drawCircle(p.add(vec2(.42, 1.3)), .07, C('#5a4a3c'));
    if (Math.random() < .3) pops.push({ p: p.add(vec2(.42, 1.42)), v: vec2(.15, .9), col: '#d9d4c8', t: .8, r: .1 });
}

// ---------- Табличка зоны ----------
function drawZoneSign(z) {
    const zone = ZONES[z], base = zoneSignPos(z), y0 = base.y, can = S.coins >= zone.unlock;
    const p = vec2(base.x, y0 + .8);                 // компактная табличка, не мозолит глаза
    drawEllipse(vec2(base.x, y0 + .1), vec2(1, .2), SHADOW);
    drawRect(p.add(vec2(0, -.32)), vec2(.14, .64), C('#a9835c'));
    drawRect(p, vec2(3.0, .92), C('#b08a5e'));
    drawRect(p.add(vec2(0, .05)), vec2(2.9, .82), C('#cca87a'));
    drawRect(p.add(vec2(0, .38)), vec2(2.9, .08), C('#dbbb8e'));
    const lp = p.add(vec2(-1.12, .16));
    drawCircle(lp.add(vec2(0, .1)), .2, new Color(0, 0, 0, 0), .05, C('#8a6749'));
    drawRect(lp, vec2(.27, .23), C('#8a6749'));
    drawCircle(lp.add(vec2(0, .01)), .06, C('#cca87a'));
    drawText(zone.name, p.add(vec2(.24, .2)), .34, C(INKT));
    drawCoin(p.add(vec2(-.5 - fmt(zone.unlock).length * .09, -.24)), .22);
    drawText(fmt(zone.unlock), p.add(vec2(.18, -.21)), .3, can ? C('#4e7e3e') : C('#b0604a'));
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
