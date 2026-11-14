// PAILLE-EN-QUEUE - main game: loop, bird physics, entity types, collisions, scoring, HUD, menus,
// saves, the demo autopilot and the headless-test hooks (window.__pq, window.__pqAdvance).
(function () {
  'use strict';
  var PL = window.PQLevels, ART = window.PQArt, AU = window.PQAudio, ASSETS = window.PQ_ASSETS || {};
  var LEVELS = PL.LEVELS, PERKS = PL.PERKS, SEA = PL.SEA, FH = 540, BR = 12, NM = 24;
  var qs = new URLSearchParams(location.search);
  var DEMO = qs.get('demo') === '1', CAPTURE = qs.get('capture') === '1', QLEVEL = parseInt(qs.get('level') || '0', 10) || 0;
  var cv = document.getElementById('game'), c = cv.getContext('2d');
  var dark = document.createElement('canvas'), dc = dark.getContext('2d');
  var W = 0, H = 0, dpr = 1, scale = 1, viewW = 960, offY = 0, portrait = false;
  var $ = function (id) { return document.getElementById(id); };
  var IMG = {};
  Object.keys(ASSETS).forEach(function (k) { var im = new Image(); im.src = ASSETS[k]; IMG[k] = im; });

  // ---------------- save ----------------
  var SKEY = 'pq_save_v1', save;
  function loadSave() {
    try { save = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { save = null; }
    if (!save || typeof save !== 'object') save = {};
    save.unlocked = save.unlocked || 1; save.best = save.best || {}; save.perks = save.perks || [];
    if (save.vibe === undefined) save.vibe = true; if (save.mute === undefined) save.mute = false;
  }
  function writeSave() { try { localStorage.setItem(SKEY, JSON.stringify(save)); } catch (e) {} }
  loadSave();
  function hasPerk(p) { return G && G.perks.indexOf(p) >= 0; }
  function vibe(ms) { if (save.vibe && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } }

  // ---------------- layout ----------------
  function resize() {
    W = window.innerWidth; H = window.innerHeight; dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    dark.width = cv.width; dark.height = cv.height;
    portrait = W < H;
    if (portrait) { viewW = 560; scale = W / viewW; offY = Math.max(0, (H - FH * scale) * 0.55); }
    else { scale = H / FH; viewW = W / scale; offY = 0; if (viewW < 680) { viewW = 680; scale = W / viewW; offY = (H - FH * scale) / 2; } }
    document.body.classList.toggle('portrait', portrait);
    if (G) G.birdOff = Math.max(140, Math.min(300, viewW * 0.27));
  }
  window.addEventListener('resize', resize);

  // ---------------- geometry ----------------
  function dSeg(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy, u = l ? ((px - x1) * dx + (py - y1) * dy) / l : 0;
    u = Math.max(0, Math.min(1, u)); var qx = x1 + u * dx - px, qy = y1 + u * dy - py; return Math.sqrt(qx * qx + qy * qy);
  }
  function inPoly(px, py, p) {
    var ins = false; for (var i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      var xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) ins = !ins;
    } return ins;
  }
  function dist(s, x, y) {
    switch (s.k) {
      case 'c': return Math.hypot(x - s.x, y - s.y) - s.r;
      case 'r': { var dx = Math.max(s.x - x, 0, x - (s.x + s.w)), dy = Math.max(s.y - y, 0, y - (s.y + s.h)); if (dx === 0 && dy === 0) return -Math.min(x - s.x, s.x + s.w - x, y - s.y, s.y + s.h - y); return Math.hypot(dx, dy); }
      case 's': return dSeg(x, y, s.x1, s.y1, s.x2, s.y2) - s.r;
      case 'p': { var m = 1e9, p = s.pts; for (var i = 0, j = p.length - 2; i < p.length; j = i, i += 2) m = Math.min(m, dSeg(x, y, p[j], p[j + 1], p[i], p[i + 1])); return inPoly(x, y, p) ? -m : m; }
      case 'band': { if (x < s.x0 || x > s.x1) return 1e9; var pr = s.f(x); return Math.min(y - pr.top, pr.bot - y); }
    }
    return 1e9;
  }

  // ---------------- state ----------------
  var G = null, mode = 'title', input = { hold: false, press: false }, titleT = 0;
  function newRun(n) {
    var L = LEVELS[n - 1]; L.ground = []; L.raceEnd = 0;
    var ents = PL.GEN[n]().map(function (o, i) { o.id = i; return o; });
    var perks = save.perks.slice();
    if (QLEVEL || DEMO) LEVELS.forEach(function (l2, i) { if (i < n - 1 && perks.indexOf(l2.perk) < 0) perks.push(l2.perk); });
    G = {
      n: n, L: L, t: 0, camX: 0, bx: 0, by: 250, vy: 0, speed: L.speed0, baseSpeed: L.speed0, prog: 0,
      energy: 100, streamers: 3, maxStreamers: 4, score: 0, chain: 0, mult: 1, comboT: 0, bestMult: 1,
      hits: 0, nm: 0, fish: 0, fishTotal: 0, deep: 0, deepTotal: 0, bounces: 0, slips: 0, penalties: 0,
      inv: 0, hitSlow: 0, slow: 0, flash: 0, shake: 0, wet: 0, slipT: 0, slipMeter: 0, burstT: 0, burstCd: 0, rollT: 0, rollCd: 0,
      dive: 0, flapPh: 0, glide: 0, perks: perks, ents: ents, act: [], next: 0, parts: [], pops: [], banner: null, tip: null,
      rain: false, place: 0, raceDone: false, lightning: 0, done: false, over: false, reason: '', lowWarned: false,
      ai: { ty: 250, cd: 0 }, demoHits: 0, penCd: 0, musicSwitched: false, fishBoost: 0, nmFlash: 0, raceBonus: 0
    };
    ents.forEach(function (o) {
      var d = T[o.type]; o.ax = d && d.ax ? d.ax(o) : (o.x !== undefined ? o.x : o.x0);
      if (o.type === 'fishLeap' || o.type === 'flyFish' || o.type === 'fishCorr') G.fishTotal++; if (o.type === 'deepFish') G.deepTotal++;
    });
    ents.sort(function (a, b) { return a.ax - b.ax; });
    G.birdOff = Math.max(140, Math.min(300, viewW * 0.27));
    G.bx = G.birdOff;
    return G;
  }
  function birdLead(sec) { return G.speed * sec; }

  // ---------------- particles & text ----------------
  function part(x, y, vx, vy, life, col, size, kind) { if (G.parts.length > 400) return; G.parts.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, col: col, size: size, kind: kind || 'dot' }); }
  function splash(x, n, big) { for (var i = 0; i < n; i++) part(x + (Math.random() - 0.5) * 20, SEA - 2, (Math.random() - 0.5) * 160, -Math.random() * (big ? 380 : 240) - 60, 0.7 + Math.random() * 0.4, 'rgba(235,250,255,0.9)', 2 + Math.random() * 3, 'drop'); }
  function feathers(x, y) { for (var i = 0; i < 7; i++) part(x, y, (Math.random() - 0.7) * 220, (Math.random() - 0.6) * 200, 1.4, '#ffffff', 7, 'feather'); }
  function sparkle(x, y, col, n) { for (var i = 0; i < (n || 8); i++) { var a = Math.random() * 6.28, v = 60 + Math.random() * 140; part(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.5, col || '#fff6a8', 3, 'spark'); } }
  function pop(x, y, text, col, size) { G.pops.push({ x: x, y: y, text: text, col: col || '#fff', size: size || 20, life: 1.1 }); }
  function banner(text, sub, col) { G.banner = { text: text, sub: sub || '', col: col || '#fff', life: 2.0 }; }

  // ---------------- scoring ----------------
  function multFor(ch) { return Math.min(8, 1 + Math.floor(ch / 3)); }
  function musicInt() { AU.setIntensity(G.mult >= 7 ? 4 : G.mult >= 4 ? 3 : G.mult >= 2 ? 2 : 1); }
  function addCombo(n) {
    var old = G.mult; G.chain += n; G.mult = multFor(G.chain); G.comboT = 4.5; G.bestMult = Math.max(G.bestMult, G.mult);
    if (G.mult > old) { AU.sfx('combo'); pop(G.bx, G.by - 40, 'x' + G.mult + '!', '#ffd23a', 26); if (G.mult === 8) banner('Bravo!', 'MAX COMBO x8', '#ffd23a'); }
    if (G.chain > 0 && G.chain % 10 === 0 && G.streamers < G.maxStreamers) { G.streamers++; pop(G.bx - 30, G.by + 20, '+ tail feather', '#bff3ff', 16); AU.sfx('perk'); }
    musicInt();
  }
  function addScore(v) { G.score += Math.round(v * G.mult); }
  function catchFish(o, x, y) {
    o.dead = true; if (o.type === 'deepFish') { G.deep++; pop(x, y - 30, 'Deep fish!', '#9ff0ff', 14); } else G.fish++; G.energy = Math.min(100, G.energy + 10); addScore(10); addCombo(1);
    AU.sfx('fish'); sparkle(x, y, '#cfefff', 6); pop(x, y - 14, '+' + 10 * G.mult, '#e8fbff', 15);
    if (G.L.id === 5 && !G.raceDone) G.fishBoost = 1.0;
  }
  function nearMiss() {
    G.nm++; addScore(25); addCombo(1); G.slow = 0.28; G.nmFlash = 0.25;
    AU.sfx('whoosh'); AU.sfx('call');
    var say = ['Near miss!', 'Gete sa!', 'Whoosh!', 'Ki bel!'][G.nm % 4];
    pop(G.bx, G.by - 30, say + ' +' + 25 * G.mult, '#9ff0ff', 18);
  }
  function hit(why) {
    if (G.inv > 0 || G.burstT > 0) return;
    if (G.rollT > 0) { pop(G.bx, G.by - 30, 'Dodge!', '#9ff0ff', 18); return; }
    G.hits++; G.chain = 0; G.mult = 1; G.comboT = 0; AU.setIntensity(1);
    G.inv = 1.6; G.hitSlow = 1.2; G.shake = 0.45; vibe(90);
    AU.sfx('hit'); AU.sfx('feather'); feathers(G.bx - 20, G.by);
    if (DEMO) { G.demoHits++; if (G.streamers > 1) G.streamers--; pop(G.bx, G.by - 30, 'Aie!', '#ff8a7a', 22); return; }
    if (G.streamers <= 0) { gameOver(why || 'You lost all your tail feathers'); return; }
    G.streamers--; pop(G.bx, G.by - 30, G.streamers === 0 ? 'Atansion! Last chance!' : 'Aie! -1 tail', '#ff8a7a', 20);
    if (G.streamers === 0) banner('Atansion!', 'No tail feathers left: one more hit ends the flight', '#ff8a7a');
  }
  function penalty(text) {
    if (G.penCd > 0) return; G.penCd = 1.2; G.penalties++;
    G.score = Math.max(0, G.score - 250); G.chain = 0; G.mult = 1; AU.setIntensity(1);
    AU.sfx('penalty'); vibe(40); pop(G.bx, G.by - 34, text + ' -250', '#ffb15c', 18); G.shake = 0.2;
    banner('Atansion!', 'Zonn proteze: protected nests and tortoises', '#ffb15c');
  }

  // ---------------- entity types ----------------
  // each type: shapes(o,t) -> collision shapes at time t ({k:'c'|'r'|'s'|'p'|'band', kd:'haz'|'fish'|'bounce'|'wet'|'pen'|'slip'}),
  // draw(c,o), optional update(o,dt), init(o), right(o) (cull edge), layer (0 under water, 2 above everything)
  var T = {};
  function tTrig(o, lead) { // when the bird reaches (or reached) o.x - lead seconds of flight
    if (o.trig !== undefined) return o.trig;
    return G.t + (o.x - birdLead(lead) - G.bx) / Math.max(50, G.speed);
  }
  T.fishLeap = {
    update: function (o) { if (o.trig === undefined && G.bx >= o.x - birdLead(1.05)) { o.trig = G.t; splash(o.x + 30, 5); } },
    pos: function (o, t) {
      var t0 = tTrig(o, 1.05), dt = t - t0; if (dt < 0) return null;
      var g = 760, v0 = Math.sqrt(2 * g * (SEA + 10 - o.apex)), y = SEA + 10 - v0 * dt + 0.5 * g * dt * dt;
      if (dt > 0.2 && y > SEA + 12) return null;
      return { x: o.x + 30 - 30 * dt, y: y, a: Math.atan2(-v0 + g * dt, -30) + Math.PI };
    },
    shapes: function (o, t) { var p = this.pos(o, t); return p ? [{ k: 'c', x: p.x, y: p.y, r: 9, kd: 'fish' }] : []; },
    right: function (o) { return o.x + 60; },
    draw: function (c, o) { var p = this.pos(o, G.t); if (p) ART.fish(c, p.x, p.y, p.a, 1.05, false, G.t); }
  };
  T.flyFish = {
    pos: function (o, t) { var t0 = arrive(o); return { x: o.x - 70 * (t - t0), y: o.y + Math.sin((t - t0) * 3 + o.x) * 8 }; },
    shapes: function (o, t) { var p = this.pos(o, t); return [{ k: 'c', x: p.x, y: p.y, r: 9, kd: 'fish' }]; },
    right: function (o) { return this.pos(o, G.t).x + 30; },
    draw: function (c, o) { var p = this.pos(o, G.t); ART.flyingFish(c, p.x, p.y, G.t); }
  };
  T.deepFish = {
    layer: 0,
    pos: function (o, t) { var t0 = arrive(o); return { x: o.x - 30 * (t - t0), y: o.y + Math.sin((t - t0) * 2 + o.x) * 4 }; },
    shapes: function (o, t) { var p = this.pos(o, t); return [{ k: 'c', x: p.x, y: p.y, r: 10, kd: 'fish', deep: true }]; },
    right: function (o) { return this.pos(o, G.t).x + 30; },
    draw: function (c, o) { var p = this.pos(o, G.t); ART.fish(c, p.x, p.y, Math.PI, 1.1, true, G.t); if (hasPerk('dive')) { c.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.2 * Math.sin(G.t * 6)) + ')'; c.beginPath(); c.arc(p.x, SEA + 4, 4, 0, 6.28); c.fill(); } }
  };
  T.fishCorr = {
    init: function (o) { var cor = null; G.ents.forEach(function (e) { if (e.type === 'corridor' && e.x0 === o.cor[0]) cor = e; }); var pr = corrProf(cor, o.x); o.y = (pr.top + pr.bot) / 2; },
    shapes: function (o) { return [{ k: 'c', x: o.x, y: o.y + Math.sin(G.t * 3 + o.x) * 6, r: 9, kd: 'fish' }]; },
    right: function (o) { return o.x + 30; },
    draw: function (c, o) { ART.flyingFish(c, o.x, o.y + Math.sin(G.t * 3 + o.x) * 6, G.t); }
  };
  T.tip = { update: function (o) { if (G.bx >= o.x) { o.dead = true; G.tip = { text: o.text, life: 4.2 }; } }, right: function (o) { return o.x + 10; } };
  T.call = { update: function (o) { if (G.bx >= o.x) { o.dead = true; banner(o.text, '', '#ffe27a'); if (o.sfx) AU.sfx(o.sfx); if (o.text.indexOf('Lapli') === 0) G.lightning = 0.6; } }, right: function (o) { return o.x + 10; } };

  // ----- L1 Pereybere / Cap Malheureux
  T.umbrella = {
    shapes: function (o) { return [{ k: 's', x1: o.x, y1: SEA, x2: o.x + 2, y2: SEA - o.h + 6, r: 3, kd: 'haz', nm: true }, { k: 'r', x: o.x - 50, y: SEA - o.h - 22, w: 104, h: 26, kd: 'bounce' }]; },
    right: function (o) { return o.x + 60; },
    draw: function (c, o) { ART.umbrella(c, o.x, SEA, o.h, o.col, G.t); ART.towel(c, o.x + 30, SEA + 2, o.col); }
  };
  T.kite = {
    shapes: function (o) { return [{ k: 's', x1: o.x, y1: SEA - 30, x2: o.kx, y2: o.ky + 28, r: 2, kd: 'haz', nm: true }, { k: 'c', x: o.kx, y: o.ky, r: 20, kd: 'haz', nm: true }]; },
    right: function (o) { return o.kx + 40; },
    draw: function (c, o) { ART.child(c, o.x - 6, SEA + 4, o.col); ART.kite(c, o.x + 4, SEA - 30, o.kx, o.ky, o.col, G.t); }
  };
  T.mast = {
    shapes: function (o) { return [{ k: 's', x1: o.x, y1: SEA - 14, x2: o.x, y2: o.top, r: 4, kd: 'haz', nm: true }, { k: 'r', x: o.x - 45, y: SEA - 18, w: 90, h: 24, kd: 'haz' }]; },
    right: function (o) { return o.x + 60; },
    draw: function (c, o) { ART.mast(c, o.x, SEA, o.top, o.col, G.t); }
  };
  T.buoy = {
    shapes: function (o) { return [{ k: 'c', x: o.x, y: SEA - 14, r: 13, kd: 'haz', nm: true }]; },
    right: function (o) { return o.x + 20; },
    draw: function (c, o) { ART.buoy(c, o.x, SEA, o.race ? '#ff8a00' : o.light ? '#2fb36b' : '#e8443a', G.t, o.light); }
  };
  function gateC(o, t) { var cc = 262 + o.amp * Math.sin(6.2832 * t / o.period + o.phase); return { top: cc - o.gap / 2, bot: Math.min(SEA - 34, cc + o.gap / 2) }; }
  T.gate = {
    shapes: function (o, t) { var g = gateC(o, t); return [{ k: 'r', x: o.x - 34, y: g.bot, w: 68, h: SEA - g.bot + 10, kd: 'haz', nm: true }, { k: 's', x1: o.x, y1: -60, x2: o.x, y2: g.top - 30, r: 3, kd: 'haz', nm: true }, { k: 'c', x: o.x, y: g.top - 18, r: 10, kd: 'haz', nm: true }]; },
    right: function (o) { return o.x + 80; },
    draw: function (c, o) {
      var g = gateC(o, G.t);
      ART.hookLine(c, o.x, g.top - 4, G.t);
      ART.net(c, o.x, g.bot, SEA + 6, 68, G.t);
      ART.pirogue(c, o.x + 10, SEA + 4, 120, o.col, G.t, { fisher: 40, shirt: '#2fb36b' });
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.setLineDash([6, 6]); c.lineWidth = 2; c.strokeRect(o.x - 40, g.top, 80, g.bot - g.top); c.setLineDash([]);
    }
  };
  // ----- L2 Coin de Mire
  function corrProf(o, x) {
    var u = (x - o.x0) / (o.x1 - o.x0), sm = u * u * (3 - 2 * u);
    var gap = o.g0 + (o.gmin - o.g0) * Math.min(1, sm * 1.4) + 34 * Math.sin(x * 0.0021 + o.seed);
    gap = Math.max(o.gmin - 8, gap);
    var w = u < 0.72 ? u / 0.72 : u < 0.84 ? 1 - (u - 0.72) / 0.12 : 0; // the wedge: long slope up, sheer cliff down
    var cc = 330 - 150 * w * (o.wedge === 1 ? 0.8 : 1) + 46 * Math.sin(x * 0.0014 + o.seed * 2);
    cc = Math.max(gap / 2 + 26, Math.min(SEA - gap / 2 - 8, cc));
    var e = Math.min(1, (x - o.x0) / 420, (o.x1 - x) / 420); e = Math.max(0, e); e = e * e * (3 - 2 * e);
    var jt = 9 * Math.sin(x * 0.045 + o.seed) + 5 * Math.sin(x * 0.13) + 4 * Math.abs(Math.sin(x * 0.021)), jb = 8 * Math.sin(x * 0.05 + 1.3) + 5 * Math.sin(x * 0.17 + o.seed);
    return { top: -20 + (cc - gap / 2 + 20 - jt) * e, bot: SEA + 40 + (cc + gap / 2 - SEA - 40 + jb) * e };
  }
  T.corridor = {
    ax: function (o) { return o.x0; },
    shapes: function (o) { return [{ k: 'band', x0: o.x0, x1: o.x1, f: function (x) { return corrProf(o, x); }, kd: 'haz' }]; },
    right: function (o) { return o.x1 + 20; },
    draw: function (c, o) {
      var a = Math.max(o.x0, G.camX - 40), b = Math.min(o.x1, G.camX + viewW + 40), top = [], bot = [];
      for (var x = a; x <= b + 24; x += 24) { var xx = Math.min(x, o.x1), pr = corrProf(o, xx); top.push(xx, pr.top); bot.push(xx, pr.bot); }
      if (top.length < 4) return;
      rock(c, top, true); rock(c, bot, false);
    }
  };
  function rock(c, pts, isTop) {
    c.beginPath(); c.moveTo(pts[0], isTop ? -400 : 900);
    for (var i = 0; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.lineTo(pts[pts.length - 2], isTop ? -400 : 900); c.closePath();
    var g = c.createLinearGradient(0, isTop ? -60 : 160, 0, isTop ? 300 : 560);
    if (isTop) { g.addColorStop(0, '#3a312b'); g.addColorStop(0.7, '#6e5e50'); g.addColorStop(1, '#9a8672'); } else { g.addColorStop(0, '#a89276'); g.addColorStop(0.35, '#6f5e4e'); g.addColorStop(1, '#2e2621'); }
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    for (var j = 0; j < pts.length; j += 2) { var x = pts[j], col = Math.floor(x / 24); c.fillStyle = col % 3 === 0 ? 'rgba(255,240,220,0.10)' : col % 3 === 1 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.04)'; c.fillRect(x, isTop ? -400 : pts[j + 1], 24, isTop ? pts[j + 1] + 400 : 600); }
    c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 2;
    for (var j2 = 0; j2 < pts.length; j2 += 2) { var x2 = pts[j2]; c.beginPath(); c.moveTo(x2, pts[j2 + 1]); c.lineTo(x2 + 3, isTop ? -400 : 900); c.stroke(); if ((Math.floor(x2 / 24) * 7) % 5 === 0) { c.beginPath(); c.moveTo(x2, pts[j2 + 1] + (isTop ? -30 : 34)); c.lineTo(x2 + 24, pts[j2 + 1] + (isTop ? -26 : 30)); c.stroke(); } }
    c.restore();
    c.strokeStyle = isTop ? 'rgba(255,255,255,0.18)' : '#4f8a3a'; c.lineWidth = isTop ? 3 : 6; c.beginPath();
    for (var k = 0; k < pts.length; k += 2) { if (k === 0) c.moveTo(pts[k], pts[k + 1] + (isTop ? 0 : 2)); else c.lineTo(pts[k], pts[k + 1] + (isTop ? 0 : 2)); } c.stroke();
    if (!isTop) { c.fillStyle = '#5f9a44'; for (var m = 0; m < pts.length; m += 6) { ART.ell(c, pts[m], pts[m + 1] + 2, 9, 5); c.fill(); } }
    else { c.fillStyle = 'rgba(245,245,235,0.55)'; for (var n = 0; n < pts.length; n += 6) { ART.ell(c, pts[n], pts[n + 1] - 3, 5, 2); c.fill(); } }
  }
  T.booby = {
    update: function (o) {
      if (o.trig === undefined && G.bx >= o.x - birdLead(o.lead)) { o.trig = G.t; AU.sfx('dive'); }
      if (o.trig !== undefined && !o.splashed) { var p = this.pos(o, G.t); if (!p && G.t - o.trig > 0.3) { o.splashed = true; splash(o.x, 12, true); AU.sfx('splash'); } }
    },
    pos: function (o, t) { var t0 = tTrig(o, o.lead), dt = t - t0; if (dt < 0) return null; var y = -70 + 300 * dt + 0.5 * 1500 * dt * dt; if (y > SEA + 30) return null; return { x: o.x, y: y }; },
    shapes: function (o, t) { var p = this.pos(o, t); return p ? [{ k: 'c', x: p.x, y: p.y, r: 12, kd: 'haz', nm: true }, { k: 'c', x: p.x, y: p.y - 22, r: 9, kd: 'haz', nm: true }] : []; },
    right: function (o) { return o.x + 40; },
    draw: function (c, o) {
      var p = this.pos(o, G.t);
      if (!o.splashed) { // shadow warning on the water + danger marker
        var near = 1 - Math.max(0, Math.min(1, (o.x - G.bx) / 900)), k = p ? Math.min(1, (p.y + 70) / (SEA + 70)) : 0, q = Math.max(near, k);
        c.fillStyle = 'rgba(10,30,50,' + (0.25 + 0.4 * q) + ')'; ART.ell(c, o.x, SEA + 3, 14 + 24 * q, 5); c.fill();
        if (!p) { c.strokeStyle = 'rgba(255,90,60,' + (0.3 + 0.45 * near) + ')'; c.setLineDash([8, 10]); c.lineWidth = 2; c.beginPath(); c.moveTo(o.x, 46); c.lineTo(o.x, SEA - 10); c.stroke(); c.setLineDash([]);
          c.fillStyle = '#ff5a3c'; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.fillText('!', o.x, 40 + Math.sin(G.t * 12) * 3); c.textAlign = 'left'; }
      }
      if (p) ART.booby(c, p.x, p.y, true, G.t);
      else if (o.splashed) { var dt2 = G.t - o.trig - 0.9; if (dt2 > 0.3 && dt2 < 3) ART.booby(c, o.x - dt2 * 40, SEA - 20 - dt2 * 130, false, G.t); }
    }
  };
  // ----- L3 Ile Gabriel & Ile Plate
  function arrive(o) { if (o.tA === undefined) o.tA = G.t + (o.x - G.bx) / Math.max(50, G.speed); return o.tA; } // boats are laid out where the bird meets them
  function catX(o, t) { return o.x + o.vx * (t - arrive(o)); }
  T.cat = {
    shapes: function (o, t) {
      var x = catX(o, t), mx = x + o.mastDx;
      return [
        { k: 'p', pts: [mx, o.top, mx, o.boomY + 2, mx - o.back, o.boomY + 2], kd: 'haz', nm: true },
        { k: 'p', pts: [mx + 2, o.top + 10, mx + o.front, o.boomY + 6, mx + 2, o.boomY + 6], kd: 'haz', nm: true },
        { k: 's', x1: mx, y1: o.top - 4, x2: mx, y2: SEA, r: 3, kd: 'haz', nm: true },
        { k: 'r', x: x - 112, y: SEA - 46, w: 234, h: 52, kd: 'haz' },
        { k: 'r', x: mx - o.back - 125, y: o.top + 46, w: 110, h: Math.max(30, o.boomY - o.top - 56), kd: 'slip' }
      ];
    },
    update: function (o) {
      var mx = catX(o, G.t) + o.mastDx;
      if (o.cam && !o.flashT && G.bx > mx - 430 && G.bx < mx - 120) { o.flashT = G.t + 0.6; }
      if (o.flashT && !o.flashed && G.t >= o.flashT) { o.flashed = true; G.flash = 1; AU.sfx('flash'); AU.sfx('whiteout'); pop(G.bx + 60, 70, 'FLASH!', '#ffffff', 22); }
    },
    right: function (o) { return catX(o, G.t) + 140; },
    draw: function (c, o) {
      var x = catX(o, G.t), mx = x + o.mastDx;
      ART.catamaran(c, x, SEA, o, G.t);
      if (o.flashT && !o.flashed) { // camera glint warning
        var k = Math.max(0, (G.t - (o.flashT - 0.6)) / 0.6), tx = x - 95 + 28, ty = SEA - 54;
        c.save(); c.translate(tx, ty); c.rotate(G.t * 6); c.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.5 * k) + ')';
        ART.poly(c, [0, -10 - 14 * k, 3, -3, 10 + 14 * k, 0, 3, 3, 0, 10 + 14 * k, -3, 3, -10 - 14 * k, 0, -3, -3]); c.fill(); c.restore();
      }
      if (o.slipOn > 0) slipLines(c, mx - o.back - 125, o.top + 60, o.boomY - o.top - 70, o.slipOn);
    }
  };
  function slipLines(c, x0, y0, h, a) { c.strokeStyle = 'rgba(160,240,255,' + (0.6 * a) + ')'; c.lineWidth = 2; for (var i = 0; i < 5; i++) { var yy = y0 + i * h / 4, xo = (G.t * 300 + i * 40) % 110; c.beginPath(); c.moveTo(x0 + xo, yy); c.lineTo(x0 + xo + 30, yy); c.stroke(); } }
  // ----- L4 Ile aux Cerfs
  function movX(o, t) { return o.x + o.vx * (t - arrive(o)); }
  T.parasail = {
    shapes: function (o, t) {
      var bx = movX(o, t), px = bx + o.dx;
      return [{ k: 'r', x: bx - 48, y: SEA - 24, w: 112, h: 28, kd: 'haz' }, { k: 's', x1: bx - 40, y1: SEA - 16, x2: px, y2: o.cy + 60, r: 2.5, kd: 'haz', nm: true },
        { k: 'p', pts: [px - 62, o.cy, px - 40, o.cy - 34, px, o.cy - 44, px + 40, o.cy - 34, px + 62, o.cy], kd: 'haz', nm: true }, { k: 'c', x: px, y: o.cy + 64, r: 13, kd: 'haz', nm: true }];
    },
    right: function (o) { return movX(o, G.t) + o.dx + 80; },
    draw: function (c, o) {
      var bx = movX(o, G.t), px = bx + o.dx;
      c.strokeStyle = 'rgba(30,30,30,0.85)'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx - 40, SEA - 16); c.lineTo(px, o.cy + 60); c.stroke();
      ART.parasail(c, px, o.cy, o.col, o.col2, G.t); ART.speedboat(c, bx, SEA, -1, o.boat, G.t);
    }
  };
  T.golf = {
    update: function (o) {
      if (o.warn === undefined && G.bx >= o.x - birdLead(1.25)) { o.warn = G.t; o.lx = G.camX + viewW + 40 + G.speed * 0.6; o.wy = SEA - 20; pop(G.camX + viewW - 70, 300, 'FORE!', '#ffffff', 22); AU.sfx('fore'); }
    },
    pos: function (o, t) {
      if (o.warn === undefined) return null;
      var dt = t - o.warn - 0.6; if (dt < 0) return null;
      var x = o.lx - 330 * dt, y = SEA - 20 - o.vy * dt + 0.5 * 520 * dt * dt;
      if (y > SEA + 10) return null; return { x: x, y: y, vx: -330, vy: -o.vy + 520 * dt };
    },
    shapes: function (o, t) { var p = this.pos(o, t); return p ? [{ k: 'c', x: p.x, y: p.y, r: 8, kd: 'haz', nm: true }] : []; },
    right: function (o) { if (o.warn === undefined) return o.x + 3000; if (G.t - o.warn > 0.8 && !this.pos(o, G.t)) return -1e9; return o.x + 3000; },
    draw: function (c, o) {
      var p = this.pos(o, G.t); if (p) ART.golfBall(c, p.x, p.y, p.vx - G.speed, p.vy);
      if (o.warn !== undefined && G.t < o.warn + 0.6) { var ex = G.camX + viewW - 100; c.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.5 * Math.sin(G.t * 20)) + ')'; c.font = 'bold 18px sans-serif'; c.fillText('\u25C0 FORE!', ex, SEA - 60); }
    }
  };
  function sprayH(o, t) { var ph = ((t + o.ph) % o.per) / 0.9; return ph < 1 ? 240 * Math.sin(Math.PI * ph) : 0; }
  T.banana = {
    shapes: function (o, t) { var x = movX(o, t), h = sprayH(o, t); var s = [{ k: 'r', x: x - 70, y: SEA - 30, w: 140, h: 34, kd: 'haz' }, { k: 'r', x: x - 250, y: SEA - 24, w: 112, h: 28, kd: 'haz' }]; if (h > 10) s.push({ k: 'r', x: x + 50, y: SEA - h, w: 70, h: h, kd: 'wet' }); return s; },
    right: function (o) { return movX(o, G.t) + 130; },
    draw: function (c, o) {
      var x = movX(o, G.t), h = sprayH(o, G.t);
      ART.speedboat(c, x - 200, SEA, -1, '#ffffff', G.t);
      c.strokeStyle = '#333'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 150, SEA - 12); c.lineTo(x - 66, SEA - 10); c.stroke();
      ART.banana(c, x, SEA, G.t);
      if (h > 4) { for (var i = 0; i < 14; i++) { var yy = SEA - h * (i / 14), xx = x + 85 + Math.sin(G.t * 20 + i) * 14 * (i / 14); c.fillStyle = 'rgba(235,250,255,' + (0.85 - i * 0.04) + ')'; ART.ell(c, xx, yy, 14 + i * 1.3, 10); c.fill(); } }
    }
  };
  T.cloud = {
    cx: function (o) { return o.x + Math.sin(G.t * 0.4 + o.x) * 10; },
    shapes: function (o) { var x = this.cx(o); return [{ k: 'c', x: x - o.w * 0.22, y: o.y, r: o.w * 0.22, kd: 'haz', nm: true }, { k: 'c', x: x + o.w * 0.2, y: o.y + 4, r: o.w * 0.2, kd: 'haz', nm: true }]; },
    right: function (o) { return o.x + o.w; },
    draw: function (c, o) { var x = this.cx(o); ART.cloudDark(c, x, o.y, o.w, G.t); if (Math.sin(G.t * 1.7 + o.x) > 0.985) { c.strokeStyle = '#fffbd0'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, o.y + 20); c.lineTo(x - 14, o.y + 90); c.lineTo(x + 6, o.y + 110); c.lineTo(x - 10, o.y + 190); c.stroke(); } }
  };
  T.rain = { ax: function (o) { return o.x0 - 2000; }, update: function (o) { G.rain = G.bx >= o.x0 && G.bx <= o.x1; }, right: function (o) { return o.x1 + 3000; } };
  // ----- L5 Mahebourg regatta + ghost battle
  T.racer = {
    ax: function () { return -1e6; },
    init: function (o) { o.x = o.x0; },
    update: function (o, dt) {
      if (G.raceDone && G.bx > G.L.raceEnd + 2500) { o.dead = true; return; }
      var v = o.base * (1 + 0.05 * Math.sin(G.t * 0.45 + o.seed));
      if (o.x < G.bx - 900) v *= 1.06; if (o.x > G.bx + 1300) v *= 0.96;
      if (o.x >= G.L.raceEnd) { v *= 0.6; if (!o.fin) o.fin = G.t; }
      o.v = v; o.x += v * dt;
    },
    shapes: function (o, t) { var x = o.x + (o.v || o.base) * (t - G.t), mx = x + 10; return [{ k: 'r', x: mx - 150, y: o.top + 40, w: 120, h: 380 - o.top - 50, kd: 'slip' }]; },
    right: function () { return 1e12; },
    draw: function (c, o) {
      var mx = o.x + 10;
      ART.sail(c, mx, o.top, 400, 130, 0, o.col, G.t, { stripe: o.stripe, num: String(o.num) });
      ART.pirogue(c, o.x, SEA + 2, 150, o.col, G.t, { fisher: -30, shirt: o.stripe, name: o.name, stripe: o.stripe });
      if (o.slipOn > 0) slipLines(c, mx - 150, o.top + 60, 300, o.slipOn);
    }
  };
  T.finish = {
    update: function (o) {
      if (!G.raceDone && G.bx >= o.x) {
        G.raceDone = true; var place = 1; G.ents.forEach(function (e) { if (e.type === 'racer' && e.x >= o.x) place++; }); G.place = place;
        var bonus = [0, 3000, 2000, 1200, 700, 400, 200][place] || 0; G.score += bonus; G.raceBonus = bonus;
        banner(place === 1 ? 'Bravo! 1st place!' : ordinal(place) + ' place', 'Regatta bonus +' + bonus, '#ffd23a'); AU.sfx(place <= 2 ? 'win' : 'bell'); vibe(60);
      }
    },
    right: function (o) { return o.x + 200; },
    draw: function (c, o) { finishLine(c, o.x, 'ARIVE REGATA'); }
  };
  function finishLine(c, x, label) {
    c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(x - 3, 40, 6, SEA - 40);
    c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 60, 20); c.lineTo(x - 60, 70); c.moveTo(x + 60, 20); c.lineTo(x + 60, 70); c.stroke();
    for (var k = 0; k < 10; k++) for (var j = 0; j < 2; j++) { c.fillStyle = (k + j) % 2 ? '#111' : '#fff'; c.fillRect(x - 60 + k * 12, 20 + j * 12, 12, 12); }
    c.font = '900 16px "Trebuchet MS", sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.strokeText(label, x, 66); c.fillStyle = '#ffd23a'; c.fillText(label, x, 66); c.textAlign = 'left';
    ART.buoy(c, x - 40, SEA, '#ffd23a', G.t, true); ART.buoy(c, x + 40, SEA, '#ffd23a', G.t, true);
  }
  T.frigate = {
    ax: function (o) { return o.x0 - 900; },
    alpha: function (o) { return Math.max(0, Math.min(1, (G.bx - o.x0) / 600, (o.x1 - G.bx) / 600)); },
    sx: function (o) { return G.camX + viewW * (o.slot ? 0.9 : 0.74) + Math.sin(G.t * 0.3 + o.x0) * 40 + (1 - this.alpha(o)) * 300; },
    update: function (o, dt) {
      if (G.bx > o.x1) { o.dead = true; return; }
      if (o.muzzle > 0) o.muzzle -= dt;
      if (this.alpha(o) < 0.6) return;
      if (o.nextFire === undefined) o.nextFire = G.t + 1.0;
      if (G.t >= o.nextFire) {
        o.nextFire = G.t + o.fire * (0.75 + Math.random() * 0.5);
        var sx = this.sx(o), lx = sx - 95, ly = SEA - 40, TT = 1.45 + Math.random() * 0.45;
        var tx = G.bx + G.speed * TT + (Math.random() * 120 - 40), ty = Math.max(70, Math.min(440, G.by + (Math.random() * 200 - 100)));
        var g = 420, vx = (tx - lx) / TT, vy = (ty - ly - 0.5 * g * TT * TT) / TT;
        mkLive({ type: 'ball', lx: lx, ly: ly, vx: vx, vy: vy, g: g });
        o.muzzle = 0.25; AU.sfx('cannon'); G.shake = Math.max(G.shake, 0.12);
        for (var i = 0; i < 3; i++) mkLive({ type: 'puff', x: lx - 10 - i * 14, y: ly - 8 - i * 6, r0: 26 + i * 8 });
      }
    },
    right: function () { return 1e12; },
    draw: function (c, o) {
      var a = this.alpha(o); if (a <= 0) return; var sx = this.sx(o);
      ART.frigate(c, sx, SEA + 6, 0.9, a * (0.75 + 0.15 * Math.sin(G.t * 2)), G.t);
      if (o.muzzle > 0) { c.fillStyle = 'rgba(255,200,90,' + Math.min(1, o.muzzle * 4) + ')'; ART.ell(c, sx - 100, SEA - 40, 28, 15); c.fill(); }
    }
  };
  T.ball = {
    pos: function (o, t) { var dt = t - o.t0; if (dt < 0) return null; return { x: o.lx + o.vx * dt, y: o.ly + o.vy * dt + 0.5 * o.g * dt * dt }; },
    update: function (o) { var p = this.pos(o, G.t); if (p && p.y > SEA + 4 && G.t - o.t0 > 0.3) { o.dead = true; splash(p.x, 10, true); AU.sfx('splashBig'); } else if (p && Math.random() < 0.5) part(p.x, p.y, 20, -10, 0.6, 'rgba(200,205,210,0.6)', 7, 'smoke'); },
    shapes: function (o, t) { var p = this.pos(o, t); return p && p.y < SEA + 4 ? [{ k: 'c', x: p.x, y: p.y, r: 10, kd: 'haz', nm: true }] : []; },
    right: function (o) { var p = this.pos(o, G.t); return p ? p.x + 30 : -1e9; },
    draw: function (c, o) { var p = this.pos(o, G.t); if (p) ART.cannonball(c, p.x, p.y); }
  };
  T.puff = { layer: 2, right: function (o) { return G.t - o.t0 > 4 ? -1e9 : o.x + 300; }, draw: function (c, o) { var k = (G.t - o.t0) / 4; ART.smoke(c, o.x - k * 60, o.y - k * 40, o.r0 + k * 90, 0.85 * (1 - k)); } };
  T.smokeBank = { layer: 2, right: function (o) { return o.x + o.r * 3; }, draw: function (c, o) { var x = o.x - (G.t - o.t0) * 18; for (var i = 0; i < 4; i++) ART.smoke(c, x + i * o.r * 0.5, o.y + Math.sin(i * 1.7 + G.t * 0.5) * 20, o.r, 0.72); } };
  T.flotsam = {
    shapes: function (o) { return [{ k: 's', x1: o.x, y1: SEA + 4, x2: o.x + 24, y2: SEA - o.h, r: 5, kd: 'haz', nm: true }]; }, right: function (o) { return o.x + 60; },
    draw: function (c, o) { c.fillStyle = 'rgba(220,230,220,0.5)'; ART.poly(c, [o.x + 22, SEA - o.h + 6, o.x + 60, SEA - o.h + 30, o.x + 16, SEA - o.h * 0.4]); c.fill(); c.strokeStyle = '#4a3a2a'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(o.x, SEA + 4); c.lineTo(o.x + 24, SEA - o.h); c.stroke(); }
  };
  // ----- L6 Ile aux Fouquets & Ile aux Aigrettes (night)
  function reefPts(o) { if (o.pts) return o.pts; var x = o.x, w = o.w, h = o.h, sd = o.x * 0.013, p = [x - w / 2, SEA + 30]; for (var i = 1; i < 10; i++) { var u = i / 10, k = Math.sin(Math.PI * Math.pow(u, 0.9)); p.push(x - w / 2 + w * u + Math.sin(sd + i * 2.1) * 4, SEA - h * k * (0.8 + 0.2 * Math.sin(sd * 3 + i * 1.7)) - (i % 2 ? 0 : 8 * k)); } p.push(x + w / 2, SEA + 30); o.pts = p; return p; }
  T.reef = {
    shapes: function (o) { return [{ k: 'p', pts: reefPts(o), kd: 'haz', nm: true }]; }, right: function (o) { return o.x + o.w; },
    draw: function (c, o) {
      var p = reefPts(o); ART.poly(c, p);
      var g = c.createLinearGradient(0, SEA - o.h, 0, SEA); g.addColorStop(0, '#8a96a6'); g.addColorStop(1, '#2f3744'); c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#d0647a'; ART.ell(c, o.x - o.w * 0.15, SEA - o.h * 0.4, 7, 4); c.fill(); c.fillStyle = '#f2b24a'; ART.ell(c, o.x + o.w * 0.12, SEA - o.h * 0.25, 6, 4); c.fill();
    }
  };
  T.tortoise = {
    shapes: function (o, t) { var x = movX(o, t); return [{ k: 'r', x: x - 36, y: SEA - 44, w: 84, h: 50, kd: 'pen' }]; }, right: function (o) { return o.x + 120; },
    draw: function (c, o) { ART.tortoise(c, movX(o, G.t), SEA + 4, G.t, 1.05); }
  };
  T.nestZone = {
    shapes: function (o) { return [{ k: 'r', x: o.x - o.w / 2, y: SEA - 30, w: o.w, h: 40, kd: 'pen' }]; }, right: function (o) { return o.x + o.w; },
    draw: function (c, o) {
      ART.nestPost(c, o.x - o.w / 2, SEA + 4, G.t); ART.nestPost(c, o.x + o.w / 2, SEA + 4, G.t);
      c.strokeStyle = 'rgba(255,214,90,0.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(o.x - o.w / 2, SEA - 22); c.quadraticCurveTo(o.x, SEA - 12, o.x + o.w / 2, SEA - 22); c.stroke();
      for (var i = -1; i <= 1; i++) ART.nest(c, o.x + i * o.w * 0.28, SEA + 6);
    }
  };
  function mkLive(o) { o.def = T[o.type]; o.t0 = G.t; o.ax = 0; o.act = true; G.act.push(o); return o; }

  // ---------------- input ----------------
  var ptr = null;
  function pressDown() { if (mode !== 'play') return; if (!input.hold) input.press = true; input.hold = true; }
  function pressUp() { input.hold = false; }
  function doDive() { if (!G || mode !== 'play' || !hasPerk('dive') || G.dive) return; G.dive = 1; G.vy = 760; G.energy = Math.max(0, G.energy - 2); AU.sfx('dive'); input.hold = false; }
  function doBurst() { if (!G || mode !== 'play' || !hasPerk('burst') || G.burstCd > 0) return; G.burstT = 0.9; G.burstCd = 7; G.energy = Math.max(0, G.energy - 5); AU.sfx('burst'); pop(G.bx, G.by - 30, 'BURST!', '#9ff0ff', 20); }
  function doRoll() { if (!G || mode !== 'play' || !hasPerk('roll') || G.rollCd > 0) return; G.rollT = 0.6; G.rollCd = 4.5; AU.sfx('roll'); }
  cv.addEventListener('pointerdown', function (e) { AU.init(); ptr = { x: e.clientX, y: e.clientY, t: performance.now(), sw: false }; pressDown(); e.preventDefault(); });
  cv.addEventListener('pointermove', function (e) {
    if (!ptr || ptr.sw) return; var dx = e.clientX - ptr.x, dy = e.clientY - ptr.y, dt = performance.now() - ptr.t;
    if (dt < 320) {
      if (dy > 45 && dy > Math.abs(dx)) { ptr.sw = true; doDive(); }
      else if (dx > 55 && dx > Math.abs(dy)) { ptr.sw = true; doBurst(); }
      else if (dy < -60 && -dy > Math.abs(dx) && hasPerk('roll')) { ptr.sw = true; doRoll(); }
    }
  });
  window.addEventListener('pointerup', function () { ptr = null; pressUp(); });
  window.addEventListener('pointercancel', function () { ptr = null; pressUp(); });
  window.addEventListener('keydown', function (e) {
    var k = e.key; AU.init();
    if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') { if (!e.repeat) pressDown(); e.preventDefault(); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { doDive(); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { doBurst(); e.preventDefault(); }
    else if (k === 'e' || k === 'E' || k === 'Shift') doRoll();
    else if (k === 'p' || k === 'P' || k === 'Escape') { if (mode === 'play') pause(); else if (mode === 'pause') resume(); }
    else if (k === 'Enter') { if (mode === 'card') $('btnCard').click(); }
  });
  window.addEventListener('keyup', function (e) { var k = e.key; if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') pressUp(); });
  function btn(id, fn) { var b = $(id); if (!b) return; b.addEventListener('pointerdown', function (e) { e.stopPropagation(); }); b.addEventListener('click', function (e) { e.stopPropagation(); AU.init(); AU.sfx('click'); fn(e); }); }
  btn('btnDive', doDive); btn('btnBurst', doBurst); btn('btnRoll', doRoll);
  document.addEventListener('visibilitychange', function () { if (document.hidden && mode === 'play' && !DEMO) pause(); });

  // ---------------- autopilot (demo mode) ----------------
  function aiThink() {
    var steps = [], K = 9, sp = G.speed;
    for (var k = 1; k <= K; k++) {
      var tf = G.t + k * 0.1, list = [];
      for (var i = 0; i < G.act.length; i++) { var o = G.act[i]; if (o.dead || !o.def || !o.def.shapes) continue; var ss = o.def.shapes(o, tf); for (var j = 0; j < ss.length; j++) list.push(ss[j]); }
      steps.push(list);
    }
    var best = G.ai.ty, bestC = 1e12, hungry = G.energy < 45 ? 2 : 1;
    for (var ty = 34; ty <= 452; ty += 14) {
      var cost = Math.abs(ty - 290) * 0.05 + Math.abs(ty - G.ai.ty) * 0.03, got = [];
      if (G.L.id === 5 && !G.raceDone) cost += Math.max(0, 375 - ty) * 0.25;
      for (var k2 = 0; k2 < K; k2++) {
        var dt = (k2 + 1) * 0.1, xf = G.bx + 4 + sp * dt, dy = ty - G.by, mv = 300 * dt, yf = G.by + Math.max(-mv, Math.min(mv, dy));
        var L2 = steps[k2];
        for (var m = 0; m < L2.length; m++) {
          var s = L2[m], d = dist(s, xf, yf);
          if (s.kd === 'haz') { if (d < BR + 5) cost += 900 * (1.3 - k2 * 0.09); else if (d < BR + 26) cost += (BR + 26 - d) * 3; }
          else if (s.kd === 'fish' && !s.deep && d < BR + 14 && got.indexOf(s) < 0) { got.push(s); cost -= 70 * hungry; }
          else if (s.kd === 'pen' && d < BR + 12) cost += 600;
          else if (s.kd === 'wet' && d < BR) cost += 60;
          else if (s.kd === 'slip' && d < 0) cost -= 15;
          else if (s.kd === 'bounce' && d < BR + 6) cost -= 25;
        }
      }
      if (cost < bestC) { bestC = cost; best = ty; }
    }
    G.ai.ty = best;
  }
  function aiControl(dt) {
    if ((G.ai.cd -= dt) <= 0) { aiThink(); G.ai.cd = 0.05; }
    var want = Math.max(-380, Math.min(480, (G.ai.ty - G.by) * 5));
    var h = G.vy > want + 15;
    input.hold = h; // the autopilot steers with hold-lift only (no tap impulses) for smooth control
    if (hasPerk('dive') && !G.dive && G.energy > 15) { // plunge for a deep fish when the timing lines up
      for (var di = 0; di < G.act.length; di++) { var f = G.act[di]; if (f.type !== 'deepFish' || f.dead) continue; var fp = f.def.pos(f, G.t), need = Math.max(0, (fp.y - G.by) / 760) * G.speed + 25, dxf = fp.x - G.bx; if (G.by > 250 && Math.abs(dxf - need) < 14) { doDive(); break; } }
    }
    if (hasPerk('roll') && G.rollCd <= 0 && G.inv <= 0) { // barrel-roll when something is about to hit
      for (var i = 0; i < G.act.length; i++) { var o = G.act[i]; if (o.dead || !o.def || !o.def.shapes) continue; var ss = o.def.shapes(o, G.t + 0.12); for (var j = 0; j < ss.length; j++) if (ss[j].kd === 'haz' && dist(ss[j], G.bx + 4 + G.speed * 0.12, G.by) < BR) { doRoll(); return; } }
    }
  }

  // ---------------- update ----------------
  function groundAt(x) { var gr = G.L.ground || []; for (var i = 0; i < gr.length; i++) if (x >= gr[i].x0 && x <= gr[i].x1) return gr[i].type; return null; }
  var TIMERS = ['inv', 'hitSlow', 'shake', 'wet', 'slipT', 'burstT', 'burstCd', 'rollT', 'rollCd', 'penCd', 'lightning', 'nmFlash'];
  function update(rdt) {
    if (!G || G.done || G.over) return;
    var dt = rdt * (G.slow > 0 ? 0.45 : 1); G.slow -= rdt;
    G.t += dt;
    if (DEMO) aiControl(dt);
    var L = G.L;
    // speed
    G.prog = Math.min(1, G.bx / L.len);
    G.baseSpeed = L.speed0 + (L.speed1 - L.speed0) * G.prog;
    var m = 1;
    if (G.slipT > 0) m *= 1.3; if (G.burstT > 0) m *= 1.7; if (G.hitSlow > 0) m *= 0.75; if (G.wet > 0) m *= 0.95;
    G.lowBonus = false;
    if (L.id === 5 && !G.raceDone) { if (G.by > 360 && !G.dive) { m *= 1.12; G.lowBonus = true; } if (G.fishBoost > 0) { m *= 1.1; G.fishBoost -= dt; } }
    G.speed = G.baseSpeed * m;
    G.camX += G.speed * dt; G.bx = G.camX + G.birdOff;
    // timers
    for (var ti = 0; ti < TIMERS.length; ti++) { var tk = TIMERS[ti]; if (G[tk] > 0) G[tk] = Math.max(0, G[tk] - rdt); }
    if (G.flash > 0) G.flash = Math.max(0, G.flash - rdt * 1.15);
    if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0 && G.chain > 0) { G.chain = Math.max(0, (G.mult - 2) * 3); G.mult = multFor(G.chain); G.comboT = G.chain > 0 ? 4.5 : 0; musicInt(); } }
    // bird physics
    var grav = 980, lift = 2150;
    if (G.wet > 0) { grav *= 1.3; lift *= 0.82; }
    if (G.rain) { grav *= 1.12; G.vy += 40 * dt; }
    var canFlap = G.energy > 0;
    if (input.press && canFlap && !G.dive) { G.vy = Math.min(G.vy, -250); AU.sfx('flap'); }
    input.press = false;
    G.glide = 0;
    if (G.dive === 1) { G.vy = 760; if (G.by >= SEA + 38) { G.dive = 2; G.vy = -520; } }
    else if (G.dive === 2) { G.vy += grav * 0.3 * dt; if (G.by < SEA - 30) G.dive = 0; }
    else {
      G.vy += grav * dt;
      if (input.hold && canFlap) G.vy -= lift * dt;
      if (!input.hold && G.vy > 140 && hasPerk('glide') && canFlap) { G.vy = Math.min(G.vy, 140 + (G.rain ? 40 : 0)); G.glide = 1; }
    }
    G.vy = Math.max(-400, Math.min(G.dive === 1 ? 760 : 560, G.vy));
    var wasAbove = G.by < SEA;
    G.by += G.vy * dt;
    var gnd = groundAt(G.bx);
    if (G.dive && wasAbove && G.by >= SEA && !gnd) { splash(G.bx, 14, true); AU.sfx('splash'); }
    if (G.by < 14) { G.by = 14; G.vy = Math.max(0, G.vy); }
    if (G.dive && gnd && G.by > SEA - 12) { if (gnd === 'shore') penalty('Zonn proteze!'); G.dive = 0; G.vy = -420; G.by = SEA - 12; AU.sfx('bounce'); }
    if (!G.dive && G.by > SEA - 12 && G.vy > 0) {
      if (!canFlap) { G.by = SEA - 12; gameOver('Out of energy: the paille-en-queue needs fish!'); return; }
      G.by = SEA - 12; G.vy = -300; G.energy = Math.max(0, G.energy - 3);
      if (gnd === 'shore') penalty('Zonn proteze!'); else if (gnd) AU.sfx('bounce'); else { splash(G.bx, 8); AU.sfx('splash'); }
    }
    // energy
    var drain = 2.0 + (input.hold ? 1.3 : 0); if (G.glide) drain *= 0.5; if (G.slipT > 0) drain *= 0.5;
    G.energy = Math.max(0, G.energy - drain * dt);
    if (G.energy < 25 && !G.lowWarned) { G.lowWarned = true; banner('Atansion!', 'Low energy: catch fish!', '#ff8a7a'); AU.sfx('call'); }
    if (G.energy > 40) G.lowWarned = false;
    G.flapPh += dt * (input.hold ? 22 : G.glide ? 0 : 9);
    // activate entities that come into range
    var ahead = G.camX + viewW + 450;
    while (G.next < G.ents.length && G.ents[G.next].ax < ahead) { var o = G.ents[G.next++]; if (o.act) continue; o.act = true; o.def = T[o.type]; o.t0 = G.t; if (o.def && o.def.init) o.def.init(o); if (o.def) G.act.push(o); }
    // update + collide
    var bx = G.bx + 4, by = G.by, catchR = 14 + (hasPerk('sense') ? 12 : 0) + (G.dive ? 6 : 0), slipIn = false;
    for (var i = 0; i < G.act.length; i++) {
      var e = G.act[i];
      if (e.dead) continue;
      if (e.def.update) e.def.update(e, dt);
      if (e.dead || !e.def.shapes) continue;
      var ss = e.def.shapes(e, G.t), minHaz = 1e9, hitThis = false, hasNm = false;
      if (e.slipOn) e.slipOn = Math.max(0, e.slipOn - dt * 2);
      for (var j = 0; j < ss.length; j++) {
        var s = ss[j], d = dist(s, bx, by);
        if (s.kd === 'haz') { if (s.nm) hasNm = true; minHaz = Math.min(minHaz, d); if (d < BR) hitThis = true; }
        else if (s.kd === 'fish') { if ((!s.deep || by > SEA - 6) && d < catchR) { catchFish(e, s.x, s.y); break; } }
        else if (s.kd === 'bounce') { if (d < BR + 2 && G.vy > -100) { G.vy = -560; G.by = Math.min(G.by, s.y - BR); G.bounces++; addScore(15); addCombo(1); AU.sfx('bounce'); pop(bx, by - 30, 'BOING! +' + 15 * G.mult, '#ffe27a', 18); sparkle(bx, by + 10, '#ffe27a', 6); } }
        else if (s.kd === 'wet') { if (d < BR) { if (G.wet <= 0) { pop(bx, by - 30, 'Splash! Heavy wings', '#bfefff', 16); G.energy = Math.max(0, G.energy - 4); AU.sfx('splash'); } G.wet = 2.2; } }
        else if (s.kd === 'pen') { if (d < BR) penalty(e.type === 'tortoise' ? 'Tortoise!' : 'Nests!'); }
        else if (s.kd === 'slip') { if (d < 0) { slipIn = true; e.slipOn = 1; if (!e.slipDone) { G.slipMeter += dt * (hasPerk('slip') ? 2.6 : 1.5); if (G.slipMeter >= 0.7) { e.slipDone = true; G.slipMeter = 0; G.slipT = hasPerk('slip') ? 3.4 : 2.2; G.slips++; addScore(30); addCombo(1); G.energy = Math.min(100, G.energy + 5); AU.sfx('slip'); pop(bx, by - 34, 'SLIPSTREAM! +' + 30 * G.mult, '#9ff0ff', 18); } } } }
      }
      if (hitThis) { if (G.inv <= 0 && G.burstT <= 0) { e.hitDone = true; } hit(); e.nearT = 0; }
      else if (hasNm && minHaz < BR + NM) e.nearT = 1;
      else if (e.nearT && minHaz > BR + NM + 6) { e.nearT = 0; if (!e.hitDone && !e.nmDone) { e.nmDone = true; nearMiss(); } }
    }
    if (!slipIn) G.slipMeter = Math.max(0, G.slipMeter - dt);
    // cull
    var left = G.camX - 400;
    G.act = G.act.filter(function (e) { if (e.dead) return false; var r = e.def.right ? e.def.right(e) : (e.x || 0) + 100; return r > left; });
    // particles & pops
    for (var p = G.parts.length - 1; p >= 0; p--) { var q = G.parts[p]; q.life -= rdt; if (q.life <= 0) { G.parts.splice(p, 1); continue; } q.x += q.vx * rdt; q.y += q.vy * rdt; if (q.kind === 'drop') q.vy += 900 * rdt; else if (q.kind === 'feather') { q.vy += 60 * rdt; q.vx *= 0.98; } }
    for (var pi = 0; pi < G.pops.length; pi++) { G.pops[pi].life -= rdt; G.pops[pi].y -= 30 * rdt; }
    G.pops = G.pops.filter(function (q2) { return q2.life > 0; });
    if (G.banner) { G.banner.life -= rdt; if (G.banner.life <= 0) G.banner = null; }
    if (G.tip) { G.tip.life -= rdt; if (G.tip.life <= 0) G.tip = null; }
    if (G.lowBonus && Math.random() < 0.6) part(G.bx - 20, SEA - 2, -G.speed * 0.3, -60 - Math.random() * 80, 0.4, 'rgba(235,250,255,0.85)', 2.5, 'drop');
    if (G.burstT > 0) part(G.bx - 26, G.by + (Math.random() - 0.5) * 14, -200, 0, 0.3, 'rgba(160,240,255,0.8)', 4, 'spark');
    if (L.id === 5 && !G.musicSwitched && G.bx > 21600) { G.musicSwitched = true; AU.music('ghost'); musicInt(); }
    if (G.bx >= L.len) complete();
  }

  // ---------------- drawing ----------------
  function drawBG(img, par, cam) {
    if (!img || !img.complete || !img.naturalWidth) { c.fillStyle = '#7cc8f0'; c.fillRect(0, 0, W, H); return; }
    var ih = H, iw = ih * img.naturalWidth / img.naturalHeight; if (iw < W) { iw = W; ih = iw * img.naturalHeight / img.naturalWidth; }
    var oy = (H - ih) * 0.5, off = (cam * par * scale) % (iw * 2), x0 = -off;
    for (var i = 0; x0 + i * iw < W; i++) {
      var x = x0 + i * iw; if (x + iw < 0) continue;
      if (i % 2 === 1) { c.save(); c.translate(x + iw, oy); c.scale(-1, 1); c.drawImage(img, 0, 0, iw, ih); c.restore(); } else c.drawImage(img, x, oy, iw, ih);
    }
  }
  function waveY(x) { return SEA - 3 + Math.sin(x * 0.035 + G.t * 2.2) * 2.5 + Math.sin(x * 0.011 - G.t * 1.3) * 3; }
  function drawWater(cols) {
    var bot = (H - offY) / scale + 10, x0 = G.camX - 20, x1 = G.camX + viewW + 20;
    var g = c.createLinearGradient(0, SEA - 8, 0, Math.max(SEA + 60, bot)); g.addColorStop(0, cols[0]); g.addColorStop(0.35, cols[1]); g.addColorStop(1, cols[2]);
    c.globalAlpha = 0.78; c.fillStyle = g; c.beginPath(); c.moveTo(x0, bot);
    for (var x = x0; x <= x1; x += 16) c.lineTo(x, waveY(x));
    c.lineTo(x1, bot); c.closePath(); c.fill(); c.globalAlpha = 1;
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 2; c.beginPath();
    for (var x2 = x0; x2 <= x1; x2 += 16) { if (x2 === x0) c.moveTo(x2, waveY(x2)); else c.lineTo(x2, waveY(x2)); } c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.35)';
    var base = Math.floor(G.camX / 140) * 140;
    for (var k = 0; k < Math.ceil(viewW / 140) + 3; k++) { var id = Math.floor(base / 140) + k, sx = base + k * 140 + ((id * 53) % 70) - 140, sy = SEA + 12 + ((id * 37) % 50); c.fillRect(sx, sy, 18 + (id % 3) * 8, 2); }
  }
  function drawGround() {
    var gr = G.L.ground || [], night = G.L.id === 6, bot = (H - offY) / scale + 10;
    gr.forEach(function (s) {
      if (s.x1 < G.camX - 50 || s.x0 > G.camX + viewW + 50) return;
      var a = Math.max(s.x0, G.camX - 50), b = Math.min(s.x1, G.camX + viewW + 50);
      var g = c.createLinearGradient(0, SEA - 10, 0, bot);
      if (s.type === 'grass') { g.addColorStop(0, '#8fe066'); g.addColorStop(0.15, '#4caf3e'); g.addColorStop(1, '#2d7a2b'); }
      else if (night) { g.addColorStop(0, '#77735f'); g.addColorStop(1, '#2c2b27'); }
      else { g.addColorStop(0, '#fff3d0'); g.addColorStop(0.3, '#f0dca8'); g.addColorStop(1, '#d8bf86'); }
      c.fillStyle = g; c.beginPath(); c.moveTo(a, bot);
      for (var x = a; x <= b + 20; x += 20) { var e = Math.max(0, Math.min(1, (x - s.x0) / 120, (s.x1 - x) / 120)); c.lineTo(x, SEA + 18 - 26 * e + Math.sin(x * 0.01) * 2); }
      c.lineTo(b + 20, bot); c.closePath(); c.fill();
      if (s.type === 'grass') { for (var f = Math.ceil(a / 900) * 900; f < b; f += 900) { ART.flag(c, f + 200, SEA - 6, '#e63b2e'); c.fillStyle = '#f2e3b0'; ART.ell(c, f + 520, SEA + 2, 40, 6); c.fill(); } }
      if (s.type === 'beach') { for (var p = Math.ceil(a / 700) * 700; p < b; p += 700) { ART.towel(c, p + 120, SEA + 2, '#ff9bd2'); } }
      if (s.type === 'shore') { c.fillStyle = '#1d3524'; for (var q = Math.ceil(a / 160) * 160; q < b; q += 160) { ART.ell(c, q, SEA - 2, 40, 16); c.fill(); } }
    });
  }
  function drawMid() {
    var L = G.L, par = 0.35, mc = G.camX * par;
    function mxs(x) { return G.camX + (x - mc); }
    var start = Math.floor(mc / 600) * 600;
    c.save(); c.globalAlpha = 0.85;
    for (var k = start - 600; k < mc + viewW + 600; k += 600) {
      var h = Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1, x = mxs(k + h * 300), y0 = SEA - 34;
      if (L.id === 1 || L.id === 3 || L.id === 4) { if (h < 0.4) ART.pirogue(c, x, y0, 56, ['#ff4f6d', '#2f9be8', '#ffb400'][Math.floor(h * 20) % 3], G.t); else if (h < 0.7 && L.id !== 1) { c.fillStyle = 'rgba(255,255,255,0.95)'; ART.poly(c, [x, y0 - 70, x, y0 - 6, x - 34, y0 - 6]); c.fill(); c.fillStyle = '#e8eef2'; c.fillRect(x - 40, y0 - 6, 60, 7); } }
      if (L.id === 2 && h < 0.5) { c.fillStyle = 'rgba(60,55,52,0.75)'; ART.poly(c, [x - 50, SEA - 26, x - 10, SEA - 66 - h * 60, x + 40, SEA - 26]); c.fill(); }
      if (L.id === 5 && h < 0.4 && G.bx < 21000) ART.pirogue(c, x, y0, 56, '#e8443a', G.t);
      if (L.id === 6 && h < 0.35) { c.fillStyle = '#0d1426'; ART.poly(c, [x - 70, SEA - 26, x - 20, SEA - 60, x + 30, SEA - 64, x + 80, SEA - 26]); c.fill(); }
    }
    c.globalAlpha = 1;
    if (L.id === 1) { var cx = mxs(L.len * par + viewW * 0.42); if (cx > G.camX - 500 && cx < G.camX + viewW + 500) { c.fillStyle = '#4f9a3c'; c.beginPath(); c.moveTo(cx - 280, SEA - 24); c.quadraticCurveTo(cx, SEA - 96, cx + 320, SEA - 24); c.closePath(); c.fill(); ART.palm(c, cx - 150, SEA - 50, 70, G.t); ART.church(c, cx, SEA - 62, 0.75); } }
    if (L.id === 6) { var lh = lighthousePos(); ART.lighthouse(c, lh.x, lh.base, lh.s, true); }
    if (L.id === 3) { var lx = mxs(21000 * par + viewW * 0.6); if (lx > G.camX - 300 && lx < G.camX + viewW + 300) { c.fillStyle = '#d9c48a'; c.beginPath(); c.moveTo(lx - 200, SEA - 28); c.quadraticCurveTo(lx, SEA - 110, lx + 220, SEA - 28); c.fill(); c.fillStyle = '#fff'; c.fillRect(lx - 7, SEA - 150, 14, 62); c.fillStyle = '#e8443a'; c.fillRect(lx - 9, SEA - 162, 18, 12); } }
    c.restore();
  }
  function lighthousePos() { return { x: G.camX + viewW * (0.9 - 0.62 * G.prog), base: SEA - 30, s: 0.72 }; }
  function drawNight() {
    var lh = lighthousePos(), lampX = lh.x, lampY = lh.base - 196 * lh.s;
    var ang = G.t * 0.85, half = 0.26, len = 1800;
    dc.setTransform(1, 0, 0, 1, 0, 0); dc.globalCompositeOperation = 'source-over'; dc.clearRect(0, 0, dark.width, dark.height);
    dc.fillStyle = 'rgba(3,7,22,0.9)'; dc.fillRect(0, 0, dark.width, dark.height);
    dc.setTransform(dpr * scale, 0, 0, dpr * scale, -G.camX * dpr * scale, dpr * offY);
    dc.globalCompositeOperation = 'destination-out';
    var g = dc.createRadialGradient(lampX, lampY, 10, lampX, lampY, len);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.97)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
    dc.fillStyle = g;
    for (var b = 0; b < 2; b++) { var a0 = ang + b * Math.PI; dc.beginPath(); dc.moveTo(lampX, lampY); dc.arc(lampX, lampY, len, a0 - half, a0 + half); dc.closePath(); dc.fill(); }
    var bg2 = dc.createRadialGradient(G.bx, G.by, 6, G.bx, G.by, 80); bg2.addColorStop(0, 'rgba(0,0,0,0.85)'); bg2.addColorStop(1, 'rgba(0,0,0,0)');
    dc.fillStyle = bg2; dc.fillRect(G.bx - 85, G.by - 85, 170, 170);
    G.act.forEach(function (o) {
      if (o.type === 'buoy' && o.light) { var gg = dc.createRadialGradient(o.x, SEA - 30, 2, o.x, SEA - 30, 50); gg.addColorStop(0, 'rgba(0,0,0,0.9)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); dc.fillStyle = gg; dc.fillRect(o.x - 55, SEA - 85, 110, 110); }
      if (o.type === 'nestZone') { [o.x - o.w / 2, o.x + o.w / 2].forEach(function (px) { var g3 = dc.createRadialGradient(px, SEA - 46, 2, px, SEA - 46, 44); g3.addColorStop(0, 'rgba(0,0,0,0.85)'); g3.addColorStop(1, 'rgba(0,0,0,0)'); dc.fillStyle = g3; dc.fillRect(px - 46, SEA - 92, 92, 92); }); }
    });
    var sky = dc.createLinearGradient(0, -offY / scale, 0, 200); sky.addColorStop(0, 'rgba(0,0,0,0.6)'); sky.addColorStop(1, 'rgba(0,0,0,0)');
    dc.fillStyle = sky; dc.fillRect(G.camX - 20, -offY / scale - 10, viewW + 40, 210 + offY / scale);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(dark, 0, 0); c.restore();
    c.save(); c.globalCompositeOperation = 'lighter';
    var bgw = c.createRadialGradient(lampX, lampY, 4, lampX, lampY, len * 0.75); bgw.addColorStop(0, 'rgba(255,240,170,0.32)'); bgw.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = bgw;
    for (var b2 = 0; b2 < 2; b2++) { var a1 = ang + b2 * Math.PI; c.beginPath(); c.moveTo(lampX, lampY); c.arc(lampX, lampY, len, a1 - half * 0.75, a1 + half * 0.75); c.closePath(); c.fill(); }
    c.restore();
    var lg = c.createRadialGradient(lampX, lampY, 2, lampX, lampY, 30); lg.addColorStop(0, 'rgba(255,250,210,1)'); lg.addColorStop(1, 'rgba(255,250,210,0)'); c.fillStyle = lg; c.fillRect(lampX - 30, lampY - 30, 60, 60);
  }
  function eachLayer(layer) { for (var i = 0; i < G.act.length; i++) { var o = G.act[i]; if (!o.dead && o.def && o.def.draw && (o.def.layer === undefined ? 1 : o.def.layer) === layer) o.def.draw(c, o); } }
  function render() {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!G || mode === 'title' || mode === 'levels' || mode === 'how') { drawTitle(); return; }
    var L = G.L;
    drawBG(IMG[L.bg], 0.06, G.camX);
    if (L.id === 5 && G.bx > 21600) { c.fillStyle = 'rgba(30,70,70,' + Math.min(0.38, (G.bx - 21600) / 3000) + ')'; c.fillRect(0, 0, W, H); }
    if (G.rain) { c.fillStyle = 'rgba(30,40,60,0.38)'; c.fillRect(0, 0, W, H); }
    var sh = G.shake > 0 ? (Math.random() - 0.5) * 24 * G.shake : 0, sh2 = G.shake > 0 ? (Math.random() - 0.5) * 24 * G.shake : 0;
    c.setTransform(dpr * scale, 0, 0, dpr * scale, (-G.camX * scale + sh) * dpr, (offY + sh2) * dpr);
    drawMid();
    var under = G.by > SEA - 4;
    eachLayer(0);
    if (under) drawBird();
    drawWater(L.water);
    drawGround();
    eachLayer(1);
    if (G.bx > L.len - viewW * 1.5) finishLine(c, L.len, 'FINI! ' + L.short.toUpperCase());
    if (!under) drawBird();
    for (var i = 0; i < G.parts.length; i++) {
      var q = G.parts[i], a = Math.max(0, q.life / q.max);
      if (q.kind === 'feather') { c.save(); c.translate(q.x, q.y); c.rotate(q.life * 5); c.fillStyle = 'rgba(255,255,255,' + a + ')'; ART.ell(c, 0, 0, q.size, q.size * 0.3); c.fill(); c.restore(); }
      else if (q.kind === 'smoke') ART.smoke(c, q.x, q.y, q.size * (2 - a), 0.5 * a);
      else { c.globalAlpha = a; c.fillStyle = q.col; c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); c.globalAlpha = 1; }
    }
    eachLayer(2);
    if (L.id === 6) drawNight();
    for (var pi = 0; pi < G.pops.length; pi++) { var p = G.pops[pi]; c.globalAlpha = Math.min(1, p.life * 2); txt(p.text, p.x, p.y, p.size, p.col, 'center'); c.globalAlpha = 1; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (G.rain) drawRain();
    if (G.rain && !G.lightning && Math.random() < 0.004) { G.lightning = 0.3; AU.sfx('thunder'); }
    if (G.lightning > 0) { c.fillStyle = 'rgba(255,255,240,' + Math.min(0.5, G.lightning) + ')'; c.fillRect(0, 0, W, H); }
    if (G.nmFlash > 0) { var vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); vg.addColorStop(0, 'rgba(160,240,255,0)'); vg.addColorStop(1, 'rgba(160,240,255,' + G.nmFlash * 1.6 + ')'); c.fillStyle = vg; c.fillRect(0, 0, W, H); }
    if (G.hitSlow > 0.9) { c.fillStyle = 'rgba(255,60,60,' + (G.hitSlow - 0.9) + ')'; c.fillRect(0, 0, W, H); }
    if (G.flash > 0) { c.fillStyle = 'rgba(255,255,255,' + Math.min(0.94, G.flash * 1.1) + ')'; c.fillRect(0, 0, W, H); }
    drawHUD();
  }
  function drawBird() {
    var blink = G.inv > 0 && Math.floor(G.inv * 12) % 2 === 0;
    var tilt = Math.max(-0.5, Math.min(0.7, G.vy / 700)); if (G.dive === 1) tilt = 1.1;
    var sx = G.bx, sy = G.by;
    if (G.slipT > 0 || G.burstT > 0) { c.strokeStyle = 'rgba(160,240,255,0.65)'; c.lineWidth = 2; for (var i = 0; i < 4; i++) { c.beginPath(); c.moveTo(sx - 40 - i * 18, sy - 12 + i * 8); c.lineTo(sx - 95 - i * 18, sy - 12 + i * 8); c.stroke(); } }
    ART.bird(c, sx, sy, { t: G.t, flap: G.flapPh, glide: G.glide || (G.dive ? 1 : 0), tilt: tilt, streamers: G.streamers, maxStreamers: G.maxStreamers, roll: G.rollT > 0 ? 1 - G.rollT / 0.6 : 0, blink: blink, wet: G.wet > 0, vyTail: -G.vy / 600, scale: 1.05, glow: G.L.id === 6 ? 0.25 : 0 });
    if (G.wet > 0 && Math.random() < 0.3) part(sx - 10, sy + 8, -40, 60, 0.4, 'rgba(200,240,255,0.9)', 2.5, 'drop');
  }
  var rainDrops = [];
  function drawRain() {
    if (!rainDrops.length) for (var i = 0; i < 160; i++) rainDrops.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.6 });
    c.strokeStyle = 'rgba(200,220,255,0.55)'; c.lineWidth = 1.3; c.beginPath();
    rainDrops.forEach(function (d) { d.y += 0.03 * d.s; d.x -= 0.006 * d.s; if (d.y > 1) { d.y = 0; d.x = Math.random() * 1.1; } if (d.x < 0) d.x += 1.1; var x = d.x * W, y = d.y * H; c.moveTo(x, y); c.lineTo(x - 6, y + 18 * d.s); });
    c.stroke();
  }
  function txt(s, x, y, size, col, align, stroke) {
    c.font = '900 ' + size + 'px "Trebuchet MS", "Segoe UI", Roboto, sans-serif'; c.textAlign = align || 'left'; c.textBaseline = 'middle';
    c.lineWidth = Math.max(3, size / 5); c.strokeStyle = stroke || 'rgba(10,30,50,0.85)'; c.lineJoin = 'round'; c.strokeText(s, x, y); c.fillStyle = col; c.fillText(s, x, y);
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  }
  function ordinal(n) { return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'); }
  function roundRect(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function racePlace() { var p = 1; G.ents.forEach(function (e) { if (e.type === 'racer' && e.x > G.bx) p++; }); return p; }
  function drawHUD() {
    var u = Math.max(0.75, Math.min(1.5, Math.min(W, H) / 430)), pad = 12 * u, top = portrait ? Math.max(pad, offY * 0.2) : pad;
    txt(String(G.score), pad, top + 18 * u, 30 * u, '#ffffff');
    var mx = pad + 4 * u, my = top + 54 * u, r = 17 * u;
    c.fillStyle = G.mult >= 8 ? '#ff5a3c' : G.mult >= 4 ? '#ffb400' : '#2fb3d6'; c.beginPath(); c.arc(mx + r, my, r, 0, 6.28); c.fill();
    if (G.comboT > 0) { c.strokeStyle = '#fff'; c.lineWidth = 3 * u; c.beginPath(); c.arc(mx + r, my, r + 3 * u, -1.57, -1.57 + 6.28 * (G.comboT / 4.5)); c.stroke(); }
    txt('x' + G.mult, mx + r, my + 1, 16 * u, '#fff', 'center', 'rgba(0,0,0,0.4)');
    if (G.chain > 0) txt(G.chain + ' combo', mx + 2 * r + 8 * u, my, 13 * u, '#e8fbff');
    var pw = portrait ? W * 0.5 : Math.min(W * 0.34, 360 * u), px = (W - pw) / 2, py = top + 8 * u;
    if (portrait) { px = pad; py = top + 84 * u; pw = W - pad * 2; }
    c.fillStyle = 'rgba(0,20,40,0.45)'; roundRect(px, py, pw, 10 * u, 5 * u); c.fill();
    var gr = c.createLinearGradient(px, 0, px + pw, 0); gr.addColorStop(0, '#5ee0ff'); gr.addColorStop(1, '#ffd23a');
    c.fillStyle = gr; roundRect(px, py, Math.max(10 * u, pw * G.prog), 10 * u, 5 * u); c.fill();
    if (G.L.id === 5) { var rx = px + pw * (G.L.raceEnd / G.L.len); c.fillStyle = '#fff'; c.fillRect(rx - 1, py - 3 * u, 2, 16 * u); }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(px + pw * G.prog, py + 5 * u, 7 * u, 0, 6.28); c.fill(); c.fillStyle = '#ff9d1c'; c.beginPath(); c.arc(px + pw * G.prog + 5 * u, py + 5 * u, 2.5 * u, 0, 6.28); c.fill();
    txt(G.L.short + (G.L.id === 5 && !G.raceDone ? '  -  RACE ' + ordinal(racePlace()) + ' / 6' : ''), px + pw / 2, py + 24 * u, 13 * u, '#ffffff', 'center');
    if (G.lowBonus) txt('LOW & FAST +12%', px + pw / 2, py + 42 * u, 12 * u, '#9ff0ff', 'center');
    var ew = 140 * u, ex = W - pad - ew - (portrait ? 0 : 96 * u), ey = top + 16 * u;
    if (portrait) ey = top + 56 * u;
    c.fillStyle = 'rgba(0,20,40,0.5)'; roundRect(ex, ey - 8 * u, ew, 16 * u, 8 * u); c.fill();
    var ec = G.energy < 25 ? (Math.floor(G.t * 6) % 2 ? '#ff5a3c' : '#ff9d7a') : G.energy < 50 ? '#ffd23a' : '#5ee0a0';
    c.fillStyle = ec; if (G.energy > 1) { roundRect(ex + 2 * u, ey - 6 * u, Math.max(6 * u, (ew - 4 * u) * G.energy / 100), 12 * u, 6 * u); c.fill(); }
    ART.fish(c, ex - 16 * u, ey, Math.PI, 0.9 * u, false, G.t);
    for (var i = 0; i < G.maxStreamers; i++) {
      var on = i < G.streamers, fx = ex + i * 24 * u + 4 * u, fy = ey + 20 * u;
      c.strokeStyle = on ? '#ffffff' : 'rgba(255,255,255,0.22)'; c.lineWidth = 3.2 * u; c.lineCap = 'round';
      c.beginPath(); c.moveTo(fx, fy); c.quadraticCurveTo(fx + 8 * u, fy + 7 * u, fx + 18 * u, fy + 2 * u + Math.sin(G.t * 6 + i) * 2 * u); c.stroke();
    }
    txt('TAIL', ex + G.maxStreamers * 24 * u + 6 * u, ey + 22 * u, 10 * u, 'rgba(255,255,255,0.8)');
    if (G.slipMeter > 0) { c.fillStyle = 'rgba(160,240,255,0.9)'; roundRect(W / 2 - 50 * u, H - 40 * u, 100 * u * Math.min(1, G.slipMeter / 0.7), 8 * u, 4 * u); c.fill(); txt('SLIPSTREAM', W / 2, H - 50 * u, 12 * u, '#9ff0ff', 'center'); }
    if (G.banner) { var b = G.banner, k = Math.min(1, (2 - b.life) * 6), a = Math.min(1, b.life * 2); c.globalAlpha = a; txt(b.text, W / 2, H * 0.3, 44 * u * (0.7 + 0.3 * k), b.col, 'center'); if (b.sub) txt(b.sub, W / 2, H * 0.3 + 38 * u, 15 * u, '#ffffff', 'center'); c.globalAlpha = 1; }
    if (G.tip) { var tw = Math.min(W - 20, 520 * u), ty = portrait ? H - Math.max(80 * u, offY * 0.6) : H - 70 * u; c.globalAlpha = Math.min(1, G.tip.life * 2); c.fillStyle = 'rgba(0,25,45,0.62)'; roundRect((W - tw) / 2, ty, tw, 34 * u, 17 * u); c.fill(); txt(G.tip.text, W / 2, ty + 17 * u, 14 * u, '#ffffff', 'center'); c.globalAlpha = 1; }
    if (DEMO) txt('DEMO', pad, H - 16 * u, 12 * u, 'rgba(255,255,255,0.7)');
    setBtnCd('btnBurst', G.burstCd); setBtnCd('btnRoll', G.rollCd);
  }
  function setBtnCd(id, k) { var b = $(id); if (b && !b.classList.contains('hidden')) b.style.opacity = k > 0 ? 0.45 : 1; }
  function drawTitle() {
    var img = IMG.title; c.fillStyle = '#f7a26b'; c.fillRect(0, 0, W, H);
    if (img && img.complete && img.naturalWidth) {
      var z = 1.05 + Math.sin(titleT * 0.15) * 0.03, ih = H * z, iw = ih * img.naturalWidth / img.naturalHeight; if (iw < W * z) { iw = W * z; ih = iw * img.naturalHeight / img.naturalWidth; }
      var ox = portrait ? (W - iw) * 0.3 : (W - iw) / 2;
      c.drawImage(img, ox + Math.sin(titleT * 0.1) * 10, (H - ih) / 2, iw, ih);
    }
    for (var i = 0; i < 40; i++) { var x = ((i * 97.3 + titleT * 12) % W), y = H * 0.7 + ((i * 53) % (H * 0.28)); var a = 0.4 + 0.4 * Math.sin(titleT * 3 + i); c.fillStyle = 'rgba(255,245,210,' + a + ')'; c.fillRect(x, y, 3, 1.5); }
    var vg = c.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, 'rgba(40,10,40,0.2)'); vg.addColorStop(0.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,20,40,0.5)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
  }

  // ---------------- flow / screens ----------------
  var screens = ['title', 'levels', 'card', 'pause', 'over', 'done', 'how'];
  function show(id) {
    screens.forEach(function (s) { var el = $(s); if (el) el.classList.toggle('hidden', s !== id); });
    var play = id === null; ['btnPause', 'btnMute'].forEach(function (b) { $(b).classList.toggle('hidden', !play); });
    [['btnDive', 'dive'], ['btnBurst', 'burst'], ['btnRoll', 'roll']].forEach(function (p) { $(p[0]).classList.toggle('hidden', !(play && G && hasPerk(p[1]))); });
    $('btnMute').textContent = save.mute ? '\u{1F507}' : '\u266B';
  }
  function toTitle() { mode = 'title'; G = null; show('title'); if (AU.ready()) { AU.music('title'); AU.setIntensity(2); AU.ambience('surf'); } refreshTitle(); }
  function refreshTitle() {
    var tot = 0, stars = 0; for (var i = 1; i <= 6; i++) { var b = save.best[i]; if (b) { tot += b.score; stars += b.stars; } }
    $('bestLine').textContent = stars ? ('\u2605 ' + stars + ' / 18   -   Total best ' + tot) : 'Fly the paille-en-queue round Mauritius!';
    $('btnSound').textContent = 'SOUND: ' + (save.mute ? 'OFF' : 'ON'); $('btnVibe').textContent = 'VIBRATION: ' + (save.vibe ? 'ON' : 'OFF');
  }
  function buildLevels() {
    var grid = $('levelGrid'); grid.innerHTML = '';
    LEVELS.forEach(function (L) {
      var locked = L.id > save.unlocked && !QLEVEL, b = save.best[L.id], el = document.createElement('button');
      el.className = 'lvl' + (locked ? ' locked' : '');
      el.style.backgroundImage = 'linear-gradient(180deg, rgba(0,0,0,0) 25%, rgba(0,20,40,0.88)), url(' + (ASSETS[L.bg] || '') + ')';
      var st = ''; for (var i = 0; i < 3; i++) st += '<span class="' + (b && b.stars > i ? 'on' : '') + '">\u2605</span>';
      el.innerHTML = '<div class="num">' + L.id + '</div><div class="nm">' + L.name + '</div><div class="st">' + st + '</div><div class="bs">' + (locked ? '\u{1F512} Finish level ' + (L.id - 1) : b ? 'Best ' + b.score : 'Unlocks: ' + PERKS[L.perk].name) + '</div>';
      el.addEventListener('click', function () { AU.init(); if (!locked) { AU.sfx('click'); openCard(L.id); } else AU.sfx('penalty'); });
      grid.appendChild(el);
    });
  }
  function openCard(n) {
    var L = LEVELS[n - 1]; mode = 'card'; show('card');
    $('cardKicker').textContent = L.kicker; $('cardTitle').textContent = L.name; $('cardText').textContent = L.theme;
    $('cardTips').innerHTML = L.tips.map(function (t) { return '<li>' + t + '</li>'; }).join('');
    $('card').style.backgroundImage = 'linear-gradient(180deg, rgba(0,20,40,0.55), rgba(0,20,40,0.85)), url(' + (ASSETS[L.bg] || '') + ')';
    $('btnCard').onclick = function (e) { if (e) e.stopPropagation(); AU.init(); AU.sfx('click'); startLevel(n); };
  }
  function startLevel(n) {
    newRun(n); mode = 'play'; show(null); input.hold = false; input.press = false;
    AU.music(G.L.music); AU.setIntensity(1); AU.ambience(G.L.amb);
  }
  function pause() { if (mode !== 'play') return; mode = 'pause'; show('pause'); AU.stopMusic(); input.hold = false; $('btnPauseVibe').textContent = 'VIBRATION: ' + (save.vibe ? 'ON' : 'OFF'); }
  function resume() { if (mode !== 'pause') return; mode = 'play'; show(null); AU.music(G.L.id === 5 && G.musicSwitched ? 'ghost' : G.L.music); musicInt(); }
  function gameOver(reason) {
    if (G.over || G.done) return; G.over = true; G.reason = reason; AU.sfx('lose'); vibe([60, 40, 120]); AU.stopMusic();
    var go = function () { if (!G || !G.over) return; mode = 'over'; show('over'); $('overReason').textContent = reason; $('overStats').innerHTML = statsHTML(); };
    if (CAPTURE) go(); else setTimeout(go, 900);
  }
  function starsFor() { var pct = G.fishTotal ? Math.min(1, G.fish / G.fishTotal) : 0, h = DEMO ? G.demoHits : G.hits, s = 1; if (pct >= 0.4) s++; if (pct >= 0.6 && h <= 1) s++; if (G.L.id === 5 && G.place === 1 && s === 2) s++; return Math.min(3, s); }
  function statsHTML() {
    var pct = G.fishTotal ? Math.round(100 * G.fish / G.fishTotal) : 0;
    return '<div><b>' + G.score + '</b> points</div><div>Fish ' + G.fish + ' / ' + G.fishTotal + ' (' + pct + '%)</div><div>Near misses ' + G.nm + '  -  Best combo x' + G.bestMult + '</div>' +
      '<div>Hits ' + (DEMO ? G.demoHits : G.hits) + (G.L.id === 1 ? '  -  Umbrella bounces ' + G.bounces : '') + (G.L.id === 3 || G.L.id === 5 ? '  -  Slipstreams ' + G.slips : '') + (G.L.id === 6 ? '  -  Penalties ' + G.penalties : '') + '</div>' +
      (G.L.id === 5 && G.place ? '<div>Regatta: <b>' + ordinal(G.place) + '</b> (+' + G.raceBonus + ')</div>' : '');
  }
  function complete() {
    if (G.done || G.over) return; G.done = true;
    var bonus = G.streamers * 200 + Math.round(G.energy * 2); G.score += bonus;
    var stars = starsFor(); G.stars = stars;
    var n = G.L.id, prev = save.best[n], isBest = !prev || G.score > prev.score;
    var perk = G.L.perk, newPerk = save.perks.indexOf(perk) < 0;
    if (!DEMO) {
      save.best[n] = { score: Math.max(G.score, prev ? prev.score : 0), stars: Math.max(stars, prev ? prev.stars : 0) };
      if (save.unlocked < n + 1) save.unlocked = Math.min(6, n + 1);
      if (newPerk) save.perks.push(perk);
      writeSave();
    }
    AU.sfx('win'); AU.setIntensity(4); vibe(50);
    banner('Bravo!', 'Level complete', '#ffd23a');
    var go = function () {
      if (!G || !G.done) return; mode = 'done'; show('done');
      $('doneKicker').textContent = G.L.kicker; $('doneTitle').textContent = G.L.name;
      $('doneStats').innerHTML = statsHTML() + '<div>Finish bonus +' + bonus + ' (tail feathers & energy)</div>' + (isBest && !DEMO ? '<div class="newbest">NEW BEST!</div>' : '') + (n >= 6 ? '<div class="newbest">All 6 levels flown! More islands are coming.</div>' : '');
      var st = $('doneStars'); st.innerHTML = ''; for (var i = 0; i < 3; i++) { var s = document.createElement('span'); s.textContent = '\u2605'; s.className = i < stars ? 'on' : ''; s.style.animationDelay = (0.2 + i * 0.3) + 's'; st.appendChild(s); }
      for (var j = 0; j < stars; j++) setTimeout(function () { AU.sfx('star'); }, 200 + j * 300);
      var P = PERKS[perk]; $('donePerk').innerHTML = '<div class="picon">' + P.icon + '</div><div><div class="pk">' + (newPerk || DEMO ? 'NEW MOVE UNLOCKED' : 'YOUR MOVE') + '</div><div class="pn">' + P.name + '</div><div class="pd">' + P.desc + '</div></div>';
      $('btnNext').classList.toggle('hidden', n >= 6);
      if (DEMO && !CAPTURE && n < 6) setTimeout(function () { startLevel(n + 1); }, 3000);
    };
    if (CAPTURE) go(); else setTimeout(go, 1300);
  }
  btn('btnPlay', function () { var n = Math.min(6, save.unlocked); for (var i = 1; i <= save.unlocked; i++) if (!save.best[i]) { n = i; break; } openCard(n); });
  btn('btnLevels', function () { mode = 'levels'; buildLevels(); show('levels'); });
  btn('btnHow', function () { mode = 'how'; show('how'); });
  btn('btnHowBack', function () { toTitle(); });
  btn('btnLevelsBack', function () { toTitle(); });
  btn('btnCardBack', function () { mode = 'levels'; buildLevels(); show('levels'); });
  btn('btnPause', pause); btn('btnResume', resume);
  btn('btnQuit', function () { toTitle(); });
  btn('btnRetry', function () { startLevel(G.L.id); }); btn('btnOverLevels', function () { mode = 'levels'; buildLevels(); show('levels'); });
  btn('btnNext', function () { openCard(Math.min(6, G.L.id + 1)); }); btn('btnDoneRetry', function () { startLevel(G.L.id); }); btn('btnDoneLevels', function () { mode = 'levels'; buildLevels(); show('levels'); });
  btn('btnSound', function () { save.mute = !save.mute; AU.setMuted(save.mute); writeSave(); refreshTitle(); });
  btn('btnVibe', function () { save.vibe = !save.vibe; writeSave(); refreshTitle(); vibe(30); });
  btn('btnMute', function () { save.mute = !save.mute; AU.setMuted(save.mute); writeSave(); $('btnMute').textContent = save.mute ? '\u{1F507}' : '\u266B'; });
  btn('btnPauseVibe', function () { save.vibe = !save.vibe; writeSave(); $('btnPauseVibe').textContent = 'VIBRATION: ' + (save.vibe ? 'ON' : 'OFF'); });
  document.addEventListener('pointerdown', function () { AU.init(); AU.setMuted(save.mute); if ((mode === 'title' || mode === 'levels' || mode === 'how') && !AU.musicOn()) { AU.music('title'); AU.setIntensity(2); AU.ambience('surf'); } }, true);

  // ---------------- main loop ----------------
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; titleT += dt;
    if (!CAPTURE && mode === 'play') { var steps = Math.max(1, Math.ceil(dt / (1 / 60))); for (var i = 0; i < steps; i++) update(dt / steps); }
    if (!CAPTURE) render();
    requestAnimationFrame(frame);
  }

  // ---------------- test hooks ----------------
  window.__pq = {
    get G() { return G; }, get mode() { return mode; }, save: function () { return save; }, LEVELS: LEVELS, audio: AU,
    api: {
      start: function (n) { startLevel(n); }, card: function (n) { openCard(n); },
      levels: function () { mode = 'levels'; buildLevels(); show('levels'); }, title: function () { toTitle(); }, how: function () { mode = 'how'; show('how'); },
      teleport: function (p) {
        var x = G.L.len * p; G.camX = x - G.birdOff; G.bx = x;
        for (var i = 0; i < G.ents.length; i++) { var e = G.ents[i]; if (e.act || e.type === 'racer' || e.type === 'rain' || e.type === 'frigate') continue; var d0 = T[e.type], rr = e.x1 !== undefined ? e.x1 : (e.x || 0) + 200; if (e.ax < G.camX - 600 && rr < G.camX - 300) e.act = true; }
        G.next = 0; while (G.next < G.ents.length && G.ents[G.next].act) G.next++;
        G.ents.forEach(function (e) { if (e.type === 'racer') { e.x0 = x - 500 + e.lane * 240; if (e.act) e.x = e.x0; } });
        G.act = G.act.filter(function (e) { return (e.def && e.def.right ? e.def.right(e) : 0) > G.camX - 400; });
      },
      setPerks: function (arr) { save.perks = arr.slice(); if (G) G.perks = arr.slice(); },
      dive: doDive, burst: doBurst, roll: doRoll, pause: pause, resume: resume,
      unlockAll: function () { save.unlocked = 6; writeSave(); },
      setSave: function (s) { localStorage.setItem(SKEY, JSON.stringify(s)); loadSave(); },
      complete: function () { complete(); }
    }
  };
  window.__pqAdvance = function (n, dt) {
    for (var i = 0; i < n && G && mode === 'play' && !G.done && !G.over; i++) update(dt || 1 / 30);
    titleT += n * (dt || 1 / 30);
    render();
    return G ? { mode: mode, level: G.n, prog: +G.prog.toFixed(4), score: G.score, hits: DEMO ? G.demoHits : G.hits, fish: G.fish, fishTotal: G.fishTotal, deep: G.deep, deepTotal: G.deepTotal, nm: G.nm, streamers: G.streamers, energy: Math.round(G.energy), place: G.place, done: G.done, over: G.over, reason: G.reason, stars: G.stars, t: +G.t.toFixed(1), bestMult: G.bestMult, slips: G.slips, bounces: G.bounces, penalties: G.penalties } : { mode: mode };
  };

  // ---------------- boot ----------------
  resize();
  if (QLEVEL >= 1 && QLEVEL <= 6) startLevel(QLEVEL); else toTitle();
  if (CAPTURE) render();
  requestAnimationFrame(frame);
  window.__pqReady = true;
})();
