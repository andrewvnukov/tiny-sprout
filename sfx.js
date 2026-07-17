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
    // ~60 c: спокойное интро на пэдах (~9 c), затем чилл-бит (глухой мягкий кик +
    // тихий хэт) поверх пэдов + чуть пианино, петля. Мягко, не давит на уши.
    const inst = [
        [ .34, 0, 110, .5, 1.2, 1.4, 0, 1, 0, 0, 0,   0,  0, 0,   0, 0, .12, .8,  .1 ],           // 0 низкий пэд
        [ .22, 0, 110, .7, 1.4, 1.6, 0, 1, 0, 0, 0,   0,  0, 0,   0, 0, .18, .75, .1 ],           // 1 верхний пэд
        [ .2,  .02, 82, .01, 0, .17, 0, 1, 0, 0, -50, .05, 0, 0, 0, 0, 0, 0, .06, 0, -300 ],      // 2 глухой кик (тихий, LPF)
        [ .09, 0, 2600, 0, 0, .022, 0, 1, 0, 0, 0,   0,  0, 1.0, 0, 0, 0, 0, .01 ],               // 3 тихий хэт (шум)
        [ .12, 0, 110, .005, .05, .2, 1, 1, 0, 0, 0,  0,  0, 0,   0, 0, .06, .3, .04 ],           // 4 лёгкое пианино (треуг.)
    ];
    // Такт = 8 долей (~3 c при BPM 40). Пэд — открытые квинты (корень + 7 п/т).
    // Барабаны/пианино: нота 12 = базовая частота инструмента; для пианино — мелодия.
    const pad   = (ins, n) => [ins, 0, n, 0, 0, 0, 0, 0, 0, 0];
    const drum  = (ins, on) => { const a = [ins, 0]; for (let i = 0; i < 8; i++) a.push(on.includes(i) ? 12 : 0); return a; };
    const piano = (map) => { const a = [4, 0]; for (let i = 0; i < 8; i++) a.push(map[i] || 0); return a; };
    const kick = drum(2, [0, 4]), hat = drum(3, [2, 6]), silK = drum(2, []), silH = drum(3, []), silP = piano({});
    const roots = [29, 24, 26, 22], fifths = [36, 31, 33, 29];
    // разреженная фортепианная мелодия по некоторым тактам (совсем слегка)
    const mel = { 5:{0:36,4:33}, 7:{2:31,6:29}, 9:{0:33,3:36}, 11:{4:31,6:33},
                  13:{0:36,4:33}, 15:{2:31,6:26}, 17:{0:29,4:33}, 19:{2:36,6:31} };
    const pat = [];
    for (let bar = 0; bar < 20; bar++) {                       // 20 тактов ≈ 60 c
        const ci = bar % 4, beat = bar >= 3;                  // первые 3 такта (~9 c) — только пэды
        pat.push([ pad(0, roots[ci]), pad(1, fifths[ci]),
                   beat ? kick : silK, beat ? hat : silH,
                   mel[bar] ? piano(mel[bar]) : silP ]);
    }
    return zzfxM(inst, pat, pat.map((_, i) => i), 40);
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
