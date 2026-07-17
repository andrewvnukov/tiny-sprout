'use strict';
// ============================================================
// sfx.js — процедурные звуки (ZzFX) и фоновая музыка (zzfxM)
// ============================================================

const SFX = {
    plant:   [ .6, 0, 120, .01, .03, .08, 0, 1.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, .7, .02 ],
    tap:     [ .4, 0, 260, .01, .02, .05, 0, 2.2, 8, 0, 0, 0, 0, 0, 0, 0, 0, .6, .01 ],
    harvest: [ .7, 0, 420, .01, .06, .14, 0, 1.6, 0, 0, 180, .05, 0, 0, 0, 0, 0, .8, .03 ],
    golden:  [ .8, 0, 780, .02, .12, .25, 0, 1.2, 0, 0, 240, .06, .05, 0, 0, 0, 0, .8, .05 ],
    coin:    [ .6, 0, 1046, .01, .04, .12, 0, 1.5, 0, 0, 300, .04, 0, 0, 0, 0, 0, .7, .02 ],
    sell:    [ .7, 0, 880, .01, .07, .18, 0, 1.4, 0, 0, 220, .05, 0, 0, 0, 0, 0, .75, .04 ],
    buy:     [ .7, 0, 520, .01, .08, .16, 0, 1.7, 0, 0, 140, .06, 0, 0, 0, 0, 0, .8, .04 ],
    error:   [ .5, 0, 140, .02, .05, .12, 1, .8, 0, 0, 0, 0, 0, 0, 0, .1, 0, .7, .04 ],
    quest:   [ .8, 0, 660, .02, .1, .3, 0, 1.3, 0, 0, 165, .08, .04, 0, 0, 0, 0, .8, .06 ],
    chest:   [ .9, 0, 523, .03, .18, .4, 0, 1.2, 0, 0, 131, .1, .06, 0, 0, 0, 0, .85, .1 ],
    animal:  [ .5, 0, 340, .01, .05, .1, 0, 2.4, 0, 0, 80, .04, 0, 0, 0, 0, 0, .7, .02 ],
    prestige:[ 1, 0, 261, .05, .3, .6, 0, 1.1, 0, 0, 130, .12, .08, 0, 0, 0, 0, .9, .15 ],
    order:   [ .7, 0, 587, .02, .09, .2, 0, 1.4, 0, 0, 196, .06, 0, 0, 0, 0, 0, .8, .05 ],
    click:   [ .3, 0, 480, .005, .01, .03, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, .5, .005 ],
};
// Раздельная громкость: ползунок 0..1, 0.5 = базовая. Эффекты масштабируем
// прямо в вызове zzfx (мастер-гейн держим на 1), музыка — своим gain-узлом.
const sfxGain = v => Math.max(0, .6 * (v || 0));    // .5 -> .3 (как было), 1 -> .6, 0 -> тишина
const musGain = v => Math.max(0, 2.8 * (v || 0));   // громче: .5 -> 1.4, 1 -> 2.8, 0 -> тишина
function sfx(name) {
    if (!S || (S.sfxVol || 0) <= 0) return;
    try { const a = SFX[name].slice(); a[0] *= sfxGain(S.sfxVol); zzfx(...a); } catch(e) {}
}

// ---------- Фоновая музыка ----------
// Мягкий эмбиент-пэд. Буфер генерируется ОДИН раз и кэшируется —
// иначе тяжёлый zzfxM пересчитывался бы на каждый тап.
let musicSource = null, musicOn = false, musicBuf = null, musicPending = false, musicGain = null;
function makeMusic() {
    // ~3 минуты развивающегося чилла: интро на пэдах (~12 c), затем несколько
    // секций с разными прогрессиями/мелодиями и «передышками», потом петля.
    // МОНО (пан всё равно 0) — вдвое меньше памяти. Мягко, не давит на уши.
    const inst = [
        [ .46, 0, 110, .5, 1.2, 1.4, 0, 1, 0, 0, 0,   0,  0, 0,   0, 0, .12, .8,  .1 ],           // 0 низкий пэд (громче)
        [ .32, 0, 110, .7, 1.4, 1.6, 0, 1, 0, 0, 0,   0,  0, 0,   0, 0, .18, .75, .1 ],           // 1 верхний пэд (громче)
        [ .2,  .02, 82, .01, 0, .17, 0, 1, 0, 0, -50, .05, 0, 0, 0, 0, 0, 0, .06, 0, -300 ],      // 2 глухой кик (как было)
        [ .09, 0, 2600, 0, 0, .022, 0, 1, 0, 0, 0,   0,  0, 1.0, 0, 0, 0, 0, .01 ],               // 3 тихий хэт (как было)
        [ .22, 0, 110, .005, .05, .2, 1, 1, 0, 0, 0,  0,  0, 0,   0, 0, .06, .3, .04 ],           // 4 пианино (громче)
    ];
    // Такт = 8 долей (~3 c при BPM 40). Пэд — открытые квинты (корень + 7 п/т).
    const pad   = (ins, n) => [ins, 0, n, 0, 0, 0, 0, 0, 0, 0];
    const drum  = (ins, on) => { const a = [ins, 0]; for (let i = 0; i < 8; i++) a.push(on.includes(i) ? 12 : 0); return a; };
    const piano = (map) => { const a = [4, 0]; for (let i = 0; i < 8; i++) a.push(map ? (map[i] || 0) : 0); return a; };
    const kick = drum(2, [0, 4]), hat = drum(3, [2, 6]), silK = drum(2, []), silH = drum(3, []), silP = piano(null);
    const bar = (root, beat, pm) => [ pad(0, root), pad(1, root + 7), beat ? kick : silK, beat ? hat : silH, pm ? piano(pm) : silP ];
    const pat = [];
    const add = (prog, count, beat, mels) => {
        for (let k = 0; k < count; k++) pat.push(bar(prog[k % prog.length], beat, mels && mels[k % mels.length]));
    };
    const progA = [29, 24, 26, 22], progB = [24, 26, 29, 22], progC = [26, 29, 22, 24];
    const mA = [ {0:36,4:33}, null, {2:31,6:29}, null ];
    const mB = [ {0:33}, {4:36}, {0:31,4:33}, {6:29} ];
    const mC = [ {0:29,4:33}, {2:36}, null, {4:31,6:36} ];
    add(progA, 4, false, null);   // интро (~12 c) — только пэды
    add(progA, 16, true, mA);     // секция A
    add(progB, 4, false, null);   // передышка
    add(progB, 16, true, mB);     // секция B
    add(progC, 4, false, null);   // передышка
    add(progC, 16, true, mC);     // секция C → петля  (итого 60 тактов ≈ 3 мин)
    return [ zzfxM(inst, pat, pat.map((_, i) => i), 40)[0] ];   // моно: берём один канал
}
function startMusic() {
    if (musicOn || musicPending || !S || (S.musVol || 0) <= 0) return;
    try {
        if (!musicBuf) musicBuf = makeMusic();             // генерируем единожды
        // ВАЖНО: playSamples проигрывает звук только если контекст уже running,
        // иначе просто вызывает resume() и молча выходит. resume() асинхронный —
        // поэтому реально запускаем музыку в .then(), когда контекст точно ожил.
        const play = () => {
            musicPending = false;
            if (musicOn || (S.musVol || 0) <= 0) return;
            // собственный gain-узел: громкость музыки меняется на лету и независимо от эффектов
            if (!musicGain && typeof audioContext !== 'undefined') musicGain = audioContext.createGain();
            musicSource = playSamples(musicBuf, musGain(S.musVol), 1, 0, true, audioDefaultSampleRate, musicGain);
            if (musicSource) musicOn = true;               // помечаем только при реальном старте
        };
        const ac = (typeof audioContext !== 'undefined') ? audioContext : null;
        if (ac && ac.state !== 'running') {
            musicPending = true;
            ac.resume().then(play).catch(() => { musicPending = false; });
        } else play();
    } catch(e) { musicPending = false; }
}
function stopMusic() {
    if (musicSource) { try { musicSource.stop(); } catch(e) {} musicSource = null; }
    musicOn = false;
}
// приложение ушло в фон — глушим музыку и весь звук, чтобы не играл «за спиной»
function audioSuspend() {
    stopMusic();
    try { if (typeof audioContext !== 'undefined' && audioContext && audioContext.state === 'running') audioContext.suspend(); } catch(e) {}
}
// вернулись (разблокировали экран / развернули приложение) — оживляем контекст и
// запускаем музыку заново. Авто-resume мобильный браузер может заблокировать без
// жеста, поэтому дополнительно вооружаем запуск по первому касанию.
function audioResume() {
    if (!S || (S.musVol || 0) <= 0) return;
    musicPending = false;                       // сбросить возможный застрявший флаг
    try {
        if (typeof audioContext !== 'undefined' && audioContext) {
            const p = audioContext.resume();
            if (p && p.then) p.then(startMusic).catch(() => {});
        }
    } catch(e) {}
    startMusic();
    armMusicKick();
}
// одноразовый слушатель: запустить музыку по первому жесту пользователя
let _kickArmed = false;
function armMusicKick() {
    if (_kickArmed || !S || (S.musVol || 0) <= 0) return;
    _kickArmed = true;
    const kick = () => {
        startMusic();
        if (musicOn) {
            _kickArmed = false;
            document.removeEventListener('pointerdown', kick, true);
            document.removeEventListener('keydown', kick, true);
        }
    };
    document.addEventListener('pointerdown', kick, true);
    document.addEventListener('keydown', kick, true);
}
// живое изменение громкости музыки (без перезапуска); на краях — старт/стоп
function setMusicVolume() {
    if (musicGain) musicGain.gain.value = musGain(S.musVol);
    if ((S.musVol || 0) > 0) startMusic(); else stopMusic();
}
