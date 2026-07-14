'use strict';
// ============================================================
// render.js — процедурный мир в стиле Cats & Soup:
// тёплая пастель, без жёстких контуров, объём тоном + мягкие тени
// ============================================================

const _hexCache = {};
function C(hex) { return _hexCache[hex] || (_hexCache[hex] = new Color().setHex(hex)); }
const _shadeCache = {};
function D(hex, k) {   // затемнённый тон (объём без контура)
    const key = hex + '|' + k;
    return _shadeCache[key] || (_shadeCache[key] = new Color().setHex(hex).scale(k, 1));
}
const SHADOW = new Color(.32, .3, .18, .22);   // мягкая тень на траве
const INKT = '#5b4a3a';                        // цвет текста в мире

// ---------- Декор (генерится один раз) ----------
let decor = null;
function initWorldDecor() {
    const R = (a,b) => a + Math.random()*(b-a);
    decor = {
        clouds: Array.from({length:5}, () => ({ x:R(-14,14), y:R(16.6,20.4), s:R(.8,1.6), v:R(.04,.12) })),
        trees:  Array.from({length:6}, () => ({ x:R(-13,13), y:R(15.5,16.2), s:R(.7,1.2) })),
        bushes: Array.from({length:5}, () => ({ x:R(-12,12), y:R(15.4,15.8), s:R(.5,.9) })),
        flowers:Array.from({length:22}, () => ({ x:R(-6.1,6.1), y:R(-.5,13.4), s:R(.09,.14), h:['#eda3b4','#f2d98a','#f7f2e4','#c3a8dd'][Math.floor(R(0,4))] })),
        grass:  Array.from({length:46}, () => ({ x:R(-6.2,6.2), y:R(-.7,13.6), s:R(.14,.26) })),
        stones: Array.from({length:7},  () => ({ x:R(-6,6), y:R(-.5,13.2), s:R(.1,.2) })),
        btf:    Array.from({length:4}, () => ({ x:R(-5,5), y:R(2,12), p:R(0,9) })),
    };
    decor.flowers = decor.flowers.filter(f => !overPlots(f.x, f.y));
    decor.grass   = decor.grass.filter(g => !overPlots(g.x, g.y));
    decor.stones  = decor.stones.filter(s => !overPlots(s.x, s.y));
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
    addFloat(p.add(vec2(0,.8)), golden ? '+5!' : '+1', golden ? '#e9b949' : '#fff');
    for (let k = 0; k < (golden?10:5); k++)
        pops.push({ p:p.add(vec2(0,.3)), v:vec2((Math.random()-.5)*3, Math.random()*3+1),
                    col: golden ? '#efd07a' : c.hue, t:.7, r:.09+Math.random()*.08 });
}
function fxTap(i) {
    const p = plotPos(i);
    pops.push({ p:p.add(vec2((Math.random()-.5)*.8,.4)), v:vec2(0,1.6), col:'#c3dd9a', t:.5, r:.08 });
}
function fxTractor() { tractorX = -9; tractorRow = Math.floor(Math.random()*S.plots.length/4) || 0; }
function fxPrestige() {
    prestigeT = 2;
    for (let k = 0; k < 60; k++)
        pops.push({ p:vec2((Math.random()-.5)*12, 6+Math.random()*8), v:vec2((Math.random()-.5)*4, Math.random()*4),
                    col:['#efd07a','#eda3b4','#a8cc80','#c3a8dd'][k%4], t:1.5+Math.random(), r:.1+Math.random()*.1 });
}

// ---------- Мир ----------
function renderWorld() {
    const tl = screenToWorld(vec2(0,0)), br = screenToWorld(mainCanvasSize);
    const L = tl.x, Rt = br.x, T = tl.y, B = br.y;
    const mid = (L+Rt)/2, w = Rt-L;

    // небо: мягкий градиент в три полосы
    drawRect(vec2(mid, (T+HORIZON)/2), vec2(w+2, T-HORIZON+2), C('#cbe6e9'));
    drawRect(vec2(mid, HORIZON+1.6), vec2(w+2, 3.2), C('#daeee6'));
    drawRect(vec2(mid, HORIZON+.5), vec2(w+2, 1), C('#e8f3e2'));
    // солнце с мягким ореолом
    const sun = vec2(Rt-2.1, T-1.9);
    drawCircle(sun, 2.6, new Color(.98,.93,.68,.25));
    drawCircle(sun, 1.5, C('#f7e6a0'));
    drawCircle(sun.add(vec2(-.16,.18)), 1.1, C('#faf0c0'));
    // облака
    for (const c of decor.clouds) {
        c.x += c.v * timeDelta;
        if (c.x > Rt+3) c.x = L-3;
        const p = vec2(c.x, c.y);
        drawEllipse(p.add(vec2(0,-.08*c.s)), vec2(1.7*c.s,.5*c.s), C('#e4ede4'));
        drawEllipse(p, vec2(1.6*c.s,.55*c.s), C('#ffffff'));
        drawEllipse(p.add(vec2(.8*c.s,.2*c.s)), vec2(1*c.s,.45*c.s), C('#ffffff'));
        drawEllipse(p.add(vec2(-.7*c.s,.16*c.s)), vec2(.9*c.s,.4*c.s), C('#fdfcf5'));
    }
    // дальние холмы — приглушённый шалфей
    drawEllipse(vec2(mid-4, HORIZON-.1), vec2(w*.7, 2.4), C('#a3c28b'));
    drawEllipse(vec2(mid+5, HORIZON-.3), vec2(w*.6, 2), C('#96b77e'));
    // деревья и кусты на холмах
    for (const t of decor.trees) {
        if (t.x < L-1 || t.x > Rt+1) continue;
        drawTree(vec2(t.x, t.y), t.s);
    }
    for (const b of decor.bushes) {
        if (b.x < L-1 || b.x > Rt+1) continue;
        const p = vec2(b.x, b.y), s = b.s;
        drawEllipse(p, vec2(.55*s,.35*s), C('#7fa568'));
        drawEllipse(p.add(vec2(-.1*s,.12*s)), vec2(.4*s,.26*s), C('#8fb478'));
    }

    // луг — тёплый шалфей + мягкие полосы покоса
    drawRect(vec2(mid, (B+HORIZON)/2), vec2(w+2, HORIZON-B+2), C('#b1cb8a'));
    for (let y = -1; y < HORIZON; y += 2.6)
        drawRect(vec2(mid, y+.65), vec2(w+2, 1.3), new Color(0,0,0,.03));

    drawFarmhouse(mid);
    drawZonePanels();

    // трава, цветы, камешки
    for (const g of decor.grass) {
        const p = vec2(g.x, g.y);
        const sway = Math.sin(time*1.4 + g.x*2)*.03;
        drawLine(p, p.add(vec2(-.06+sway, g.s)), .045, C('#93b371'));
        drawLine(p, p.add(vec2(.07+sway, g.s*.8)), .045, C('#9dbc7a'));
        drawLine(p, p.add(vec2(sway, g.s*1.05)), .04, C('#88a967'));
    }
    for (const s of decor.stones) {
        const p = vec2(s.x, s.y);
        drawEllipse(p, vec2(s.s*1.2, s.s*.75), C('#a8a795'));
        drawEllipse(p.add(vec2(-.03,.04)), vec2(s.s*.85, s.s*.5), C('#bcbaa8'));
    }
    for (const f of decor.flowers) {
        const p = vec2(f.x, f.y);
        drawLine(p, p.add(vec2(0,.17)), .04, C('#8aab68'));
        const c = p.add(vec2(0,.22));
        for (let k = 0; k < 5; k++) {
            const a = k/5*Math.PI*2 + f.x;
            drawCircle(c.add(vec2(Math.cos(a), Math.sin(a)).scale(f.s*.9)), f.s*1.15, C(f.h));
        }
        drawCircle(c, f.s*.9, C('#f2d98a'));
    }

    drawPaddock(L, Rt);
    drawPlots();
    drawWorkers();
    drawTractor();
    drawParticles();
}

function drawTree(p, s) {
    drawEllipse(p.add(vec2(.14*s,-.1*s)), vec2(.5*s,.16*s), SHADOW);
    drawRect(p.add(vec2(0,.14*s)), vec2(.14*s,.5*s), C('#9a7a58'));
    drawCircle(p.add(vec2(0,.75*s)), .95*s, C('#6f9c5c'));
    drawCircle(p.add(vec2(-.2*s,.9*s)), .6*s, C('#7fac68'));
    drawCircle(p.add(vec2(.24*s,.66*s)), .55*s, C('#679455'));
    drawCircle(p.add(vec2(-.14*s,1.02*s)), .3*s, C('#8fbc76'));
}

// ---------- Постройки у горизонта ----------
function drawFarmhouse(mid) {
    // домик слева
    let p = vec2(-4.4, HORIZON-.65);
    drawEllipse(p.add(vec2(.1,-.62)), vec2(1.35,.24), SHADOW);
    drawRect(p, vec2(2, 1.3), C('#f2e3c8'));                                  // стены
    drawRect(p.add(vec2(.8,0)), vec2(.4, 1.3), C('#e3cfae'));                 // тень на боку
    drawPoly([vec2(-1.25,.65), vec2(1.25,.65), vec2(.02,1.62)], C('#d98a72'), 0, undefined, p);
    drawPoly([vec2(-1.25,.65), vec2(1.25,.65), vec2(.02,.95)], C('#c67a64'), 0, undefined, p);  // низ крыши темнее
    drawRect(p.add(vec2(.45,-.28)), vec2(.5,.74), C('#a97e58'));              // дверь
    drawCircle(p.add(vec2(.58,-.3)), .07, C('#e9d8b8'));                      // ручка
    drawCircle(p.add(vec2(-.42,.16)), .46, C('#cbe6e9'));                     // круглое окно
    drawCircle(p.add(vec2(-.42,.16)), .34, C('#dff2f0'));
    drawRect(p.add(vec2(.62,1.42)), vec2(.24,.5), C('#c67a64'));              // труба
    drawEllipse(p.add(vec2(.62,1.7)), vec2(.16,.07), C('#b06a56'));
    // амбар справа
    p = vec2(4.5, HORIZON-.6);
    drawEllipse(p.add(vec2(.1,-.68)), vec2(1.5,.26), SHADOW);
    drawRect(p, vec2(2.3, 1.4), C('#dd8f78'));
    drawRect(p.add(vec2(.9,0)), vec2(.5, 1.4), C('#cc7f6a'));
    drawPoly([vec2(-1.4,.7), vec2(1.4,.7), vec2(.9,1.45), vec2(-.9,1.45)], C('#c17762'), 0, undefined, p);
    drawRect(p.add(vec2(0,1.48)), vec2(1.84,.1), C('#b06a56'));
    drawRect(p.add(vec2(0,-.1)), vec2(.9,1.1), C('#c97a63'));                 // ворота
    drawRect(p.add(vec2(0,-.1)), vec2(.78,.98), C('#b96e58'));
    drawLine(p.add(vec2(-.36,-.56)), p.add(vec2(.36,.36)), .07, C('#f2e3c8'));
    drawLine(p.add(vec2(-.36,.36)), p.add(vec2(.36,-.56)), .07, C('#f2e3c8'));
    drawCircle(p.add(vec2(0,.9)), .3, C('#f2e3c8'));                          // окошко
    drawCircle(p.add(vec2(0,.9)), .2, C('#cbe6e9'));
}

// ---------- Панели зон, заборчики, теплица ----------
function drawZonePanels() {
    for (let z = 0; z < ZONES.length; z++) {
        const cy = ZONE_Y[z] + 1;
        if (z < S.zones) {
            // ухоженный участок: чуть светлее луга, светлая кромка сверху
            drawRect(vec2(0, cy), vec2(12.9, 4.15), C(z === 2 ? '#b7d093' : '#a9c481'));
            drawRect(vec2(0, cy+2.04), vec2(12.9, .09), C('#c2d89c'));
            drawRect(vec2(0, cy-2.04), vec2(12.9, .09), new Color(0,0,0,.05));
        } else if (z === S.zones) {
            // следующая зона: блеклая, с табличкой
            drawRect(vec2(0, cy), vec2(12.9, 4.15), new Color(.62,.7,.5,.3));
            drawZoneSign(z, cy);
        }
    }
    // штакетник между зонами
    for (let z = 1; z < S.zones; z++) drawFence(ZONE_Y[z] - 1.18);
    // теплица над 3-й зоной
    if (S.zones >= 3) drawGreenhouse(ZONE_Y[2] + 1);
}
function drawFence(y) {
    drawRect(vec2(0, y+.02), vec2(12.6, .3), new Color(0,0,0,.05));
    for (let x = -6.1; x <= 6.1; x += .92) {
        drawRect(vec2(x, y+.26), vec2(.13, .62), C('#efe4cb'));
        drawPoly([vec2(-.065,0), vec2(.065,0), vec2(0,.1)], C('#efe4cb'), 0, undefined, vec2(x, y+.57));
        drawRect(vec2(x+.04, y+.26), vec2(.05, .62), C('#dcCFb2'.toLowerCase()));
    }
    drawRect(vec2(0, y+.4), vec2(12.5, .09), C('#e4d7ba'));
    drawRect(vec2(0, y+.14), vec2(12.5, .09), C('#e4d7ba'));
}
function drawGreenhouse(cy) {
    // стеклянный купол-рамка
    drawRect(vec2(0, cy), vec2(13.1, 4.3), new Color(.85,.95,.95,.16));
    drawRect(vec2(-6.5, cy), vec2(.16, 4.3), C('#b7d4cf'));
    drawRect(vec2(6.5, cy), vec2(.16, 4.3), C('#b7d4cf'));
    drawRect(vec2(0, cy+2.12), vec2(13.1, .16), C('#b7d4cf'));
    drawRect(vec2(0, cy-2.12), vec2(13.1, .16), C('#c4ddd8'));
    for (let x = -4.9; x <= 4.9; x += 2.45)
        drawRect(vec2(x, cy), vec2(.1, 4.3), C('#c4ddd8'));
    // блик стекла
    drawLine(vec2(-5.4, cy+1.7), vec2(-4.2, cy-1.7), .14, new Color(1,1,1,.18));
}
function drawZoneSign(z, cy) {
    const zone = ZONES[z];
    const y = ZONE_Y[z] + 1;
    const can = S.coins >= zone.unlock;
    drawEllipse(vec2(.06, y-.85), vec2(1.6,.2), SHADOW);
    drawRect(vec2(0, y-.45), vec2(.2, .9), C('#a9835c'));
    // дощечка с объёмом
    drawRect(vec2(0, y-.02), vec2(4.7, 1.42), C('#b08a5e'));
    drawRect(vec2(0, y+.05), vec2(4.7, 1.28), C('#cca87a'));
    drawRect(vec2(0, y+.56), vec2(4.7, .12), C('#dbbb8e'));
    // замочек
    const lp = vec2(-1.75, y+.22);
    drawCircle(lp.add(vec2(0,.14)), .3, new Color(0,0,0,0), .07, C('#8a6749'));
    drawRect(lp, vec2(.4,.34), C('#8a6749'));
    drawCircle(lp.add(vec2(0,.02)), .09, C('#cca87a'));
    drawText(zone.name, vec2(.35, y+.3), .52, C(INKT));
    // цена с монеткой
    drawCoin(vec2(-.75 - fmt(zone.unlock).length*.13, y-.34), .34);
    drawText(fmt(zone.unlock), vec2(.25, y-.3), .44, can ? C('#4e7e3e') : C('#b0604a'));
}
function drawCoin(p, d) {
    drawCircle(p, d, C('#d9a93e'));
    drawCircle(p.add(vec2(-.02*d, .04*d)), d*.8, C('#efc75f'));
    drawCircle(p, d*.44, new Color(0,0,0,0), d*.1, C('#d9a93e'));
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
function drawPaddock(L, Rt) {
    syncAnimals();
    const y = 14.05;
    if (animEnts.length) {
        for (let x = -5.5; x <= 5.5; x += 1.3) {
            drawRect(vec2(x, y+.28), vec2(.12, .66), C('#efe4cb'));
            drawPoly([vec2(-.06,0), vec2(.06,0), vec2(0,.09)], C('#efe4cb'), 0, undefined, vec2(x, y+.61));
        }
        drawRect(vec2(0, y+.44), vec2(11.2, .09), C('#e4d7ba'));
        drawRect(vec2(0, y+.16), vec2(11.2, .09), C('#e4d7ba'));
        // сено в углу
        drawEllipse(vec2(-5, y-.15), vec2(.5,.28), C('#e2c878'));
        drawEllipse(vec2(-5.1, y-.05), vec2(.36,.2), C('#eed88f'));
    }
    for (const a of animEnts) {
        a.x += a.dir * a.v * timeDelta;
        if (a.x > 5) a.dir = -1;
        if (a.x < -5) a.dir = 1;
        const bob = Math.abs(Math.sin(time*4 + a.ph)) * .06;
        const p = vec2(a.x, y - .3 + bob);
        drawEllipse(vec2(a.x, y-.42), vec2(.5,.14), SHADOW);
        if (a.id === 'hen') drawHen(p, a.dir);
        else if (a.id === 'cow') drawCow(p, a.dir);
        else drawSheep(p, a.dir);
    }
}
// чиби-животные: пухлые, глазки-точки, румянец
function drawHen(p, dir) {
    drawEllipse(p.add(vec2(0,.2)), vec2(.36,.3), C('#f7ecd4'));                 // тело
    drawEllipse(p.add(vec2(-.12*dir,.16)), vec2(.2,.16), C('#eddfc0'));         // крыло
    drawCircle(p.add(vec2(.16*dir,.4)), .26, C('#f7ecd4'));                     // голова
    drawCircle(p.add(vec2(.13*dir,.55)), .07, C('#e26a5a'));                    // гребешок
    drawCircle(p.add(vec2(.2*dir,.57)), .06, C('#e26a5a'));
    drawPoly([vec2(0,-.04), vec2(.15*dir,.02), vec2(0,.07)], C('#eb9c4a'), 0, undefined, p.add(vec2(.36*dir,.38)));
    drawCircle(p.add(vec2(.24*dir,.44)), .035, C('#4a3b2e'));                   // глаз
    drawCircle(p.add(vec2(.17*dir,.36)), .05, new Color(.95,.66,.6,.55));       // румянец
    drawRect(p.add(vec2(-.05,-.03)), vec2(.04,.1), C('#eb9c4a'));
    drawRect(p.add(vec2(.08,-.03)), vec2(.04,.1), C('#eb9c4a'));
}
function drawCow(p, dir) {
    drawEllipse(p.add(vec2(0,.26)), vec2(.62,.42), C('#f7f2e4'));               // тело
    drawEllipse(p.add(vec2(-.16,.34)), vec2(.22,.15), C('#c9b8a4'));            // пятна
    drawEllipse(p.add(vec2(.18,.14)), vec2(.16,.11), C('#c9b8a4'));
    drawCircle(p.add(vec2(.5*dir,.48)), .3, C('#f7f2e4'));                      // голова
    drawEllipse(p.add(vec2(.56*dir,.38)), vec2(.17,.11), C('#f2c4b4'));         // мордочка
    drawCircle(p.add(vec2(.48*dir,.72)), .07, C('#e0d2ba'));                    // рожки
    drawCircle(p.add(vec2(.66*dir,.68)), .07, C('#e0d2ba'));
    drawEllipse(p.add(vec2(.3*dir,.6)), vec2(.1,.06), C('#e8dcc4'));            // ушко
    drawCircle(p.add(vec2(.44*dir,.52)), .04, C('#4a3b2e'));                    // глаза
    drawCircle(p.add(vec2(.6*dir,.52)), .04, C('#4a3b2e'));
    drawCircle(p.add(vec2(.34*dir,.44)), .05, new Color(.95,.66,.6,.5));        // румянец
    drawRect(p.add(vec2(-.3,-.02)), vec2(.14,.16), C('#e8dcc4'));               // ножки
    drawRect(p.add(vec2(.3,-.02)), vec2(.14,.16), C('#e8dcc4'));
}
function drawSheep(p, dir) {
    for (const [x,y,r] of [[0,.24,.42],[-.3,.3,.3],[.3,.3,.3],[-.16,.44,.28],[.16,.44,.28]])
        drawCircle(p.add(vec2(x,y)), r*1.15, C('#f2ecdd'));
    drawCircle(p.add(vec2(0,.3)), .4, C('#faf6ea'));                            // светлый центр
    drawCircle(p.add(vec2(.4*dir,.34)), .2, C('#d9c2ad'));                      // мордочка
    drawCircle(p.add(vec2(.34*dir,.5)), .12, C('#f2ecdd'));                     // чёлка
    drawEllipse(p.add(vec2(.26*dir,.4)), vec2(.09,.05), C('#cbb29c'));          // ушко
    drawCircle(p.add(vec2(.38*dir,.38)), .035, C('#4a3b2e'));
    drawCircle(p.add(vec2(.47*dir,.38)), .035, C('#4a3b2e'));
    drawCircle(p.add(vec2(.42*dir,.28)), .045, new Color(.95,.66,.6,.5));
    drawRect(p.add(vec2(-.2,-.02)), vec2(.1,.14), C('#c9b8a4'));
    drawRect(p.add(vec2(.2,-.02)), vec2(.1,.14), C('#c9b8a4'));
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
        drawRect(pos, vec2(PLOT_W, PLOT_H), new Color(.45,.36,.25,.14));
        drawRect(pos, vec2(PLOT_W-.14, PLOT_H-.14), new Color(.95,.9,.78,.16));
        drawText('+', pos.add(vec2(0,.2)), .85, new Color(.36,.28,.2,.6));
        drawCoin(pos.add(vec2(-.35 - fmt(cost).length*.11, -.4)), .3);
        drawText(fmt(cost), pos.add(vec2(.2,-.36)), .4, can ? C('#4e7e3e') : C('#b0604a'));
    }
}
function drawBed(pos) {
    // мягкая тень под коробом
    drawEllipse(pos.add(vec2(.05,-.74)), vec2(PLOT_W*.5, .2), SHADOW);
    // деревянный короб: нижняя грань + верх рамки + светлая кромка
    drawRect(pos.add(vec2(0,-.05)), vec2(PLOT_W, PLOT_H), C('#a07a52'));
    drawRect(pos.add(vec2(0,.05)), vec2(PLOT_W, PLOT_H-.16), C('#c9a578'));
    drawRect(pos.add(vec2(0, PLOT_H/2-.05)), vec2(PLOT_W, .08), C('#dbbb8e'));
    // земля с бороздками
    drawRect(pos.add(vec2(0,.04)), vec2(PLOT_W-.32, PLOT_H-.44), C('#8a6749'));
    for (let r = -1; r <= 1; r++)
        drawRect(pos.add(vec2(0, .04 + r*.36)), vec2(PLOT_W-.44, .12), C('#7a5a3e'));
    drawRect(pos.add(vec2(0, PLOT_H/2-.28)), vec2(PLOT_W-.32, .07), C('#9b7454'));
}
function drawCrop(pos, p) {
    const c = CROPS[p.c];
    const gt = cropGrow(c);
    const k = Math.min(1, p.t / gt);
    const ready = k >= 1;
    const bob = ready ? Math.sin(time*3 + pos.x) * .05 : 0;
    const o = pos.add(vec2(0, .06 + bob));
    if (k < .3) {           // росток
        const s = .3 + k;
        drawLine(o, o.add(vec2(0,.32*s)), .05, C('#6da057'));
        drawEllipse(o.add(vec2(-.1,.32*s)), vec2(.13*s,.08*s), C('#8fbf68'));
        drawEllipse(o.add(vec2(.1,.32*s)), vec2(.13*s,.08*s), C('#9cc973'));
    } else {
        drawCropArt(o, p.c, .45 + .55*k);
    }
    if (p.g && k > .3) {    // золотое сияние
        const tw = .5 + Math.sin(time*5 + pos.x*2)*.5;
        drawStar(o.add(vec2(.72,.78)), .1 + .05*tw);
        drawStar(o.add(vec2(-.78,.5)), .08 + .04*(1-tw));
    }
    if (!ready) {           // полоска роста
        drawRect(pos.add(vec2(0,-.6)), vec2(1.5,.16), new Color(1,1,1,.4));
        drawRect(pos.add(vec2(0,-.6)), vec2(1.42,.1), new Color(.4,.34,.24,.25));
        drawRect(pos.add(vec2(-(1.42-1.42*k)/2, -.6)), vec2(1.42*k,.1), C('#8fc167'));
    } else {                // пузырик «готово»
        const t = 1 + Math.sin(time*4)*.08;
        const bp = pos.add(vec2(.95,.8));
        drawCircle(bp, .42*t, C('#fffdf4'));
        drawPoly([vec2(-.1,0), vec2(.1,0), vec2(0,-.16)], C('#fffdf4'), 0, undefined, bp.add(vec2(0,-.18*t)));
        drawText('!', bp.add(vec2(0,.02)), .4*t, C('#e0a83e'));
    }
}
function drawStar(p, r) {
    for (let k = 0; k < 4; k++) {
        const a = k*Math.PI/2 + Math.PI/4;
        drawPoly([vec2(-r*.35,0), vec2(r*.35,0), vec2(0,r*1.9)], C('#f2d98a'), 0, undefined, p, a);
    }
    drawCircle(p, r*.7, C('#f7e6a0'));
}
// отрисовка культуры: мягкие формы, тёмный низ + светлый верх + блик
function blob(o, dx, dy, rx, ry, base, k) {
    drawEllipse(o.add(vec2(dx, dy)), vec2(rx, ry), D(base, .82));
    drawEllipse(o.add(vec2(dx-rx*.08, dy+ry*.12)), vec2(rx*.88, ry*.85), C(base));
    drawEllipse(o.add(vec2(dx-rx*.3, dy+ry*.4)), vec2(rx*.24, ry*.16), new Color(1,1,1,.35));
}
function drawCropArt(o, ci, s) {
    const c = CROPS[ci];
    const top = C(c.top), body = C(c.hue);
    switch (c.id) {
    case 'wheat':
        for (let k = -2; k <= 2; k++) {
            const x = k*.28, h = (.72 + Math.abs(k)*.06)*s;
            drawLine(o.add(vec2(x,0)), o.add(vec2(x+.06, h)), .05, C('#cdb162'));
            drawEllipse(o.add(vec2(x+.06, h)), vec2(.11*s,.22*s), D(c.hue,.85));
            drawEllipse(o.add(vec2(x+.04, h+.03)), vec2(.09*s,.19*s), body);
        }
        break;
    case 'carrot':
        for (let k = -1; k <= 1; k++) {
            const b = o.add(vec2(k*.62, .16));
            drawPoly([vec2(-.16,0), vec2(.16,0), vec2(0,-.46*s)], D(c.hue,.85), 0, undefined, b);
            drawPoly([vec2(-.12,-.02), vec2(.1,-.02), vec2(-.02,-.4*s)], body, 0, undefined, b);
            drawLine(b, b.add(vec2(-.09,.4*s+.1)), .06, top);
            drawLine(b, b.add(vec2(.1,.36*s+.1)), .06, D(c.top,.88));
        }
        break;
    case 'potato':
        drawEllipse(o.add(vec2(0,.32*s)), vec2(.7*s,.4*s), C('#84a95e'));
        drawEllipse(o.add(vec2(-.1,.36*s)), vec2(.5*s,.32*s), C('#94b96c'));
        blob(o, -.4, .08, .24*s, .17*s, c.hue);
        blob(o, .38, .06, .26*s, .18*s, c.hue);
        break;
    case 'cabbage':
        blob(o, 0, .32*s, .5*s, .46*s, c.hue);
        drawEllipse(o.add(vec2(-.34*s,.3*s)), vec2(.2*s,.36*s), C(c.top));
        drawEllipse(o.add(vec2(.34*s,.3*s)), vec2(.2*s,.36*s), C(c.top));
        drawEllipse(o.add(vec2(0,.5*s)), vec2(.26*s,.2*s), new Color(1,1,1,.25));
        break;
    case 'tomato':
        drawEllipse(o.add(vec2(0,.36*s)), vec2(.56*s,.5*s), C('#84a95e'));
        blob(o, -.26, .3*s, .19*s, .18*s, c.hue);
        blob(o, .26, .42*s, .19*s, .18*s, c.hue);
        blob(o, 0, .16, .18*s, .17*s, c.hue);
        break;
    case 'cuke':
        drawEllipse(o.add(vec2(0,.32*s)), vec2(.58*s,.4*s), C('#84a95e'));
        blob(o, -.3, .14, .32*s, .13*s, c.hue);
        blob(o, .32, .2, .3*s, .12*s, c.hue);
        break;
    case 'corn':
        drawLine(o, o.add(vec2(0,.95*s)), .08, C('#6da057'));
        drawEllipse(o.add(vec2(-.22,.45*s)), vec2(.32*s,.11*s), C(c.top));
        drawEllipse(o.add(vec2(.22,.62*s)), vec2(.32*s,.11*s), D(c.top,.9));
        drawEllipse(o.add(vec2(.13,.36*s)), vec2(.18*s,.34*s), D(c.hue,.85));
        drawEllipse(o.add(vec2(.11,.38*s)), vec2(.15*s,.3*s), body);
        drawEllipse(o.add(vec2(.06,.46*s)), vec2(.05*s,.12*s), new Color(1,1,1,.35));
        break;
    case 'berry':
        drawEllipse(o.add(vec2(0,.26*s)), vec2(.62*s,.34*s), C('#84a95e'));
        for (const [x,y] of [[-.36,.12],[.32,.16],[0,.36*s]]) {
            const b = o.add(vec2(x,y));
            drawPoly([vec2(-.13,.1), vec2(.13,.1), vec2(0,-.18)], D(c.hue,.85), 0, undefined, b);
            drawPoly([vec2(-.1,.09), vec2(.1,.09), vec2(0,-.14)], body, 0, undefined, b);
            drawCircle(b.add(vec2(-.03,.02)), .025, new Color(1,1,1,.5));
        }
        break;
    case 'pumpkin':
        blob(o, 0, .3*s, .58*s, .42*s, c.hue);
        drawEllipse(o.add(vec2(0,.3*s)), vec2(.26*s,.4*s), C('#f0a45a'));
        drawEllipse(o.add(vec2(-.3*s,.3*s)), vec2(.14*s,.36*s), D(c.hue,.9));
        drawRect(o.add(vec2(0,.74*s)), vec2(.1,.16*s), C('#7d915c'));
        break;
    case 'melon':
        blob(o, 0, .34*s, .5*s, .46*s, c.hue);
        for (let k = -1; k <= 1; k++)
            drawEllipse(o.add(vec2(k*.26*s,.32*s)), vec2(.08*s,.42*s), C('#2f5c3c'));
        break;
    case 'grape':
        drawRect(o.add(vec2(0,.44*s)), vec2(.9*s,.07), C('#b08a5e'));
        drawRect(o.add(vec2(-.42*s,.24*s)), vec2(.07,.5*s), C('#b08a5e'));
        drawRect(o.add(vec2(.42*s,.24*s)), vec2(.07,.5*s), C('#b08a5e'));
        for (const [x,y] of [[0,.1],[-.16,.26],[.16,.26],[0,.42]]) {
            drawCircle(o.add(vec2(x*s, y*s)), .16*s, D(c.hue,.82));
            drawCircle(o.add(vec2((x-.02)*s, (y+.02)*s)), .14*s, C(c.hue));
        }
        drawCircle(o.add(vec2(-.05*s,.16*s)), .04*s, new Color(1,1,1,.4));
        drawEllipse(o.add(vec2(.22*s,.56*s)), vec2(.17*s,.1*s), C(c.top));
        break;
    case 'pine':
        drawEllipse(o.add(vec2(0,.36*s)), vec2(.32*s,.44*s), D(c.hue,.82));
        drawEllipse(o.add(vec2(-.02,.38*s)), vec2(.28*s,.4*s), body);
        drawLine(o.add(vec2(-.2*s,.22*s)), o.add(vec2(.2*s,.52*s)), .035, C('#c89a2e'));
        drawLine(o.add(vec2(-.2*s,.46*s)), o.add(vec2(.2*s,.24*s)), .035, C('#c89a2e'));
        drawEllipse(o.add(vec2(-.1*s,.5*s)), vec2(.07*s,.14*s), new Color(1,1,1,.3));
        for (let k = -1; k <= 1; k++)
            drawPoly([vec2(-.08,0), vec2(.08,0), vec2(k*.13,.36*s)], C(c.top), 0, undefined, o.add(vec2(k*.1,.74*s)));
        break;
    }
}

// ---------- Работники (чиби) ----------
const workerEnts = { harv:null, sow:null };
function drawWorkers() {
    for (const id of ['harv','sow']) {
        if (!S.workers[id]) { workerEnts[id] = null; continue; }
        let e = workerEnts[id];
        if (!e) e = workerEnts[id] = { x: id==='harv'?-5.8:5.8, y: 2, tx: 0, ty: 2, ph: Math.random()*9 };
        if (Math.abs(e.x-e.tx) < .2 && Math.abs(e.y-e.ty) < .2) {
            const i = Math.floor(Math.random()*S.plots.length);
            const p = plotPos(i);
            e.tx = p.x + (Math.random()<.5?-1.75:1.75);
            e.ty = p.y - .4;
        }
        const sp = 1.1 * timeDelta;
        e.x += Math.sign(e.tx-e.x) * Math.min(sp, Math.abs(e.tx-e.x));
        e.y += Math.sign(e.ty-e.y) * Math.min(sp, Math.abs(e.ty-e.y));
        const bob = Math.abs(Math.sin(time*6+e.ph))*.06;
        const p = vec2(e.x, e.y+bob);
        const shirt = id === 'harv' ? '#e29070' : '#7fa3c9';
        drawEllipse(vec2(e.x, e.y-.04), vec2(.32,.1), SHADOW);
        // тельце-капелька
        drawEllipse(p.add(vec2(0,.26)), vec2(.28,.32), D(shirt,.85));
        drawEllipse(p.add(vec2(-.02,.28)), vec2(.25,.3), C(shirt));
        // большая чиби-голова
        drawCircle(p.add(vec2(0,.76)), .3, C('#f6d7b2'));
        drawCircle(p.add(vec2(-.09,.78)), .032, C('#4a3b2e'));
        drawCircle(p.add(vec2(.09,.78)), .032, C('#4a3b2e'));
        drawCircle(p.add(vec2(-.16,.7)), .05, new Color(.95,.66,.6,.55));
        drawCircle(p.add(vec2(.16,.7)), .05, new Color(.95,.66,.6,.55));
        // соломенная шляпа
        drawEllipse(p.add(vec2(0,.94)), vec2(.36,.11), C('#e2c878'));
        drawEllipse(p.add(vec2(0,1)), vec2(.2,.13), C('#eed88f'));
        drawEllipse(p.add(vec2(0,.94)), vec2(.36,.04), C('#d0b264'));
        // инвентарь
        if (id === 'harv') {
            drawEllipse(p.add(vec2(.32,.24)), vec2(.16,.11), C('#c9a578'));
            drawEllipse(p.add(vec2(.32,.29)), vec2(.13,.06), C('#8a6749'));
        } else {
            drawEllipse(p.add(vec2(-.3,.24)), vec2(.13,.17), C('#d9c8a8'));
            drawEllipse(p.add(vec2(-.3,.33)), vec2(.09,.05), C('#b8a37c'));
        }
    }
}
function drawTractor() {
    if (!S.workers.tract && tractorX < -50) return;
    if (tractorX > -50 && tractorX < 12) {
        tractorX += 4.5 * timeDelta;
        const y = ZONE_Y[Math.min(tractorRow, 2)] + .2;
        const p = vec2(tractorX, y);
        drawEllipse(p.add(vec2(0,-.05)), vec2(.95,.16), SHADOW);
        drawRect(p.add(vec2(-.1,.48)), vec2(1.24,.58), C('#c96a54'));
        drawRect(p.add(vec2(-.12,.54)), vec2(1.16,.42), C('#d97b64'));
        drawRect(p.add(vec2(.25,.95)), vec2(.62,.48), C('#a4c9cc'));       // кабина
        drawRect(p.add(vec2(.25,.97)), vec2(.5,.36), C('#cfe6e6'));
        drawCircle(p.add(vec2(-.5,.14)), .36, C('#6b5748'));               // большое колесо
        drawCircle(p.add(vec2(-.5,.14)), .16, C('#e7d6b8'));
        drawCircle(p.add(vec2(.5,.1)), .24, C('#6b5748'));
        drawCircle(p.add(vec2(.5,.1)), .1, C('#e7d6b8'));
        drawRect(p.add(vec2(-.72,.86)), vec2(.11,.3), C('#8a7460'));       // труба
        if (Math.random() < .3)
            pops.push({ p:p.add(vec2(-.72,1.05)), v:vec2(-.3,.8), col:'#d9d4c8', t:.8, r:.1 });
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
        drawEllipse(p.add(vec2(-.07,0)), vec2(.1,.14+f), C('#eda3b4'));
        drawEllipse(p.add(vec2(.07,0)), vec2(.1,.14-f), C('#f2bcc9'));
        drawEllipse(p, vec2(.03,.1), C('#8a7460'));
    }
}
function renderWorldUI() {
    for (let i = floats.length-1; i >= 0; i--) {
        const f = floats[i];
        f.t -= timeDelta;
        if (f.t <= 0) { floats.splice(i,1); continue; }
        f.p = f.p.add(vec2(0, timeDelta*1.2));
        drawText(f.txt, f.p, .55, C(f.col).scale(1, Math.min(1, f.t*2)), .04, new Color(.3,.24,.18,Math.min(1,f.t*2)*.6));
    }
    if (prestigeT > 0) {
        prestigeT -= timeDelta;
        drawStar(vec2(-3.4, 9.1), .4);
        drawStar(vec2(3.4, 9.1), .4);
        drawText('Новый сезон!', vec2(0, 9), 1.15, C('#e9b949'), .07, new Color(.42,.3,.1,.5));
    }
}
