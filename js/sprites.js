// PAILLE-EN-QUEUE - painted sprites. The boats, parasails, umbrellas and the new animals are painted images
// (generated, chroma-keyed, embedded in js/assets.js as PQ_SPRITES). This file swaps the old vector boat
// drawings in art.js for the painted ones, adds waterline foam, wake, bob/pitch and a soft reflection on the
// water. Hitboxes live in game.js and are unchanged. Colour variants are made once by shifting the hull hue.
(function () {
  'use strict';
  var R = window.PQArt, SRC = window.PQ_SPRITES || {}, S = {}, TAU = Math.PI * 2;
  var V = {}; ['pirogue', 'mast', 'catamaran', 'speedboat', 'parasail', 'banana', 'frigate', 'umbrella', 'sail'].forEach(function (k) { V[k] = R[k]; });
  R.vector = V;
  Object.keys(SRC).forEach(function (k) { var im = new Image(); im.src = SRC[k]; S[k] = im; });
  R.sprites = S;
  R.spritesReady = function () { return Promise.all(Object.keys(S).map(function (k) { var im = S[k]; return im.decode ? im.decode().catch(function () {}) : new Promise(function (r) { if (im.complete) r(); else im.onload = im.onerror = r; }); })); };
  function ok(k) { var im = S[k]; return im && im.complete && im.naturalWidth > 0; }
  R.sprOk = ok;
  // ---- colour helpers
  function hexHue(col) {
    if (!col || col.charAt(0) !== '#') return null;
    var n = parseInt(col.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 0.12) return null;
    var h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360;
  }
  var cache = {};
  // hue-shift only the saturated pixels near the sprite's own hull hue (keeps wood, skin and white trim)
  function tinted(key, col, baseHue, range) {
    var h = hexHue(col); if (h === null || !ok(key)) return S[key];
    var shift = ((h - baseHue) + 540) % 360 - 180; if (Math.abs(shift) < 8) return S[key];
    var id = key + '|' + Math.round(shift); if (cache[id]) return cache[id];
    var im = S[key], cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    var x = cv.getContext('2d'); x.drawImage(im, 0, 0);
    try {
      var d = x.getImageData(0, 0, cv.width, cv.height), p = d.data;
      for (var i = 0; i < p.length; i += 4) {
        if (p[i + 3] < 8) continue;
        var r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
        if (mx < 0.08 || dl / mx < 0.32) continue;
        var hh = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; hh = (hh * 60 + 360) % 360;
        var dd = Math.abs(((hh - baseHue) + 540) % 360 - 180); if (dd > range) continue;
        var nh = (hh + shift + 360) % 360, sat = dl / mx, v = mx, c2 = v * sat, X = c2 * (1 - Math.abs((nh / 60) % 2 - 1)), m = v - c2, rr, gg, bb;
        if (nh < 60) { rr = c2; gg = X; bb = 0; } else if (nh < 120) { rr = X; gg = c2; bb = 0; } else if (nh < 180) { rr = 0; gg = c2; bb = X; } else if (nh < 240) { rr = 0; gg = X; bb = c2; } else if (nh < 300) { rr = X; gg = 0; bb = c2; } else { rr = c2; gg = 0; bb = X; }
        p[i] = (rr + m) * 255; p[i + 1] = (gg + m) * 255; p[i + 2] = (bb + m) * 255;
      }
      x.putImageData(d, 0, 0);
    } catch (e) { return S[key]; }
    cache[id] = cv; return cv;
  }
  function multiplied(key, col) { // white sail cloth dyed a colour (multiply keeps the folds & seams)
    if (!col || col === '#ffffff' || col === '#fff' || !ok(key)) return S[key];
    var id = 'm|' + key + col; if (cache[id]) return cache[id];
    var im = S[key], cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    var x = cv.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, cv.width, cv.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0); cache[id] = cv; return cv;
  }
  function ghostOf(key) {
    var id = 'g|' + key; if (cache[id]) return cache[id]; if (!ok(key)) return null;
    var im = S[key], cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    var x = cv.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop';
    var g = x.createLinearGradient(0, 0, 0, cv.height); g.addColorStop(0, 'rgba(170,255,235,0.62)'); g.addColorStop(1, 'rgba(60,160,150,0.55)');
    x.fillStyle = g; x.fillRect(0, 0, cv.width, cv.height); cache[id] = cv; return cv;
  }
  R.tinted = tinted; R.multiplied = multiplied;
  // ---- water interaction: foam at the waterline, a wake and a soft broken reflection
  function foam(c, x0, x1, sea, t, k) {
    k = k || 1; c.fillStyle = 'rgba(255,255,255,0.75)';
    for (var i = 0; i < 9; i++) { var u = i / 8, xx = x0 + (x1 - x0) * u, w = 7 + 5 * Math.abs(Math.sin(t * 3 + i * 1.7)); R.ell(c, xx, sea + 1 + Math.sin(t * 4 + i) * 1.2, w * k, 2.2 * k); c.fill(); }
  }
  function wake(c, x, sea, dir, t, n, sz) {
    for (var i = 0; i < n; i++) { var a = 0.55 - i * (0.5 / n); c.fillStyle = 'rgba(255,255,255,' + a + ')'; R.ell(c, x - dir * i * sz * 1.3, sea + 1 - Math.abs(Math.sin(t * 7 + i)) * sz * 0.35, sz * (1 - i * 0.05), sz * 0.28); c.fill(); }
  }
  function reflect(c, img, dx, dw, dh, sea, wl, flip, alpha) { // mirror the part above the waterline, squashed, below it
    c.save(); c.globalAlpha = alpha || 0.2; c.translate(dx + (flip ? dw : 0), sea); c.scale(flip ? -1 : 1, -0.45);
    c.drawImage(img, 0, -dh * wl, dw, dh); c.restore();
  }
  R.foam = foam; R.wake = wake; R.reflect = reflect;
  // generic painted hull: img drawn so that its waterline (fraction wl of its height) sits on the sea
  function hull(c, img, cx, sea, w, wl, t, o) {
    o = o || {}; var ih = img.height || img.naturalHeight, iw = img.width || img.naturalWidth, h = w * ih / iw;
    var bob = Math.sin(t * (o.bobF || 2) + cx * 0.01) * (o.bobA === undefined ? 2 : o.bobA), pitch = Math.sin(t * (o.bobF || 2) * 0.8 + cx * 0.013) * (o.pitch || 0.025);
    var x0 = cx - w / 2;
    if (o.reflect !== false) reflect(c, img, x0, w, h, sea + 3, wl, o.flip, o.ra || 0.16);
    c.save(); c.translate(cx, sea + bob); c.rotate(pitch); if (o.flip) c.scale(-1, 1);
    c.drawImage(img, -w / 2, -h * wl, w, h);
    c.restore();
    if (o.foam !== false) foam(c, x0 + w * 0.06, x0 + w * 0.94, sea + bob, t, o.fk || 1);
    return { h: h, bob: bob, top: sea + bob - h * wl };
  }
  R.hull = hull;

  // ================= boats =================
  R.pirogue = function (c, x, sea, len, col, t, opts) {
    opts = opts || {}; var fisher = opts.fisher !== undefined, key = fisher ? 'pirogue' : 'pointu';
    if (!ok(key)) return V.pirogue(c, x, sea, len, col, t, opts);
    var img = tinted(key, col, fisher ? 2 : 214, 34);
    var r = hull(c, img, x, sea, len * 1.12, fisher ? 0.8 : 0.84, t, { fk: len / 120 });
    if (opts.name) { c.save(); c.font = '900 ' + Math.round(len / 13) + 'px "Trebuchet MS", sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,0.92)'; c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 2; var ty = sea + r.bob - 2; c.strokeText(opts.name, x + len * 0.12, ty); c.fillText(opts.name, x + len * 0.12, ty); c.restore(); }
  };
  function woodPole(c, x, y0, y1, w) {
    var g = c.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, '#4a3220'); g.addColorStop(0.4, '#a77b4f'); g.addColorStop(1, '#3d2a1a');
    c.fillStyle = g; c.fillRect(x - w / 2, Math.min(y0, y1), w, Math.abs(y1 - y0));
  }
  function metalPole(c, x, y0, y1, w) {
    var g = c.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, '#6d7780'); g.addColorStop(0.45, '#f4f7fa'); g.addColorStop(1, '#6a737b');
    c.fillStyle = g; c.fillRect(x - w / 2, Math.min(y0, y1), w, Math.abs(y1 - y0));
  }
  R.woodPole = woodPole; R.metalPole = metalPole;
  R.mast = function (c, x, sea, top, col, t) {
    if (!ok('pointu')) return V.mast(c, x, sea, top, col, t);
    var bob = Math.sin(t * 2 + x * 0.01) * 2;
    c.strokeStyle = 'rgba(40,35,30,0.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, top + 2); c.lineTo(x - 44, sea - 12 + bob); c.moveTo(x, top + 2); c.lineTo(x + 44, sea - 12 + bob); c.stroke();
    woodPole(c, x, top, sea - 10 + bob, 5);
    // furled lateen sail lashed to its yard
    c.save(); c.translate(x, top + 30); c.rotate(-0.5);
    var g = c.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, '#f3ead6'); g.addColorStop(1, '#b9a988'); c.fillStyle = g; R.ell(c, -6, 0, 40, 5); c.fill();
    c.strokeStyle = '#6b4a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-52, 0); c.lineTo(40, 0); c.stroke();
    c.strokeStyle = 'rgba(90,60,30,0.7)'; c.lineWidth = 1; for (var i = -3; i <= 2; i++) { c.beginPath(); c.moveTo(i * 12, -5); c.lineTo(i * 12 + 3, 5); c.stroke(); }
    c.restore();
    var fl = Math.sin(t * 6 + x) * 3; c.fillStyle = '#e8443a'; R.poly(c, [x, top, x + 18, top + 4 + fl, x, top + 10]); c.fill();
    R.pirogue(c, x, sea, 96, col, t);
  };
  // the mainsail: the painted sail cloth stretched onto the sail triangle (mast at mx, head at top, foot on the boom)
  R.sail = function (c, mx, top, boomY, back, front, col, t, opts) {
    opts = opts || {};
    if (!ok('sail')) return V.sail(c, mx, top, boomY, back, front, col, t, opts);
    var cloth = multiplied('sail', col === '#ffffff' ? null : col), bel = Math.sin(t * 1.7) * 3;
    metalPole(c, mx, top - 6, boomY + 34, 4);
    c.strokeStyle = 'rgba(50,50,50,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(mx, top - 4); c.lineTo(mx + Math.max(40, front + 14), boomY + 30); c.moveTo(mx, top - 4); c.lineTo(mx - back - 10, boomY + 30); c.stroke();
    c.save(); c.drawImage(cloth, mx - back - bel * 0.5, top, back + bel * 0.5, boomY - top + 2);
    if (opts.stripe) { c.beginPath(); c.moveTo(mx, top); c.lineTo(mx, boomY); c.lineTo(mx - back, boomY); c.closePath(); c.clip(); c.globalCompositeOperation = 'multiply'; c.fillStyle = opts.stripe; c.fillRect(mx - back, (top + boomY) / 2 - 10, back, 16); }
    c.restore();
    if (front) { c.save(); c.translate(mx + 2, 0); c.scale(-1, 1); c.globalAlpha = 0.96; c.drawImage(cloth, -front + 2, top + 10, front - 2, boomY - top - 4); c.restore(); }
    // boom with a shadow line under the foot
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(mx - back - 2, boomY + 2, back + 8, 3);
    var bg = c.createLinearGradient(0, boomY - 3, 0, boomY + 3); bg.addColorStop(0, '#e9eef2'); bg.addColorStop(0.5, '#8d979f'); bg.addColorStop(1, '#4d565d');
    c.fillStyle = bg; c.fillRect(mx - back - 4, boomY - 3, back + 10, 6);
    if (opts.num) { c.save(); c.font = '900 22px "Trebuchet MS", sans-serif'; c.textAlign = 'center'; c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgba(20,20,30,0.85)'; c.fillText(opts.num, mx - back * 0.32, boomY - (boomY - top) * 0.28); c.restore(); }
  };
  R.catamaran = function (c, x, sea, o, t) {
    if (!ok('cat')) return V.catamaran(c, x, sea, o, t);
    var bob = Math.sin(t * 1.6 + o.seed) * 2.5;
    c.save(); c.translate(0, bob);
    R.sail(c, x + o.mastDx, o.top, o.boomY, o.back, o.front, o.sailCol, t, { stripe: o.stripe });
    c.restore();
    hull(c, S.cat, x + 5, sea + 2, 244, 0.9, t, { bobA: 2.5, bobF: 1.6, pitch: 0.012, fk: 1.6 });
    wake(c, x - 125, sea + 2, 1, t, 6, 14);
  };
  R.speedboat = function (c, x, sea, dir, col, t) {
    if (!ok('speedboat')) return V.speedboat(c, x, sea, dir, col, t);
    var img = tinted('speedboat', col === '#ffffff' ? null : col, 356, 26);
    hull(c, img, x + dir * 8, sea, 124, 0.84, t, { flip: dir < 0, bobF: 6, bobA: 1.5, pitch: 0.03 });
    wake(c, x - dir * 62, sea, dir, t, 7, 12);
    c.fillStyle = 'rgba(255,255,255,0.8)'; for (var i = 0; i < 5; i++) { R.ell(c, x + dir * (54 + i * 3), sea - 3 - Math.abs(Math.sin(t * 11 + i)) * 7, 4, 3); c.fill(); }
  };
  R.banana = function (c, x, sea, t) {
    if (!ok('banana')) return V.banana(c, x, sea, t);
    hull(c, S.banana, x, sea + 2, 152, 0.86, t, { flip: true, bobF: 5, bobA: 2, pitch: 0.04, fk: 1.2 });
  };
  R.parasail = function (c, px, py, col, col2, t) {
    if (!ok('parasail')) return V.parasail(c, px, py, col, col2, t);
    var img = tinted('parasail', col, 2, 30), iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
    var w = 132, k = w / iw, sway = Math.sin(t * 1.4) * 0.04;
    c.save(); c.translate(px, py); c.rotate(sway);
    var ch = ih * 0.42; // canopy band of the painted image
    c.strokeStyle = 'rgba(40,40,40,0.55)'; c.lineWidth = 0.9;
    for (var i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 19, -48 + ch * k - 6 - (3 - Math.abs(i)) * 2); c.lineTo(i * 1.5, 50); c.stroke(); }
    c.drawImage(img, 0, 0, iw, ch, -w / 2, -48, w, ch * k);
    var rs = ih * 0.72, rh = ih - rs; c.drawImage(img, 0, rs, iw, rh, -w / 2, 44 + Math.sin(t * 3) * 1.5, w, rh * k);
    c.restore();
  };
  R.umbrella = function (c, x, ground, h, col, t) {
    if (!ok('umbrella')) return V.umbrella(c, x, ground, h, col, t);
    var img = tinted('umbrella', col, 358, 28), iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
    woodPole(c, x, ground - h - 8, ground + 2, 4);
    c.fillStyle = 'rgba(0,0,0,0.16)'; R.ell(c, x + 6, ground + 3, 46, 5); c.fill();
    var w = 116, k = w / iw, chh = ih * 0.5;
    c.drawImage(img, 0, 0, iw, chh, x + 2 - w / 2, ground - h - 26, w, chh * k);
  };
  R.frigate = function (c, x, sea, s, alpha, t) {
    var gimg = ghostOf('frigate'); if (!gimg) return V.frigate(c, x, sea, s, alpha, t);
    var w = 360 * s, h = w * gimg.height / gimg.width, bob = Math.sin(t * 0.9) * 3, roll = Math.sin(t * 0.7) * 0.015;
    c.save(); c.globalAlpha = alpha * 0.35; c.translate(x, sea + 4); c.scale(1, -0.4); c.drawImage(gimg, -w / 2, -h * 0.95, w, h); c.restore();
    c.save(); c.translate(x, sea + bob); c.rotate(roll);
    c.globalAlpha = alpha * 0.9; c.drawImage(gimg, -w / 2, -h * 0.95, w, h);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = alpha * (0.18 + 0.1 * Math.sin(t * 3)); c.drawImage(gimg, -w / 2 - 3, -h * 0.95 - 2, w + 6, h + 4);
    c.restore();
    c.save(); c.globalAlpha = alpha * 0.5; foam(c, x - w * 0.42, x + w * 0.4, sea + bob, t, 1.4); c.restore();
  };

  // distant boats in the parallax layer: a small painted catamaran with its sail
  R.midBoat = function (c, x, y, t) {
    if (!ok('cat') || !ok('sail')) { c.fillStyle = 'rgba(255,255,255,0.95)'; R.poly(c, [x, y - 70, x, y - 6, x - 34, y - 6]); c.fill(); return; }
    R.sail(c, x, y - 74, y - 10, 36, 14, '#ffffff', t); hull(c, S.cat, x - 2, y + 2, 70, 0.9, t, { foam: false, reflect: false, bobA: 1 });
  };
  // terns & brown noddies for the Ile aux Serpents murmuration (procedural so thousands stay cheap)
  R.tern = function (c, x, y, ang, ph, noddy, s) {
    s = s || 1; var f = Math.sin(ph) * 0.9;
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
    c.fillStyle = noddy ? '#4a3a2e' : '#eef1f4';
    c.beginPath(); c.moveTo(-2, 0); c.quadraticCurveTo(-6, -14 * f, -14, -20 * f); c.quadraticCurveTo(-4, -6 * f, 4, 0); c.fill();
    R.ell(c, 0, 0, 9, 3); c.fill();
    c.fillStyle = noddy ? '#d9d4cc' : '#16181c'; R.ell(c, 6, -1, 3.2, 2.6); c.fill();
    c.fillStyle = noddy ? '#2a221c' : '#e8443a'; R.poly(c, [8, -1.5, 13, 0, 8, 1]); c.fill();
    c.fillStyle = noddy ? '#3a2e24' : '#dfe4ea'; R.poly(c, [-8, 0, -15, -3, -13, 0, -15, 3]); c.fill();
    c.restore();
  };
  // ================= painted animals for the new levels =================
  function sprite(c, key, x, y, w, o) { // centred sprite with optional rotation / flip / vertical squash
    if (!ok(key)) return false; o = o || {}; var im = S[key], h = w * im.naturalHeight / im.naturalWidth;
    c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot); c.scale(o.flip ? -1 : 1, o.sy || 1); if (o.alpha !== undefined) c.globalAlpha = o.alpha;
    c.drawImage(im, -w * (o.ax === undefined ? 0.5 : o.ax), -h * (o.ay === undefined ? 0.5 : o.ay), w, h); c.restore(); return true;
  }
  R.sprite = sprite;
  R.dolphin = function (c, x, y, ang, t) { if (!sprite(c, 'dolphin', x, y, 150, { rot: ang })) { c.fillStyle = '#7d8a96'; R.ell(c, x, y, 60, 16, ang); c.fill(); } };
  R.monkey = function (c, x, y, t, flip, fall) {
    var w = 62 + Math.sin(t * 9) * 1.5;
    if (!sprite(c, 'monkey', x, y, w, { flip: flip, rot: fall ? t * 7 : Math.sin(t * 6) * 0.06, ay: 0.55 })) { c.fillStyle = '#7a6040'; R.ell(c, x, y, 14, 22); c.fill(); }
  };
  R.bat = function (c, x, y, t, ph) {
    var f = Math.sin(t * 10 + (ph || 0)); // flap by squashing vertically and swapping
    if (!sprite(c, 'bat', x, y, 74, { sy: 0.55 + 0.45 * Math.abs(f), flip: false })) { c.fillStyle = '#3a2a22'; R.ell(c, x, y, 30, 8); c.fill(); }
  };
  R.frigatebird = function (c, x, y, t, flip, tuck) {
    var f = tuck ? 0.55 : 0.8 + 0.2 * Math.sin(t * 5);
    if (!sprite(c, 'frigatebird', x, y, tuck ? 92 : 112, { flip: flip, sy: f, rot: tuck ? (flip ? -0.5 : 0.5) : 0 })) { c.fillStyle = '#111'; R.ell(c, x, y, 40, 8); c.fill(); }
  };
})();
