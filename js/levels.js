// PAILLE-EN-QUEUE - the six levels: meta data (names, perks, colours) and seeded generators that lay out
// every fish, obstacle and set-piece along the flight. World units: the play field is 540 tall, the sea
// surface is at y=470, x grows to the right (the bird flies right).
(function () {
  'use strict';
  var SEA = 470;
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function B(r, a, b) { return a + (b - a) * r(); }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }

  var LEVELS = [
    { id: 1, name: 'Pereybere to Cap Malheureux', short: 'Pereybere', kicker: 'LEVEL 1 - FIRST FLIGHT', bg: 'bg1', music: 'day', amb: 'surf',
      theme: 'Learn to fly over the beach, then thread the fishermen\'s nets at the red-roofed church.',
      tips: ['TAP or HOLD to flap up, let go to drop', 'Leaping fish refill your energy', 'Land on a beach umbrella to BOUNCE', 'Nets and lines rise and fall: time the gap'],
      len: 34000, speed0: 225, speed1: 262, perk: 'sense', water: ['#33c9d6', '#0f8fb0', '#0a5e86'] },
    { id: 2, name: 'Coin de Mire', short: 'Coin de Mire', kicker: 'LEVEL 2 - THE WEDGE ROCK', bg: 'bg2', music: 'day', amb: 'surf',
      theme: 'Masked boobies dive-bomb from the sky while the cliff corridor squeezes round the wedge island.',
      tips: ['A shadow on the water = a booby is about to plunge', 'Inside the cliffs, follow the gap as it narrows', 'Brush past danger for NEAR-MISS points'],
      len: 39000, speed0: 245, speed1: 285, perk: 'dive', water: ['#2b7fc4', '#165a9a', '#0b3866'] },
    { id: 3, name: 'Ile Gabriel & Ile Plate', short: 'Ile Gabriel', kicker: 'LEVEL 3 - CATAMARAN PARADE', bg: 'bg3', music: 'lagoon', amb: 'surf',
      theme: 'Weave through a parade of catamaran sails, ride their slipstream, and hold your line through the tourist camera flashes.',
      tips: ['Fly just behind a sail for a SLIPSTREAM boost', 'Go over the mast or under the boom', 'Camera flash! The screen goes white: hold your line', 'NEW: swipe DOWN / S to DIVE for fish under the water'],
      len: 42000, speed0: 260, speed1: 295, perk: 'slip', water: ['#3fd3d0', '#139bc0', '#0b5f99'] },
    { id: 4, name: 'Ile aux Cerfs', short: 'Ile aux Cerfs', kicker: 'LEVEL 4 - LAGOON PLAYGROUND', bg: 'bg4', music: 'lagoon', amb: 'surf',
      theme: 'Dodge parasail tow ropes, golf balls from the island course and the banana boats\' spray, then beat a rain squall.',
      tips: ['Tow ropes are diagonal: go over the parasail', 'FORE! Golf balls arc in from the course', 'Banana-boat spray makes you heavy and wet', 'Lapli pe vini! Rain pushes you down'],
      len: 45000, speed0: 270, speed1: 305, perk: 'glide', water: ['#4fe0d2', '#1cb3c6', '#0f74a6'] },
    { id: 5, name: 'Mahebourg & Grand-Port', short: 'Mahebourg', kicker: 'LEVEL 5 - REGATTA & GHOST BATTLE', bg: 'bg5', music: 'day', music2: 'ghost', amb: 'surf',
      theme: 'Race the pirogues in the Mahebourg regatta, then survive the ghost frigates of the 1810 Battle of Grand Port.',
      tips: ['RACE! Fly low and draft behind sails to go faster', 'Your finishing place earns a big bonus', 'Ghost frigates fire cannonballs in arcs', 'Smoke hides the cannonballs: watch the flashes'],
      len: 50000, speed0: 280, speed1: 300, perk: 'burst', water: ['#2a8f9a', '#17677c', '#0d3f55'] },
    { id: 6, name: 'Ile aux Fouquets & Ile aux Aigrettes', short: 'Fouquets', kicker: 'LEVEL 6 - LIGHTHOUSE NIGHT', bg: 'bg6', music: 'night', amb: 'night',
      theme: 'Night flight: only the 1864 lighthouse beam shows the fish and the reef. Never dive onto the protected shore.',
      tips: ['It is dark: fish and reef rocks show only in the beam', 'Lit buoys glow on their own', 'Aigrettes shore: protected nests & giant tortoises', 'Touching or diving into the shore = penalty'],
      len: 48000, speed0: 270, speed1: 300, perk: 'roll', water: ['#16305a', '#0d2244', '#06142c'] }
  ];
  var PERKS = {
    sense: { name: 'Fish Sense', icon: '\u{1F41F}', desc: 'Bigger catch radius: fish are easier to grab.' },
    dive: { name: 'Dive', icon: '\u2193', desc: 'Swipe DOWN (or S / Down / DIVE button) to plunge under the surface for deep fish.' },
    slip: { name: 'Slipstream Pro', icon: '\u{1F4A8}', desc: 'Slipstream fills twice as fast and the boost lasts longer.' },
    glide: { name: 'Glide', icon: '\u{1FAB6}', desc: 'Let go while falling to glide: slower fall, half the energy drain.' },
    burst: { name: 'Speed Burst', icon: '\u00BB', desc: 'Swipe RIGHT (or D / Right / BURST button): a short dash that passes through danger.' },
    roll: { name: 'Barrel Roll', icon: '\u21BB', desc: 'Swipe UP (or E / Shift / ROLL button): spin and dodge one hit.' }
  };

  // ---------- generator helpers ----------
  function G(seed) {
    var out = [], r = rng(seed);
    return {
      r: r, out: out,
      add: function (o) { out.push(o); return o; },
      fishArc: function (x, n, apex, gap) { for (var i = 0; i < n; i++) out.push({ type: 'fishLeap', x: x + i * (gap || 70), apex: apex + Math.sin(i / Math.max(1, n - 1) * Math.PI) * -40 }); },
      flyFish: function (x, y, n) { for (var i = 0; i < n; i++) out.push({ type: 'flyFish', x: x + i * 46, y: y + Math.sin(i) * 12 }); },
      deep: function (x, n) { for (var i = 0; i < n; i++) out.push({ type: 'deepFish', x: x + i * 60, y: B(r, 492, 512) }); },
      tip: function (x, text) { out.push({ type: 'tip', x: x, text: text }); },
      call: function (x, text, sfx) { out.push({ type: 'call', x: x, text: text, sfx: sfx }); }
    };
  }

  var GEN = {};
  GEN[1] = function () {
    var g = G(101), r = g.r, cols = ['#ff4f6d', '#2f9be8', '#ffb400', '#22b573', '#9b5cff'];
    var L = LEVELS[0];
    L.ground = [{ x0: 3600, x1: 7400, type: 'beach' }, { x0: 9000, x1: 13600, type: 'beach' }];
    g.tip(250, L.tips[0]); g.call(120, 'Anou vole!');
    g.fishArc(1400, 3, 330); g.tip(1500, L.tips[1]); g.fishArc(2400, 4, 300); g.flyFish(3000, 400, 3);
    // Pereybere beach: umbrellas to bounce on, kids flying kites
    g.tip(3500, L.tips[2]);
    function beach(x0, x1) {
      for (var x = x0 + 300; x < x1 - 200; x += B(r, 330, 520)) {
        var u = g.add({ type: 'umbrella', x: x, h: B(r, 70, 120), col: pick(r, cols) });
        if (r() < 0.35) g.add({ type: 'fishLeap', x: x + 150, apex: 260 });
        if (r() < 0.25 && x < x1 - 600) { g.add({ type: 'kite', x: x + 220, kx: x + 330, ky: B(r, 150, 250), col: pick(r, cols) }); x += 250; }
      }
    }
    beach(3600, 7400);
    g.fishArc(7700, 5, 320, 60); g.add({ type: 'mast', x: 8300, top: 230, col: '#2f9be8' }); g.flyFish(8500, 420, 4);
    beach(9000, 13600);
    // open sea run past moored boats
    for (var x = 14000; x < 21500; x += B(r, 520, 800)) {
      var k = r();
      if (k < 0.45) g.add({ type: 'mast', x: x, top: B(r, 170, 290), col: pick(r, cols) });
      else if (k < 0.7) g.add({ type: 'buoy', x: x });
      if (r() < 0.6) g.fishArc(x + 250, 2 + (r() * 3 | 0), B(r, 240, 360));
      else g.flyFish(x + 260, B(r, 380, 430), 3);
    }
    g.call(21800, 'Atansion!', 'call');
    // Cap Malheureux: pirogues with nets & lines that rise and fall as timed gates
    g.tip(22200, L.tips[3]);
    var n = 0;
    for (var gx = 22800; gx < 33000; gx += B(r, 620, 780)) {
      g.add({ type: 'gate', x: gx, period: B(r, 2.6, 3.4), phase: B(r, 0, 6.28), gap: 190 - Math.min(40, n * 3), amp: 70 + Math.min(40, n * 4), col: pick(r, cols) });
      if (r() < 0.7) g.add({ type: 'fishLeap', x: gx + 300, apex: B(r, 230, 330) });
      n++;
    }
    return g.out;
  };
  GEN[2] = function () {
    var g = G(202), r = g.r, L = LEVELS[1];
    g.tip(250, L.tips[0]); g.call(140, 'Anou ale!');
    function openSea(x0, x1, dens) {
      for (var x = x0; x < x1; x += B(r, 380, 560) / dens) {
        var k = r();
        if (k < 0.55) { var m = 1 + (r() < 0.35 * dens ? 1 : 0) + (r() < 0.12 * dens ? 1 : 0); for (var i = 0; i < m; i++) g.add({ type: 'booby', x: x + i * 95, lead: B(r, 0.75, 1.05) + i * 0.12 }); }
        else if (k < 0.7) g.add({ type: 'buoy', x: x });
        if (r() < 0.65) g.fishArc(x + 200, 2 + (r() * 3 | 0), B(r, 250, 380));
        else g.flyFish(x + 180, B(r, 330, 430), 3);
      }
    }
    openSea(900, 7000, 0.8);
    g.tip(7200, L.tips[1]);
    // three cliff corridors round the wedge
    var C = [[7600, 13200, 250, 185], [17500, 24500, 230, 165], [29000, 37200, 215, 150]];
    C.forEach(function (cc, i) {
      g.add({ type: 'corridor', x0: cc[0], x1: cc[1], g0: cc[2], gmin: cc[3], seed: i * 7 + 3, wedge: i });
      for (var x = cc[0] + 500; x < cc[1] - 300; x += B(r, 420, 640)) g.add({ type: 'fishCorr', x: x, cor: cc });
    });
    g.tip(13600, L.tips[2]);
    openSea(13600, 17300, 1.1);
    openSea(24800, 28800, 1.35);
    g.call(28800, 'Atansion!', 'call');
    return g.out;
  };
  GEN[3] = function () {
    var g = G(303), r = g.r, L = LEVELS[2], sails = ['#ffffff', '#fff3d6', '#ffe1e1', '#e5f3ff'];
    g.tip(250, L.tips[0]); g.call(140, 'Anou ale!');
    g.tip(1200, L.tips[1]);
    var n = 0;
    for (var x = 1600; x < 40000; x += B(r, 640, 900) - Math.min(160, n * 4)) {
      var top = B(r, 90, 210), boom = B(r, 360, 395);
      g.add({ type: 'cat', x: x, vx: B(r, 70, 120), top: top, boomY: boom, back: B(r, 110, 150), front: B(r, 50, 80), mastDx: B(r, -10, 20), tourists: 2 + (r() * 4 | 0), cam: r() < 0.38 && x > 4000, sailCol: pick(r, sails), stripe: r() < 0.5 ? pick(r, ['#1f6fb2', '#e8443a', '#f5a400']) : null, seed: r() * 6 });
      // fish sit where the parade leaves room: just past the bow (high) and in the gap before the next sail
      if (r() < 0.7) g.fishArc(x + 190, 2, B(r, 190, 250), 60);
      if (x > 6000 && r() < 0.5) g.deep(x + 250, 2 + (r() * 2 | 0));
      if (r() < 0.55) g.flyFish(x - 400, B(r, 250, 330), 3);
      if (x > 20000 && r() < 0.25) { g.add({ type: 'cat', x: x + 330, vx: B(r, 70, 110), top: B(r, 220, 260), boomY: 392, back: 110, front: 60, mastDx: 0, tourists: 3, cam: true, sailCol: '#fff', seed: r() * 6 }); x += 330; }
      n++;
    }
    g.tip(5000, L.tips[2]);
    g.tip(7000, L.tips[3]);
    g.call(20500, 'Ile Plate!', 'bell');
    return g.out;
  };
  GEN[4] = function () {
    var g = G(404), r = g.r, L = LEVELS[3], cols = [['#ff4f6d', '#ffd400'], ['#2f9be8', '#ffffff'], ['#22b573', '#ffe14d'], ['#9b5cff', '#ff9bd2']];
    L.ground = [{ x0: 12000, x1: 19500, type: 'grass' }, { x0: 27000, x1: 32500, type: 'grass' }];
    g.tip(250, L.tips[0]); g.call(140, 'Anou ale!');
    for (var x = 1200; x < 12000; x += B(r, 700, 950)) {
      var cc = pick(r, cols);
      g.add({ type: 'parasail', x: x + 300, vx: -B(r, 60, 120), cy: B(r, 150, 290), dx: B(r, 230, 290), col: cc[0], col2: cc[1], boat: pick(r, ['#ffffff', '#e8443a', '#1f6fb2']) });
      if (r() < 0.6) g.fishArc(x + 650, 2, B(r, 280, 360));
      if (r() < 0.5) g.deep(x + 300, 2);
    }
    g.tip(11800, L.tips[1]);
    function golf(x0, x1) { for (var x = x0 + 300; x < x1; x += B(r, 360, 560)) { g.add({ type: 'golf', x: x, vy: B(r, 420, 640), t: B(r, 1.3, 1.8) }); if (r() < 0.5) g.flyFish(x + 200, B(r, 300, 400), 3); } }
    golf(12000, 19500);
    g.tip(19800, L.tips[2]);
    for (var x2 = 20000; x2 < 27000; x2 += B(r, 700, 950)) {
      g.add({ type: 'banana', x: x2 + 200, vx: -B(r, 40, 90), per: B(r, 1.8, 2.6), ph: r() * 3 });
      if (r() < 0.5) { var c2 = pick(r, cols); g.add({ type: 'parasail', x: x2 + 650, vx: -B(r, 60, 110), cy: B(r, 120, 200), dx: 250, col: c2[0], col2: c2[1], boat: '#ffffff' }); }
      if (r() < 0.6) g.fishArc(x2 + 500, 3, B(r, 250, 340));
    }
    golf(27000, 32500);
    for (var x4 = 27400; x4 < 32500; x4 += 1800) g.add({ type: 'banana', x: x4, vx: -60, per: 2.2, ph: 0 });
    // rain squall finale
    g.call(33000, 'Lapli pe vini!', 'thunder');
    g.tip(33300, L.tips[3]);
    g.add({ type: 'rain', x0: 33500, x1: 44000 });
    for (var x3 = 33900; x3 < 43800; x3 += B(r, 420, 620)) {
      g.add({ type: 'cloud', x: x3, y: B(r, 40, 210), w: B(r, 150, 230) });
      if (r() < 0.45) { var c3 = pick(r, cols); g.add({ type: 'parasail', x: x3 + 300, vx: -80, cy: B(r, 260, 320), dx: 220, col: c3[0], col2: c3[1], boat: '#ffffff' }); }
      if (r() < 0.7) g.fishArc(x3 + 200, 2, B(r, 300, 380)); else g.deep(x3 + 150, 3);
    }
    return g.out;
  };
  GEN[5] = function () {
    var g = G(505), r = g.r, L = LEVELS[4];
    g.call(140, 'Regata Mahebourg!', 'bell');
    g.tip(260, L.tips[0]);
    L.raceEnd = 21000;
    var racers = [['#e8443a', '#ffd400', 'Lion', 7], ['#1f6fb2', '#ffffff', 'Ti Kolo', 3], ['#22b573', '#ffe14d', 'Dodo', 5], ['#9b5cff', '#ff9bd2', 'Zezer', 9], ['#ff8a00', '#1d2b44', 'Kreol', 2]];
    racers.forEach(function (rc, i) { g.add({ type: 'racer', x0: 200 + i * 520, base: 262 + i * 9.5, col: rc[0], stripe: rc[1], name: rc[2], num: rc[3], seed: i * 1.7, top: B(r, 200, 270), lane: i }); });
    for (var x = 1600; x < 20500; x += B(r, 520, 760)) {
      var k = r();
      if (k < 0.4) g.add({ type: 'buoy', x: x, race: true }); else if (k < 0.6) g.add({ type: 'mast', x: x, top: B(r, 190, 260), col: '#ffb400' });
      if (r() < 0.7) g.fishArc(x + 250, 2 + (r() * 2 | 0), B(r, 300, 380)); else g.deep(x + 200, 2);
    }
    g.tip(3000, L.tips[1]);
    g.add({ type: 'finish', x: L.raceEnd });
    // ghost battle of Grand Port (1810)
    g.call(22000, 'Lagerr 1810!', 'cannon');
    g.tip(22300, L.tips[2]);
    var fr = [[22800, 30000, 0], [29000, 37500, 1], [36000, 44000, 0], [42500, 49000, 1]];
    fr.forEach(function (f) { g.add({ type: 'frigate', x0: f[0], x1: f[1], slot: f[2], fire: B(r, 2.0, 2.6) }); });
    g.tip(30500, L.tips[3]);
    for (var x2 = 22600; x2 < 49500; x2 += B(r, 520, 760)) {
      if (r() < 0.5) g.add({ type: 'smokeBank', x: x2 + 200, y: B(r, 120, 380), r: B(r, 90, 150) });
      if (r() < 0.3) g.add({ type: 'flotsam', x: x2, h: B(r, 60, 120) });
      if (r() < 0.65) g.fishArc(x2 + 300, 2, B(r, 260, 370)); else g.deep(x2 + 300, 2);
    }
    return g.out;
  };
  GEN[6] = function () {
    var g = G(606), r = g.r, L = LEVELS[5];
    L.ground = [{ x0: 14000, x1: 21000, type: 'shore' }, { x0: 31000, x1: 38500, type: 'shore' }];
    g.tip(250, L.tips[0]); g.call(140, 'Lanwit pe tonbe...', 'bell');
    function reefRun(x0, x1, dens) {
      for (var x = x0; x < x1; x += B(r, 360, 540) / dens) {
        var k = r();
        if (k < 0.55) g.add({ type: 'reef', x: x, w: B(r, 70, 140), h: B(r, 90, 250) });
        else if (k < 0.75) g.add({ type: 'buoy', x: x, light: true });
        else g.add({ type: 'reef', x: x, w: 60, h: B(r, 260, 330) });
        if (r() < 0.75) g.fishArc(x + 220, 2 + (r() * 2 | 0), B(r, 220, 360)); else g.deep(x + 200, 3);
      }
    }
    reefRun(900, 13800, 0.9);
    g.tip(2600, L.tips[1]);
    g.tip(13600, L.tips[2]); g.call(13400, 'Atansion! Zonn proteze!', 'call');
    function shore(x0, x1) {
      for (var x = x0 + 250; x < x1 - 200; x += B(r, 380, 600)) {
        if (r() < 0.5) g.add({ type: 'tortoise', x: x, vx: B(r, -12, 12) });
        else g.add({ type: 'nestZone', x: x, w: B(r, 150, 260) });
        if (r() < 0.55) g.add({ type: 'reef', x: x + 230, w: 60, h: B(r, 200, 300), tall: true });
        g.add({ type: 'fishLeap', x: x + 140, apex: B(r, 200, 300), noDrop: true });
      }
    }
    shore(14000, 21000);
    g.tip(14600, L.tips[3]);
    reefRun(21200, 30800, 1.05);
    shore(31000, 38500);
    reefRun(38700, 47000, 1.2);
    return g.out;
  };

  window.PQLevels = { LEVELS: LEVELS, PERKS: PERKS, GEN: GEN, SEA: SEA, rng: rng };
})();
