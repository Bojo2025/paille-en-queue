// PAILLE-EN-QUEUE - levels 7 to 18: the south coast, the west, the northern islets, Rodrigues, the outer
// islands and the Saint-Brandon cyclone. Same world units as levels.js (field 540 tall, sea at y=470).
// Every level has its own core mechanic (entity types live in game.js) and a harder final section.
(function () {
  'use strict';
  var PL = window.PQLevels, L = PL.LEVELS, P = PL.PERKS, GEN = PL.GEN, B = PL.B, pick = PL.pick, mk = PL.mk;
  var SEA = PL.SEA;
  // region for each level (used by the world map and the music)
  var REG = { 1: 'North', 2: 'North', 3: 'North', 4: 'East', 5: 'South-East', 6: 'South-East', 7: 'South', 8: 'South', 9: 'South-West', 10: 'West', 11: 'West', 12: 'West', 13: 'Northern islets', 14: 'Northern islets', 15: 'Rodrigues', 16: 'Rodrigues', 17: 'Agalega', 18: 'Saint-Brandon' };
  L.forEach(function (l) { l.region = REG[l.id]; });
  function lv(o) { o.region = REG[o.id]; L.push(o); }
  lv({ id: 7, name: 'Le Souffleur & Le Pont Naturel', short: 'Le Souffleur', kicker: 'LEVEL 7 - BLOWHOLE COAST', bg: 'bg7', music: 'south', amb: 'surf',
    theme: 'No reef on the wild south coast: blowholes fire water jets that launch you to the high fish, and the natural rock arches reward a perfect line.',
    tips: ['RUMBLE = a blowhole is about to fire', 'Fly into a jet: it LAUNCHES you up to the airborne fish', 'Thread the arch along the gold line for PERFECT LINE', 'Black sea stacks: do not touch'],
    len: 46000, speed0: 280, speed1: 312, perk: 'arch', water: ['#2a88b8', '#13608f', '#0a3a62'] });
  lv({ id: 8, name: 'Gris-Gris', short: 'Gris-Gris', kicker: 'LEVEL 8 - THE COAST WITHOUT A REEF', bg: 'bg8', music: 'south', amb: 'surf',
    theme: 'Giant waves roll straight in at Souillac. Skim the wave faces for speed, stay out of the curling lip, and beware the spray of La Roche qui Pleure.',
    tips: ['Fly low in FRONT of a wave face to SURF (speed + points)', 'The white curling lip is solid: keep under or over it', 'Inside the wave = wipeout', 'Roche qui Pleure spray makes you heavy'],
    len: 48000, speed0: 285, speed1: 318, perk: 'surf', water: ['#25799a', '#155774', '#0b3348'] });
  lv({ id: 9, name: 'Bassin Blanc', short: 'Bassin Blanc', kicker: 'LEVEL 9 - THE CRATER LAKE', bg: 'bg9', music: 'west', amb: 'forest',
    theme: 'Flapping is tiring in the thin crater air. Circle in the warm thermals to climb over the crater ridges, read the lake reflections to find hidden fish, and fly blind through the fog.',
    tips: ['Flapping costs DOUBLE energy here', 'Inside a THERMAL let go: it lifts you for free', 'Some fish show only as REFLECTIONS: the deeper the reflection, the higher the fish', 'Fog hides everything: trust the reflections'],
    len: 46000, speed0: 270, speed1: 300, perk: 'thermal', water: ['#2f7f6a', '#1e5a4c', '#0f3530'], flapCost: 2.0 });
  lv({ id: 10, name: 'Black River Gorges', short: 'Gorges', kicker: 'LEVEL 10 - THE CANYON AT DUSK', bg: 'bg10', music: 'west', amb: 'forest',
    theme: 'Race through the gorge as night falls: the canyon pinches shut, fruit bats swarm across your path and the waterfalls push you down.',
    tips: ['PINCH POINTS: the gap gets tiny, steer early', 'Fruit bats cross in swarms: find the hole', 'Waterfalls PUSH you down: climb before them', 'The river is your floor: skim it'],
    len: 50000, speed0: 288, speed1: 322, perk: 'agile', water: ['#5a4a6a', '#3a3150', '#1d1a30'] });
  lv({ id: 11, name: 'Chamarel black cliffs', short: 'Chamarel', kicker: 'LEVEL 11 - PROTECT THE NEST', bg: 'bg11', music: 'west', amb: 'forest',
    theme: 'Carry fish to the hungry chicks on the cliff ledges. Monkeys climb up to raid the nests: swoop down on them to scare them off. Rocks fall from the black cliffs.',
    tips: ['Catch fish to CARRY them (up to 3)', 'Fly over a nest to FEED the chick', 'Swoop DOWN onto a climbing monkey to scare it (flying flat into it hurts)', '! at the top = falling rock'],
    len: 48000, speed0: 278, speed1: 305, perk: 'guard', water: ['#2a8aa0', '#18667a', '#0c3c4a'], nest: true });
  lv({ id: 12, name: 'Crystal Rock & Ile aux Benitiers', short: 'Crystal Rock', kicker: 'LEVEL 12 - THE DOLPHIN LAGOON', bg: 'bg12', music: 'west', amb: 'surf',
    theme: 'Dolphins leap through the Tamarin lagoon: land on their backs for a boost but never meet them head-on. The falling tide raises the sandbank and trade-wind gusts shove you around.',
    tips: ['Drop onto a dolphin\'s BACK = boost. Its head = ouch', 'The tide is going out: the sandbank rises', 'Wind lines show a GUST: up or down', 'White Crystal Rock stacks are sharp'],
    len: 52000, speed0: 292, speed1: 328, perk: 'wind', water: ['#43d6cf', '#1aa9bf', '#0f6f9a'], sand: true });
  lv({ id: 13, name: 'Ile aux Serpents', short: 'Ile aux Serpents', kicker: 'LEVEL 13 - THE SEABIRD STORM', bg: 'bg13', music: 'islet', amb: 'surf',
    theme: 'Thousands of terns and noddies swirl round the islet as one shape-shifting cloud. Weave through the gaps, and never fly low over their colony.',
    tips: ['The flock changes shape: watch the gaps open', 'Fly LOW over the islet and the noddies dive at you', 'A red ring = a territorial dive is coming', 'Burst through a closing gap'],
    len: 52000, speed0: 298, speed1: 332, perk: 'flock', water: ['#2b86c4', '#165f9a', '#0b3a68'] });
  lv({ id: 14, name: 'Round Island (Ile Ronde)', short: 'Round Island', kicker: 'LEVEL 14 - THE HOME COLONY', bg: 'bg14', music: 'islet', amb: 'surf',
    theme: 'Home at last: show off a courtship display through the feather hoops, keep your tail streamers away from jealous rivals, and dodge the crumbling slopes.',
    tips: ['Fly through the hoops in order: STYLE points', 'A full hoop set = PARADE bonus', 'Rivals chase your streamers: ROLL or BURST to shake them', 'Boulders roll down the crumbling slopes'],
    len: 52000, speed0: 298, speed1: 330, perk: 'display', water: ['#2d7cb8', '#195a8e', '#0c355e'] });
  lv({ id: 15, name: 'Rodrigues - Cascade Victoire', short: 'Cascade Victoire', kicker: 'LEVEL 15 - THE VERTICAL CLIMB', bg: 'bg15', music: 'rodrigues', amb: 'falls', vertical: true,
    theme: 'Climb straight up the waterfall cliff. The falling water pushes you back down, rocks tumble from above, and the ledges are the only place to rest.',
    tips: ['You climb UP. Hold = push away from the cliff, let go = drift back to it', 'Water curtains slow your climb and tire you', 'REST on a ledge to refill energy', 'Falling rock: watch the marker at the top'],
    len: 34000, speed0: 205, speed1: 238, perk: 'stamina', water: ['#5d6b6e', '#3b4648', '#202729'], drainMul: 1.15 });
  lv({ id: 16, name: 'Ile aux Cocos & Ile aux Sables', short: 'Ile aux Cocos', kicker: 'LEVEL 16 - THE TIDE ISLANDS', bg: 'bg16', music: 'rodrigues', amb: 'surf', sand: true,
    theme: 'The tide goes in and out while you fly: sandbars rise and vanish, coral heads appear at low tide, and frigatebirds try to rob you of your fish.',
    tips: ['Low tide = sandbars and coral heads', 'A frigatebird tucks its wings, then LUNGES', 'Change height at the last moment to FEINT', 'A stolen fish costs energy and your combo'],
    len: 54000, speed0: 302, speed1: 338, perk: 'magnet', water: ['#55dcc8', '#22b2bc', '#118096'] });
  lv({ id: 17, name: 'Agalega - the open ocean', short: 'Agalega', kicker: 'LEVEL 17 - ENDURANCE', bg: 'bg17', music: 'outer', music2: 'night', amb: 'surf',
    theme: 'A thousand kilometres of open sea. Fish are scarce, the midday sun burns your energy away, and after sunset only the stars show the way through the squalls.',
    tips: ['MIDDAY SUN: energy drains faster - stay in cloud shade', 'Flying-fish SCHOOLS come at intervals: feast!', 'NIGHT: the Southern Cross points to the open lane', 'Squall walls hide in the dark'],
    len: 60000, speed0: 308, speed1: 344, perk: 'starnav', water: ['#2a6fc0', '#174e94', '#0a2c60'] });
  lv({ id: 18, name: 'Saint-Brandon - the cyclone', short: 'Saint-Brandon', kicker: 'LEVEL 18 - FINALE: THE CYCLONE', bg: 'bg18', music: 'storm', amb: 'storm',
    theme: 'The final boss: a cyclone over the Cargados Carajos reef. Survive the rain bands and lightning, the rotating eyewall, rest in the calm eye, then escape using every skill you have.',
    tips: ['PHASE 1: a white preview line = where lightning will strike', 'PHASE 2: the eyewall wind swings you up and down; debris orbits', 'PHASE 3: the calm eye - feed and rest', 'ESCAPE: everything at once'],
    len: 62000, speed0: 312, speed1: 352, perk: 'legend', water: ['#3e6a6a', '#2a4c50', '#152c30'] });
  // region music for the earlier levels
  L[0].music = 'day'; L[1].music = 'day'; L[2].music = 'lagoon'; L[3].music = 'lagoon';

  P.arch = { name: 'Eagle Eye', icon: '\u{1F441}', desc: 'Wider near-miss window: more NEAR MISS points.' };
  P.surf = { name: 'Wave Skimmer', icon: '\u{1F30A}', desc: 'Touching the sea no longer costs energy, and surfing is faster.' };
  P.thermal = { name: 'Thermal Soar', icon: '\u{1F300}', desc: 'Glide falls even slower and thermals lift you harder.' };
  P.agile = { name: 'Quick Wings', icon: '\u26A1', desc: 'Faster climbing: sharper steering through tight gaps.' };
  P.guard = { name: 'Fifth Streamer', icon: '\u{1FAB6}', desc: 'Your tail can grow a 5th streamer: one more hit allowed.' };
  P.wind = { name: 'Wind Reader', icon: '\u{1F32C}', desc: 'Gusts and cyclone winds push you 40% less.' };
  P.flock = { name: 'Flock Sense', icon: '\u{1F426}', desc: 'Speed Burst recharges faster (5 s instead of 7 s).' };
  P.display = { name: 'Courtship Loop', icon: '\u{1F496}', desc: 'Barrel Roll recharges faster and scores style points.' };
  P.stamina = { name: 'Strong Heart', icon: '\u2764', desc: 'All energy drain is 15% lower.' };
  P.magnet = { name: 'Fish Magnet', icon: '\u{1F9F2}', desc: 'Catch fish from further away.' };
  P.starnav = { name: 'Star Navigator', icon: '\u2B50', desc: 'Your combo timer lasts 6 s instead of 4.5 s.' };
  P.legend = { name: 'Legend of Mauritius', icon: '\u{1F451}', desc: 'A golden glow: you have flown every coast and island of Mauritius!' };

  // ===================== generators =====================
  GEN[7] = function () {
    var g = mk(707), r = g.r, LL = L[6];
    g.tip(250, LL.tips[0]); g.call(140, 'Lamer pe gronde!', 'rumble');
    function jets(x0, x1, dens, hard) {
      for (var x = x0; x < x1; x += B(r, 700, 950) / dens) {
        var h = B(r, 300, 400);
        g.add({ type: 'blowhole', x: x, per: B(r, 2.6, 3.4) - (hard ? 0.5 : 0), ph: r() * 3, h: h });
        // airborne fish that you reach riding the jet
        for (var i = 0; i < 3; i++) g.add({ type: 'hoverFish', x: x + 90 + i * 55, y: SEA - h + 10 - i * 18 });
        if (r() < 0.6) g.add({ type: 'reef', x: x + B(r, 330, 430), w: B(r, 60, 90), h: B(r, 120, 230) + (hard ? 40 : 0), col: 'basalt' });
        if (r() < 0.55) g.fishArc(x + 520, 2, B(r, 260, 340));
      }
    }
    jets(900, 9000, 0.8);
    g.tip(1500, LL.tips[1]);
    var arches = [[9600, 10500, 210], [19200, 20150, 240], [30000, 31000, 268], [41500, 42600, 300]];
    arches.forEach(function (a, i) { g.add({ type: 'arch', x0: a[0], x1: a[1], top: a[2], seed: i * 3 + 1 }); for (var x = a[0] + 160; x < a[1] - 100; x += 180) g.add({ type: 'hoverFish', x: x, y: (a[2] + 40 + SEA) / 2 + 12 }); });
    g.tip(9200, LL.tips[2]); g.call(9300, 'Pont Naturel!', 'bell');
    jets(11000, 18800, 1.0);
    g.tip(13000, LL.tips[3]);
    for (var x = 20800; x < 29600; x += B(r, 420, 600)) { g.add({ type: 'reef', x: x, w: B(r, 55, 90), h: B(r, 140, 290), col: 'basalt' }); g.add({ type: 'spray', x: x + 200, per: B(r, 2.2, 3), ph: r() * 3, h: B(r, 180, 260), w: 80 }); if (r() < 0.7) g.fishArc(x + 260, 2, B(r, 230, 330)); }
    jets(31400, 41000, 1.25, true);
    g.call(40800, 'Atansion! Dernie pon!', 'call');
    jets(42900, 45600, 1.6, true);
    return g.out;
  };
  GEN[8] = function () {
    var g = mk(808), r = g.r, LL = L[7];
    g.tip(250, LL.tips[0]); g.call(140, 'Gro lame!', 'wave');
    function waves(x0, x1, gap, Hmin, Hmax) {
      for (var x = x0; x < x1; x += B(r, gap, gap * 1.3)) {
        var H = B(r, Hmin, Hmax);
        g.add({ type: 'bigwave', x: x, vx: B(r, 120, 160), H: H, Lw: B(r, 460, 560), seed: r() * 6 });
        if (r() < 0.8) g.fishArc(x + B(r, 900, 1100), 2, B(r, 230, 300));
        if (r() < 0.5) g.flyFish(x + 700, B(r, 150, 230), 3);
      }
    }
    waves(1200, 12000, 1500, 150, 210);
    g.tip(2600, LL.tips[1]); g.tip(6000, LL.tips[2]);
    g.call(12400, 'La Ros ki Plore!', 'bell'); g.tip(12600, LL.tips[3]);
    for (var x = 13000; x < 20500; x += B(r, 600, 800)) { g.add({ type: 'weeping', x: x, h: B(r, 150, 260) }); g.add({ type: 'spray', x: x + 40, per: B(r, 2.0, 2.8), ph: r() * 3, h: B(r, 220, 330), w: 110 }); g.fishArc(x + 330, 2, B(r, 240, 330)); }
    waves(21000, 36000, 1350, 180, 250);
    g.call(36400, 'Lame geant!', 'wave');
    waves(37000, 47000, 1150, 220, 290);
    for (var x2 = 38000; x2 < 47000; x2 += 2600) g.add({ type: 'spray', x: x2, per: 2.2, ph: r() * 2, h: 280, w: 110 });
    return g.out;
  };
  GEN[9] = function () {
    var g = mk(909), r = g.r, LL = L[8];
    g.tip(250, LL.tips[0]); g.call(140, 'Bassin Blanc...', 'bell');
    function crater(x0, x1, ridgeTop, fogD) {
      for (var x = x0; x < x1; x += B(r, 1500, 1800)) {
        g.add({ type: 'thermal', x: x, w: B(r, 150, 190) });
        var rt = ridgeTop + B(r, -15, 20);
        g.add({ type: 'ridge', x: x + 720, w: B(r, 260, 340), top: rt });
        for (var i = 0; i < 3; i++) g.add({ type: 'mirrorFish', x: x + 1050 + i * 70, y: B(r, 180, 360) });
        if (r() < 0.6) g.add({ type: 'hoverFish', x: x + 40, y: B(r, 140, 220) });
        if (r() < fogD) g.add({ type: 'fog', x: x + B(r, 900, 1300), y: B(r, 150, 380), r: B(r, 120, 190) });
      }
    }
    crater(1000, 12000, 190, 0.25);
    g.tip(1100, LL.tips[1]); g.tip(4000, LL.tips[2]);
    g.call(12500, 'Labrim pe vini...', 'bell'); g.tip(12700, LL.tips[3]);
    crater(13000, 30000, 160, 0.75);
    crater(30500, 40000, 140, 0.9);
    g.call(40200, 'Dernie miray!', 'call');
    crater(40600, 45500, 120, 1);
    return g.out;
  };
  GEN[10] = function () {
    var g = mk(1010), r = g.r, LL = L[9];
    g.tip(250, LL.tips[3]); g.call(140, 'Gorz Rivier Nwar!', 'bell');
    var C = [[1800, 14000, 250, 150, 1], [17500, 31000, 235, 135, 2], [34500, 49200, 220, 122, 3]];
    C.forEach(function (cc, ci) {
      var pin = []; for (var x = cc[0] + 1500; x < cc[1] - 800; x += B(r, 1700, 2300)) pin.push(x);
      g.add({ type: 'canyon', x0: cc[0], x1: cc[1], g0: cc[2], gmin: cc[3], seed: ci * 5 + 2, pin: pin, zig: cc[4] });
      for (var x2 = cc[0] + 600; x2 < cc[1] - 400; x2 += B(r, 380, 560)) g.add({ type: 'fishCanyon', x: x2, cx0: cc[0] });
      for (var x3 = cc[0] + 2600; x3 < cc[1] - 1200; x3 += B(r, 2600, 3400) - ci * 300) g.add({ type: 'waterfall', x: x3, w: B(r, 60, 90), cx0: cc[0] });
      for (var x4 = cc[0] + 3400; x4 < cc[1] - 900; x4 += B(r, 2200, 3000) - ci * 400) g.add({ type: 'batSwarm', x: x4, n: 12 + ci * 4 + (r() * 4 | 0), dir: r() < 0.5 ? 1 : -1, spd: B(r, 150, 200) + ci * 25, lead: B(r, 1.0, 1.3), seed: r() * 9, cx0: cc[0] });
    });
    g.tip(2000, LL.tips[0]); g.tip(5200, LL.tips[1]); g.tip(4400, LL.tips[2]);
    for (var x = 14200; x < 17300; x += 600) g.fishArc(x, 2, B(r, 260, 340));
    for (var x5 = 31200; x5 < 34300; x5 += 600) g.fishArc(x5, 2, B(r, 260, 340));
    g.call(34200, 'Lanwit tonbe! Vit vit!', 'call');
    return g.out;
  };
  GEN[11] = function () {
    var g = mk(1111), r = g.r, LL = L[10];
    g.tip(250, LL.tips[0]); g.call(140, 'Bann piti pe ena fin!', 'chick');
    var n = 0;
    function cliff(x0, x1, step, mk2, rf) {
      for (var x = x0; x < x1; x += B(r, step, step * 1.25)) {
        g.fishArc(x - 420, 3, B(r, 250, 330));
        var top = B(r, 300, 370), w = B(r, 90, 120);
        g.add({ type: 'ledgeNest', x: x, top: top, w: w, k: n++ });
        if (r() < mk2) g.add({ type: 'monkey', x: x - w / 2 - 6, top: top, lead: B(r, 2.4, 3.0), spd: B(r, 42, 58) });
        if (r() < rf) g.add({ type: 'rockfall', x: x + B(r, 300, 500), lead: B(r, 0.9, 1.1) });
        if (r() < 0.5) g.flyFish(x + 260, B(r, 200, 260), 2);
      }
    }
    cliff(1500, 12000, 1300, 0.25, 0.35);
    g.tip(1600, LL.tips[1]); g.tip(4200, LL.tips[2]); g.tip(7000, LL.tips[3]);
    g.call(12200, 'Zako pe monte!', 'monkey');
    cliff(12500, 30000, 1150, 0.6, 0.55);
    cliff(30500, 42000, 1050, 0.8, 0.75);
    g.call(42200, 'Pros nou nik!', 'call');
    cliff(42600, 47200, 950, 1, 1);
    return g.out;
  };
  GEN[12] = function () {
    var g = mk(1212), r = g.r, LL = L[11];
    LL.sandSeg = [{ x0: 9000, x1: 17000 }, { x0: 22000, x1: 31000 }, { x0: 36000, x1: 44000 }, { x0: 46500, x1: 51500 }];
    g.tip(250, LL.tips[0]); g.call(140, 'Bann dofin!', 'bell');
    function pod(x0, x1, gap, gustP, rockP) {
      for (var x = x0; x < x1; x += B(r, gap, gap * 1.3)) {
        var sandHere = LL.sandSeg.some(function (s) { return x > s.x0 - 200 && x < s.x1 + 200; });
        if (!sandHere) g.add({ type: 'dolphin', x: x, apex: B(r, 250, 330), vx: r() < 0.6 ? B(r, 60, 120) : -B(r, 40, 90), lead: B(r, 1.0, 1.3) });
        else g.add({ type: 'reef', x: x, w: B(r, 50, 80), h: B(r, 120, 200), col: 'crystal' });
        if (r() < gustP) g.add({ type: 'gust', x0: x + 300, x1: x + 300 + B(r, 500, 800), f: (r() < 0.5 ? -1 : 1) * B(r, 650, 950) });
        if (r() < rockP) g.add({ type: 'reef', x: x + 520, w: B(r, 50, 70), h: B(r, 150, 260), col: 'crystal' });
        if (!sandHere && r() < 0.7) g.fishArc(x + 430, 2, B(r, 240, 320)); else g.flyFish(x + 400, B(r, 220, 300), 3);
      }
    }
    pod(1000, 9000, 900, 0.15, 0.2);
    g.tip(1400, LL.tips[0]); g.tip(5000, LL.tips[3]);
    g.call(8800, 'Lamare pe bese!', 'bell'); g.tip(9100, LL.tips[1]);
    pod(9000, 22000, 850, 0.45, 0.3);
    g.tip(12000, LL.tips[2]);
    pod(22000, 40000, 780, 0.65, 0.35);
    g.call(44000, 'Gro divan!', 'wind');
    pod(40000, 51200, 700, 0.9, 0.45);
    return g.out;
  };
  GEN[13] = function () {
    var g = mk(1313), r = g.r, LL = L[12];
    LL.ground = [];
    g.tip(250, LL.tips[0]); g.call(140, 'Enn nwaz zwazo!', 'call');
    function sea(x0, x1, dens) { for (var x = x0; x < x1; x += B(r, 600, 800) / dens) { if (r() < 0.7) g.fishArc(x, 2 + (r() * 2 | 0), B(r, 250, 360)); else g.flyFish(x, B(r, 200, 380), 3); } }
    function flock(x, n, R1, R2, vx) { g.add({ type: 'flock', x: x, n: n, R1: R1, R2: R2, vx: vx, seed: r() * 6.28 }); }
    sea(800, 3000, 1);
    flock(3600, 40, 230, 120, -40); sea(5200, 7400, 1);
    flock(8200, 46, 260, 130, -50); sea(9800, 12000, 1);
    var isl = [[12500, 17500], [27000, 33000], [43000, 49000]];
    isl.forEach(function (s, i) {
      LL.ground.push({ x0: s[0], x1: s[1], type: 'rock' });
      g.add({ type: 'colony', x0: s[0] + 200, x1: s[1] - 200, n: 4 + i * 2 });
      for (var x = s[0] + 300; x < s[1] - 200; x += B(r, 500, 700)) g.add({ type: 'hoverFish', x: x, y: B(r, 150, 260) });
    });
    g.tip(12200, LL.tips[1]); g.tip(13400, LL.tips[2]);
    flock(19000, 52, 280, 140, -60); sea(20500, 22500, 1.1); flock(23500, 56, 290, 150, -55); sea(25000, 26800, 1.1);
    g.tip(19500, LL.tips[3]);
    flock(34500, 60, 300, 150, -60); sea(36000, 37600, 1.2); flock(38500, 64, 300, 160, -65); flock(40800, 54, 260, 130, -40);
    g.call(42600, 'Atansion koloni!', 'call');
    flock(50000, 70, 320, 165, -70);
    return g.out;
  };
  GEN[14] = function () {
    var g = mk(1414), r = g.r, LL = L[13];
    g.tip(250, LL.tips[0]); g.call(140, 'Lakaz paillenké!', 'call');
    function hoopSet(x, kind, k) {
      var pts = [];
      if (kind === 'loop') for (var i = 0; i < 7; i++) { var a = Math.PI - i * Math.PI / 6; pts.push([x + i * 130, 270 - Math.sin(Math.PI * i / 6) * 150]); }
      else if (kind === 'dive') for (var j = 0; j < 6; j++) pts.push([x + j * 120, 110 + j * 62]);
      else for (var q = 0; q < 7; q++) pts.push([x + q * 125, 270 + Math.sin(q * 1.1) * 120]);
      pts.forEach(function (p, i) { g.add({ type: 'hoop', x: p[0], y: p[1], set: k, idx: i, n: pts.length }); });
      return x + pts.length * 130;
    }
    var k = 0, x = 900;
    function phase(x0, x1, rivP, slopeP) {
      x = x0;
      while (x < x1) {
        x = hoopSet(x, pick(r, ['loop', 'dive', 'wave']), k++) + 300;
        if (r() < slopeP) { g.add({ type: 'slope', x: x, w: B(r, 620, 760), h: B(r, 220, 300), n: 2 + (r() * 3 | 0) }); x += 900; }
        if (r() < rivP) g.add({ type: 'rival', x: x - 600 });
        g.fishArc(x, 3, B(r, 250, 330)); x += 500;
      }
    }
    phase(900, 12000, 0.15, 0.35);
    g.tip(1300, LL.tips[1]); g.tip(6000, LL.tips[3]);
    g.call(12200, 'Bann rival!', 'call'); g.tip(12400, LL.tips[2]);
    phase(12500, 30000, 0.5, 0.5);
    phase(30500, 43000, 0.7, 0.65);
    g.call(43200, 'Dernie parad!', 'style');
    phase(43500, 51000, 1, 0.8);
    return g.out;
  };
  GEN[15] = function () { // vertical: x = height climbed, y = distance from the cliff side (SEA = against the cliff)
    var g = mk(1515), r = g.r, LL = L[14];
    g.tip(150, LL.tips[0]); g.call(100, 'Mont kaskad!', 'bell');
    function climb(x0, x1, cur, rock, out) {
      for (var x = x0; x < x1; x += B(r, 520, 700)) {
        var k = r();
        if (k < cur) { var a = B(r, 60, 260); g.add({ type: 'curtain', x0: x, x1: x + B(r, 320, 520), y0: a, y1: Math.min(SEA, a + B(r, 150, 230)) }); }
        if (r() < out) g.add({ type: 'outcrop', x: x + B(r, 200, 300), depth: B(r, 120, 250), w: B(r, 90, 140) });
        if (r() < rock) g.add({ type: 'vrock', x: x + B(r, 250, 450), y: B(r, 80, 400), lead: B(r, 1.1, 1.4) });
        g.add({ type: 'hoverFish', x: x + B(r, 80, 300), y: B(r, 120, 400) }); if (r() < 0.6) g.add({ type: 'hoverFish', x: x + B(r, 320, 480), y: B(r, 120, 400) });
      }
    }

    for (var lx = 2200; lx < 33000; lx += B(r, 2400, 3000)) g.add({ type: 'ledge', x: lx, w: 90 });
    climb(600, 9000, 0.25, 0.25, 0.4);
    g.tip(1500, LL.tips[1]); g.tip(2300, LL.tips[2]); g.tip(4500, LL.tips[3]);
    g.call(9200, 'Ros pe tonbe!', 'rock');
    climb(9200, 22000, 0.4, 0.5, 0.5);
    climb(22000, 30000, 0.5, 0.7, 0.6);
    g.call(30200, 'Lao net!', 'call');
    climb(30200, 33500, 0.6, 0.95, 0.7);
    return g.out;
  };
  GEN[16] = function () {
    var g = mk(1616), r = g.r, LL = L[15];
    LL.sandSeg = []; for (var sx = 4000; sx < 52000; sx += B(r, 3000, 4200)) LL.sandSeg.push({ x0: sx, x1: sx + B(r, 1500, 2300) });
    g.tip(250, LL.tips[0]); g.call(140, 'Lamare pe bese!', 'bell');
    LL.sandSeg.forEach(function (s) { for (var x = s.x0 + 200; x < s.x1 - 150; x += B(r, 260, 420)) g.add({ type: 'coral', x: x, h: B(r, 34, 70) }); });
    function run(x0, x1, frig) {
      for (var x = x0; x < x1; x += B(r, 600, 780)) {
        if (r() < 0.75) g.fishArc(x, 2 + (r() * 2 | 0), B(r, 240, 330)); else g.flyFish(x, B(r, 220, 330), 3);
        if (r() < frig) { g.add({ type: 'pirate', x: x + 300, lead: B(r, 1.9, 2.3), seed: r() * 6 }); x += 400; }
        if (r() < 0.2) g.add({ type: 'mast', x: x + 350, top: B(r, 200, 280), col: pick(r, ['#2f9be8', '#ffb400', '#22b573']) });
      }
    }
    run(800, 10000, 0.15);
    g.tip(3000, LL.tips[1]); g.tip(3700, LL.tips[2]); g.tip(8000, LL.tips[3]);
    run(10000, 30000, 0.32);
    run(30000, 45000, 0.45);
    g.call(45200, 'Bann fregat!', 'steal');
    run(45200, 53400, 0.65);
    return g.out;
  };
  GEN[17] = function () {
    var g = mk(1717), r = g.r, LL = L[16];
    LL.nightAt = 31000;
    g.tip(250, LL.tips[0]); g.call(140, 'Soley pe brile!', 'call');
    function school(x, n) { for (var i = 0; i < n; i++) g.add({ type: 'flyFish', x: x + i * 42, y: 300 - Math.sin(i / (n - 1) * Math.PI) * 120 + (i % 2) * 14 }); }
    for (var x = 1500; x < 30000; x += B(r, 1700, 2300)) {
      g.add({ type: 'shade', x0: x, x1: x + B(r, 500, 800), y: B(r, 60, 120) });
      if (r() < 0.45) g.fishArc(x + 900, 2, B(r, 260, 340));
      if (r() < 0.25) g.add({ type: 'cloud', x: x + 1200, y: B(r, 80, 200), w: B(r, 140, 200) });
    }
    for (var s = 5000; s < 30000; s += 5200) { school(s, 12); g.call(s - 300, 'Pwason volan!', 'fish'); }
    g.tip(1300, LL.tips[0]); g.tip(4700, LL.tips[1]);
    g.call(30200, 'Lanwit lor losean...', 'bell'); g.tip(31200, LL.tips[2]); g.tip(33500, LL.tips[3]);
    var n = 0;
    for (var gx = 33000; gx < 59000; gx += B(r, 1700, 2100) - Math.min(500, n * 40)) {
      g.add({ type: 'navGate', x: gx, open: r() < 0.5 ? 0 : 1, k: n++ });
      if (r() < 0.6) g.fishArc(gx + 700, 2, B(r, 260, 330));
    }
    for (var s2 = 36000; s2 < 59000; s2 += 6400) school(s2 + 900, 10);
    return g.out;
  };
  GEN[18] = function () {
    var g = mk(1818), r = g.r, LL = L[17], len = LL.len;
    LL.phases = [0, 0.3, 0.58, 0.72];
    g.call(140, 'Siklonn!', 'thunder'); g.tip(260, LL.tips[0]);
    // phase 1: rain bands + lightning
    g.add({ type: 'rain', x0: 400, x1: len * 0.58 });
    for (var x = 1500; x < len * 0.3; x += B(r, 700, 950)) {
      g.add({ type: 'bolt', x: x, yEnd: r() < 0.5 ? B(r, 230, 320) : B(r, 340, 400), lead: B(r, 1.35, 1.6) });
      if (r() < 0.5) g.add({ type: 'cloud', x: x + 380, y: B(r, 40, 120), w: B(r, 150, 210) });
      g.fishArc(x + 450, 3, B(r, 360, 420));
    }
    // phase 2: the eyewall - rotating wind + orbiting debris
    var e0 = len * 0.3, e1 = len * 0.58;
    g.call(e0 - 200, 'Miray siklonn!', 'wind'); g.tip(e0, LL.tips[1]);
    g.add({ type: 'eyewall', x0: e0, x1: e1 });
    for (var x2 = e0 + 900; x2 < e1 - 600; x2 += B(r, 1100, 1400)) {
      g.add({ type: 'debris', x: x2, y: B(r, 200, 300), R: B(r, 110, 160), n: 3 + (r() * 2 | 0), w: B(r, 1.4, 2.0) * (r() < 0.5 ? 1 : -1), seed: r() * 6 });
      g.fishArc(x2 + 600, 3, B(r, 250, 330)); g.fishArc(x2 + 150, 2, B(r, 380, 420));
    }
    // phase 3: the calm eye
    var c0 = len * 0.58, c1 = len * 0.72;
    g.add({ type: 'eye', x0: c0, x1: c1 });
    g.call(c0 + 100, 'Lizye siklonn: repoze!', 'bell'); g.tip(c0 + 300, LL.tips[2]);
    for (var x3 = c0 + 400; x3 < c1 - 300; x3 += 380) g.fishArc(x3, 3, B(r, 240, 340));
    // phase 4: the escape - everything together
    g.call(c1, 'Sove! Sove!', 'thunder'); g.tip(c1 + 200, LL.tips[3]);
    g.add({ type: 'rain', x0: c1, x1: len + 2000 });
    g.add({ type: 'eyewall', x0: c1 + 4000, x1: len - 1200, soft: true });
    for (var x4 = c1 + 900; x4 < len - 800; x4 += B(r, 1300, 1600)) {
      var k = r();
      if (k < 0.35) g.add({ type: 'bigwave', x: x4, vx: 140, H: B(r, 170, 230), Lw: 480, seed: r() * 6 });
      else if (k < 0.65) g.add({ type: 'bolt', x: x4, yEnd: B(r, 240, 330), lead: 1.45 });
      else if (k < 0.85) g.add({ type: 'debris', x: x4, y: B(r, 210, 290), R: 120, n: 3, w: 1.7, seed: r() * 6 });
      else g.add({ type: 'gust', x0: x4, x1: x4 + 600, f: (r() < 0.5 ? -1 : 1) * 800 });
      g.fishArc(x4 + 700, 3, B(r, 250, 330)); g.fishArc(x4 + 250, 2, B(r, 380, 420));
    }
    return g.out;
  };
})();
