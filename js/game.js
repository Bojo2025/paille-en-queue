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
  var W = 0, H = 0, dpr = 1, scale = 1, viewW = 960, offY = 0, offX = 0, portrait = false;
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
    offX = 0;
    if (G && G.vert) { scale = Math.min(W / (FH + 40), H / 640); viewW = H / scale; offX = (W - FH * scale) / 2; offY = 0; }
    document.body.classList.toggle('portrait', portrait);
    if (G) G.birdOff = G.vert ? viewW * 0.28 : Math.max(140, Math.min(300, viewW * 0.27));
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
    var maxS = perks.indexOf('guard') >= 0 ? 5 : 4;
    G = {
      n: n, L: L, t: 0, camX: 0, bx: 0, by: 250, vy: 0, speed: L.speed0, baseSpeed: L.speed0, prog: 0,
      energy: 100, streamers: 3, maxStreamers: maxS, score: 0, chain: 0, mult: 1, comboT: 0, bestMult: 1,
      hits: 0, nm: 0, fish: 0, fishTotal: 0, deep: 0, deepTotal: 0, bounces: 0, slips: 0, penalties: 0,
      inv: 0, hitSlow: 0, slow: 0, flash: 0, shake: 0, wet: 0, slipT: 0, slipMeter: 0, burstT: 0, burstCd: 0, rollT: 0, rollCd: 0,
      dive: 0, flapPh: 0, glide: 0, perks: perks, ents: ents, act: [], next: 0, parts: [], pops: [], banner: null, tip: null,
      rain: false, place: 0, raceDone: false, lightning: 0, done: false, over: false, reason: '', lowWarned: false,
      ai: { ty: 250, cd: 0 }, demoHits: 0, penCd: 0, musicSwitched: false, fishBoost: 0, nmFlash: 0, raceBonus: 0,
      comboMax: perks.indexOf('starnav') >= 0 ? 6 : 4.5, launchT: 0, surfT: 0, tide: 0, carry: 0, fed: 0, nests: 0, raids: 0, scares: 0, perfect: 0, arches: 0, jets: 0, surfs: 0, thermals: 0,
      dolph: 0, hoops: 0, hoopSet: -1, hoopIdx: -1, hoopChain: 0, parades: 0, stolen: 0, shaken: 0, feints: 0, rests: 0, navs: 0, gates: 0, minEnergy: 100,
      zfy: 0, zspd: 1, zdrain: 0, zthermal: 0, zsurf: 0, zrest: 0, zshade: 0, zeye: 0, zcalm: 0, zgust: 0, sunOn: false, vert: !!L.vertical
    };
    ents.forEach(function (o) {
      var d = T[o.type]; o.ax = d && d.ax ? d.ax(o) : (o.x !== undefined ? o.x : o.x0);
      if (o.type === 'fishLeap' || o.type === 'flyFish' || o.type === 'fishCorr' || o.type === 'hoverFish' || o.type === 'mirrorFish' || o.type === 'fishCanyon') G.fishTotal++; if (o.type === 'deepFish') G.deepTotal++;
      if (o.type === 'ledgeNest') G.nests++; if (o.type === 'arch') G.arches++; if (o.type === 'navGate') G.gates++;
    });
    ents.sort(function (a, b) { return a.ax - b.ax; });
    resize();
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
    var old = G.mult; G.chain += n; G.mult = multFor(G.chain); G.comboT = G.comboMax; G.bestMult = Math.max(G.bestMult, G.mult);
    if (G.mult > old) { AU.sfx('combo'); pop(G.bx, G.by - 40, 'x' + G.mult + '!', '#ffd23a', 26); if (G.mult === 8) banner('Bravo!', 'MAX COMBO x8', '#ffd23a'); }
    if (G.chain > 0 && G.chain % 10 === 0 && G.streamers < G.maxStreamers) { G.streamers++; pop(G.bx - 30, G.by + 20, '+ tail feather', '#bff3ff', 16); AU.sfx('perk'); }
    musicInt();
  }
  function addScore(v) { G.score += Math.round(v * G.mult); }
  function catchFish(o, x, y) {
    o.dead = true; if (o.type === 'deepFish') { G.deep++; pop(x, y - 30, 'Deep fish!', '#9ff0ff', 14); } else G.fish++; G.energy = Math.min(100, G.energy + 10); addScore(10); addCombo(1);
    AU.sfx('fish'); sparkle(x, y, '#cfefff', 6); pop(x, y - 14, '+' + 10 * G.mult, '#e8fbff', 15);
    if (G.L.id === 5 && !G.raceDone) G.fishBoost = 1.0;
    if (G.L.nest && G.carry < 3) { G.carry++; pop(x, y - 34, 'Carrying ' + G.carry + '/3', '#ffe27a', 13); }
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
    G.hits++; G.chain = 0; G.mult = 1; G.comboT = 0; AU.setIntensity(1); (G.hitLog = G.hitLog || []).push((G.lastHitType || why || '?') + '@' + Math.round(G.bx) + ',' + Math.round(G.by)); G.lastHitType = null;
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
  // painted tile textures (assets.js texBasalt/texForest/texWave/texTuff) as world-space patterns
  var PATS = {};
  function pat(k, sc) {
    var im = IMG[k], key = k + '|' + sc; if (!im || !im.complete || !im.naturalWidth) return null;
    if (!PATS[key]) { var p = c.createPattern(im, 'repeat'); if (p && p.setTransform && window.DOMMatrix) p.setTransform(new DOMMatrix().scale(sc || 0.5)); PATS[key] = p; }
    return PATS[key];
  }
  function texFor(col) { var r = parseInt(col.substr(1, 2), 16), g = parseInt(col.substr(3, 2), 16), b = parseInt(col.substr(5, 2), 16); if (g > r + 14 && g > b) return 'texForest'; if (r > b + 18 && r + g + b > 300) return 'texTuff'; return 'texBasalt'; }
  function rimShade(c, w) { c.save(); c.clip(); c.strokeStyle = 'rgba(0,0,0,0.38)'; c.lineWidth = w || 16; c.stroke(); c.restore(); }
  function mist(c, x, y, r, a) { var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(0.55, 'rgba(235,248,255,' + a * 0.55 + ')'); g.addColorStop(1, 'rgba(220,240,255,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  function rock(c, pts, isTop, pal) {
    c.beginPath(); c.moveTo(pts[0], isTop ? -400 : 900);
    for (var i = 0; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.lineTo(pts[pts.length - 2], isTop ? -400 : 900); c.closePath();
    var g = c.createLinearGradient(0, isTop ? -60 : 160, 0, isTop ? 300 : 560);
    if (pal) { var pc = isTop ? pal.top : pal.bot; g.addColorStop(0, pc[0]); g.addColorStop(isTop ? 0.7 : 0.35, pc[1]); g.addColorStop(1, pc[2]); }
    else if (isTop) { g.addColorStop(0, '#3a312b'); g.addColorStop(0.7, '#6e5e50'); g.addColorStop(1, '#9a8672'); } else { g.addColorStop(0, '#a89276'); g.addColorStop(0.35, '#6f5e4e'); g.addColorStop(1, '#2e2621'); }
    var tx = pat((pal && pal.tex) || 'texTuff', 0.6);
    if (tx) {
      c.fillStyle = tx; c.fill(); c.globalAlpha = 0.35; c.fillStyle = g; c.fill(); c.globalAlpha = 1;
      c.save(); c.clip(); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 22; c.beginPath(); for (var q = 0; q < pts.length; q += 2) { if (q === 0) c.moveTo(pts[q], pts[q + 1]); else c.lineTo(pts[q], pts[q + 1]); } c.stroke(); c.restore();
    } else { c.fillStyle = g; c.fill(); }
    if (!tx) { c.save(); c.clip();
    for (var j = 0; j < pts.length; j += 2) { var x = pts[j], col = Math.floor(x / 24); c.fillStyle = col % 3 === 0 ? 'rgba(255,240,220,0.10)' : col % 3 === 1 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.04)'; c.fillRect(x, isTop ? -400 : pts[j + 1], 24, isTop ? pts[j + 1] + 400 : 600); }
    c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 2;
    for (var j2 = 0; j2 < pts.length; j2 += 2) { var x2 = pts[j2]; c.beginPath(); c.moveTo(x2, pts[j2 + 1]); c.lineTo(x2 + 3, isTop ? -400 : 900); c.stroke(); if ((Math.floor(x2 / 24) * 7) % 5 === 0) { c.beginPath(); c.moveTo(x2, pts[j2 + 1] + (isTop ? -30 : 34)); c.lineTo(x2 + 24, pts[j2 + 1] + (isTop ? -26 : 30)); c.stroke(); } }
    c.restore(); }
    c.strokeStyle = isTop ? (pal ? pal.edgeTop : 'rgba(255,255,255,0.18)') : (pal ? pal.edgeBot : '#4f8a3a'); c.lineWidth = isTop ? 3 : 6; c.beginPath();
    for (var k = 0; k < pts.length; k += 2) { if (k === 0) c.moveTo(pts[k], pts[k + 1] + (isTop ? 0 : 2)); else c.lineTo(pts[k], pts[k + 1] + (isTop ? 0 : 2)); } c.stroke();
    if (!isTop) { c.fillStyle = pal ? pal.tuft : '#5f9a44'; for (var m = 0; m < pts.length; m += 6) { ART.ell(c, pts[m], pts[m + 1] + 2, 9, 5); c.fill(); } }
    else { c.fillStyle = pal ? pal.snow : 'rgba(245,245,235,0.55)'; for (var n = 0; n < pts.length; n += 6) { ART.ell(c, pts[n], pts[n + 1] - 3, 5, 2); c.fill(); } }
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
      var RC = o.col === 'basalt' ? ['#4c5058', '#141518'] : o.col === 'crystal' ? ['#fbf8f0', '#b8ae9c'] : ['#8a96a6', '#2f3744'];
      var g = c.createLinearGradient(0, SEA - o.h, 0, SEA); g.addColorStop(0, RC[0]); g.addColorStop(1, RC[1]); c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 2; c.stroke();
      if (o.col) { c.save(); c.clip(); c.strokeStyle = o.col === 'crystal' ? 'rgba(120,110,90,0.35)' : 'rgba(0,0,0,0.3)'; c.lineWidth = 2; for (var q = -3; q <= 3; q++) { c.beginPath(); c.moveTo(o.x + q * o.w / 7, SEA - o.h); c.lineTo(o.x + q * o.w / 6 + 6, SEA + 10); c.stroke(); } c.restore(); return; }
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
  // =====================================================================================
  // ----- levels 7-18: shared helpers
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function onScreen(x) { return x > G.camX - 200 && x < G.camX + viewW + 200; }
  function perkK(p, a, b) { return hasPerk(p) ? a : b; }
  function windK() { return hasPerk('wind') ? 0.6 : 1; }
  function sandH(x) {
    var sg = G.L.sandSeg; if (!sg) return 0;
    for (var i = 0; i < sg.length; i++) { var s = sg[i]; if (x > s.x0 && x < s.x1) { var e = clamp(Math.min(x - s.x0, s.x1 - x) / 320, 0, 1); e = e * e * (3 - 2 * e); return e * (70 + 30 * Math.sin(x * 0.0037 + s.x0)); } }
    return 0;
  }
  function floorAt(x) { if (!G.L.sand) return SEA + 30; return SEA + 16 - sandH(x) * G.tide; }
  function noop() {}
  function basaltPal() { return { tex: 'texBasalt', top: ['#121316', '#2c2f35', '#4b4f57'], bot: ['#5a5e66', '#2c2f35', '#111215'], edgeTop: 'rgba(255,255,255,0.14)', edgeBot: '#3d5a34', tuft: '#4f6e3a', snow: 'rgba(220,235,240,0.35)' }; }
  function forestPal() { return { tex: 'texForest', top: ['#1c2a18', '#33472a', '#55683e'], bot: ['#56703c', '#2c4022', '#141d10'], edgeTop: 'rgba(160,200,120,0.25)', edgeBot: '#5f8f3a', tuft: '#6fa040', snow: 'rgba(150,190,110,0.35)' }; }
  function rockPoly(c, pts, top, bot, edge, tex) {
    ART.poly(c, pts); var ys = pts.filter(function (v, i) { return i % 2; }), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, bot);
    var tx = pat(tex || texFor(top), 0.6);
    if (tx) { c.fillStyle = tx; c.fill(); c.globalAlpha = 0.3; c.fillStyle = g; c.fill(); c.globalAlpha = 1; rimShade(c, Math.min(18, (y1 - y0) * 0.25 + 4)); ART.poly(c, pts); }
    else {
      c.fillStyle = g; c.fill();
      c.save(); c.clip(); c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 2;
      for (var k = 0; k < pts.length - 2; k += 2) { var x = pts[k]; c.beginPath(); c.moveTo(x, pts[k + 1]); c.lineTo(x + 6, y1); c.stroke(); }
      c.restore();
    }
    c.strokeStyle = edge || 'rgba(255,255,255,0.22)'; c.lineWidth = 2; ART.poly(c, pts); c.stroke();
  }
  function hoverDraw(c, x, y) { ART.flyingFish(c, x, y, G.t); var gl = c.createRadialGradient(x, y, 2, x, y, 20); gl.addColorStop(0, 'rgba(255,255,220,0.35)'); gl.addColorStop(1, 'rgba(255,255,220,0)'); c.fillStyle = gl; c.fillRect(x - 20, y - 20, 40, 40); }
  T.hoverFish = {
    shapes: function (o) { return [{ k: 'c', x: o.x, y: o.y + Math.sin(G.t * 3 + o.x) * 6, r: 9, kd: 'fish' }]; },
    right: function (o) { return o.x + 30; },
    draw: function (c, o) { hoverDraw(c, o.x, o.y + Math.sin(G.t * 3 + o.x) * 6); }
  };
  // ----- L7 Le Souffleur: blowholes + the natural arches
  function cyc(o, t) { return ((t + o.ph) % o.per + o.per) % o.per; }
  function jetH(o, t) { var u = cyc(o, t); return u < 1.15 ? o.h * Math.pow(Math.sin(Math.PI * u / 1.15), 0.6) : 0; }
  function jetWarn(o, t) { var u = cyc(o, t); return u > o.per - 0.95 ? (u - (o.per - 0.95)) / 0.95 : 0; }
  function jetFn(e) {
    if (e.launched) { G.vy = Math.min(G.vy, -520); return; }
    e.launched = true; G.vy = -800; G.launchT = 0.55; G.jets++; addScore(50); addCombo(1);
    pop(G.bx, G.by - 30, 'JET RIDE! +' + 50 * G.mult, '#9ff0ff', 18); AU.sfx('whoosh'); splash(G.bx, 8, true);
  }
  T.blowhole = {
    rock: function (o) { return [o.x - 52, SEA + 20, o.x - 34, SEA - 16, o.x - 10, SEA - 26, o.x + 12, SEA - 22, o.x + 36, SEA - 12, o.x + 54, SEA + 20]; },
    shapes: function (o, t) { var s = [{ k: 'p', pts: this.rock(o), kd: 'haz', nm: true }], h = jetH(o, t); if (h > 40) s.push({ k: 'r', x: o.x - 26, y: SEA - h, w: 52, h: h - 28, kd: 'fn', lure: true, fn: jetFn }); return s; },
    update: function (o) {
      var w = jetWarn(o, G.t), h = jetH(o, G.t);
      if (w > 0 && !o.rum) { o.rum = true; if (onScreen(o.x)) { AU.sfx('rumble'); G.shake = Math.max(G.shake, 0.1); } }
      if (w === 0) o.rum = false;
      if (h > 40 && !o.erupt) { o.erupt = true; o.launched = false; if (onScreen(o.x)) AU.sfx('jet'); }
      if (h <= 40) o.erupt = false;
      if (h > 50 && Math.random() < 0.8) part(o.x + (Math.random() - 0.5) * 46, SEA - h + Math.random() * 40, (Math.random() - 0.5) * 160, -Math.random() * 160, 0.7, 'rgba(235,250,255,0.9)', 2 + Math.random() * 3, 'drop');
    },
    right: function (o) { return o.x + 90; },
    draw: function (c, o) {
      var h = jetH(o, G.t), w = jetWarn(o, G.t);
      if (w > 0) { // rumble warning: boiling foam and pressure rings
        for (var i = 0; i < 3; i++) { var rr = 18 + ((G.t * 60 + i * 14) % 42); c.strokeStyle = 'rgba(255,255,255,' + (0.55 * w * (1 - rr / 60)) + ')'; c.lineWidth = 2; ART.ell(c, o.x, SEA - 22, rr, rr * 0.35); c.stroke(); }
        c.fillStyle = 'rgba(255,90,60,' + (0.4 + 0.5 * Math.sin(G.t * 20)) * w + ')'; c.font = 'bold 24px sans-serif'; c.textAlign = 'center'; c.fillText('!', o.x, SEA - 60 - w * 20); c.textAlign = 'left';
      }
      if (h > 4) {
        var g = c.createLinearGradient(0, SEA - h, 0, SEA); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.5, 'rgba(210,240,255,0.8)'); g.addColorStop(1, 'rgba(160,220,245,0.6)');
        c.fillStyle = g; c.beginPath(); c.moveTo(o.x - 16, SEA - 20);
        for (var k = 0; k <= 10; k++) { var yy = SEA - 20 - (h - 20) * k / 10; c.lineTo(o.x - 16 - k * 1.6 + Math.sin(G.t * 18 + k) * 3, yy); }
        for (var k2 = 10; k2 >= 0; k2--) { var y2 = SEA - 20 - (h - 20) * k2 / 10; c.lineTo(o.x + 16 + k2 * 1.6 + Math.sin(G.t * 16 + k2 * 1.3) * 3, y2); }
        c.closePath(); c.fill();
        for (var p = 0; p < 9; p++) mist(c, o.x + Math.sin(p * 2.3 + G.t * 6) * 30, SEA - h + Math.cos(p * 1.7 + G.t * 5) * 14 + p * 4, 26, 0.7);
        for (var p2 = 0; p2 < 5; p2++) mist(c, o.x + Math.sin(p2 * 3.1 + G.t * 4) * 20, SEA - h * (0.25 + p2 * 0.15), 22, 0.35);
      }
      rockPoly(c, this.rock(o), '#4a4e56', '#16171a');
    }
  };
  function archTop(o, x) { var u = clamp((x - o.x0) / (o.x1 - o.x0), 0, 1); return o.top + 46 * (1 - Math.sin(Math.PI * u)); }
  function archLine(o) { return (o.top + 46 + SEA) / 2 + 6; }
  T.arch = {
    ax: function (o) { return o.x0; },
    shapes: function (o) {
      var s = [{ k: 'band', x0: o.x0, x1: o.x1, f: function (x) { return { top: archTop(o, x), bot: SEA + 90 }; }, kd: 'haz', nm: true }];
      if (G.bx > o.x0 - 500 && G.bx < o.x1) for (var x = o.x0 - 120; x < o.x1; x += 110) s.push({ k: 'c', x: x, y: archLine(o), r: 6, kd: 'fn', lure: true, fn: noop });
      return s;
    },
    update: function (o) {
      if (G.bx >= o.x0 && G.bx <= o.x1 && Math.abs(G.by - archLine(o)) > 42) o.broke = true;
      if (G.bx > o.x1 && !o.judged) {
        o.judged = true;
        if (!o.broke && !o.hitDone) { G.perfect++; G.score += 400; banner('PERFECT LINE!', 'Pont Naturel +400', '#ffd23a'); AU.sfx('style'); AU.sfx('call'); sparkle(G.bx, G.by, '#ffd23a', 14); addCombo(2); }
        else pop(G.bx, G.by - 30, 'Arch cleared', '#e8fbff', 16);
      }
    },
    right: function (o) { return o.x1 + 120; },
    draw: function (c, o) {
      var pts = [o.x0 - 150, -80];
      for (var j = 0; j <= 6; j++) { var u = j / 6; pts.push(o.x0 - 150 + 110 * u * u + 14 * Math.sin(j * 2.1 + o.seed), -80 + (o.top + 90) * u); }
      for (var x = o.x0; x <= o.x1; x += 30) pts.push(Math.min(x, o.x1), archTop(o, Math.min(x, o.x1)) + 4 * Math.sin(x * 0.07));
      for (var j2 = 6; j2 >= 0; j2--) { var u2 = j2 / 6; pts.push(o.x1 + 150 - 110 * u2 * u2 + 14 * Math.sin(j2 * 1.7 + o.seed), -80 + (o.top + 90) * u2); }
      pts.push(o.x1 + 150, -80);
      rockPoly(c, pts, '#2a2c31', '#5a5e66', 'rgba(255,255,255,0.3)');
      c.fillStyle = 'rgba(0,0,0,0.25)'; for (var x2 = o.x0 + 30; x2 < o.x1; x2 += 70) { ART.ell(c, x2, archTop(o, x2) - 18, 18, 6); c.fill(); }
      for (var x4 = o.x0 + 20; x4 < o.x1; x4 += 26) { var hy = archTop(o, x4); c.strokeStyle = 'rgba(70,110,50,0.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x4, hy - 2); c.quadraticCurveTo(x4 + 4, hy + 14, x4 + 1 + Math.sin(G.t * 2 + x4) * 3, hy + 22 + (x4 % 3) * 6); c.stroke(); }
      if (!o.judged) { var ly = archLine(o); c.save(); c.setLineDash([10, 10]); c.lineDashOffset = -G.t * 60; c.strokeStyle = o.broke ? 'rgba(255,120,90,0.5)' : 'rgba(255,214,70,0.85)'; c.lineWidth = 3; c.beginPath(); c.moveTo(o.x0 - 160, ly); c.lineTo(o.x1, ly); c.stroke(); c.restore(); c.strokeStyle = 'rgba(255,214,70,0.7)'; c.lineWidth = 3; ART.ell(c, o.x0, ly, 14, 42); c.stroke(); }
    }
  };
  function sprayCyc(o, t) { var ph = (((t + o.ph) % o.per) + o.per) % o.per / 0.95; return ph < 1 ? o.h * Math.sin(Math.PI * ph) : 0; }
  T.spray = {
    shapes: function (o, t) { var h = sprayCyc(o, t); return h > 14 ? [{ k: 'r', x: o.x - o.w / 2, y: SEA - h, w: o.w, h: h, kd: 'wet' }] : []; },
    right: function (o) { return o.x + 100; },
    draw: function (c, o) { var h = sprayCyc(o, G.t); if (h < 4) return; for (var i = 0; i < 14; i++) { var u = i / 14, yy = SEA - h * u, xx = o.x + Math.sin(G.t * 5 + i * 1.7) * o.w * 0.3 * u; mist(c, xx, yy, o.w * 0.35 + u * o.w * 0.45, 0.75 - u * 0.35); } c.fillStyle = 'rgba(255,255,255,0.8)'; for (var d = 0; d < 10; d++) { var a = d * 2.4 + G.t * 3, rr = (G.t * 140 + d * 37) % h; c.fillRect(o.x + Math.cos(a) * o.w * 0.6 * rr / h, SEA - h + rr * 0.6 + Math.sin(a) * 6, 3, 3); } }
  };
  T.weeping = { // La Roche qui Pleure: a black rock streaming with sea water
    pts: function (o) { if (!o.pts) { var x = o.x, h = o.h; o.pts = [x - 60, SEA + 30, x - 48, SEA - h * 0.6, x - 24, SEA - h, x + 6, SEA - h * 0.92, x + 30, SEA - h * 0.7, x + 58, SEA + 30]; } return o.pts; },
    shapes: function (o) { return [{ k: 'p', pts: this.pts(o), kd: 'haz', nm: true }]; }, right: function (o) { return o.x + 70; },
    draw: function (c, o) {
      rockPoly(c, this.pts(o), '#3c4048', '#101114');
      c.strokeStyle = 'rgba(220,240,255,0.55)'; c.lineWidth = 2;
      for (var i = 0; i < 5; i++) { var x = o.x - 30 + i * 14, y0 = SEA - o.h * (0.9 - i * 0.05); c.beginPath(); c.moveTo(x, y0); for (var k = 1; k <= 6; k++) c.lineTo(x + Math.sin(G.t * 4 + k + i) * 2, y0 + (SEA - y0) * k / 6); c.stroke(); }
    }
  };
  // ----- L8 Gris-Gris: giant waves to surf
  function waveX(o, t) { return movX(o, t); }
  function waveSurf(o, x, t) {
    var cx = waveX(o, t), u = (x - cx) / o.Lw;
    if (u < -1 || u > 0.3) return SEA;
    if (u <= 0) { var k = 1 + u; return SEA - o.H * k * k * (3 - 2 * k); }
    var f = u / 0.3; return SEA - o.H * Math.pow(1 - f, 1.7);
  }
  function waveBody(o, t) { var cx = waveX(o, t), p = [cx - o.Lw, SEA + 30]; for (var i = 0; i <= 14; i++) { var x = cx - o.Lw + (o.Lw * 1.3) * i / 14; p.push(x, waveSurf(o, x, t) + 10); } p.push(cx + o.Lw * 0.3, SEA + 30); return p; }
  function waveLip(o, t) { var cx = waveX(o, t), H = o.H, L2 = o.Lw, k = 1 + 0.06 * Math.sin(t * 2 + o.seed); return [cx - 10, SEA - H + 4, cx + 0.16 * L2 * k, SEA - H + 6, cx + 0.3 * L2 * k, SEA - H * 0.66, cx + 0.27 * L2 * k, SEA - H * 0.54, cx + 0.15 * L2, SEA - H * 0.78, cx + 4, SEA - H + 20]; }
  function surfFn() { G.zsurf = 1; }
  T.bigwave = {
    shapes: function (o, t) {
      var cx = waveX(o, t), H = o.H, L2 = o.Lw;
      return [{ k: 'p', pts: waveBody(o, t), kd: 'haz', nm: true }, { k: 'p', pts: waveLip(o, t), kd: 'haz', nm: true },
        { k: 'r', x: cx + 0.3 * L2 + 30, y: SEA - H * 0.7, w: 190, h: H * 0.7 - 8, kd: 'fn', lure: true, fn: surfFn }];
    },
    update: function (o) { var cx = waveX(o, G.t); if (!o.roar && Math.abs(cx - G.bx) < viewW * 0.8) { o.roar = true; AU.sfx('wave'); } if (Math.random() < 0.6 && onScreen(cx)) part(cx + o.Lw * 0.28, SEA - o.H * 0.6, 60 + Math.random() * 80, -Math.random() * 120, 0.6, 'rgba(240,250,255,0.9)', 3, 'drop'); },
    right: function (o) { return waveX(o, G.t) + o.Lw * 0.4 + 40; },
    draw: function (c, o) {
      var t = G.t, cx = waveX(o, t), body = waveBody(o, t);
      ART.poly(c, body); var g = c.createLinearGradient(0, SEA - o.H, 0, SEA + 20); g.addColorStop(0, 'rgba(110,210,215,0.95)'); g.addColorStop(0.45, 'rgba(32,120,150,0.96)'); g.addColorStop(1, 'rgba(12,60,90,0.98)');
      var wt = pat('texWave', 0.45); if (wt) { c.save(); c.translate(-t * 40, 0); c.fillStyle = wt; ART.poly(c, body.map(function (v, i) { return i % 2 ? v : v + t * 40; })); c.fill(); c.restore(); ART.poly(c, body); c.globalAlpha = 0.55; c.fillStyle = g; c.fill(); c.globalAlpha = 1; } else { c.fillStyle = g; c.fill(); }
      // light through the face + streaks
      c.save(); c.clip(); c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 2; for (var i = 0; i < 8; i++) { var x = cx - o.Lw * 0.8 + i * o.Lw * 0.14; c.beginPath(); c.moveTo(x, SEA); c.quadraticCurveTo(x + 40, SEA - o.H * 0.4, x + 90, SEA - o.H * 0.2); c.stroke(); } c.restore();
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 3; c.beginPath(); for (var k = 0; k <= 20; k++) { var xx = cx - o.Lw + o.Lw * 1.3 * k / 20, yy = waveSurf(o, xx, t) + 8; if (k === 0) c.moveTo(xx, yy); else c.lineTo(xx, yy); } c.stroke();
      var lip = waveLip(o, t); ART.poly(c, lip); c.fillStyle = 'rgba(250,253,255,0.96)'; c.fill();
      for (var q = 0; q < 9; q++) mist(c, cx + o.Lw * (0.02 + q * 0.035), SEA - o.H + 2 + Math.sin(t * 9 + q) * 5, 22 + (q % 3) * 6, 0.75);
      for (var q2 = 0; q2 < 6; q2++) mist(c, cx + o.Lw * 0.3 + Math.sin(q2 * 2.1 + t * 3) * 18, SEA - o.H * (0.15 + q2 * 0.1), 20, 0.5);
      if (G.zsurfPrev && Math.abs(G.bx - cx) < o.Lw * 0.5) { c.fillStyle = 'rgba(160,240,255,0.25)'; ART.poly(c, [cx + 0.08 * o.Lw, SEA - o.H * 0.5, cx + 0.3 * o.Lw + 20, SEA - 16, cx + 0.3 * o.Lw + 80, SEA - 16, cx + 0.08 * o.Lw + 70, SEA - o.H * 0.5]); c.fill(); }
    }
  };
  // ----- L9 Bassin Blanc: thermals, ridges, reflection fish, fog
  T.thermal = {
    update: function (o, dt) {
      if (Math.abs(G.bx - o.x) < o.w / 2 && G.by > 40) {
        G.zthermal = 1; if (!input.hold) G.zfy -= perkK('thermal', 2350, 1950);
        o.acc = (o.acc || 0) + dt; if (!o.hello) { o.hello = true; G.thermals++; addCombo(1); pop(G.bx, G.by - 34, 'THERMAL! Let go to rise', '#ffe27a', 16); AU.sfx('slip'); }
        if (o.acc > 0.5) { o.acc = 0; addScore(20); }
      }
    },
    shapes: function (o) { return G.by > 200 && Math.abs(G.bx - o.x) < 900 ? [{ k: 'r', x: o.x - o.w / 2 + 20, y: G.by - 30, w: o.w - 40, h: 60, kd: 'fn', lure: true, fn: noop }] : []; },
    right: function (o) { return o.x + o.w; },
    draw: function (c, o) {
      var g = c.createLinearGradient(o.x - o.w / 2, 0, o.x + o.w / 2, 0); g.addColorStop(0, 'rgba(255,220,140,0)'); g.addColorStop(0.5, 'rgba(255,220,140,0.16)'); g.addColorStop(1, 'rgba(255,220,140,0)');
      c.fillStyle = g; c.fillRect(o.x - o.w / 2, 30, o.w, SEA - 30);
      for (var i = 0; i < 18; i++) { var y = SEA - ((G.t * 140 + i * 37) % (SEA - 40)), x = o.x + Math.sin(G.t * 3 + i * 1.3) * o.w * 0.38; c.fillStyle = i % 3 ? 'rgba(255,240,200,0.7)' : 'rgba(150,200,90,0.85)'; ART.ell(c, x, y, i % 3 ? 2 : 4, i % 3 ? 2 : 2.2, G.t * 3 + i); c.fill(); }
      c.strokeStyle = 'rgba(255,235,170,0.45)'; c.lineWidth = 2; for (var k = 0; k < 4; k++) { var yy = SEA - 60 - ((G.t * 90 + k * 110) % (SEA - 100)); c.beginPath(); c.arc(o.x, yy, o.w * 0.3, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    }
  };
  T.ridge = {
    pts: function (o) { if (!o.pts) { var p = [o.x - o.w / 2, SEA + 30], n = 9; for (var i = 1; i < n; i++) { var u = i / n, k = Math.sin(Math.PI * u); p.push(o.x - o.w / 2 + o.w * u, SEA - (SEA - o.top) * Math.pow(k, 0.7) + (i % 2 ? 10 : -6)); } p.push(o.x + o.w / 2, SEA + 30); o.pts = p; } return o.pts; },
    shapes: function (o) { return [{ k: 'p', pts: this.pts(o), kd: 'haz', nm: true }]; }, right: function (o) { return o.x + o.w; },
    draw: function (c, o) { var p = this.pts(o); rockPoly(c, p, '#3f6a34', '#14261a', 'rgba(190,230,150,0.3)'); c.fillStyle = '#2f5a2a'; for (var i = 2; i < p.length - 2; i += 2) { ART.ell(c, p[i], p[i + 1] + 6, 20, 12); c.fill(); } }
  };
  T.mirrorFish = {
    yy: function (o) { return o.y + Math.sin(G.t * 2.4 + o.x) * 6; },
    shapes: function (o) { return [{ k: 'c', x: o.x, y: this.yy(o), r: 10, kd: 'fish' }]; }, right: function (o) { return o.x + 30; },
    draw: function (c, o) {
      var y = this.yy(o), ry = SEA + 8 + (SEA - y) * 0.16;
      c.save(); c.globalAlpha = hasPerk('sense') ? 0.24 : 0.1; ART.flyingFish(c, o.x, y, G.t); c.restore();
      c.save(); c.translate(o.x, ry); c.scale(1, -0.7); c.globalAlpha = 0.95; ART.flyingFish(c, 0, 0, G.t); c.restore();
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1; ART.ell(c, o.x, ry + 4, 14 + Math.sin(G.t * 4) * 3, 2.5); c.stroke();
    }
  };
  T.fog = { layer: 2, fx: function (o) { return o.x - (G.t - o.t0) * 14; }, right: function (o) { return this.fx(o) + o.r * 3; },
    draw: function (c, o) { var x = this.fx(o); for (var i = 0; i < 5; i++) ART.smoke(c, x + (i - 2) * o.r * 0.55, o.y + Math.sin(i * 1.9 + G.t * 0.4) * 24, o.r * (0.9 + (i % 2) * 0.3), 0.9); } };
  // ----- L10 Black River Gorges: canyon, waterfalls, bat swarms
  function canProf(o, x) {
    var gap = o.g0 + 10 * Math.sin(x * 0.011);
    for (var i = 0; i < o.pin.length; i++) { var d = (x - o.pin[i]) / 280; gap -= (o.g0 - o.gmin) * Math.exp(-d * d); }
    var cc = 262 + 80 * Math.sin(x * 0.0017 + o.seed) + 16 * o.zig * Math.sin(x * 0.0063 + o.seed * 2);
    cc = clamp(cc, gap / 2 + 28, SEA + 6 - gap / 2);
    var e = clamp(Math.min((x - o.x0) / 420, (o.x1 - x) / 420), 0, 1); e = e * e * (3 - 2 * e);
    var jt = 8 * Math.sin(x * 0.05 + o.seed) + 5 * Math.sin(x * 0.13), jb = 7 * Math.sin(x * 0.045 + 1.3);
    return { top: -20 + (cc - gap / 2 + 20 - jt) * e, bot: SEA + 50 + (cc + gap / 2 - SEA - 50 + jb) * e };
  }
  function findCanyon(x0) { for (var i = 0; i < G.ents.length; i++) if (G.ents[i].type === 'canyon' && G.ents[i].x0 === x0) return G.ents[i]; return null; }
  T.canyon = {
    ax: function (o) { return o.x0; },
    shapes: function (o) { return [{ k: 'band', x0: o.x0, x1: o.x1, f: function (x) { return canProf(o, x); }, kd: 'haz', nm: true }]; },
    right: function (o) { return o.x1 + 20; },
    draw: function (c, o) {
      var a = Math.max(o.x0, G.camX - 40), b = Math.min(o.x1, G.camX + viewW + 40), top = [], bot = [];
      for (var x = a; x <= b + 24; x += 24) { var xx = Math.min(x, o.x1), pr = canProf(o, xx); top.push(xx, pr.top); bot.push(xx, pr.bot); }
      if (top.length < 4) return; rock(c, top, true, forestPal()); rock(c, bot, false, forestPal());
      o.pin.forEach(function (p) { if (p > a - 100 && p < b + 100 && p > G.bx - 50) { var pr = canProf(o, p); c.fillStyle = 'rgba(255,120,80,' + (0.5 + 0.4 * Math.sin(G.t * 8)) + ')'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center'; c.fillText('\u25BC', p, pr.top - 4 + 18); c.fillText('\u25B2', p, pr.bot - 4); c.textAlign = 'left'; } });
    }
  };
  T.fishCanyon = {
    init: function (o) { var cn = findCanyon(o.cx0), pr = cn ? canProf(cn, o.x) : { top: 150, bot: 400 }; o.y = (pr.top + pr.bot) / 2; },
    shapes: function (o) { return [{ k: 'c', x: o.x, y: o.y + Math.sin(G.t * 3 + o.x) * 6, r: 9, kd: 'fish' }]; }, right: function (o) { return o.x + 30; },
    draw: function (c, o) { hoverDraw(c, o.x, o.y + Math.sin(G.t * 3 + o.x) * 6); }
  };
  T.waterfall = {
    init: function (o) { var cn = findCanyon(o.cx0), pr = cn ? canProf(cn, o.x) : { top: 0, bot: SEA }; o.y0 = pr.top - 10; o.y1 = pr.bot + 4; },
    update: function (o) { if (Math.abs(G.bx - o.x) < o.w / 2 + 6 && G.by < (o.y0 + o.y1) / 2 + 14) { G.zfy += 1100 * windK(); G.wet = Math.max(G.wet, 0.4); if (!o.hello) { o.hello = true; pop(G.bx, G.by - 30, 'Waterfall!', '#bfefff', 16); AU.sfx('splash'); } } },
    shapes: function (o) { return [{ k: 'r', x: o.x - o.w / 2, y: o.y0, w: o.w, h: Math.max(10, (o.y0 + o.y1) / 2 - o.y0), kd: 'fn', cost: 220, fn: noop }]; },
    right: function (o) { return o.x + o.w; },
    draw: function (c, o) {
      var g = c.createLinearGradient(o.x - o.w / 2, 0, o.x + o.w / 2, 0); g.addColorStop(0, 'rgba(220,240,255,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(220,240,255,0.35)');
      c.fillStyle = g; c.fillRect(o.x - o.w / 2, o.y0, o.w, o.y1 - o.y0);
      c.strokeStyle = 'rgba(180,215,240,0.7)'; c.lineWidth = 2; for (var i = 0; i < 6; i++) { var xx = o.x - o.w / 2 + 6 + i * (o.w - 12) / 5, off = (G.t * 420 + i * 47) % 60; for (var y = o.y0 - 60 + off; y < o.y1; y += 60) { c.beginPath(); c.moveTo(xx, y); c.lineTo(xx, y + 26); c.stroke(); } }
      for (var k = 0; k < 5; k++) ART.smoke(c, o.x + (k - 2) * 26, o.y1 - 14, 40, 0.5);
    }
  };
  T.batSwarm = {
    init: function (o) { var r = PL.rng(Math.floor(o.seed * 1000) + 7); o.b = []; for (var i = 0; i < o.n; i++) o.b.push({ dx: (r() - 0.5) * 200, dy: (r() - 0.5) * 420, ph: r() * 6 }); },
    pos: function (o, i, t) { var t0 = tTrig(o, o.lead), yc = 262 - o.dir * o.spd * o.lead + o.dir * o.spd * (t - t0), b = o.b[i]; return { x: o.x + b.dx + Math.sin(t * 2 + b.ph) * 10, y: yc + b.dy + Math.sin(t * 3 + b.ph) * 8 }; },
    update: function (o) { if (!o.cry && G.bx > o.x - birdLead(o.lead + 0.4)) { o.cry = true; AU.sfx('monkey'); } },
    shapes: function (o, t) { var s = []; for (var i = 0; i < o.n; i++) { var p = this.pos(o, i, t); if (p.y > -40 && p.y < SEA + 40) s.push({ k: 'c', x: p.x, y: p.y, r: 11, kd: 'haz', nm: true }); } return s; },
    right: function (o) { return o.x + 160; },
    draw: function (c, o) { for (var i = 0; i < o.n; i++) { var p = this.pos(o, i, G.t); if (p.y > -60 && p.y < SEA + 60) ART.bat(c, p.x, p.y, G.t, o.b[i].ph); } }
  };
  // ----- L11 Chamarel: nests, monkeys, rockfall
  function feedFn(e) {
    if (G.carry <= 0 || e.fed || e.raided) return;
    e.fed = true; G.fed++; var v = 40 * G.carry; G.score += v * G.mult; addCombo(G.carry);
    pop(e.x, e.top - 70, 'Chick fed! +' + v * G.mult, '#ffe27a', 20); AU.sfx('chick'); AU.sfx('perk'); sparkle(e.x, e.top - 30, '#ffe27a', 12); G.carry = 0;
  }
  T.ledgeNest = {
    pts: function (o) { if (!o.pts) { var x = o.x, w = o.w, t = o.top; o.pts = [x - w / 2 - 8, SEA + 30, x - w / 2, t + 30, x - w / 2 + 6, t + 4, x - w * 0.2, t, x + w * 0.25, t + 2, x + w / 2, t + 10, x + w / 2 + 10, SEA + 30]; } return o.pts; },
    shapes: function (o) { return [{ k: 'p', pts: this.pts(o), kd: 'haz', nm: true }, { k: 'c', x: o.x, y: o.top - 40, r: 30, kd: 'fn', lure: G.carry > 0 && !o.fed, fn: feedFn }]; },
    right: function (o) { return o.x + o.w; },
    draw: function (c, o) {
      rockPoly(c, this.pts(o), '#3a3a40', '#0f1012', 'rgba(255,255,255,0.18)');
      c.fillStyle = '#4e7a32'; ART.ell(c, o.x - o.w * 0.3, o.top + 2, 16, 5); c.fill(); ART.ell(c, o.x + o.w * 0.3, o.top + 6, 12, 4); c.fill();
      c.fillStyle = '#8b6a3e'; ART.ell(c, o.x, o.top - 4, 22, 7); c.fill();
      if (o.raided) { c.fillStyle = 'rgba(240,230,210,0.7)'; ART.ell(c, o.x - 6, o.top - 6, 5, 3); c.fill(); }
      else { // the fluffy grey chick, begging with its beak open when you carry fish
        var beg = G.carry > 0 && !o.fed ? Math.abs(Math.sin(G.t * 10)) * 4 : 0;
        c.fillStyle = '#dcdcd6'; ART.ell(c, o.x, o.top - 14, 13, 11); c.fill(); ART.ell(c, o.x + 8, o.top - 24 - beg * 0.3, 7, 7); c.fill();
        c.fillStyle = '#222'; ART.ell(c, o.x + 10, o.top - 26, 1.5, 1.5); c.fill();
        c.fillStyle = '#f2c94c'; ART.poly(c, [o.x + 14, o.top - 25, o.x + 22, o.top - 24 - beg, o.x + 14, o.top - 21]); c.fill();
        if (o.fed) { c.fillStyle = '#ff6b8a'; c.font = 'bold 14px sans-serif'; c.fillText('\u2665', o.x + 14, o.top - 36 - Math.sin(G.t * 4) * 3); }
        else if (G.carry > 0) { c.strokeStyle = 'rgba(255,226,122,' + (0.4 + 0.4 * Math.sin(G.t * 6)) + ')'; c.lineWidth = 2; ART.ell(c, o.x, o.top - 40, 30, 30); c.stroke(); }
      }
    }
  };
  function nestAt(x) { for (var i = 0; i < G.act.length; i++) { var e = G.act[i]; if (e.type === 'ledgeNest' && Math.abs(e.x - e.w / 2 - 6 - x) < 2) return e; } return null; }
  T.monkey = {
    init: function (o) { o.spd = (SEA - o.top + 16) / (o.lead + 0.75); },
    my: function (o, t) { var t0 = tTrig(o, o.lead); return Math.max(o.top - 8, SEA + 10 - o.spd * Math.max(0, t - t0)); },
    update: function (o, dt) {
      if (o.state === 'fall') { o.fy += o.fv * dt; o.fv += 900 * dt; if (o.fy > SEA + 40) { o.dead = true; splash(o.x, 12, true); AU.sfx('splash'); } return; }
      if (o.state) return;
      var y = this.my(o, G.t);
      if (y <= o.top - 6) { o.state = 'raid'; var n = nestAt(o.x); if (n && !n.raided && !n.fed) { n.raided = true; G.raids++; G.score = Math.max(0, G.score - 300); pop(o.x, o.top - 60, 'Zako! Nest raided -300', '#ff8a7a', 18); AU.sfx('monkey'); AU.sfx('penalty'); } }
      if (!o.chat && onScreen(o.x) && G.bx > o.x - 700) { o.chat = true; AU.sfx('monkey'); }
    },
    shapes: function (o, t) { if (o.state === 'fall') return []; var y = o.state === 'raid' ? o.top - 8 : this.my(o, t); return [{ k: 'c', x: o.x, y: y - 26, r: 18, kd: 'fn', avoid: true, fn: monkeyFn }]; },
    right: function (o) { return o.x + 60; },
    draw: function (c, o) { var y = o.state === 'fall' ? o.fy : o.state === 'raid' ? o.top - 8 : this.my(o, G.t); ART.monkey(c, o.x - 4, y - 30, G.t, false, o.state === 'fall'); }
  };
  function monkeyFn(e) {
    if (e.state === 'fall') return;
    if (G.vy > 80 || G.burstT > 0 || G.rollT > 0 || G.dive) { e.state = 'fall'; e.fy = T.monkey.my(e, G.t) - 26; e.fv = -200; G.scares++; addScore(200); addCombo(2); pop(e.x, e.fy - 30, 'SHOO! +' + 200 * G.mult, '#ffe27a', 20); AU.sfx('scare'); AU.sfx('monkey'); G.vy = -360; }
    else hit('A monkey grabbed your tail!');
  }
  T.rockfall = {
    update: function (o) { if (o.trig === undefined && G.bx >= o.x - birdLead(o.lead)) { o.trig = G.t; AU.sfx('rock'); } if (o.trig !== undefined && !o.splashed && !this.pos(o, G.t) && G.t - o.trig > 0.4) { o.splashed = true; splash(o.x, 14, true); AU.sfx('splashBig'); } },
    pos: function (o, t) { var t0 = tTrig(o, o.lead), dt = t - t0 - 0.35; if (dt < 0) return null; var y = -60 + 260 * dt + 0.5 * 1400 * dt * dt; return y > SEA + 30 ? null : { x: o.x, y: y }; },
    shapes: function (o, t) { var p = this.pos(o, t); return p ? [{ k: 'c', x: p.x, y: p.y, r: 17, kd: 'haz', nm: true }] : []; },
    right: function (o) { return o.x + 60; },
    draw: function (c, o) {
      var p = this.pos(o, G.t);
      if (!o.splashed && !p) { var near = 1 - clamp((o.x - G.bx) / 900, 0, 1); c.fillStyle = '#ff5a3c'; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.fillText('!', o.x, 34 + Math.sin(G.t * 12) * 3); c.textAlign = 'left'; c.fillStyle = 'rgba(120,110,100,' + 0.5 * near + ')'; for (var i = 0; i < 4; i++) { ART.ell(c, o.x + Math.sin(G.t * 9 + i) * 10, 8 + ((G.t * 120 + i * 20) % 60), 2, 2); c.fill(); } }
      if (p) { c.save(); c.translate(p.x, p.y); c.rotate(G.t * 4 + o.x); rockPoly(c, [-18, -6, -8, -17, 10, -15, 18, -2, 12, 14, -6, 16, -17, 8], '#5b5e66', '#1d1e22'); c.restore(); }
    }
  };
  // ----- L12 Crystal Rock: dolphins, gusts (sand floor handled by floorAt)
  function dolphPos(o, t) {
    var t0 = tTrig(o, o.lead), dt = t - t0; if (dt < 0) return null;
    var g = 700, v0 = Math.sqrt(2 * g * (SEA + 24 - o.apex)), y = SEA + 24 - v0 * dt + 0.5 * g * dt * dt; if (dt > 0.3 && y > SEA + 30) return null;
    var dir = o.vx >= 0 ? 1 : -1, sp = Math.abs(o.vx) + 90, vy = -v0 + g * dt, a = Math.atan2(vy, sp), d = { x: dir * Math.cos(a), y: Math.sin(a) };
    return { x: o.x + o.vx * dt, y: y, a: a, dir: dir, d: d, n: { x: dir * d.y, y: -dir * d.x } };
  }
  function dolphFn(e) {
    if (G.vy < -160 || e.bounced) return;
    e.bounced = true; G.vy = -640; G.slipT = Math.max(G.slipT, 1.6); G.inv = Math.max(G.inv, 0.3); G.dolph++; addScore(60); addCombo(1);
    pop(G.bx, G.by - 34, 'DOLPHIN BOOST! +' + 60 * G.mult, '#9ff0ff', 18); AU.sfx('bounce'); AU.sfx('slip'); sparkle(G.bx, G.by + 10, '#9ff0ff', 8);
  }
  T.dolphin = {
    update: function (o) { if (o.trig === undefined && G.bx >= o.x - birdLead(o.lead)) { o.trig = G.t; splash(o.x, 8); } var p = dolphPos(o, G.t); if (o.trig !== undefined && !p && !o.sp2 && G.t - o.trig > 0.5) { o.sp2 = true; var q = o.x + o.vx * (G.t - o.trig); splash(q, 12, true); AU.sfx('splash'); } },
    shapes: function (o, t) { var p = dolphPos(o, t); if (!p) return []; return [{ k: 'c', x: p.x + p.d.x * 56, y: p.y + p.d.y * 56, r: 11, kd: 'haz', nm: true }, { k: 'c', x: p.x - p.n.x * 3, y: p.y - p.n.y * 3, r: 13, kd: 'haz' }, { k: 'c', x: p.x + p.n.x * 22, y: p.y + p.n.y * 22, r: 16, kd: 'fn', lure: true, fn: dolphFn }]; },
    right: function (o) { return o.x + 400; },
    draw: function (c, o) { var p = dolphPos(o, G.t); if (p) ART.sprite(c, 'dolphin', p.x, p.y, 150, { rot: p.dir > 0 ? p.a : -p.a, flip: p.dir < 0 }); }
  };
  T.gust = {
    update: function (o) { if (G.bx >= o.x0 && G.bx <= o.x1) { G.zfy += o.f * windK(); G.zgust = o.f; } if (!o.hello && G.bx > o.x0 - viewW * 0.6) { o.hello = true; AU.sfx('wind'); } },
    shapes: function (o) { return []; },
    right: function (o) { return o.x1 + 40; },
    draw: function (c, o) {
      var up = o.f < 0, a = Math.min(1, Math.abs(o.f) / 900);
      c.strokeStyle = 'rgba(255,255,255,' + (0.35 + 0.3 * a) + ')'; c.lineWidth = 2;
      for (var i = 0; i < 14; i++) { var x = o.x0 + ((i * 97) % (o.x1 - o.x0)), y = ((up ? -1 : 1) * G.t * 340 + i * 61) % 470; if (y < 0) y += 470; var yy = 20 + y; c.beginPath(); c.moveTo(x, yy); c.quadraticCurveTo(x + 22, yy + (up ? -18 : 18), x + 44, yy + (up ? -40 : 40)); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,0.8)'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillText(up ? '\u25B2 GUST' : '\u25BC GUST', (o.x0 + o.x1) / 2, up ? 40 : SEA - 30); c.textAlign = 'left';
    }
  };
  // ----- L13 Ile aux Serpents: the murmuration and territorial divers
  function flockP(o, i, t) {
    var cx = movX(o, t), cy = 245 + 50 * Math.sin(0.5 * t + o.seed), s = (i / o.n) * 0.85 + Math.floor(i * 3 / o.n) * 0.05, m = 0.5 + 0.5 * Math.sin(0.6 * t + o.seed), T2 = 6.2832;
    var x = cx + o.R1 * (0.55 + 0.45 * m) * Math.cos(T2 * s + 0.7 * t + o.seed) + 18 * Math.sin(T2 * 7 * s + 3 * t);
    var y = cy + o.R2 * (0.45 + 0.55 * (1 - m)) * Math.sin(2 * T2 * s + 1.1 * t) + 14 * Math.cos(T2 * 5 * s + 2.4 * t);
    return { x: x, y: clamp(y, 26, 446) };
  }
  T.flock = {
    update: function (o) { if (!o.cry && onScreen(movX(o, G.t) - 300)) { o.cry = true; AU.sfx('call'); } },
    shapes: function (o, t) { var cx = movX(o, t); if (Math.abs(cx - G.bx) > o.R1 + 500) return []; var s = []; for (var i = 0; i < o.n; i++) { var p = flockP(o, i, t); s.push({ k: 'c', x: p.x, y: p.y, r: 7, kd: 'haz', nm: true }); } return s; },
    right: function (o) { return movX(o, G.t) + o.R1 + 80; },
    draw: function (c, o) { for (var i = 0; i < o.n; i++) { var p = flockP(o, i, G.t), q = flockP(o, i, G.t + 0.05); ART.tern(c, p.x, p.y, Math.atan2(q.y - p.y, q.x - p.x), G.t * 14 + i, i % 4 === 0); } }
  };
  T.colony = {
    ax: function (o) { return o.x0; },
    update: function (o) {
      o.cd = (o.cd || 0) - (1 / 60);
      if (G.bx > o.x0 && G.bx < o.x1 && G.by > 318 && (!o.next || G.t > o.next)) {
        o.next = G.t + 1.5; var T0 = 0.95;
        mkLive({ type: 'diver', sx: G.bx + 420, sy: 30, tx: G.bx + G.speed * (T0 + 0.45), ty: G.by + 10, T: T0, warn: 0.45 }); AU.sfx('call');
      }
    },
    right: function (o) { return o.x1 + 50; },
    draw: function (c, o) { for (var x = o.x0; x < o.x1; x += 70) { var bob = Math.sin(G.t * 3 + x) * 1.5; c.fillStyle = (x / 70 | 0) % 3 ? '#5a4636' : '#f2f2ee'; ART.ell(c, x, SEA - 6 + bob, 7, 5); c.fill(); c.fillStyle = '#222'; ART.ell(c, x + 5, SEA - 10 + bob, 3, 3); c.fill(); } }
  };
  T.diver = {
    pos: function (o, t) { var dt = t - o.t0 - o.warn; if (dt < 0) return null; var u = dt / o.T; if (u > 1.7) return null; return { x: o.sx + (o.tx - o.sx) * u, y: o.sy + (o.ty - o.sy) * u }; },
    shapes: function (o, t) { var p = this.pos(o, t); return p ? [{ k: 'c', x: p.x, y: p.y, r: 12, kd: 'haz', nm: true }] : []; },
    right: function (o) { return G.t - o.t0 > o.warn + o.T * 1.8 ? -1e9 : o.sx + 200; },
    draw: function (c, o) {
      var p = this.pos(o, G.t);
      if (!p || G.t - o.t0 < o.warn + 0.3) { c.strokeStyle = 'rgba(255,70,60,' + (0.5 + 0.4 * Math.sin(G.t * 20)) + ')'; c.lineWidth = 3; ART.ell(c, o.sx, o.sy + 20, 20, 20); c.stroke(); c.setLineDash([6, 8]); c.lineWidth = 1.5; c.beginPath(); c.moveTo(o.sx, o.sy + 20); c.lineTo(o.tx, o.ty); c.stroke(); c.setLineDash([]); }
      if (p) ART.tern(c, p.x, p.y, Math.atan2(o.ty - o.sy, o.tx - o.sx), G.t * 20, true, 1.5);
    }
  };
  // ----- L14 Round Island: display hoops, crumbling slopes, rivals
  function hoopFn(e) {
    if (e.done) return; e.done = true;
    if (G.hoopSet === e.set && G.hoopIdx === e.idx - 1) G.hoopChain++; else G.hoopChain = 1;
    G.hoopSet = e.set; G.hoopIdx = e.idx; G.hoops++;
    var v = 25 * G.hoopChain; addScore(v); addCombo(1); AU.sfx('style'); pop(e.x, e.y - 40, 'STYLE +' + v * G.mult, '#ff9bd2', 16);
    if (e.idx === e.n - 1 && G.hoopChain === e.n) { G.parades++; G.score += 500; banner('PARADE!', 'Courtship display +500', '#ff9bd2'); AU.sfx('call'); AU.sfx('perk'); }
  }
  T.hoop = {
    shapes: function (o) { return o.done ? [] : [{ k: 'c', x: o.x, y: o.y, r: 0, pad: 18, kd: 'fn', lure: true, lureW: 160, fn: hoopFn }]; }, right: function (o) { return o.x + 40; },
    draw: function (c, o) {
      var a = o.done ? 0.25 : 0.9, pulse = 1 + 0.06 * Math.sin(G.t * 5 + o.idx);
      c.strokeStyle = 'rgba(255,155,210,' + a + ')'; c.lineWidth = 5; ART.ell(c, o.x, o.y, 11 * pulse, 36 * pulse); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,' + a * 0.8 + ')'; c.lineWidth = 1.5; ART.ell(c, o.x, o.y, 11 * pulse, 36 * pulse); c.stroke();
      if (!o.done) { c.fillStyle = '#fff'; for (var k = 0; k < 6; k++) { var an = G.t * 2 + k; ART.ell(c, o.x + Math.cos(an) * 11, o.y + Math.sin(an) * 36, 3, 6, an); c.fill(); } }
    }
  };
  T.slope = {
    pts: function (o) { if (!o.pts) { var x = o.x, w = o.w, h = o.h, p = [x - w / 2, SEA + 30]; for (var i = 1; i < 10; i++) { var u = i / 10, k = u < 0.6 ? u / 0.6 : (1 - u) / 0.4; p.push(x - w / 2 + w * u, SEA - h * k + (i % 2 ? 8 : -5)); } p.push(x + w / 2, SEA + 30); o.pts = p; } return o.pts; },
    boulder: function (o, j, t) { var t0 = tTrig(o, 1.15 + j * 0.32), u = (t - t0) / 1.25; if (u < 0 || u > 1) return null; var px = o.x + o.w * 0.1, py = SEA - o.h, ex = o.x - o.w / 2, k = u * u; return { x: px + (ex - px) * k, y: py + (SEA - 10 - py) * k - 14, a: u * 9 }; },
    shapes: function (o, t) { var s = [{ k: 'p', pts: this.pts(o), kd: 'haz', nm: true }]; for (var j = 0; j < o.n; j++) { var b = this.boulder(o, j, t); if (b) s.push({ k: 'c', x: b.x, y: b.y, r: 15, kd: 'haz', nm: true }); } return s; },
    update: function (o) { for (var j = 0; j < o.n; j++) { var b = this.boulder(o, j, G.t); if (b && !o['r' + j]) { o['r' + j] = 1; AU.sfx('rock'); } } },
    right: function (o) { return o.x + o.w; },
    draw: function (c, o) {
      var p = this.pts(o); rockPoly(c, p, '#a59680', '#4a4237', 'rgba(255,255,255,0.3)');
      c.fillStyle = 'rgba(25,20,15,0.7)'; for (var i = 2; i < p.length - 4; i += 4) { ART.ell(c, p[i] + 10, p[i + 1] + 30, 9, 6); c.fill(); }
      c.strokeStyle = '#3e6a2c'; c.lineWidth = 3; for (var k = 4; k < p.length - 4; k += 6) { c.beginPath(); c.moveTo(p[k], p[k + 1]); c.lineTo(p[k] + 4, p[k + 1] - 26); c.stroke(); c.fillStyle = '#4f8a34'; for (var f = 0; f < 5; f++) { ART.ell(c, p[k] + 4 + Math.cos(f * 1.3) * 12, p[k + 1] - 28 + Math.sin(f * 1.3) * 5, 10, 3, f * 1.3); c.fill(); } }
      for (var j = 0; j < o.n; j++) { var b = this.boulder(o, j, G.t); if (b) { c.save(); c.translate(b.x, b.y); c.rotate(-b.a); rockPoly(c, [-15, -5, -6, -15, 9, -13, 15, 0, 9, 13, -7, 14, -15, 6], '#9a8a74', '#4a4136'); c.restore(); } }
    }
  };
  T.rival = {
    ax: function (o) { return o.x; },
    init: function (o) { o.rx = G.bx - 380; o.ry = Math.max(60, G.by - 90); o.s0 = G.t; o.state = 'chase'; AU.sfx('call'); pop(G.bx, G.by - 40, 'A rival is chasing your streamers!', '#ff8a7a', 15); },
    update: function (o, dt) {
      if (o.state === 'flee') { o.ry -= 320 * dt; o.rx += (G.speed + 220) * dt; if (o.ry < -120) o.dead = true; return; }
      o.rx += (G.speed + 75) * dt; o.ry += clamp((G.by - o.ry) * 2.6, -240, 240) * dt;
      var d = Math.hypot(o.rx - (G.bx - 28), o.ry - G.by);
      if (d < 30) {
        if (G.rollT > 0 || G.burstT > 0) { o.state = 'flee'; G.shaken++; addScore(120); addCombo(1); pop(G.bx, G.by - 30, 'Shaken off! +' + 120 * G.mult, '#9ff0ff', 18); AU.sfx('feint'); }
        else if (G.inv <= 0) { o.state = 'flee'; G.stolen++; if (G.streamers > 1 || DEMO) { if (G.streamers > 1) G.streamers--; G.inv = 1.0; G.chain = 0; G.mult = 1; AU.setIntensity(1); feathers(G.bx - 24, G.by); pop(G.bx, G.by - 30, 'Streamer stolen!', '#ff8a7a', 20); AU.sfx('steal'); vibe(60); } else hit('A rival stole your last streamer'); }
      }
      if (o.rx > G.bx + 40) { o.state = 'flee'; }
      if (G.t - o.s0 > 8.5 && o.state === 'chase') { o.state = 'flee'; G.shaken++; addScore(150); pop(G.bx, G.by - 30, 'The rival gave up +' + 150 * G.mult, '#9ff0ff', 16); }
    },
    shapes: function (o, t) { if (o.state !== 'chase') return []; var dt = t - G.t; return [{ k: 'c', x: o.rx + (G.speed + 75) * dt, y: o.ry, r: 16, kd: 'fn', avoid: true, fn: noop }]; },
    right: function () { return 1e12; },
    draw: function (c, o) { if (o.rx === undefined) return; ART.bird(c, o.rx, o.ry, { t: G.t + 1, flap: G.t * 20, glide: 0, tilt: 0.1, streamers: 2, maxStreamers: 2, tailCol: '#e8443a', scale: 0.95 }); }
  };
  // ----- L15 Cascade Victoire (vertical): curtains, outcrops, ledges, falling rocks
  T.curtain = {
    ax: function (o) { return o.x0; },
    update: function (o) { if (G.bx > o.x0 && G.bx < o.x1 && G.by > o.y0 && G.by < o.y1) { G.zspd *= 0.55; G.zdrain += 1.4; G.wet = Math.max(G.wet, 0.3); if (!o.hello) { o.hello = true; pop(G.bx, G.by - 30, 'Water curtain!', '#bfefff', 16); AU.sfx('splash'); } } },
    shapes: function (o) { return [{ k: 'r', x: o.x0, y: o.y0, w: o.x1 - o.x0, h: o.y1 - o.y0, kd: 'fn', cost: 45, fn: noop }]; },
    right: function (o) { return o.x1 + 20; },
    draw: function (c, o) {
      var gy = c.createLinearGradient(0, o.y0, 0, o.y1); gy.addColorStop(0, 'rgba(225,242,255,0)'); gy.addColorStop(0.18, 'rgba(225,242,255,0.32)'); gy.addColorStop(0.82, 'rgba(225,242,255,0.32)'); gy.addColorStop(1, 'rgba(225,242,255,0)'); c.fillStyle = gy; c.fillRect(o.x0, o.y0, o.x1 - o.x0, o.y1 - o.y0);
      for (var m = 0; m < 6; m++) mist(c, o.x0 + (o.x1 - o.x0) * ((m * 0.37 + G.t * 0.4) % 1), o.y0 + (o.y1 - o.y0) * (0.2 + (m * 0.29) % 0.6), 40, 0.25);
      c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 2.2;
      for (var i = 0; i < 9; i++) { var y = o.y0 + (o.y1 - o.y0) * (i + 0.5) / 9, off = (G.t * 520 + i * 53) % 90; for (var x = o.x1 - off; x > o.x0; x -= 90) { c.beginPath(); c.moveTo(x, y + Math.sin(x * 0.05) * 2); c.lineTo(Math.max(o.x0, x - 46), y); c.stroke(); } }
    }
  };
  T.outcrop = {
    pts: function (o) { if (!o.pts) { var x = o.x, w = o.w, d = o.depth; o.pts = [x - w / 2, SEA + 60, x - w * 0.32, SEA - d * 0.7, x - w * 0.05, SEA - d, x + w * 0.3, SEA - d * 0.62, x + w / 2, SEA + 60]; } return o.pts; },
    shapes: function (o) { return [{ k: 'p', pts: this.pts(o), kd: 'haz', nm: true }]; }, right: function (o) { return o.x + o.w; },
    draw: function (c, o) { rockPoly(c, this.pts(o), '#55585f', '#1c1d21', 'rgba(255,255,255,0.2)'); c.fillStyle = '#4f7a34'; ART.ell(c, o.x - o.w * 0.1, SEA - o.depth + 12, 14, 6); c.fill(); }
  };
  function restFn(e) { G.zrest = 1; if (!e.hello) { e.hello = true; G.rests++; pop(G.bx, G.by - 30, 'REST - energy up', '#9ff0a0', 16); AU.sfx('rest'); } }
  T.ledge = {
    shapes: function (o) { return [{ k: 'r', x: o.x - o.w / 2, y: SEA - 84, w: o.w, h: 104, kd: 'fn', lure: G.energy < 75, fn: restFn }]; }, right: function (o) { return o.x + o.w; },
    draw: function (c, o) {
      rockPoly(c, [o.x - o.w / 2 - 10, SEA + 40, o.x - o.w / 2, SEA - 74, o.x + o.w / 2, SEA - 74, o.x + o.w / 2 + 10, SEA + 40], '#6b6a62', '#2a2a28', 'rgba(255,255,255,0.3)');
      c.fillStyle = '#5f9a3c'; c.fillRect(o.x - o.w / 2, SEA - 80, o.w, 8);
      c.fillStyle = 'rgba(159,240,160,' + (0.35 + 0.3 * Math.sin(G.t * 4)) + ')'; ART.ell(c, o.x, SEA - 96, 28, 9); c.fill();
    }
  };
  T.vrock = {
    update: function (o) { if (o.w0 === undefined && G.bx >= o.x - birdLead(o.lead)) { o.w0 = G.t; o.sx = G.camX + viewW + 60 + G.speed * 0.6; AU.sfx('rock'); } },
    pos: function (o, t) { if (o.w0 === undefined) return null; var dt = t - o.w0 - 0.6; if (dt < 0) return null; return { x: o.sx - 470 * dt, y: o.y + Math.sin(dt * 6) * 6 }; },
    shapes: function (o, t) { var p = this.pos(o, t); return p ? [{ k: 'c', x: p.x, y: p.y, r: 15, kd: 'haz', nm: true }] : []; },
    right: function (o) { var p = this.pos(o, G.t); return o.w0 === undefined ? o.x + 3000 : p ? p.x + 40 : o.x + 3000; },
    draw: function (c, o) {
      var p = this.pos(o, G.t);
      if (o.w0 !== undefined && G.t - o.w0 < 0.9) { var xm = G.camX + viewW - 26; c.fillStyle = 'rgba(255,90,60,' + (0.5 + 0.5 * Math.sin(G.t * 22)) + ')'; ART.poly(c, [xm + 16, o.y, xm - 12, o.y - 14, xm - 12, o.y + 14]); c.fill(); }
      if (p) { c.save(); c.translate(p.x, p.y); c.rotate(G.t * 5); rockPoly(c, [-16, -5, -6, -15, 9, -13, 16, -1, 10, 13, -6, 15, -15, 7], '#6a6c72', '#22232a'); c.restore(); }
    }
  };
  // ----- L16 Ile aux Cocos: coral heads (only at low tide) and pirate frigatebirds
  T.coral = {
    exposed: function (o) { return floorAt(o.x) < SEA - 6; },
    pts: function (o) { var f = Math.min(SEA + 20, floorAt(o.x)), h = o.h; return [o.x - 22, f + 10, o.x - 18, f - h * 0.6, o.x - 8, f - h * 0.4, o.x - 4, f - h, o.x + 6, f - h * 0.5, o.x + 14, f - h * 0.8, o.x + 22, f + 10]; },
    shapes: function (o) { return this.exposed(o) ? [{ k: 'p', pts: this.pts(o), kd: 'haz', nm: true }] : []; }, right: function (o) { return o.x + 30; },
    draw: function (c, o) { // branching staghorn coral, drawn as tapered round branches with polyp highlights
      var ex = this.exposed(o), f = Math.min(SEA + 20, floorAt(o.x)), h = o.h;
      c.save(); c.globalAlpha = ex ? 1 : 0.35; c.lineCap = 'round';
      var B2 = [[0, 0, -4, -h, 9], [-4, -h * 0.45, -18, -h * 0.62, 6], [-1, -h * 0.7, 10, -h * 0.92, 5], [2, -h * 0.3, 15, -h * 0.8, 6], [-12, -h * 0.55, -14, -h * 0.75, 4], [12, -h * 0.65, 20, -h * 0.72, 3.5]];
      [['#7a2e2a', 2.2], [ex ? '#e9866f' : '#7fb0bc', 0], [ex ? '#ffc2a8' : '#c5e2ea', -0.45]].forEach(function (L2, li) {
        c.strokeStyle = L2[0]; B2.forEach(function (b) { c.lineWidth = Math.max(1, b[4] + L2[1] * (li === 2 ? b[4] * 0.6 / 2.2 : 1) * (li === 2 ? -1 : 1)); c.beginPath(); c.moveTo(o.x + b[0] + (li === 2 ? -1.5 : 0), f + b[1]); c.quadraticCurveTo(o.x + (b[0] + b[2]) / 2 + 3, f + (b[1] + b[3]) / 2, o.x + b[2] + (li === 2 ? -1.5 : 0), f + b[3]); c.stroke(); });
      });
      c.fillStyle = ex ? 'rgba(255,236,220,0.9)' : 'rgba(230,250,255,0.6)'; for (var i = 0; i < 9; i++) { var bb = B2[i % 6], u = 0.3 + (i * 0.37) % 0.7; ART.ell(c, o.x + bb[0] + (bb[2] - bb[0]) * u, f + bb[1] + (bb[3] - bb[1]) * u, 1.6, 1.6); c.fill(); }
      c.restore();
    }
  };
  T.pirate = {
    init: function (o) { o.state = 'wait'; },
    update: function (o, dt) {
      if (o.state === 'wait') { if (G.bx >= o.x - birdLead(o.lead)) { o.state = 'hover'; o.h0 = G.t; o.px = G.bx + 520; o.py = 50; AU.sfx('steal'); } return; }
      if (o.state === 'hover') {
        var u = (G.t - o.h0) / 1.25, tx = G.bx + 300 - 120 * u, ty = Math.max(50, G.by - 170);
        o.px += (tx - o.px) * Math.min(1, dt * 4); o.py += (ty - o.py) * Math.min(1, dt * 3);
        if (u >= 1) { o.state = 'lunge'; o.l0 = G.t; o.lx = o.px; o.ly = o.py; o.tx = G.bx + G.speed * 0.55; o.ty = G.by; o.minD = 1e9; AU.sfx('dive'); }
        return;
      }
      if (o.state === 'lunge') {
        var p = this.lp(o, G.t); o.px = p.x; o.py = p.y; var d = Math.hypot(p.x - G.bx, p.y - G.by); o.minD = Math.min(o.minD, d);
        if (d < BR + 18 && G.inv <= 0 && G.rollT <= 0 && G.burstT <= 0) {
          o.state = 'away'; G.stolen++; G.energy = Math.max(0, G.energy - 15); G.score = Math.max(0, G.score - 100); G.chain = 0; G.mult = 1; AU.setIntensity(1); G.inv = 0.8;
          pop(G.bx, G.by - 30, 'Vole! Fish stolen -100', '#ff8a7a', 18); AU.sfx('steal'); vibe(50);
        } else if (G.t - o.l0 > 0.95) { o.state = 'away'; if (o.minD < 110) { G.feints++; addScore(150); addCombo(1); pop(G.bx, G.by - 30, 'FEINT! +' + 150 * G.mult, '#9ff0ff', 18); AU.sfx('feint'); } }
        return;
      }
      if (o.state === 'away') { o.py -= 260 * dt; o.px += (G.speed + 120) * dt; if (o.py < -100) o.dead = true; }
    },
    lp: function (o, t) { var u = (t - o.l0) / 0.55; return { x: o.lx + (o.tx - o.lx) * u, y: o.ly + (o.ty - o.ly) * u }; },
    shapes: function (o, t) { if (o.state !== 'lunge' && !(o.state === 'hover' && t - o.h0 > 1.0)) return []; if (o.state === 'hover') return [{ k: 'c', x: G.bx + G.speed * 0.55 * 0.7, y: G.by, r: 20, kd: 'fn', avoid: true, fn: noop }]; var p = this.lp(o, t); return [{ k: 'c', x: p.x, y: p.y, r: 18, kd: 'fn', avoid: true, fn: noop }]; },
    right: function (o) { return o.state === 'wait' ? o.x + 400 : 1e12; },
    draw: function (c, o) { if (o.state === 'wait') return; var tuck = o.state === 'lunge' || (o.state === 'hover' && G.t - o.h0 > 0.9); ART.frigatebird(c, o.px, o.py, G.t, true, tuck); if (o.state === 'hover' && G.t - o.h0 > 0.85) { c.fillStyle = '#ff5a3c'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText('!', o.px, o.py - 30); c.textAlign = 'left'; } }
  };
  // ----- L17 Agalega: cloud shade, night navigation gates
  T.shade = {
    ax: function (o) { return o.x0; },
    update: function (o) { if (G.bx > o.x0 && G.bx < o.x1) G.zshade = 1; },
    shapes: function (o) { return G.sunOn && G.energy < 85 ? [{ k: 'r', x: o.x0 + 40, y: 120, w: o.x1 - o.x0 - 80, h: 300, kd: 'fn', cost: -6, fn: noop }] : []; },
    right: function (o) { return o.x1 + 200; },
    draw: function (c, o) {
      var g = c.createLinearGradient(0, o.y, 0, SEA); g.addColorStop(0, 'rgba(20,40,80,0.05)'); g.addColorStop(1, 'rgba(20,40,80,0.22)'); c.fillStyle = g; c.fillRect(o.x0, o.y + 30, o.x1 - o.x0, SEA - o.y - 30);
      var w = o.x1 - o.x0; for (var i = 0; i < 6; i++) { var x = o.x0 + w * (0.1 + i * 0.16), r = w * (0.12 + 0.05 * Math.sin(i * 2.1)); var gg = c.createRadialGradient(x, o.y - r * 0.2, r * 0.1, x, o.y, r); gg.addColorStop(0, 'rgba(255,255,255,0.98)'); gg.addColorStop(0.7, 'rgba(235,242,250,0.9)'); gg.addColorStop(1, 'rgba(235,242,250,0)'); c.fillStyle = gg; c.beginPath(); c.arc(x, o.y, r, 0, 6.2832); c.fill(); }
    }
  };
  function gateWalls(o) { return o.open === 0 ? [[-80, 64], [238, SEA + 40]] : [[-80, 252]]; }
  T.navGate = {
    shapes: function (o) { return gateWalls(o).map(function (w) { return { k: 'r', x: o.x, y: w[0], w: 90, h: w[1] - w[0], kd: 'haz', nm: true }; }); },
    update: function (o) { if (!o.judged && G.bx > o.x + 90) { o.judged = true; if (!o.hitDone) { G.navs++; addScore(300); addCombo(1); banner('Bon direksion!', 'Star navigation +300', '#ffe27a'); AU.sfx('style'); } } },
    right: function (o) { return o.x + 140; },
    draw: function (c, o) {
      gateWalls(o).forEach(function (w) { var g = c.createLinearGradient(o.x, 0, o.x + 90, 0); g.addColorStop(0, 'rgba(30,36,52,0.0)'); g.addColorStop(0.2, 'rgba(30,36,52,0.95)'); g.addColorStop(0.8, 'rgba(30,36,52,0.95)'); g.addColorStop(1, 'rgba(30,36,52,0.0)'); c.fillStyle = g; c.fillRect(o.x - 10, w[0], 110, w[1] - w[0]); c.strokeStyle = 'rgba(160,180,220,0.35)'; c.lineWidth = 1; for (var y = w[0]; y < w[1]; y += 9) { c.beginPath(); c.moveTo(o.x + ((y * 7) % 80), y); c.lineTo(o.x + ((y * 7) % 80) - 6, y + 16); c.stroke(); } });
    }
  };
  function drawCross(c, x, y, up, a) { // the Southern Cross, its long axis pointing at the open lane
    var ang = up ? -0.55 : 0.55, pts = [[0, -34, 4.2], [0, 30, 4.8], [-20, -2, 3.4], [18, 4, 3.2], [7, 10, 2]];
    c.save(); c.translate(x, y); c.rotate(ang);
    c.strokeStyle = 'rgba(200,220,255,' + 0.25 * a + ')'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -34); c.lineTo(0, 30); c.moveTo(-20, -2); c.lineTo(18, 4); c.stroke();
    pts.forEach(function (p) { var g = c.createRadialGradient(p[0], p[1], 0, p[0], p[1], p[2] * 4); g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(1, 'rgba(180,210,255,0)'); c.fillStyle = g; c.fillRect(p[0] - p[2] * 4, p[1] - p[2] * 4, p[2] * 8, p[2] * 8); });
    c.restore();
  }
  // ----- L18 Saint-Brandon cyclone: lightning, eyewall, debris, the eye
  T.bolt = {
    update: function (o) {
      if (o.t0 === undefined && G.bx >= o.x - birdLead(o.lead)) { o.t0 = G.t; AU.sfx('flash'); }
      if (o.t0 !== undefined && !o.struck && G.t >= o.t0 + o.lead - 0.2) { o.struck = true; if (onScreen(o.x)) { G.lightning = 0.45; G.shake = Math.max(G.shake, 0.25); AU.sfx('lightning'); } }
    },
    win: function (o, t) { return o.t0 !== undefined && t >= o.t0 + o.lead - 0.2 && t <= o.t0 + o.lead + 0.22; },
    shapes: function (o, t) { return this.win(o, t) ? [{ k: 'r', x: o.x - 18, y: -60, w: 36, h: o.yEnd + 60, kd: 'haz', nm: true }] : []; },
    right: function (o) { return o.x + 60; },
    draw: function (c, o) {
      if (o.t0 === undefined) return; var t = G.t, k = (t - o.t0) / (o.lead - 0.2);
      function zig(w, col) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(o.x, 0); for (var i = 1; i <= 8; i++) c.lineTo(o.x + (i % 2 ? 12 : -12) * Math.sin(o.x + i), o.yEnd * i / 8); c.stroke(); }
      if (k < 1) { c.save(); c.setLineDash([8, 8]); zig(2, 'rgba(255,255,255,' + (0.25 + 0.6 * k) + ')'); c.restore(); c.fillStyle = 'rgba(255,255,255,' + 0.6 * k + ')'; ART.ell(c, o.x, o.yEnd, 18 * k + 4, 5); c.fill(); }
      else if (this.win(o, t)) { zig(12, 'rgba(160,200,255,0.5)'); zig(4, '#ffffff'); }
      else if (t - o.t0 < o.lead + 0.6) zig(2, 'rgba(255,255,255,0.3)');
    }
  };
  T.eyewall = {
    ax: function (o) { return o.x0; },
    update: function (o) { if (G.bx > o.x0 && G.bx < o.x1) { var A = (o.soft ? 650 : 1000) * windK(); G.zfy += A * Math.sin(G.t * 1.35 + G.bx * 0.0017); G.zspd *= 1 + 0.12 * Math.cos(G.t * 1.35 + G.bx * 0.0017); G.zeye = 1; if (!o.hello) { o.hello = true; AU.sfx('wind'); } if (Math.random() < 0.02) AU.sfx('wind'); } },
    right: function (o) { return o.x1 + 100; }
  };
  T.debris = {
    p: function (o, j, t) { var a = o.w * t + o.seed + j * 6.2832 / o.n; return { x: o.x + o.R * Math.cos(a), y: o.y + o.R * 0.8 * Math.sin(a), a: a }; },
    shapes: function (o, t) { var s = []; for (var j = 0; j < o.n; j++) { var p = this.p(o, j, t); s.push({ k: 'c', x: p.x, y: p.y, r: 13, kd: 'haz', nm: true }); } return s; },
    right: function (o) { return o.x + o.R + 40; },
    draw: function (c, o) {
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 2; ART.ell(c, o.x, o.y, o.R, o.R * 0.8); c.stroke();
      for (var j = 0; j < o.n; j++) { var p = this.p(o, j, G.t); c.save(); c.translate(p.x, p.y); c.rotate(p.a * 3); var kind = (j + Math.floor(o.seed * 3)) % 3;
        if (kind === 0) { c.fillStyle = '#3f7a2e'; for (var f = -3; f <= 3; f++) { ART.ell(c, f * 5, Math.abs(f) * 2, 3, 10, f * 0.3); c.fill(); } c.strokeStyle = '#7b5b3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-18, 0); c.lineTo(18, 0); c.stroke(); }
        else if (kind === 1) { c.fillStyle = '#6b4a28'; ART.ell(c, 0, 0, 11, 10); c.fill(); c.fillStyle = '#3b2a16'; ART.ell(c, -3, -3, 2, 2); c.fill(); }
        else { var g = c.createLinearGradient(0, -5, 0, 5); g.addColorStop(0, '#b08a5a'); g.addColorStop(1, '#6a4e30'); c.fillStyle = g; c.fillRect(-20, -5, 40, 10); }
        c.restore(); }
    }
  };
  T.eye = {
    ax: function (o) { return o.x0; },
    update: function (o) {
      if (G.bx > o.x0 && G.bx < o.x1) { G.zcalm = 1; if (!o.hello) { o.hello = true; if (G.streamers < G.maxStreamers) G.streamers++; G.energy = Math.min(100, G.energy + 30); banner('Lizye siklonn', 'The calm eye: +1 tail feather, energy', '#ffe27a'); AU.music('outer'); AU.setIntensity(2); } }
      if (G.bx > o.x1 && !o.bye) { o.bye = true; AU.music('storm'); musicInt(); }
    },
    right: function (o) { return o.x1 + 100; }
  };
  function mkLive(o) { o.def = T[o.type]; o.t0 = G.t; o.ax = 0; o.act = true; G.act.push(o); return o; }

  // ---------------- input ----------------
  var ptr = null;
  function pressDown() { if (mode !== 'play') return; if (!input.hold) input.press = true; input.hold = true; }
  function pressUp() { input.hold = false; }
  function doDive() { if (!G || mode !== 'play' || !hasPerk('dive') || G.dive) return; G.dive = 1; G.vy = 760; G.energy = Math.max(0, G.energy - 2); AU.sfx('dive'); input.hold = false; }
  function doBurst() { if (!G || mode !== 'play' || !hasPerk('burst') || G.burstCd > 0) return; G.burstT = 0.9; G.burstCd = hasPerk('flock') ? 5 : 7; G.energy = Math.max(0, G.energy - 5); AU.sfx('burst'); pop(G.bx, G.by - 30, 'BURST!', '#9ff0ff', 20); }
  function doRoll() { if (!G || mode !== 'play' || !hasPerk('roll') || G.rollCd > 0) return; G.rollT = 0.6; G.rollCd = hasPerk('display') ? 3 : 4.5; AU.sfx('roll'); if (G.L.id === 14 || hasPerk('display')) { var v = G.L.id === 14 ? 150 : 50; addScore(v); pop(G.bx, G.by - 44, 'LOOP-DE-LOOP +' + v * G.mult, '#ff9bd2', 15); if (G.L.id === 14) AU.sfx('style'); } }
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
      if (G.L.id === 13 && groundAt(G.bx + 300)) cost += Math.max(0, ty - 300) * 0.6;
      var flr = Math.min(SEA, floorAt(G.bx + sp * 0.5)); if (flr < SEA - 3) cost += Math.max(0, ty - (flr - 40)) * 2;
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
          else if (s.kd === 'fn') { var dd = d - (s.pad || 0); if (s.avoid) { if (dd < BR + 6) cost += 700 * (1.3 - k2 * 0.09); else if (dd < BR + 30) cost += (BR + 30 - dd) * 3; } else if (s.lure && dd < BR + 8) cost -= s.lureW || 60; else if (s.cost && dd < BR) cost += s.cost; }
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
    if (G.zthermalPrev && G.ai.ty < G.by + 20) h = false; // let the thermal do the lifting
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
  var TIMERS = ['inv', 'hitSlow', 'shake', 'wet', 'slipT', 'burstT', 'burstCd', 'rollT', 'rollCd', 'penCd', 'lightning', 'nmFlash', 'launchT', 'surfT'];
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
    // zone effects gathered from last frame's entity updates (wind, thermals, water curtains, surf, shade...)
    var zfy = G.zfy, zspd = G.zspd, zdrain = G.zdrain, zth = G.zthermal, zrest = G.zrest, zshade = G.zshade;
    G.zthermalPrev = zth; G.zsurfPrev = G.zsurf; G.zeyePrev = G.zeye; G.zcalmPrev = G.zcalm; G.zgustPrev = G.zgust;
    if (G.zsurf) { if (!G.surfT) { G.surfs++; AU.sfx('surf'); pop(G.bx, G.by - 30, 'SURF!', '#9ff0ff', 18); addCombo(1); } G.surfT = 0.35; addScore(90 * dt); }
    G.zfy = 0; G.zspd = 1; G.zdrain = 0; G.zthermal = 0; G.zsurf = 0; G.zrest = 0; G.zshade = 0; G.zeye = 0; G.zcalm = 0; G.zgust = 0;
    if (G.surfT > 0) m *= hasPerk('surf') ? 1.34 : 1.24;
    m *= zspd;
    if (L.sand) G.tide = L.id === 12 ? clamp(0.15 + G.prog * 1.2, 0.15, 1) : 0.5 - 0.5 * Math.cos(6.2832 * G.t / 34);
    if (L.id === 16) { var lowNow = G.tide > 0.6; if (lowNow !== G.wasLow) { if (G.t > 2) { banner(lowNow ? 'Lamare pe bese!' : 'Lamare pe monte!', lowNow ? 'Low tide: sandbars & coral' : 'High tide: open water', '#ffe27a'); AU.sfx('bell'); } G.wasLow = lowNow; } }
    G.sunOn = L.id === 17 && G.bx < (L.nightAt || 1e9);
    if (L.id === 17 && !G.musicSwitched && G.bx > L.nightAt) { G.musicSwitched = true; AU.music('night'); musicInt(); }
    G.speed = G.baseSpeed * m;
    G.camX += G.speed * dt; G.bx = G.camX + G.birdOff;
    // timers
    for (var ti = 0; ti < TIMERS.length; ti++) { var tk = TIMERS[ti]; if (G[tk] > 0) G[tk] = Math.max(0, G[tk] - rdt); }
    if (G.flash > 0) G.flash = Math.max(0, G.flash - rdt * 1.15);
    if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0 && G.chain > 0) { G.chain = Math.max(0, (G.mult - 2) * 3); G.mult = multFor(G.chain); G.comboT = G.chain > 0 ? G.comboMax : 0; musicInt(); } }
    // bird physics
    var grav = 980, lift = 2150 * (hasPerk('agile') ? 1.12 : 1);
    if (G.wet > 0) { grav *= 1.3; lift *= 0.82; }
    if (G.rain) { grav *= 1.12; G.vy += 40 * dt; }
    var canFlap = G.energy > 0;
    if (input.press && canFlap && !G.dive) { G.vy = Math.min(G.vy, -250); AU.sfx('flap'); }
    input.press = false;
    G.glide = 0;
    if (G.dive === 1) { G.vy = 760; if (G.by >= SEA + 38) { G.dive = 2; G.vy = -520; } }
    else if (G.dive === 2) { G.vy += grav * 0.3 * dt; if (G.by < SEA - 30) G.dive = 0; }
    else {
      G.vy += (grav + zfy) * dt;
      if (input.hold && canFlap) G.vy -= lift * dt;
      var gmax = hasPerk('thermal') ? 100 : 140;
      if (!input.hold && G.vy > gmax && hasPerk('glide') && canFlap && zfy <= 300) { G.vy = Math.min(G.vy, gmax + (G.rain ? 40 : 0)); G.glide = 1; }
      if (zth && !input.hold) { G.glide = 1; G.vy = Math.max(G.vy, -330); }
    }
    G.vy = Math.max(G.launchT > 0 ? -820 : -400, Math.min(G.dive === 1 ? 760 : 560, G.vy));
    var wasAbove = G.by < SEA;
    G.by += G.vy * dt;
    var FL = Math.min(SEA, floorAt(G.bx)), gnd = groundAt(G.bx) || (FL < SEA - 3 ? 'sand' : null) || (G.vert ? 'cliff' : null);
    if (G.dive && wasAbove && G.by >= SEA && !gnd) { splash(G.bx, 14, true); AU.sfx('splash'); }
    if (G.by < 14) { G.by = 14; G.vy = Math.max(0, G.vy); }
    if (G.dive && gnd && G.by > FL - 12) { if (gnd === 'shore') penalty('Zonn proteze!'); G.dive = 0; G.vy = -420; G.by = FL - 12; AU.sfx('bounce'); }
    if (!G.dive && G.by > FL - 12 && G.vy > 0) {
      if (!canFlap) { G.by = FL - 12; if (DEMO) { G.energy = 12; G.demoStarved = (G.demoStarved || 0) + 1; } else { gameOver(G.vert ? 'Out of energy: you slid down the cascade!' : 'Out of energy: the paille-en-queue needs fish!'); return; } }
      G.by = FL - 12; G.vy = -300; if (!(hasPerk('surf') && !gnd)) G.energy = Math.max(0, G.energy - 3);
      if (gnd === 'shore') penalty('Zonn proteze!'); else if (gnd) AU.sfx('bounce'); else { splash(G.bx, 8); AU.sfx('splash'); }
    }
    // energy
    var drain = 2.0 + (input.hold ? 1.3 * (L.flapCost || 1) : 0); if (G.glide) drain *= 0.5; if (G.slipT > 0) drain *= 0.5;
    drain = drain * (L.drainMul || 1) + zdrain; if (G.sunOn) drain *= zshade ? 0.75 : 1.6; if (hasPerk('stamina')) drain *= 0.85;
    G.energy = Math.max(0, G.energy - drain * dt);
    if (zrest) G.energy = Math.min(100, G.energy + 32 * dt);
    G.minEnergy = Math.min(G.minEnergy, G.energy);
    if (G.energy < 25 && !G.lowWarned) { G.lowWarned = true; banner('Atansion!', 'Low energy: catch fish!', '#ff8a7a'); AU.sfx('call'); }
    if (G.energy > 40) G.lowWarned = false;
    G.flapPh += dt * (input.hold ? 22 : G.glide ? 0 : 9);
    // activate entities that come into range
    var ahead = G.camX + viewW + 450;
    while (G.next < G.ents.length && G.ents[G.next].ax < ahead) { var o = G.ents[G.next++]; if (o.act) continue; o.act = true; o.def = T[o.type]; o.t0 = G.t; if (o.def && o.def.init) o.def.init(o); if (o.def) G.act.push(o); }
    // update + collide
    var bx = G.bx + 4, by = G.by, catchR = 14 + (hasPerk('sense') ? 12 : 0) + (hasPerk('magnet') ? 12 : 0) + (G.dive ? 6 : 0), slipIn = false, nmR = NM + (hasPerk('arch') ? 12 : 0);
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
        else if (s.kd === 'fn') { if (d < BR + (s.pad || 0)) s.fn(e, s, d); }
        else if (s.kd === 'slip') { if (d < 0) { slipIn = true; e.slipOn = 1; if (!e.slipDone) { G.slipMeter += dt * (hasPerk('slip') ? 2.6 : 1.5); if (G.slipMeter >= 0.7) { e.slipDone = true; G.slipMeter = 0; G.slipT = hasPerk('slip') ? 3.4 : 2.2; G.slips++; addScore(30); addCombo(1); G.energy = Math.min(100, G.energy + 5); AU.sfx('slip'); pop(bx, by - 34, 'SLIPSTREAM! +' + 30 * G.mult, '#9ff0ff', 18); } } } }
      }
      if (hitThis) { if (G.inv <= 0 && G.burstT <= 0) { e.hitDone = true; } G.lastHitType = e.type; hit(); e.nearT = 0; }
      else if (hasNm && minHaz < BR + nmR) e.nearT = 1;
      else if (e.nearT && minHaz > BR + nmR + 6) { e.nearT = 0; if (!e.hitDone && !e.nmDone) { e.nmDone = true; nearMiss(); } }
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
    if (L.id === 18) { var ph = G.prog < 0.3 ? 1 : G.prog < 0.58 ? 2 : G.prog < 0.72 ? 3 : 4; if (ph !== G.phase) { if (G.phase) { var PN = ['', 'Phase 1: rain bands', 'Phase 2: the eyewall', 'The calm eye', 'Phase 3: ESCAPE!']; banner(ph === 3 ? 'Lizye!' : 'SIKLONN', PN[ph], ph === 3 ? '#ffe27a' : '#ff8a7a'); AU.sfx(ph === 3 ? 'bell' : 'thunder'); } G.phase = ph; } }
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
      else if (s.type === 'rock') { g.addColorStop(0, '#d8d2c4'); g.addColorStop(0.2, '#8f8778'); g.addColorStop(1, '#3d3a34'); }
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
      if (L.id === 1 || L.id === 3 || L.id === 4) { if (h < 0.4) ART.pirogue(c, x, y0, 56, ['#ff4f6d', '#2f9be8', '#ffb400'][Math.floor(h * 20) % 3], G.t); else if (h < 0.7 && L.id !== 1) ART.midBoat(c, x, y0, G.t); }
      if ((L.id === 7 || L.id === 8) && h < 0.45) { c.fillStyle = 'rgba(28,30,36,0.8)'; ART.poly(c, [x - 46, SEA - 26, x - 26, SEA - 70 - h * 120, x + 4, SEA - 84 - h * 100, x + 30, SEA - 26]); c.fill(); }
      if (L.id === 16 && h < 0.3) ART.pirogue(c, x, y0, 60, '#2f9be8', G.t);
      if ((L.id === 13 || L.id === 14) && h < 0.6) for (var bq = 0; bq < 4; bq++) ART.tern(c, x + bq * 30, 120 + h * 160 + Math.sin(G.t + bq) * 10, 3.14, G.t * 10 + bq, bq % 2, 0.7);
      if (L.id === 18 && h < 0.5) { c.save(); c.translate(x, SEA - 26); c.strokeStyle = '#2a3a2a'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(10, -40, 34, -60); c.stroke(); c.fillStyle = '#2f4a2c'; for (var pf = 0; pf < 5; pf++) { ART.ell(c, 34 + pf * 8, -60 + pf * 3 + Math.sin(G.t * 6 + pf) * 3, 16, 4, 0.2); c.fill(); } c.restore(); }
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
    if (!G || mode === 'title' || mode === 'levels' || mode === 'how' || mode === 'victory') { drawTitle(); return; }
    if (G.vert) { renderVert(); return; }
    var L = G.L;
    drawBG(IMG[L.bg], 0.06, G.camX);
    if (L.id === 5 && G.bx > 21600) { c.fillStyle = 'rgba(30,70,70,' + Math.min(0.38, (G.bx - 21600) / 3000) + ')'; c.fillRect(0, 0, W, H); }
    if (G.rain) { c.fillStyle = 'rgba(30,40,60,0.38)'; c.fillRect(0, 0, W, H); }
    if (L.id === 17) { var nk = clamp((G.bx - L.nightAt + 2500) / 2500, 0, 1); if (G.sunOn && nk === 0) { c.fillStyle = 'rgba(255,250,220,0.10)'; c.fillRect(0, 0, W, H); } if (nk > 0) { c.fillStyle = 'rgba(10,14,50,' + 0.55 * nk + ')'; c.fillRect(0, 0, W, H); } }
    var sh = G.shake > 0 ? (Math.random() - 0.5) * 24 * G.shake : 0, sh2 = G.shake > 0 ? (Math.random() - 0.5) * 24 * G.shake : 0;
    c.setTransform(dpr * scale, 0, 0, dpr * scale, (-G.camX * scale + sh) * dpr, (offY + sh2) * dpr);
    drawMid();
    var under = G.by > SEA - 4;
    eachLayer(0);
    if (under) drawBird();
    drawWater(L.water);
    drawGround();
    if (L.sand) drawSand();
    eachLayer(1);
    if (G.bx > L.len - viewW * 1.5) finishLine(c, L.len, 'FINI! ' + L.short.toUpperCase());
    if (!under) drawBird();
    drawParts();
    eachLayer(2);
    if (L.id === 6) drawNight();
    if (L.id === 17 && G.bx > L.nightAt - 1600) drawDark(clamp((G.bx - L.nightAt + 1600) / 1600, 0, 1));
    if (L.id === 18) drawStorm();
    drawPops();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    screenFx();
    drawHUD();
  }
  function drawPops() { for (var pi = 0; pi < G.pops.length; pi++) { var p = G.pops[pi]; c.globalAlpha = Math.min(1, p.life * 2); if (G.vert) { c.save(); c.translate(p.x, p.y); c.rotate(Math.PI / 2); txt(p.text, 0, 0, p.size, p.col, 'center'); c.restore(); } else txt(p.text, p.x, p.y, p.size, p.col, 'center'); c.globalAlpha = 1; } }
  function drawParts() {
    for (var i = 0; i < G.parts.length; i++) {
      var q = G.parts[i], a = Math.max(0, q.life / q.max);
      if (q.kind === 'feather') { c.save(); c.translate(q.x, q.y); c.rotate(q.life * 5); c.fillStyle = 'rgba(255,255,255,' + a + ')'; ART.ell(c, 0, 0, q.size, q.size * 0.3); c.fill(); c.restore(); }
      else if (q.kind === 'smoke') ART.smoke(c, q.x, q.y, q.size * (2 - a), 0.5 * a);
      else { c.globalAlpha = a; c.fillStyle = q.col; c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); c.globalAlpha = 1; }
    }
  }
  // ---- L15: the vertical climb. Same world maths, drawn rotated: world +x = up the screen, world y = across.
  function drawBGV(img) {
    if (!img || !img.complete || !img.naturalWidth) { c.fillStyle = '#334'; c.fillRect(0, 0, W, H); return; }
    var iw = W, ih = iw * img.naturalHeight / img.naturalWidth; if (ih < H) { ih = H; iw = ih * img.naturalWidth / img.naturalHeight; }
    var ox = (W - iw) / 2, off = (G.camX * scale * 0.35) % (ih * 2);
    for (var i = -1; i < 3; i++) { var y = H - ih * (i + 1) + off; if (y > H || y + ih < 0) continue; if ((i % 2 + 2) % 2 === 1) { c.save(); c.translate(ox, y + ih); c.scale(1, -1); c.drawImage(img, 0, 0, iw, ih); c.restore(); } else c.drawImage(img, ox, y, iw, ih); }
  }
  function renderVert() {
    var L = G.L; drawBGV(IMG[L.bg]);
    c.fillStyle = 'rgba(10,20,30,0.18)'; c.fillRect(0, 0, W, H);
    var sh = G.shake > 0 ? (Math.random() - 0.5) * 24 * G.shake : 0, sh2 = G.shake > 0 ? (Math.random() - 0.5) * 24 * G.shake : 0;
    c.setTransform(0, -scale * dpr, scale * dpr, 0, (offX + sh) * dpr, (H + scale * G.camX + sh2) * dpr);
    // the waterfall cliff on the far side (world y >= SEA)
    var x0 = G.camX - 60, x1 = G.camX + viewW + 60;
    var g = c.createLinearGradient(0, SEA - 10, 0, SEA + 120); g.addColorStop(0, '#5b5e64'); g.addColorStop(0.3, '#2c2e33'); g.addColorStop(1, '#141517');
    c.beginPath(); c.moveTo(x0, SEA + 400);
    for (var x = x0; x <= x1; x += 30) c.lineTo(x, SEA - 4 + Math.sin(x * 0.03) * 5 + Math.sin(x * 0.011) * 7);
    c.lineTo(x1, SEA + 400); c.closePath(); var ctx2 = pat('texBasalt', 0.6); if (ctx2) { c.fillStyle = ctx2; c.fill(); c.globalAlpha = 0.55; } c.fillStyle = g; c.fill(); c.globalAlpha = 1;
    c.strokeStyle = 'rgba(230,245,255,0.6)'; c.lineWidth = 2;
    for (var k = 0; k < 10; k++) { var yy = SEA + 6 + k * 9, off = (G.t * 520 + k * 77) % 120; for (var xx = x1 - off; xx > x0; xx -= 120) { c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx - 70, yy + Math.sin(xx) * 2); c.stroke(); } }
    c.fillStyle = '#4f7a34'; for (var fx = Math.floor(x0 / 160) * 160; fx < x1; fx += 160) { ART.ell(c, fx + 40, SEA - 2, 22, 7); c.fill(); }
    eachLayer(0); eachLayer(1);
    if (G.bx > L.len - viewW * 1.5) { c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(L.len - 3, 0, 6, SEA); for (var q = 0; q < 18; q++) { c.fillStyle = q % 2 ? '#111' : '#fff'; c.fillRect(L.len - 12, q * 26, 12, 26); c.fillStyle = q % 2 ? '#fff' : '#111'; c.fillRect(L.len, q * 26, 12, 26); } }
    drawBird(); drawParts(); eachLayer(2); drawPops();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    screenFx(); drawHUD();
  }
  function drawSand() {
    var x0 = G.camX - 20, x1 = G.camX + viewW + 20, bot = SEA + 80, any = false, pts = [];
    for (var x = x0; x <= x1; x += 16) { var f = floorAt(x); if (f < SEA + 12) any = true; pts.push(x, Math.min(SEA + 20, f)); }
    if (!any) return;
    c.beginPath(); c.moveTo(x0, bot); for (var i = 0; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.lineTo(x1, bot); c.closePath();
    var g = c.createLinearGradient(0, SEA - 90, 0, SEA + 20); g.addColorStop(0, '#fff6dc'); g.addColorStop(0.5, '#eedcae'); g.addColorStop(1, 'rgba(220,200,150,0.6)'); c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2; c.beginPath(); var st = false; for (var j = 0; j < pts.length; j += 2) { if (pts[j + 1] < SEA + 4) { if (!st) { c.moveTo(pts[j], pts[j + 1]); st = true; } else c.lineTo(pts[j], pts[j + 1]); } else st = false; } c.stroke();
  }
  var starField = null;
  function drawDark(k) {
    var bx = (G.bx - G.camX) * scale, by = G.by * scale + offY;
    dc.setTransform(1, 0, 0, 1, 0, 0); dc.globalCompositeOperation = 'source-over'; dc.clearRect(0, 0, dark.width, dark.height);
    dc.fillStyle = 'rgba(2,6,22,' + (0.9 * k) + ')'; dc.fillRect(0, 0, dark.width, dark.height);
    dc.globalCompositeOperation = 'destination-out';
    var R0 = 190 * scale * dpr, gg = dc.createRadialGradient(bx * dpr, by * dpr, 10, bx * dpr, by * dpr, R0); gg.addColorStop(0, 'rgba(0,0,0,0.95)'); gg.addColorStop(0.6, 'rgba(0,0,0,0.6)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
    dc.fillStyle = gg; dc.fillRect(bx * dpr - R0, by * dpr - R0, R0 * 2, R0 * 2);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(dark, 0, 0); c.restore();
    if (!starField) { starField = []; var r = PL.rng(77); for (var i = 0; i < 140; i++) starField.push([r(), r() * 0.75, r()]); }
    c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    starField.forEach(function (s) { var x = ((s[0] * W * 1.4 - G.camX * scale * 0.02) % (W * 1.4) + W * 1.4) % (W * 1.4), a = k * (0.35 + 0.4 * Math.abs(Math.sin(G.t * 1.5 + s[2] * 9))); c.fillStyle = 'rgba(255,255,240,' + a + ')'; c.fillRect(x, s[1] * H, 1.6, 1.6); });
    c.restore();
    if (!G.navList) G.navList = G.ents.filter(function (e) { return e.type === 'navGate'; });
    for (var j = 0; j < G.navList.length; j++) { var o = G.navList[j]; if (!o.judged && o.x - G.bx < 2200 && o.x - G.bx > 20) { var cxs = clamp(o.x - 380, G.camX + viewW * 0.5, G.camX + viewW - 90); drawCross(c, cxs, 140, o.open === 0, k); c.globalAlpha = k * 0.85; txt('Lakrwa di Sid', cxs, 200, 12, '#cfe0ff', 'center'); c.globalAlpha = 1; break; } }
    if (Math.random() < 0.004 * k) G.lightning = 0.18;
  }
  function drawStorm() {
    if (G.zcalmPrev) { var g = c.createLinearGradient(0, 0, 0, SEA); g.addColorStop(0, 'rgba(255,225,150,0.28)'); g.addColorStop(1, 'rgba(255,225,150,0.04)'); c.fillStyle = g; c.fillRect(G.camX - 20, -40, viewW + 40, SEA + 40); for (var r = 0; r < 5; r++) { c.fillStyle = 'rgba(255,240,190,0.08)'; ART.poly(c, [G.camX + viewW * 0.6 + r * 60, -40, G.camX + viewW * 0.3 + r * 90, SEA, G.camX + viewW * 0.36 + r * 90, SEA]); c.fill(); } return; }
    c.fillStyle = 'rgba(15,22,30,0.2)'; c.fillRect(G.camX - 20, -40, viewW + 40, SEA + 100);
    if (G.zeyePrev) { // the rotating eyewall: spiral wind streaks
      c.save(); c.translate(G.camX + viewW * 0.5, 240); c.strokeStyle = 'rgba(220,230,240,0.35)'; c.lineWidth = 2;
      for (var i = 0; i < 34; i++) { var a = G.t * 1.35 + i * 0.55, rr = 60 + ((i * 53 + G.t * 140) % 520); c.beginPath(); c.arc(0, 0, rr, a, a + 0.35); c.stroke(); }
      c.restore();
    }
  }
  function screenFx() {
    var L = G.L;
    if (G.rain) drawRain();
    if (G.rain && !G.lightning && Math.random() < 0.004) { G.lightning = 0.3; AU.sfx('thunder'); }
    if (G.lightning > 0) { c.fillStyle = 'rgba(255,255,240,' + Math.min(0.5, G.lightning) + ')'; c.fillRect(0, 0, W, H); }
    if (G.nmFlash > 0) { var vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); vg.addColorStop(0, 'rgba(160,240,255,0)'); vg.addColorStop(1, 'rgba(160,240,255,' + G.nmFlash * 1.6 + ')'); c.fillStyle = vg; c.fillRect(0, 0, W, H); }
    if (G.hitSlow > 0.9) { c.fillStyle = 'rgba(255,60,60,' + (G.hitSlow - 0.9) + ')'; c.fillRect(0, 0, W, H); }
    if (G.flash > 0) { c.fillStyle = 'rgba(255,255,255,' + Math.min(0.94, G.flash * 1.1) + ')'; c.fillRect(0, 0, W, H); }
    if (G.zgustPrev) { c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 2; for (var gi = 0; gi < 10; gi++) { var gx = (gi * 137 + G.t * 900) % W, gy = (gi * 71) % H; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + 40, gy + (G.zgustPrev < 0 ? -30 : 30)); c.stroke(); } }
  }
  function drawBird() {
    var blink = G.inv > 0 && Math.floor(G.inv * 12) % 2 === 0;
    var tilt = Math.max(-0.5, Math.min(0.7, G.vy / 700)); if (G.dive === 1) tilt = 1.1;
    var sx = G.bx, sy = G.by;
    if (G.zthermalPrev && !input.hold) { sx += Math.cos(G.t * 5) * 9; sy += Math.sin(G.t * 5) * 4; tilt = Math.sin(G.t * 5) * 0.35; }
    if (G.slipT > 0 || G.burstT > 0) { c.strokeStyle = 'rgba(160,240,255,0.65)'; c.lineWidth = 2; for (var i = 0; i < 4; i++) { c.beginPath(); c.moveTo(sx - 40 - i * 18, sy - 12 + i * 8); c.lineTo(sx - 95 - i * 18, sy - 12 + i * 8); c.stroke(); } }
    ART.bird(c, sx, sy, { t: G.t, flap: G.flapPh, glide: G.glide || (G.dive ? 1 : 0), tilt: tilt, streamers: G.streamers, maxStreamers: G.maxStreamers, roll: G.rollT > 0 ? 1 - G.rollT / 0.6 : 0, blink: blink, wet: G.wet > 0, vyTail: -G.vy / 600, scale: 1.05, glow: G.L.id === 6 || (G.L.id === 17 && G.bx > G.L.nightAt) ? 0.25 : hasPerk('legend') ? 0.18 + 0.08 * Math.sin(G.t * 3) : 0 });
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
    if (G.comboT > 0) { c.strokeStyle = '#fff'; c.lineWidth = 3 * u; c.beginPath(); c.arc(mx + r, my, r + 3 * u, -1.57, -1.57 + 6.28 * (G.comboT / G.comboMax)); c.stroke(); }
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
    var info = hudInfo(); if (info) txt(info[0], px + pw / 2, py + 42 * u, 12 * u, info[1] || '#e8fbff', 'center');
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
  function hudInfo() {
    var L = G.L, id = L.id;
    if (id === 7) return ['PERFECT LINES ' + G.perfect + '/' + G.arches + '   JET RIDES ' + G.jets];
    if (id === 8) return [G.surfT > 0 ? 'SURFING! +SPEED' : 'SURFS ' + G.surfs, G.surfT > 0 ? '#9ff0ff' : null];
    if (id === 9) return [G.zthermalPrev ? (input.hold ? 'THERMAL - LET GO TO RISE' : 'THERMAL LIFT') : 'FLAPPING COSTS x2', G.zthermalPrev ? '#ffe27a' : null];
    if (id === 10) return ['DUSK IN THE GORGE'];
    if (id === 11) { var cs = ''; for (var i = 0; i < 3; i++) cs += i < G.carry ? '●' : '○'; return ['CARRY ' + cs + '   CHICKS FED ' + G.fed + '/' + G.nests + (G.raids ? '   RAIDED ' + G.raids : ''), G.carry ? '#ffe27a' : null]; }
    if (id === 12) return ['TIDE GOING OUT ' + Math.round(G.tide * 100) + '%   DOLPHIN BOOSTS ' + G.dolph];
    if (id === 13) return [groundAt(G.bx) ? 'COLONY: STAY HIGH!' : 'WEAVE THROUGH THE FLOCK', groundAt(G.bx) ? '#ff8a7a' : null];
    if (id === 14) return ['STYLE HOOPS ' + G.hoops + '   PARADES ' + G.parades + (G.stolen ? '   STOLEN ' + G.stolen : '')];
    if (id === 15) return ['CLIMB ' + Math.round(G.bx / 34) + ' m' + (G.zrest ? '   RESTING' : ''), G.zrest ? '#9ff0a0' : null];
    if (id === 16) return [(G.tide > 0.6 ? 'LOW TIDE' : 'HIGH TIDE') + '   FEINTS ' + G.feints + '   STOLEN ' + G.stolen];
    if (id === 17) return G.sunOn ? [G.zshade ? 'CLOUD SHADE: drain x0.75' : 'MIDDAY SUN: drain x1.6', G.zshade ? '#9ff0ff' : '#ffb15c'] : ['NIGHT: follow the Southern Cross  ' + G.navs + '/' + G.gates, '#cfe0ff'];
    if (id === 18) return [['', 'CYCLONE 1/3 - RAIN BANDS', 'CYCLONE 2/3 - THE EYEWALL', 'THE CALM EYE', 'CYCLONE 3/3 - ESCAPE!'][G.phase || 1], G.phase === 3 ? '#ffe27a' : '#ff8a7a'];
    return null;
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
  var screens = ['title', 'levels', 'card', 'pause', 'over', 'done', 'how', 'victory'];
  (function () { var SP = window.PQ_SPRITES || {}; document.querySelectorAll('.bslogo').forEach(function (im) { if (SP.logoIcon) im.src = SP.logoIcon; else im.style.display = 'none'; }); })();
  function show(id) {
    screens.forEach(function (s) { var el = $(s); if (el) el.classList.toggle('hidden', s !== id); });
    var play = id === null; ['btnPause', 'btnMute'].forEach(function (b) { $(b).classList.toggle('hidden', !play); });
    [['btnDive', 'dive'], ['btnBurst', 'burst'], ['btnRoll', 'roll']].forEach(function (p) { $(p[0]).classList.toggle('hidden', !(play && G && hasPerk(p[1]))); });
    $('btnMute').textContent = save.mute ? '\u{1F507}' : '\u266B';
  }
  function toTitle() { mode = 'title'; G = null; resize(); show('title'); if (AU.ready()) { AU.music('title'); AU.setIntensity(2); AU.ambience('surf'); } refreshTitle(); }
  function refreshTitle() {
    var tot = 0, stars = 0; for (var i = 1; i <= 18; i++) { var b = save.best[i]; if (b) { tot += b.score; stars += b.stars; } }
    $('bestLine').textContent = stars ? ('\u2605 ' + stars + ' / 54   -   Total best ' + tot) : 'Fly the paille-en-queue round Mauritius!';
    $('btnSound').textContent = 'SOUND: ' + (save.mute ? 'OFF' : 'ON'); $('btnVibe').textContent = 'VIBRATION: ' + (save.vibe ? 'ON' : 'OFF');
  }
  // the world map: Mauritius plus insets for Rodrigues, Agalega and Saint-Brandon; dots follow the flight route
  var ISLAND = [[57.61, -19.98], [57.66, -20.02], [57.73, -20.07], [57.79, -20.15], [57.81, -20.25], [57.77, -20.32], [57.72, -20.39], [57.70, -20.45], [57.62, -20.50], [57.52, -20.52], [57.42, -20.51], [57.33, -20.47], [57.31, -20.44], [57.36, -20.36], [57.37, -20.28], [57.42, -20.21], [57.50, -20.16], [57.55, -20.08], [57.57, -20.02]];
  var SPOTS = { 1: [57.585, -20.0], 2: [57.62, -19.93], 3: [57.69, -19.89], 4: [57.82, -20.26], 5: [57.70, -20.41], 6: [57.77, -20.37], 7: [57.63, -20.52], 8: [57.53, -20.545], 9: [57.48, -20.45], 10: [57.42, -20.40], 11: [57.37, -20.43], 12: [57.30, -20.40], 13: [57.80, -19.88], 14: [57.80, -19.82] };
  function proj(p) { return [Math.round((p[0] - 57.24) * 520), Math.round((p[1] + 19.76) * -520)]; }
  function buildMap() {
    var el = $('levelMap'), svg = '<svg viewBox="0 0 900 420" xmlns="http://www.w3.org/2000/svg">';
    svg += '<defs><radialGradient id="sea" cx="40%" cy="45%" r="70%"><stop offset="0" stop-color="#2aa6c9"/><stop offset="1" stop-color="#0b3b5a"/></radialGradient></defs>';
    svg += '<rect x="0" y="0" width="900" height="420" rx="18" fill="url(#sea)" opacity="0.85"/>';
    svg += '<polygon points="' + ISLAND.map(function (p) { return proj(p).join(','); }).join(' ') + '" fill="#5d9e48" stroke="#f3e2b0" stroke-width="5" stroke-linejoin="round"/>';
    svg += '<text class="lbl" x="150" y="190">MAURITIUS</text>';
    var boxes = [['RODRIGUES', 460, 30, [15, 16]], ['AGALEGA', 640, 30, [17]], ['SAINT-BRANDON', 640, 225, [18]]];
    var pos = {};
    for (var k in SPOTS) pos[k] = proj(SPOTS[k]);
    boxes.forEach(function (b, i) {
      var w = i === 0 ? 160 : 230, h = i === 0 ? 360 : 170;
      svg += '<rect x="' + b[1] + '" y="' + b[2] + '" width="' + w + '" height="' + h + '" rx="14" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.35)" stroke-dasharray="6 5"/>';
      svg += '<text class="lbl" x="' + (b[1] + 12) + '" y="' + (b[2] + 22) + '">' + b[0] + '</text>';
      var cx = b[1] + w / 2, cy = b[2] + h / 2 + 10;
      if (i === 0) svg += '<ellipse cx="' + cx + '" cy="' + (cy - 30) + '" rx="62" ry="30" fill="#6fa452" stroke="#f3e2b0" stroke-width="4"/>';
      else if (i === 1) svg += '<path d="M' + (cx - 70) + ' ' + (cy + 10) + ' q35 -30 70 -10 q30 -6 60 -30 l8 10 q-30 36 -70 34 q-40 14 -68 -4z" fill="#6fa452" stroke="#f3e2b0" stroke-width="4"/>';
      else for (var q = 0; q < 6; q++) svg += '<circle cx="' + (cx - 60 + q * 24) + '" cy="' + (cy + Math.sin(q * 1.7) * 18) + '" r="7" fill="#e8d9a0"/>';
      b[3].forEach(function (lv, j) { pos[lv] = i === 0 ? [cx + (j ? 30 : -24), cy + (j ? 110 : -36)] : [cx, cy + (i === 2 ? 38 : -8)]; });
    });
    var route = []; for (var n = 1; n <= 18; n++) route.push(pos[n].join(','));
    svg += '<polyline points="' + route.join(' ') + '" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/>';
    LEVELS.forEach(function (L) {
      var p = pos[L.id], locked = L.id > save.unlocked && !QLEVEL, b = save.best[L.id];
      var col = locked ? '#55606a' : b ? (b.stars >= 3 ? '#ffd23a' : '#f08a5d') : '#2fc6e8';
      svg += '<g class="dot" data-lv="' + L.id + '"><circle cx="' + p[0] + '" cy="' + p[1] + '" r="17" fill="' + col + '" stroke="#fff" stroke-width="3"/><text x="' + p[0] + '" y="' + p[1] + '">' + (locked ? '\u{1F512}' : L.id) + '</text></g>';
    });
    el.innerHTML = svg + '</svg>';
    el.querySelectorAll('.dot').forEach(function (d) { d.addEventListener('click', function () { var n = +d.getAttribute('data-lv'); AU.init(); if (n <= save.unlocked || QLEVEL) { AU.sfx('click'); openCard(n); } else AU.sfx('penalty'); }); });
  }
  function buildLevels() {
    buildMap();
    var grid = $('levelGrid'); grid.innerHTML = '';
    LEVELS.forEach(function (L) {
      var locked = L.id > save.unlocked && !QLEVEL, b = save.best[L.id], el = document.createElement('button');
      el.className = 'lvl' + (locked ? ' locked' : '');
      el.style.backgroundImage = 'linear-gradient(180deg, rgba(0,0,0,0) 25%, rgba(0,20,40,0.88)), url(' + (ASSETS[L.bg] || '') + ')';
      var st = ''; for (var i = 0; i < 3; i++) st += '<span class="' + (b && b.stars > i ? 'on' : '') + '">\u2605</span>';
      el.innerHTML = '<div class="num">' + L.id + '</div><div class="nm">' + (L.short || L.name) + '</div><div class="st">' + st + '</div><div class="bs">' + (locked ? '\u{1F512} Finish level ' + (L.id - 1) : b ? 'Best ' + b.score : 'Unlocks: ' + PERKS[L.perk].name) + '</div>';
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
  function resume() { if (mode !== 'pause') return; mode = 'play'; show(null); AU.music(G.musicSwitched ? (G.L.id === 5 ? 'ghost' : G.L.music2 || 'night') : G.L.music); musicInt(); }
  function gameOver(reason) {
    if (G.over || G.done) return; G.over = true; G.reason = reason; AU.sfx('lose'); vibe([60, 40, 120]); AU.stopMusic();
    var go = function () { if (!G || !G.over) return; mode = 'over'; show('over'); $('overReason').textContent = reason; $('overStats').innerHTML = statsHTML(); };
    if (CAPTURE) go(); else setTimeout(go, 900);
  }
  function starsFor() {
    var pct = G.fishTotal ? Math.min(1, G.fish / G.fishTotal) : 0, h = DEMO ? G.demoHits : G.hits, s = 1, id = G.L.id;
    if (pct >= 0.4) s++; if (pct >= 0.6 && h <= 1) s++;
    if (id === 5 && G.place === 1 && s === 2) s++;
    if (id === 11) { s = 1 + (G.fed >= Math.ceil(G.nests * 0.5) ? 1 : 0) + (G.fed >= G.nests - 1 && h <= 2 ? 1 : 0); }
    if (id === 14 && s === 2 && G.parades >= 2) s++;
    if (id === 17 && s === 2 && G.navs >= G.gates - 1) s++;
    return Math.min(3, s);
  }
  function statsHTML() {
    var pct = G.fishTotal ? Math.round(100 * G.fish / G.fishTotal) : 0;
    return '<div><b>' + G.score + '</b> points</div><div>Fish ' + G.fish + ' / ' + G.fishTotal + ' (' + pct + '%)</div><div>Near misses ' + G.nm + '  -  Best combo x' + G.bestMult + '</div>' +
      '<div>Hits ' + (DEMO ? G.demoHits : G.hits) + (G.L.id === 1 ? '  -  Umbrella bounces ' + G.bounces : '') + (G.L.id === 3 || G.L.id === 5 ? '  -  Slipstreams ' + G.slips : '') + (G.L.id === 6 ? '  -  Penalties ' + G.penalties : '') + '</div>' + levelStats() +
      (G.L.id === 5 && G.place ? '<div>Regatta: <b>' + ordinal(G.place) + '</b> (+' + G.raceBonus + ')</div>' : '');
  }
  function levelStats() {
    var id = G.L.id, t = '';
    if (id === 7) t = 'Perfect arch lines ' + G.perfect + ' / ' + G.arches + '  -  Blowhole launches ' + G.jets;
    else if (id === 8) t = 'Wave surfs ' + G.surfs;
    else if (id === 9) t = 'Thermals ridden ' + G.thermals;
    else if (id === 11) t = 'Chicks fed ' + G.fed + ' / ' + G.nests + '  -  Monkeys scared ' + G.scares + '  -  Nests raided ' + G.raids;
    else if (id === 12) t = 'Dolphin boosts ' + G.dolph;
    else if (id === 14) t = 'Style hoops ' + G.hoops + '  -  Full parades ' + G.parades + '  -  Fish stolen ' + G.stolen;
    else if (id === 15) t = 'Rests on ledges ' + G.rests + '  -  Climbed ' + Math.round(G.L.len / 34) + ' m';
    else if (id === 16) t = 'Pirate feints ' + G.feints + '  -  Fish stolen ' + G.stolen;
    else if (id === 17) t = 'Southern Cross gates ' + G.navs + ' / ' + G.gates;
    else if (id === 18) t = 'Survived the cyclone: rain bands, eyewall, the eye and the escape';
    return t ? '<div>' + t + '</div>' : '';
  }
  function showVictory() {
    mode = 'victory'; show('victory'); AU.music('title'); AU.setIntensity(4);
    $('victory').style.backgroundImage = 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,20,40,0.6)), url(' + (ASSETS.victory || '') + ')';
    var tot = 0, stars = 0, flown = 0; for (var i = 1; i <= 18; i++) { var b = save.best[i]; if (b) { tot += b.score; stars += b.stars; flown++; } }
    if (DEMO && G) { stars = Math.max(stars, G.stars || 0); }
    $('vicStats').innerHTML = '<div><b>\u2605 ' + stars + ' / 54</b> stars  -  ' + flown + ' / 18 levels saved</div><div>Total best score ' + tot + '</div><div>All 18 moves unlocked: Legend of the Paille-en-Queue</div>';
    AU.sfx('win');
  }
  function complete() {
    if (G.done || G.over) return; G.done = true;
    var bonus = G.streamers * 200 + Math.round(G.energy * 2); G.score += bonus;
    var stars = starsFor(); G.stars = stars;
    var n = G.L.id, prev = save.best[n], isBest = !prev || G.score > prev.score;
    var perk = G.L.perk, newPerk = save.perks.indexOf(perk) < 0;
    if (!DEMO) {
      save.best[n] = { score: Math.max(G.score, prev ? prev.score : 0), stars: Math.max(stars, prev ? prev.stars : 0) };
      if (save.unlocked < n + 1) save.unlocked = Math.min(18, n + 1);
      if (newPerk) save.perks.push(perk);
      writeSave();
    }
    AU.sfx('win'); AU.setIntensity(4); vibe(50);
    banner('Bravo!', 'Level complete', '#ffd23a');
    var go = function () {
      if (!G || !G.done) return; mode = 'done'; show('done');
      $('doneKicker').textContent = G.L.kicker; $('doneTitle').textContent = G.L.name;
      $('doneStats').innerHTML = statsHTML() + '<div>Finish bonus +' + bonus + ' (tail feathers & energy)</div>' + (isBest && !DEMO ? '<div class="newbest">NEW BEST!</div>' : '') + (n >= 18 ? '<div class="newbest">The cyclone is beaten! All 18 flights flown.</div>' : '');
      var st = $('doneStars'); st.innerHTML = ''; for (var i = 0; i < 3; i++) { var s = document.createElement('span'); s.textContent = '\u2605'; s.className = i < stars ? 'on' : ''; s.style.animationDelay = (0.2 + i * 0.3) + 's'; st.appendChild(s); }
      for (var j = 0; j < stars; j++) setTimeout(function () { AU.sfx('star'); }, 200 + j * 300);
      var P = PERKS[perk]; $('donePerk').innerHTML = '<div class="picon">' + P.icon + '</div><div><div class="pk">' + (newPerk || DEMO ? 'NEW MOVE UNLOCKED' : 'YOUR MOVE') + '</div><div class="pn">' + P.name + '</div><div class="pd">' + P.desc + '</div></div>';
      $('btnNext').classList.remove('hidden'); $('btnNext').textContent = n >= 18 ? 'THE ENDING' : 'NEXT LEVEL';
      if (DEMO && !CAPTURE) setTimeout(function () { if (n < 18) startLevel(n + 1); else showVictory(); }, 3000);
    };
    if (CAPTURE) go(); else setTimeout(go, 1300);
  }
  btn('btnPlay', function () { var n = Math.min(18, save.unlocked); for (var i = 1; i <= save.unlocked; i++) if (!save.best[i]) { n = i; break; } openCard(n); });
  btn('btnLevels', function () { mode = 'levels'; buildLevels(); show('levels'); });
  btn('btnHow', function () { mode = 'how'; show('how'); });
  btn('btnHowBack', function () { toTitle(); });
  btn('btnLevelsBack', function () { toTitle(); });
  btn('btnCardBack', function () { mode = 'levels'; buildLevels(); show('levels'); });
  btn('btnPause', pause); btn('btnResume', resume);
  btn('btnQuit', function () { toTitle(); });
  btn('btnRetry', function () { startLevel(G.L.id); }); btn('btnOverLevels', function () { mode = 'levels'; buildLevels(); show('levels'); });
  btn('btnNext', function () { if (G.L.id >= 18) showVictory(); else openCard(G.L.id + 1); });
  btn('btnVicLevels', function () { mode = 'levels'; buildLevels(); show('levels'); }); btn('btnVicTitle', function () { toTitle(); }); btn('btnDoneRetry', function () { startLevel(G.L.id); }); btn('btnDoneLevels', function () { mode = 'levels'; buildLevels(); show('levels'); });
  btn('btnSound', function () { save.mute = !save.mute; AU.setMuted(save.mute); writeSave(); refreshTitle(); });
  btn('btnVibe', function () { save.vibe = !save.vibe; writeSave(); refreshTitle(); vibe(30); });
  btn('btnMute', function () { save.mute = !save.mute; AU.setMuted(save.mute); writeSave(); $('btnMute').textContent = save.mute ? '\u{1F507}' : '\u266B'; });
  btn('btnPauseVibe', function () { save.vibe = !save.vibe; writeSave(); $('btnPauseVibe').textContent = 'VIBRATION: ' + (save.vibe ? 'ON' : 'OFF'); });
  document.addEventListener('pointerdown', function () { AU.init(); AU.setMuted(save.mute); if ((mode === 'title' || mode === 'levels' || mode === 'how' || mode === 'victory') && !AU.musicOn()) { AU.music('title'); AU.setIntensity(2); AU.ambience('surf'); } }, true);

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
      unlockAll: function () { save.unlocked = 18; writeSave(); }, victory: function () { showVictory(); },
      setSave: function (s) { localStorage.setItem(SKEY, JSON.stringify(s)); loadSave(); },
      complete: function () { complete(); }
    }
  };
  window.__pqAdvance = function (n, dt) {
    for (var i = 0; i < n && G && mode === 'play' && !G.done && !G.over; i++) update(dt || 1 / 30);
    titleT += n * (dt || 1 / 30);
    render();
    return G ? { mode: mode, level: G.n, prog: +G.prog.toFixed(4), score: G.score, hits: DEMO ? G.demoHits : G.hits, fish: G.fish, fishTotal: G.fishTotal, deep: G.deep, deepTotal: G.deepTotal, nm: G.nm, streamers: G.streamers, energy: Math.round(G.energy), place: G.place, done: G.done, over: G.over, reason: G.reason, stars: G.stars, t: +G.t.toFixed(1), bestMult: G.bestMult, slips: G.slips, bounces: G.bounces, penalties: G.penalties, phase: G.phase, starved: G.demoStarved || 0, hitLog: (G.hitLog || []).slice(0, 14), minEnergy: Math.round(G.minEnergy), x: Math.round(G.bx), extra: { perfect: G.perfect, arches: G.arches, jets: G.jets, surfs: G.surfs, thermals: G.thermals, fed: G.fed, nests: G.nests, raids: G.raids, scares: G.scares, dolph: G.dolph, hoops: G.hoops, parades: G.parades, stolen: G.stolen, rests: G.rests, feints: G.feints, navs: G.navs, gates: G.gates } } : { mode: mode };
  };

  // ---------------- boot ----------------
  resize();
  if (QLEVEL >= 1 && QLEVEL <= 18) startLevel(QLEVEL); else toTitle();
  if (CAPTURE) render();
  requestAnimationFrame(frame);
  (ART.spritesReady ? ART.spritesReady() : Promise.resolve()).then(function () { if (CAPTURE) render(); window.__pqReady = true; });
})();
