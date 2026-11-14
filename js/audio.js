// PAILLE-EN-QUEUE - WebAudio synth: sega-flavoured adaptive music (ravanne frame drum, maravanne shaker,
// bass, plucked chords, melody) that builds with the combo, plus all sound effects and the tropicbird call.
// Audio starts on the first user gesture (browser autoplay rule) with an iOS silent-buffer unlock,
// and goes through a compressor + limiter so nothing clips on phone speakers.
(function () {
  'use strict';
  var A = {}, ctx = null, master, comp, limiter, analyser, musicBus, sfxBus, ambBus, delay, delayFb, noiseBuf = null;
  var muted = false, musicOn = false, style = 'day', intensity = 0, targetInt = 0, nextStep = 0, step = 0, bar = 0;
  var started = 0, amb = null, ambKind = null;
  A.stats = { nodesStarted: 0, sfxPlayed: 0, musicNotes: 0 };

  function AC() { return window.AudioContext || window.webkitAudioContext; }
  function setupGraph() {
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 8; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.18;
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2.5; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.06;
    analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
    master.connect(comp); comp.connect(limiter); limiter.connect(analyser); analyser.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.42; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1.2; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.22; ambBus.connect(master);
    delay = ctx.createDelay(1.0); delay.delayTime.value = 0.375; delayFb = ctx.createGain(); delayFb.gain.value = 0.32;
    var dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2600;
    delay.connect(dl); dl.connect(delayFb); delayFb.connect(delay); dl.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nextStep = ctx.currentTime + 0.12;
  }
  function silentUnlock() {
    try { var b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource(); s.buffer = b; s.connect(master); s.start(0); } catch (e) {}
  }
  A.init = function () {
    var C = AC(); if (!C) return;
    if (!ctx) { ctx = new C(); setupGraph(); }
    if (ctx.state === 'suspended') { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); }
    silentUnlock();
  };
  A.ready = function () { return !!ctx; };
  A.state = function () { return ctx ? ctx.state : 'none'; };
  A.setMuted = function (m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05); };
  A.isMuted = function () { return muted; };
  A.suspend = function () { if (ctx && ctx.state === 'running') ctx.suspend(); };
  A.resume = function () { if (ctx && ctx.state === 'suspended') ctx.resume(); };
  A.peak = function () {
    if (!analyser) return 0;
    var a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a);
    var m = 0; for (var i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i])); return m;
  };

  // ---------- primitives ----------
  function env(g, t, a, peak, len, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + len + (rel || 0.02));
  }
  function osc(type, f, t, len, vol, dest, o) {
    o = o || {};
    var n = ctx.createOscillator(), g = ctx.createGain();
    n.type = type; n.frequency.setValueAtTime(f, t);
    if (o.to) n.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + (o.toT || len));
    if (o.detune) n.detune.value = o.detune;
    env(g, t, o.a || 0.004, vol, len, o.r);
    var last = g;
    if (o.lp) { var f1 = ctx.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.setValueAtTime(o.lp, t); if (o.lpTo) f1.frequency.exponentialRampToValueAtTime(o.lpTo, t + len); f1.Q.value = o.q || 0.8; g.connect(f1); last = f1; }
    n.connect(g); last.connect(dest || sfxBus);
    if (o.send) { var sg = ctx.createGain(); sg.gain.value = o.send; last.connect(sg); sg.connect(delay); }
    n.start(t); n.stop(t + (o.a || 0.004) + len + 0.25); A.stats.nodesStarted++;
    return n;
  }
  function noise(t, len, vol, type, f, dest, o) {
    o = o || {};
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var fl = ctx.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.setValueAtTime(f || 1000, t); fl.Q.value = o.q || 1;
    if (o.fTo) fl.frequency.exponentialRampToValueAtTime(o.fTo, t + len);
    var g = ctx.createGain(); env(g, t, o.a || 0.002, vol, len, o.r);
    s.connect(fl); fl.connect(g); g.connect(dest || sfxBus);
    s.start(t, Math.random() * 1.5); s.stop(t + len + 0.25); A.stats.nodesStarted++;
  }

  // ---------- music ----------
  var NOTE = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  // chord roots per style (MIDI). sega loves I-IV-V-I in a bright major key.
  var STYLES = {
    day:   { prog: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], bass: [36, 41, 43, 36], scale: [0, 2, 4, 7, 9], root: 72, bar: 1.9 },
    lagoon:{ prog: [[62, 66, 69], [67, 71, 74], [69, 73, 76], [62, 66, 69]], bass: [38, 43, 45, 38], scale: [0, 2, 4, 7, 9], root: 74, bar: 1.8 },
    ghost: { prog: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]], bass: [33, 29, 31, 28], scale: [0, 3, 5, 7, 10], root: 69, bar: 1.85 },
    night: { prog: [[57, 60, 64], [62, 65, 69], [60, 64, 67], [55, 59, 62]], bass: [33, 38, 36, 31], scale: [0, 3, 5, 7, 10], root: 69, bar: 2.1 },
    south: { prog: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], bass: [33, 29, 36, 31], scale: [0, 2, 3, 7, 9], root: 69, bar: 1.75 },
    west:  { prog: [[62, 66, 69], [60, 64, 67], [67, 71, 74], [62, 66, 69]], bass: [38, 36, 43, 38], scale: [0, 2, 4, 7, 10], root: 74, bar: 1.85 },
    islet: { prog: [[64, 68, 71], [69, 73, 76], [71, 75, 78], [64, 68, 71]], bass: [40, 45, 47, 40], scale: [0, 2, 4, 7, 9], root: 76, bar: 1.7 },
    rodrigues: { prog: [[67, 71, 74], [60, 64, 67], [62, 66, 69], [67, 71, 74]], bass: [43, 36, 38, 43], scale: [0, 2, 4, 5, 7, 9], root: 79, bar: 1.65 },
    outer: { prog: [[65, 69, 72], [62, 65, 69], [58, 62, 65], [60, 64, 67]], bass: [41, 38, 34, 36], scale: [0, 2, 4, 7, 9], root: 77, bar: 2.2 },
    storm: { prog: [[52, 55, 59], [48, 52, 55], [50, 53, 57], [47, 50, 54]], bass: [28, 24, 26, 23], scale: [0, 3, 5, 7, 10], root: 64, bar: 1.55 },
    title: { prog: [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]], bass: [36, 33, 41, 43], scale: [0, 2, 4, 7, 9], root: 72, bar: 2.0 }
  };
  // a fixed melodic phrase bank (scale-degree indices, -1 = rest) so the tune is catchy, not random
  var PHR = [
    [0, -1, 2, 3, -1, 2, 1, -1, 0, 2, -1, -1],
    [3, -1, 4, 3, -1, 2, 3, -1, 2, 1, -1, 0],
    [4, -1, 3, 4, -1, 5, 4, -1, 3, 2, -1, -1],
    [2, 3, -1, 2, 1, -1, 0, -1, 1, 0, -1, -1]
  ];
  function ravanneLow(t, v) { osc('sine', 120, t, 0.22, 0.9 * v, musicBus, { to: 55, toT: 0.18 }); noise(t, 0.05, 0.25 * v, 'lowpass', 400, musicBus); }
  function ravanneSlap(t, v) { noise(t, 0.08, 0.55 * v, 'bandpass', 1800, musicBus, { q: 1.4 }); osc('triangle', 330, t, 0.07, 0.25 * v, musicBus, { to: 200 }); }
  function shaker(t, v) { noise(t, 0.045, 0.22 * v, 'highpass', 6500, musicBus, { a: 0.008 }); }
  function bassNote(m, t, len) { osc('triangle', NOTE(m), t, len, 0.5, musicBus, { lp: 700 }); osc('sine', NOTE(m), t, len, 0.35, musicBus); }
  function pluck(ch, t) { for (var i = 0; i < ch.length; i++) osc('sawtooth', NOTE(ch[i]), t + i * 0.012, 0.16, 0.09, musicBus, { lp: 2600, lpTo: 500, send: 0.15 }); }
  function lead(m, t, len, ghost) {
    osc(ghost ? 'sine' : 'square', NOTE(m), t, len, ghost ? 0.16 : 0.07, musicBus, { lp: 3000, send: 0.35 });
    osc('triangle', NOTE(m + 12), t, len * 0.7, 0.05, musicBus, { send: 0.2 });
  }
  function bell(m, t) { osc('sine', NOTE(m), t, 0.6, 0.08, musicBus, { send: 0.5 }); osc('sine', NOTE(m) * 2.76, t, 0.25, 0.03, musicBus); }

  function scheduleStep(t) {
    var S = STYLES[style] || STYLES.day, sd = S.bar / 12, s = step % 12, ci = bar % 4, ch = S.prog[ci], I = intensity;
    var v = style === 'night' ? 0.7 : 1;
    // ravanne pattern (sega 6/8 feel)
    if (s === 0 || s === 6) ravanneLow(t, v);
    if (I >= 2 && s === 9) ravanneLow(t, 0.6 * v);
    if (s === 3 || s === 9 || (I >= 1 && (s === 5 || s === 11))) ravanneSlap(t, (s % 6 === 3 ? 0.9 : 0.6) * v);
    if (I >= 4 && (s === 10 || s === 11)) ravanneSlap(t, 0.5);
    // maravanne shaker on every triplet step, accented on beats
    shaker(t, (s % 3 === 0 ? 1 : 0.55) * v);
    if (I >= 3) shaker(t + sd / 2, 0.35 * v);
    // bass
    if (I >= 1 || style === 'title') {
      if (s === 0) bassNote(S.bass[ci], t, sd * 2.5);
      if (s === 6) bassNote(S.bass[ci] + 7, t, sd * 2);
      if (s === 9) bassNote(S.bass[ci] + 12, t, sd * 1.5);
    }
    // plucked chords on the off-beats
    if ((I >= 2 || style === 'title') && (s === 3 || s === 9 || (I >= 3 && s === 6))) pluck(ch, t);
    // melody
    if (I >= 3 || style === 'title' || style === 'night' || style === 'outer') {
      var sp = style === 'night' || style === 'outer', ph = PHR[(bar + (sp ? 2 : 0)) % 4], deg = ph[s];
      if (deg >= 0 && (!sp || s % 2 === 0)) {
        var sc = S.scale, m = S.root + sc[deg % sc.length] + 12 * Math.floor(deg / sc.length);
        if (style === 'night' || style === 'outer') bell(m, t); else if (style === 'rodrigues') { osc('triangle', NOTE(m), t, sd * 1.1, 0.13, musicBus, { send: 0.25 }); osc('square', NOTE(m + 7), t, sd * 0.8, 0.03, musicBus, { lp: 2200 }); } else lead(m, t, sd * 1.2, style === 'ghost' || style === 'storm');
        A.stats.musicNotes++;
      }
    }
    if (style === 'storm' && s === 0) { osc('sawtooth', NOTE(S.bass[ci] + 12), t, S.bar * 0.95, 0.05, musicBus, { lp: 700, a: 0.2, send: 0.3 }); noise(t, S.bar * 0.9, 0.05, 'lowpass', 500, musicBus, { a: 0.4 }); }
    if (style === 'south' && s === 0 && bar % 2 === 1) osc('sine', NOTE(S.bass[ci] + 24), t, S.bar * 0.7, 0.05, musicBus, { a: 0.15, send: 0.4 });
    if (style === 'ghost' && s === 0 && bar % 2 === 0) osc('sawtooth', NOTE(S.bass[ci] + 24), t, S.bar * 0.9, 0.035, musicBus, { lp: 900, a: 0.3, send: 0.4 });
  }
  function pump() {
    if (!ctx || !musicOn) return;
    if (intensity < targetInt) intensity = targetInt; // build up quickly
    else if (intensity > targetInt && step % 12 === 0) intensity = targetInt;
    var S = STYLES[style] || STYLES.day;
    var sd = (S.bar / 12) * (1 - Math.min(intensity, 4) * 0.025);
    if (nextStep < ctx.currentTime - 0.3) nextStep = ctx.currentTime + 0.05;
    while (nextStep < ctx.currentTime + 0.15) {
      scheduleStep(nextStep);
      nextStep += sd; step++; if (step % 12 === 0) bar++;
    }
  }
  setInterval(pump, 40);
  A.music = function (st) { if (!ctx) return; style = st || 'day'; musicOn = true; step = 0; bar = 0; nextStep = ctx.currentTime + 0.1; };
  A.stopMusic = function () { musicOn = false; };
  A.setIntensity = function (i) { targetInt = Math.max(0, Math.min(4, i | 0)); };
  A.intensity = function () { return intensity; };
  A.musicOn = function () { return musicOn; };

  // ambience: soft looping surf / night crickets
  A.ambience = function (kind) {
    if (!ctx || ambKind === kind) return;
    if (amb) { try { amb.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3); amb.s.stop(ctx.currentTime + 1.5); } catch (e) {} amb = null; }
    ambKind = kind; if (!kind) return;
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'night' ? 500 : kind === 'storm' ? 1400 : kind === 'forest' ? 650 : kind === 'falls' ? 1800 : 900;
    var g = ctx.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(0.5, ctx.currentTime, 0.8);
    var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 0.35; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    s.connect(f); f.connect(g); g.connect(ambBus); s.start(); A.stats.nodesStarted += 2;
    amb = { s: s, g: g };
  };

  // ---------- sound effects ----------
  var SFX = {
    flap: function (t) { noise(t, 0.09, 0.22, 'bandpass', 900, null, { fTo: 400, q: 0.8 }); },
    fish: function (t) { osc('triangle', 880, t, 0.06, 0.35, null, { to: 1320 }); osc('sine', 1760, t + 0.05, 0.12, 0.25, null, { send: 0.3 }); },
    combo: function (t) { [0, 4, 7, 12].forEach(function (n, i) { osc('square', NOTE(76 + n), t + i * 0.05, 0.08, 0.12, null, { lp: 3500 }); }); },
    whoosh: function (t) { noise(t, 0.35, 0.6, 'bandpass', 600, null, { fTo: 3200, q: 1.6, a: 0.05 }); },
    call: function (t) { // tropicbird: a shrill, ternlike rattling "kek-kek-keee" whistle
      for (var i = 0; i < 3; i++) osc('square', 2100 + i * 120, t + i * 0.085, 0.05, 0.12, null, { to: 2600, lp: 4200 });
      osc('sawtooth', 2400, t + 0.27, 0.26, 0.11, null, { to: 1700, lp: 3800, send: 0.3 });
    },
    hit: function (t) { osc('sine', 180, t, 0.25, 0.9, null, { to: 50 }); noise(t, 0.25, 0.6, 'lowpass', 1600, null, { fTo: 200 }); },
    feather: function (t) { noise(t, 0.4, 0.25, 'highpass', 3000, null, { fTo: 900, a: 0.02 }); },
    bounce: function (t) { osc('sine', 220, t, 0.18, 0.6, null, { to: 520 }); osc('triangle', 440, t, 0.12, 0.2, null, { to: 900 }); },
    splash: function (t) { noise(t, 0.4, 0.55, 'bandpass', 1400, null, { fTo: 400, q: 0.7, a: 0.01 }); },
    dive: function (t) { noise(t, 0.3, 0.4, 'bandpass', 2400, null, { fTo: 700, q: 2 }); osc('sine', 900, t, 0.25, 0.15, null, { to: 300 }); },
    slip: function (t) { osc('sawtooth', 300, t, 0.4, 0.14, null, { to: 900, lp: 1800 }); noise(t, 0.4, 0.3, 'bandpass', 1500, null, { fTo: 4000 }); },
    flash: function (t) { noise(t, 0.03, 0.6, 'highpass', 4000); osc('sine', 3000, t + 0.04, 0.3, 0.12, null, { to: 5000 }); },
    fore: function (t) { osc('triangle', 1320, t, 0.08, 0.3); osc('sine', 1980, t + 0.03, 0.2, 0.15); },
    cannon: function (t) { osc('sine', 90, t, 0.6, 1.0, null, { to: 30 }); noise(t, 0.7, 0.9, 'lowpass', 900, null, { fTo: 120 }); },
    splashBig: function (t) { noise(t, 0.7, 0.7, 'lowpass', 2000, null, { fTo: 300, a: 0.02 }); },
    penalty: function (t) { osc('square', 330, t, 0.15, 0.18, null, { lp: 1500 }); osc('square', 247, t + 0.16, 0.25, 0.18, null, { lp: 1500 }); },
    burst: function (t) { noise(t, 0.5, 0.5, 'bandpass', 800, null, { fTo: 5000, q: 1.2 }); osc('sawtooth', 200, t, 0.4, 0.12, null, { to: 800, lp: 2000 }); },
    roll: function (t) { noise(t, 0.4, 0.4, 'bandpass', 2000, null, { fTo: 600, q: 3 }); },
    thunder: function (t) { noise(t, 1.6, 0.8, 'lowpass', 300, null, { fTo: 60, a: 0.05 }); },
    perk: function (t) { [0, 4, 7, 11, 14].forEach(function (n, i) { osc('triangle', NOTE(72 + n), t + i * 0.08, 0.3, 0.2, null, { send: 0.4 }); }); },
    win: function (t) { [0, 4, 7, 12, 7, 12, 16].forEach(function (n, i) { osc('square', NOTE(67 + n), t + i * 0.11, 0.14, 0.13, null, { lp: 3000, send: 0.3 }); }); ravanneLowS(t); ravanneLowS(t + 0.44); },
    lose: function (t) { [7, 4, 0, -5].forEach(function (n, i) { osc('triangle', NOTE(67 + n), t + i * 0.18, 0.22, 0.22, null, { send: 0.3 }); }); },
    click: function (t) { osc('triangle', 1200, t, 0.03, 0.2); },
    bell: function (t) { osc('sine', 1046, t, 1.0, 0.25, null, { send: 0.5 }); osc('sine', 2887, t, 0.4, 0.07); },
    whiteout: function (t) { osc('sine', 4000, t, 0.5, 0.06, null, { to: 1200 }); },
    rumble: function (t) { osc('sine', 55, t, 0.8, 0.9, null, { to: 38, a: 0.15 }); noise(t, 0.8, 0.5, 'lowpass', 220, null, { a: 0.2 }); },
    jet: function (t) { noise(t, 0.9, 0.8, 'bandpass', 900, null, { fTo: 2800, q: 0.6, a: 0.03 }); osc('sine', 120, t, 0.5, 0.5, null, { to: 60 }); },
    surf: function (t) { noise(t, 0.6, 0.45, 'bandpass', 700, null, { fTo: 1800, q: 0.7, a: 0.08 }); },
    wave: function (t) { noise(t, 1.4, 0.7, 'lowpass', 900, null, { fTo: 200, a: 0.2 }); },
    monkey: function (t) { for (var i = 0; i < 3; i++) osc('sawtooth', 700 + i * 90, t + i * 0.09, 0.07, 0.14, null, { to: 1100, lp: 2600 }); },
    chick: function (t) { osc('sine', 2600, t, 0.07, 0.2, null, { to: 3400 }); osc('sine', 2900, t + 0.1, 0.08, 0.18, null, { to: 3600 }); },
    scare: function (t) { osc('square', 500, t, 0.2, 0.15, null, { to: 220, lp: 1800 }); noise(t, 0.2, 0.3, 'bandpass', 1500); },
    rock: function (t) { noise(t, 0.5, 0.7, 'lowpass', 600, null, { fTo: 120 }); osc('sine', 80, t, 0.3, 0.5, null, { to: 40 }); },
    steal: function (t) { osc('sawtooth', 900, t, 0.25, 0.14, null, { to: 300, lp: 2200 }); },
    feint: function (t) { osc('triangle', 660, t, 0.1, 0.25, null, { to: 1320 }); osc('triangle', 990, t + 0.08, 0.15, 0.2); },
    lightning: function (t) { noise(t, 0.12, 1.0, 'highpass', 2500); noise(t + 0.05, 1.8, 0.9, 'lowpass', 400, null, { fTo: 50, a: 0.02 }); },
    wind: function (t) { noise(t, 1.2, 0.35, 'bandpass', 500, null, { fTo: 1400, q: 2.5, a: 0.3 }); },
    style: function (t) { [0, 7, 12].forEach(function (n, i) { osc('triangle', NOTE(79 + n), t + i * 0.06, 0.12, 0.2, null, { send: 0.4 }); }); },
    rest: function (t) { osc('sine', 523, t, 0.4, 0.15, null, { send: 0.4 }); osc('sine', 784, t + 0.1, 0.4, 0.12, null, { send: 0.4 }); },
    star: function (t) { osc('triangle', 1568, t, 0.15, 0.25, null, { send: 0.4 }); osc('triangle', 2093, t + 0.06, 0.2, 0.2, null, { send: 0.4 }); }
  };
  function ravanneLowS(t) { osc('sine', 120, t, 0.22, 0.9, null, { to: 55, toT: 0.18 }); }
  A.sfxNames = Object.keys(SFX);
  var lastAt = {};
  A.sfx = function (name) {
    if (!ctx || !SFX[name] || ctx.state !== 'running') return;
    var now = ctx.currentTime; if (lastAt[name] && now - lastAt[name] < 0.04) return; lastAt[name] = now;
    SFX[name](now + 0.005); A.stats.sfxPlayed++;
  };
  // render effects offline and report their peak level (used by the headless test to prove they are audible)
  A.measureSfx = function (names) {
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC || !ctx) return Promise.resolve([]);
    var out = [];
    return names.reduce(function (p, name) {
      return p.then(function () {
        var oc = new OAC(1, 44100 * 2, 44100), saveCtx = ctx, saveBus = sfxBus, saveDelay = delay;
        ctx = oc; sfxBus = oc.createGain(); sfxBus.connect(oc.destination);
        delay = oc.createGain(); delay.connect(oc.destination);
        try { SFX[name](0.01); } catch (e) { out.push({ name: name, err: String(e) }); }
        ctx = saveCtx; sfxBus = saveBus; delay = saveDelay;
        return oc.startRendering().then(function (buf) {
          var d = buf.getChannelData(0), m = 0; for (var i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
          out.push({ name: name, peak: +m.toFixed(3) });
        });
      });
    }, Promise.resolve()).then(function () { return out; });
  };
  window.PQAudio = A;
})();
