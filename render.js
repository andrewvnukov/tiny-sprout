'use strict';
// ============================================================
// render.js — процедурный мир: луг, грядки, растения, техника
// Стиль: плоские заливки + чернильные контуры (Мур-Луг)
// ============================================================

const _hexCache = {};
function C(hex) { return _hexCache[hex] || (_hexCache[hex] = new Color().setHex(hex)); }
const LW = .06;   // толщина контура

// ---------- Декор (генерится один раз) ----------
let decor = null;
function initWorldDecor() {
    const R = (a,b) => a + Math.random()*(b-a);
    decor = {
        clouds: Array.from({length:5}, () => ({ x:R(-14,14), y:R(16.4,20), s:R(.8,1.6), v:R(.05,.14) })),
        trees:  Array.from({length:7}, () => ({ x:R(-13,13), y:R(15.3,16.1), s:R(.7,1.3) })),
        flowers:Array.from({length:26}, () => ({ x:R(-6.4,6.4), y:R(-.6,13.2), s:R(.1,.16), h:['#e86a8a','#f0c93e','#f8f4ea','#8f5fb8'][Math.floor(R(0,4))] })),
        grass:  Array.from({length:40}, () => ({ x:R(-6.5,6.5), y:R(-.8,13.4), s:R(.12,.24) })),
        btf:    Array.from({length:4}, () => ({ x:R(-5,5), y:R(2,12), p:R(0,9) })),
    };
    // разбрасываем цветы/траву мимо грядок
    decor.flowers = decor.flowers.filter(f => !overPlots(f.x, f.y));
    decor.grass   = decor.grass.filter(g => !overPlots(g.x, g.y));
}
function overPlots(x, y) {
    for (let i = 0; i < MAXPLOTS; i++) {
        const p = plotPos(i);
        if (Math.abs(x-p.x) < PLOT_W/2+.3 && Math.abs(y-p.y) < PLOT_H/2+.5) return true;
    }
    return false;
}

// ---------- Эффекты ----------
const floats = [];   // {p, txt, col, t}
const pops = [];     // {p, v, col, t, r}
let tractorX = -99, tractorRow = 0;
let prestigeT = 0;

function addFloat(p, txt, col) { floats.push({ p:p.copy(), txt, col, t:1.2 }); }
function fxHarvest(i, ci, golden) {
    const p = plotPos(i);
    const c = CROPS[ci];
    addFloat(p.add(vec2(0,.8)), golden ? '+5 ✨' : '+1', golden ? '#f0c93e' : '#fff');
    for (let k = 0; k < (golden?10:5); k++)
        pops.push({ p:p.add(vec2(0,.3)), v:vec2((Math.random()-.5)*3, Math.random()*3+1),
                    col: golden ? '#f0c93e' : c.hue, t:.7, r:.09+Math.random()*.08 });
}
function fxTap(i) {
    const p = plotPos(i);
    pops.push({ p:p.add(vec2((Math.random()-.5)*.8,.4)), v:vec2(0,1.6), col:'#b8e08a', t:.5, r:.08 });
}
function fxTractor() { tractorX = -9; tractorRow = Math.floor(Math.random()*S.plots.length/4) || 0; }
function fxPrestige() {
    prestigeT = 2;
    for (let k = 0; k < 60; k++)
        pops.push({ p:vec2((Math.random()-.5)*12, 6+Math.random()*8), v:vec2((Math.random()-.5)*4, Math.random()*4),
                    col:['#f0c93e','#e86a8a','#8fce5f','#8f5fb8'][k%4], t:1.5+Math.random(), r:.1+Math.random()*.1 });
}

// ---------- Мир ----------
function renderWorld() {
    const tl = screenToWorld(vec2(0,0)), br = screenToWorld(mainCanvasSize);
    const L = tl.x, Rt = br.x, T = tl.y, B = br.y;
    const mid = (L+Rt)/2, w = Rt-L;

    // небо
    drawRect(vec2(mid, (T+HORIZON)/2), vec2(w+2, T-HORIZON+2), C('#aee3f5'));
    drawRect(vec2(mid, HORIZON+.9), vec2(w+2, 1.8), C('#cceefa'));
    // солнце
    drawCircle(vec2(Rt-2.2, T-1.8), 1.5, C('#f8e27a'), LW, C('#e8c95a'));
    // облака
    for (const c of decor.clouds) {
        c.x += c.v * timeDelta;
        if (c.x > Rt+3) c.x = L-3;
        const p = vec2(c.x, c.y);
        drawEllipse(p, vec2(1.6*c.s,.6*c.s), C('#ffffff'));
        drawEllipse(p.add(vec2(.8*c.s,.18*c.s)), vec2(1.1*c.s,.45*c.s), C('#ffffff'));
        drawEllipse(p.add(vec2(-.8*c.s,.14*c.s)), vec2(1*c.s,.4*c.s), C('#ffffff'));
    }
    // дальние холмы
    drawEllipse(vec2(mid-4, HORIZON-.2), vec2(w*.7, 2.2), C('#8fbf6a'));
    drawEllipse(vec2(mid+5, HORIZON-.4), vec2(w*.6, 1.8), C('#7fb35c'));
    // ёлки на холмах
    for (const t of decor.trees) {
        if (t.x < L-1 || t.x > Rt+1) continue;
        const p = vec2(t.x, t.y), s = t.s;
        drawRect(p.add(vec2(0,-.25*s)), vec2(.16*s,.3*s), C('#8a6a48'), 0);
        drawPoly([vec2(-.4*s,0), vec2(.4*s,0), vec2(0,.85*s)], C('#4e8e46'), LW, INKC, p);
        drawPoly([vec2(-.3*s,.4*s), vec2(.3*s,.4*s), vec2(0,1.05*s)], C('#5f9e52'), LW, INKC, p);
    }
    // луг
    drawRect(vec2(mid, (B+HORIZON)/2), vec2(w+2, HORIZON-B+2), C('#9ccf6e'));
    // полосы зон
    drawRect(vec2(mid, 3), vec2(w+2, 4.6), C('#a3d476'));
    drawRect(vec2(mid, 11), vec2(w+2, 4.4), C('#98cb6b'));
    drawFarmhouse();

    // трава и цветы
    for (const g of decor.grass) {
        const p = vec2(g.x, g.y);
        drawLine(p, p.add(vec2(-.06, g.s)), .04, C('#7fb35c'));
        drawLine(p, p.add(vec2(.07, g.s*.8)), .04, C('#7fb35c'));
    }
    for (const f of decor.flowers) {
        const p = vec2(f.x, f.y);
        drawLine(p, p.add(vec2(0,.16)), .04, C('#6faf5a'));
        drawCircle(p.add(vec2(0,.2)), f.s*2, C(f.h), .03, INKC);
        drawCircle(p.add(vec2(0,.2)), f.s*.8, C('#f8e27a'));
    }

    drawPaddock(L, Rt);
    drawZones();
    drawPlots();
    drawWorkers();
    drawTractor();
    drawParticles();
}

// ---------- Загон с животными ----------
const animEnts = [];
function syncAnimals() {
    const want = [];
    for (const a of ANIMALS)
        for (let k = 0; k < S.animals[a.id]; k++) want.push(a.id);
    while (animEnts.length > want.length) animEnts.pop();
    while (animEnts.length < want.length) {
        const id = want[animEnts.length];
        animEnts.push({ id, x:(Math.random()-.5)*9, dir:Math.random()<.5?1:-1, v:.3+Math.random()*.3, ph:Math.random()*9 });
    }
    for (let i = 0; i < want.length; i++) animEnts[i].id = want[i];
}
// домик и амбар у горизонта — уют и заполнение композиции
function drawFarmhouse() {
    // домик слева
    let p = vec2(-4.6, HORIZON-.75);
    drawRect(p, vec2(1.9, 1.2), C('#f0dfc0'), 0);
    drawRect(p, vec2(1.9, 1.2), new Color(0,0,0,0), LW, INKC);
    drawPoly([vec2(-1.15,.6), vec2(1.15,.6), vec2(0,1.5)], C('#c86a4a'), LW, INKC, p);
    drawRect(p.add(vec2(.45,-.25)), vec2(.5,.7), C('#8a6242'), .05, INKC);       // дверь
    drawRect(p.add(vec2(-.45,.1)), vec2(.5,.44), C('#aee3f5'), .05, INKC);       // окно
    drawRect(p.add(vec2(.55,1.35)), vec2(.24,.55), C('#b06a4a'), .04, INKC);     // труба
    // амбар справа
    p = vec2(4.7, HORIZON-.7);
    drawRect(p, vec2(2.1, 1.3), C('#d86a52'), 0);
    drawRect(p, vec2(2.1, 1.3), new Color(0,0,0,0), LW, INKC);
    drawPoly([vec2(-1.25,.65), vec2(1.25,.65), vec2(.8,1.3), vec2(-.8,1.3)], C('#b85a44'), LW, INKC, p);
    drawRect(p.add(vec2(0,-.15)), vec2(.8,1), C('#a84a3a'), .05, INKC);
    drawLine(p.add(vec2(-.4,-.63)), p.add(vec2(.4,.33)), .05, C('#f0dfc0'));
    drawLine(p.add(vec2(-.4,.33)), p.add(vec2(.4,-.63)), .05, C('#f0dfc0'));
}

function drawPaddock(L, Rt) {
    syncAnimals();
    const y = 14;
    if (animEnts.length) {
        // изгородь
        for (let x = -5.5; x <= 5.5; x += 1.4) {
            drawRect(vec2(x, y+.25), vec2(.1, .7), C('#b8906a'), 0);
        }
        drawRect(vec2(0, y+.42), vec2(11.2, .08), C('#a8805a'), 0);
        drawRect(vec2(0, y+.12), vec2(11.2, .08), C('#a8805a'), 0);
    }
    for (const a of animEnts) {
        a.x += a.dir * a.v * timeDelta;
        if (a.x > 5) a.dir = -1;
        if (a.x < -5) a.dir = 1;
        const bob = Math.abs(Math.sin(time*4 + a.ph)) * .06;
        const p = vec2(a.x, y - .28 + bob);
        if (a.id === 'hen') {
            drawEllipse(p, vec2(.34,.26), C('#f5ead0'), LW, INKC);
            drawCircle(p.add(vec2(.22*a.dir,.16)), .22, C('#f5ead0'), LW, INKC);
            drawPoly([vec2(0,0), vec2(.12*a.dir,.04), vec2(0,.08)], C('#e8923a'), .03, INKC, p.add(vec2(.32*a.dir,.14)));
            drawCircle(p.add(vec2(.24*a.dir,.28)), .07, C('#e2503a'), .02, INKC);
            drawCircle(p.add(vec2(.26*a.dir,.18)), .035, INKC);
        } else if (a.id === 'cow') {
            drawEllipse(p.add(vec2(0,.1)), vec2(.62,.4), C('#f8f4ea'), LW, INKC);
            drawEllipse(p.add(vec2(-.14,.16)), vec2(.2,.13), C('#4a3628'));
            drawEllipse(p.add(vec2(.2,.02)), vec2(.14,.1), C('#4a3628'));
            drawCircle(p.add(vec2(.5*a.dir,.3)), .26, C('#f8f4ea'), LW, INKC);
            drawEllipse(p.add(vec2(.56*a.dir,.22)), vec2(.14,.09), C('#e8b8a0'), .03, INKC);
            drawCircle(p.add(vec2(.52*a.dir,.38)), .04, INKC);
        } else {
            drawCircle(p.add(vec2(0,.12)), .5, C('#ece6d8'), LW, INKC);
            drawCircle(p.add(vec2(.22,.3)), .3, C('#ece6d8'), LW, INKC);
            drawCircle(p.add(vec2(-.22,.28)), .3, C('#ece6d8'), LW, INKC);
            drawCircle(p.add(vec2(.34*a.dir,.1)), .17, C('#6a5644'), .04, INKC);
            drawCircle(p.add(vec2(.38*a.dir,.14)), .03, C('#f8f4ea'));
        }
    }
}

// ---------- Зоны ----------
function drawZones() {
    // изгородь между полем и огородом — когда огород уже открыт
    if (S.zones >= 2) {
        const y = 5;
        for (let x = -6; x <= 6; x += 1.5) drawRect(vec2(x,y), vec2(.09,.55), C('#b8906a'), 0);
        drawRect(vec2(0,y+.14), vec2(12.2,.07), C('#a8805a'), 0);
    }
    // теплица: стеклянная рамка вокруг 3-й зоны
    if (S.zones >= 3) {
        const cy = ZONE_Y[2] + .95;
        drawRect(vec2(0, cy), vec2(13, 3.8), new Color(.75,.92,1,.16));
        drawRect(vec2(-6.4, cy), vec2(.14, 3.8), C('#88b8c8'), 0);
        drawRect(vec2(6.4, cy), vec2(.14, 3.8), C('#88b8c8'), 0);
        drawRect(vec2(0, cy+1.9), vec2(13, .14), C('#88b8c8'), 0);
        drawRect(vec2(0, cy-1.9), vec2(13, .14), C('#88b8c8'), 0);
        for (let x = -4.8; x <= 4.8; x += 2.4) drawRect(vec2(x, cy), vec2(.1, 3.8), C('#9cc8d8'), 0);
    }
    // табличка закрытой зоны
    if (S.zones < ZONES.length) {
        const z = ZONES[S.zones];
        const y = ZONE_Y[S.zones] + 1;
        drawRect(vec2(0, y-.5), vec2(.18, 1), C('#a8805a'), 0);
        drawRect(vec2(0, y), vec2(4.6, 1.3), C('#c8a06a'), 0);
        drawRect(vec2(0, y), vec2(4.6, 1.3), new Color(0,0,0,0), LW, INKC);
        drawText('🔒 ' + z.name, vec2(0, y+.22), .5, C('#4a3628'));
        drawText(fmt(z.unlock) + ' 🪙', vec2(0, y-.28), .42, S.coins >= z.unlock ? C('#2a7a2a') : C('#a04030'));
    }
}

// ---------- Грядки и растения ----------
function drawPlots() {
    for (let i = 0; i < S.plots.length; i++) {
        const pos = plotPos(i), p = S.plots[i];
        drawBed(pos);
        if (p.c >= 0) drawCrop(pos, p);
    }
    // призрачная грядка «+»
    const owned = S.plots.length;
    const maxNow = ZONES.slice(0, S.zones).reduce((s,z)=>s+z.plots, 0);
    if (owned < maxNow) {
        const pos = plotPos(owned);
        const cost = plotCost(owned-1);
        const can = S.coins >= cost;
        drawRect(pos, vec2(PLOT_W, PLOT_H), new Color(.55,.4,.25,.25));
        drawRect(pos, vec2(PLOT_W, PLOT_H), new Color(0,0,0,0), .05, new Color(.29,.21,.16,.6));
        drawText('+', pos.add(vec2(0,.16)), .8, new Color(.29,.21,.16,.75));
        drawText(fmt(cost), pos.add(vec2(0,-.42)), .38, can ? C('#2a7a2a') : C('#a04030'));
    }
}
function drawBed(pos) {
    drawRect(pos.add(vec2(.06,-.08)), vec2(PLOT_W, PLOT_H), new Color(.2,.14,.1,.25));   // тень
    drawRect(pos, vec2(PLOT_W, PLOT_H), C('#8a6244'), 0);
    drawRect(pos, vec2(PLOT_W, PLOT_H), new Color(0,0,0,0), LW, INKC);
    for (let r = -1; r <= 1; r++)
        drawRect(pos.add(vec2(0, r*.42)), vec2(PLOT_W-.3, .1), C('#7a5438'), 0);
}
function drawCrop(pos, p) {
    const c = CROPS[p.c];
    const gt = cropGrow(c);
    const k = Math.min(1, p.t / gt);
    const ready = k >= 1;
    const bob = ready ? Math.sin(time*3 + pos.x) * .05 : 0;
    const o = pos.add(vec2(0, .1 + bob));
    if (k < .3) {           // росток
        const s = .3 + k;
        drawLine(o, o.add(vec2(0,.3*s)), .05, C('#5fae52'));
        drawEllipse(o.add(vec2(-.09,.3*s)), vec2(.12*s,.07*s), C('#7fbf4d'), .03, INKC);
        drawEllipse(o.add(vec2(.09,.3*s)), vec2(.12*s,.07*s), C('#7fbf4d'), .03, INKC);
    } else {
        drawCropArt(o, p.c, .45 + .55*k);
    }
    if (p.g && k > .3) {    // золотое сияние
        const tw = .5 + Math.sin(time*5 + pos.x*2)*.5;
        drawCircle(o.add(vec2(.7,.75)), .09 + .05*tw, C('#f8e27a'), .02, C('#e8c95a'));
        drawCircle(o.add(vec2(-.75,.5)), .07 + .04*(1-tw), C('#f8e27a'), .02, C('#e8c95a'));
    }
    if (!ready) {           // полоска роста
        drawRect(pos.add(vec2(0,-.62)), vec2(1.5,.14), new Color(0,0,0,.25));
        drawRect(pos.add(vec2(-(1.5-1.5*k)/2, -.62)), vec2(1.5*k,.14), C('#8fce5f'));
    } else {
        const t = .9 + Math.sin(time*4)*.12;
        drawText('!', pos.add(vec2(.95,.72)), .55*t, C('#f0c93e'), .05, INKC);
    }
}
// отрисовка культуры по виду, s — масштаб 0..1
function drawCropArt(o, ci, s) {
    const c = CROPS[ci];
    const top = C(c.top), body = C(c.hue);
    switch (c.id) {
    case 'wheat':
        for (let k = -2; k <= 2; k++) {
            const x = k*.28, h = (.7 + Math.abs(k)*.06)*s;
            drawLine(o.add(vec2(x,0)), o.add(vec2(x+.06, h)), .05, C('#d8b84e'));
            drawEllipse(o.add(vec2(x+.06, h)), vec2(.1*s,.2*s), body, .03, INKC);
        }
        break;
    case 'carrot':
        for (let k = -1; k <= 1; k++) {
            drawPoly([vec2(-.14,0), vec2(.14,0), vec2(0,-.42*s)], body, .04, INKC, o.add(vec2(k*.6, .18)));
            drawLine(o.add(vec2(k*.6,.16)), o.add(vec2(k*.6-.08,.44*s+.14)), .05, top);
            drawLine(o.add(vec2(k*.6,.16)), o.add(vec2(k*.6+.09,.4*s+.14)), .05, top);
        }
        break;
    case 'potato':
        drawEllipse(o.add(vec2(0,.3*s)), vec2(.8*s,.4*s), top, LW, INKC);
        drawEllipse(o.add(vec2(-.4,.06)), vec2(.2*s,.14*s), body, .04, INKC);
        drawEllipse(o.add(vec2(.36,.04)), vec2(.22*s,.15*s), body, .04, INKC);
        break;
    case 'cabbage':
        drawCircle(o.add(vec2(0,.3*s)), .46*s, body, LW, INKC);
        drawEllipse(o.add(vec2(-.3*s,.3*s)), vec2(.2*s,.34*s), top, .04, INKC);
        drawEllipse(o.add(vec2(.3*s,.3*s)), vec2(.2*s,.34*s), top, .04, INKC);
        break;
    case 'tomato':
        drawEllipse(o.add(vec2(0,.34*s)), vec2(.6*s,.5*s), top, LW, INKC);
        drawCircle(o.add(vec2(-.26,.3*s)), .15*s, body, .04, INKC);
        drawCircle(o.add(vec2(.24,.44*s)), .15*s, body, .04, INKC);
        drawCircle(o.add(vec2(.02,.16)), .14*s, body, .04, INKC);
        break;
    case 'cuke':
        drawEllipse(o.add(vec2(0,.3*s)), vec2(.62*s,.42*s), top, LW, INKC);
        drawEllipse(o.add(vec2(-.3,.14)), vec2(.3*s,.12*s), body, .04, INKC);
        drawEllipse(o.add(vec2(.32,.2)), vec2(.28*s,.11*s), body, .04, INKC);
        break;
    case 'corn':
        drawLine(o, o.add(vec2(0,.95*s)), .07, C('#5fae52'));
        drawEllipse(o.add(vec2(-.2,.45*s)), vec2(.3*s,.1*s), top, .03, INKC);
        drawEllipse(o.add(vec2(.2,.62*s)), vec2(.3*s,.1*s), top, .03, INKC);
        drawEllipse(o.add(vec2(.12,.34*s)), vec2(.16*s,.32*s), body, .05, INKC);
        break;
    case 'berry':
        drawEllipse(o.add(vec2(0,.24*s)), vec2(.66*s,.34*s), top, LW, INKC);
        for (const [x,y] of [[-.34,.1],[.3,.14],[0,.34*s]])
            drawPoly([vec2(-.11,.08), vec2(.11,.08), vec2(0,-.16)], body, .04, INKC, o.add(vec2(x,y).scale(1)));
        break;
    case 'pumpkin':
        drawEllipse(o.add(vec2(0,.3*s)), vec2(.6*s,.44*s), body, LW, INKC);
        drawEllipse(o.add(vec2(0,.3*s)), vec2(.3*s,.44*s), C('#f0a45a'), .04, INKC);
        drawRect(o.add(vec2(0,.76*s)), vec2(.1,.16*s), C('#6a8a3a'), 0);
        break;
    case 'melon':
        drawCircle(o.add(vec2(0,.34*s)), .5*s, body, LW, INKC);
        for (let k = -1; k <= 1; k++)
            drawEllipse(o.add(vec2(k*.26*s,.34*s)), vec2(.09*s,.46*s), C('#2e6e3e'));
        break;
    case 'grape':
        drawRect(o.add(vec2(0,.44*s)), vec2(.9*s,.07), C('#a8805a'), 0);
        drawRect(o.add(vec2(-.42*s,.24*s)), vec2(.07,.5*s), C('#a8805a'), 0);
        drawRect(o.add(vec2(.42*s,.24*s)), vec2(.07,.5*s), C('#a8805a'), 0);
        for (const [x,y] of [[0,.1],[-.15,.26],[.15,.26],[0,.4]])
            drawCircle(o.add(vec2(x*s, y*s)), .14*s, body, .035, INKC);
        drawEllipse(o.add(vec2(.2*s,.58*s)), vec2(.16*s,.09*s), top, .03, INKC);
        break;
    case 'pine':
        drawEllipse(o.add(vec2(0,.34*s)), vec2(.3*s,.42*s), body, LW, INKC);
        drawLine(o.add(vec2(-.2*s,.2*s)), o.add(vec2(.2*s,.5*s)), .03, C('#c89a2e'));
        drawLine(o.add(vec2(-.2*s,.44*s)), o.add(vec2(.2*s,.22*s)), .03, C('#c89a2e'));
        for (let k = -1; k <= 1; k++)
            drawPoly([vec2(-.07,0), vec2(.07,0), vec2(k*.12,.34*s)], top, .03, INKC, o.add(vec2(k*.1,.72*s)));
        break;
    }
}

// ---------- Работники ----------
const workerEnts = { harv:null, sow:null };
function drawWorkers() {
    for (const id of ['harv','sow']) {
        if (!S.workers[id]) { workerEnts[id] = null; continue; }
        let e = workerEnts[id];
        if (!e) e = workerEnts[id] = { x: id==='harv'?-5.8:5.8, y: 2, tx: 0, ty: 2, ph: Math.random()*9 };
        // бродит между рядами грядок
        if (Math.abs(e.x-e.tx) < .2 && Math.abs(e.y-e.ty) < .2) {
            const i = Math.floor(Math.random()*S.plots.length);
            const p = plotPos(i);
            e.tx = p.x + (Math.random()<.5?-1.7:1.7);
            e.ty = p.y - .4;
        }
        const sp = 1.1 * timeDelta;
        e.x += Math.sign(e.tx-e.x) * Math.min(sp, Math.abs(e.tx-e.x));
        e.y += Math.sign(e.ty-e.y) * Math.min(sp, Math.abs(e.ty-e.y));
        const bob = Math.abs(Math.sin(time*6+e.ph))*.07;
        const p = vec2(e.x, e.y+bob);
        const shirt = id === 'harv' ? C('#e2825a') : C('#5a8ac2');
        drawEllipse(p.add(vec2(0,-.02)), vec2(.3,.09), new Color(.2,.14,.1,.25));
        drawEllipse(p.add(vec2(0,.3)), vec2(.26,.34), shirt, LW, INKC);        // тело
        drawCircle(p.add(vec2(0,.78)), .22, C('#f0c8a0'), LW, INKC);           // голова
        drawEllipse(p.add(vec2(0,.92)), vec2(.3,.1), C('#e8c95a'), .04, INKC); // шляпа
        drawEllipse(p.add(vec2(0,.98)), vec2(.16,.12), C('#e8c95a'), .04, INKC);
        drawCircle(p.add(vec2(-.07,.78)), .025, INKC);
        drawCircle(p.add(vec2(.07,.78)), .025, INKC);
        if (id === 'harv') drawEllipse(p.add(vec2(.3,.26)), vec2(.14,.1), C('#c8a06a'), .04, INKC);  // корзинка
        else drawEllipse(p.add(vec2(-.3,.26)), vec2(.12,.16), C('#c8b090'), .04, INKC);              // мешок семян
    }
}
function drawTractor() {
    if (!S.workers.tract && tractorX < -50) return;
    if (tractorX > -50 && tractorX < 12) {
        tractorX += 4.5 * timeDelta;
        const y = ZONE_Y[Math.min(tractorRow, 2)] + .2;
        const p = vec2(tractorX, y);
        drawEllipse(p.add(vec2(0,-.05)), vec2(.9,.14), new Color(.2,.14,.1,.25));
        drawRect(p.add(vec2(-.1,.5)), vec2(1.2,.55), C('#e2503a'), 0);
        drawRect(p.add(vec2(-.1,.5)), vec2(1.2,.55), new Color(0,0,0,0), LW, INKC);
        drawRect(p.add(vec2(.25,.95)), vec2(.6,.45), C('#88c8d8'), .05, INKC);   // кабина
        drawCircle(p.add(vec2(-.5,.14)), .34, C('#4a3628'), .04, C('#2a1e14'));  // большое колесо
        drawCircle(p.add(vec2(-.5,.14)), .12, C('#c8b090'));
        drawCircle(p.add(vec2(.5,.1)), .22, C('#4a3628'), .04, C('#2a1e14'));
        drawCircle(p.add(vec2(.5,.1)), .08, C('#c8b090'));
        drawRect(p.add(vec2(-.72,.85)), vec2(.1,.3), C('#6a5644'), 0);           // труба
        if (Math.random() < .3)
            pops.push({ p:p.add(vec2(-.72,1.05)), v:vec2(-.3,.8), col:'#c8c0b4', t:.8, r:.1 });
    }
}

// ---------- Частицы, всплывающие числа, бабочки ----------
function drawParticles() {
    for (let i = pops.length-1; i >= 0; i--) {
        const q = pops[i];
        q.t -= timeDelta;
        if (q.t <= 0) { pops.splice(i,1); continue; }
        q.p = q.p.add(q.v.scale(timeDelta));
        q.v = q.v.add(vec2(0,-4*timeDelta));
        drawCircle(q.p, q.r*Math.min(1,q.t*2), C(q.col).scale(1, Math.min(1,q.t*2)));
    }
    for (const b of decor.btf) {
        b.p += timeDelta;
        const p = vec2(b.x + Math.sin(b.p*.7)*2.5, b.y + Math.sin(b.p*1.3)*1.2);
        const f = Math.sin(b.p*14)*.09;
        drawEllipse(p.add(vec2(-.07,0)), vec2(.1,.14+f), C('#e86a8a'), .02, INKC);
        drawEllipse(p.add(vec2(.07,0)), vec2(.1,.14-f), C('#e86a8a'), .02, INKC);
    }
}
function renderWorldUI() {
    for (let i = floats.length-1; i >= 0; i--) {
        const f = floats[i];
        f.t -= timeDelta;
        if (f.t <= 0) { floats.splice(i,1); continue; }
        f.p = f.p.add(vec2(0, timeDelta*1.2));
        drawText(f.txt, f.p, .55, C(f.col).scale(1, Math.min(1, f.t*2)), .05, INKC);
    }
    if (prestigeT > 0) {
        prestigeT -= timeDelta;
        drawText('🌟 Новый сезон! 🌟', vec2(0, 9), 1.1, C('#f0c93e'), .08, INKC);
    }
}
