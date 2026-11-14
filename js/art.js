// PAILLE-EN-QUEUE - procedural vector art for every sprite (the bird, fish, boats, rocks, people...).
// Everything is drawn with Canvas 2D paths so it stays sharp at any phone resolution.
(function () {
  'use strict';
  var R = {};
  var TAU = Math.PI * 2;
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, TAU); }
  function poly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
  R.ell = ell; R.poly = poly;
  R.shade = function (hex, k) { // lighten (k>0) / darken (k<0) a #rrggbb colour
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function f(v) { return Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)))); }
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  };

  // ---------------- the white-tailed tropicbird ----------------
  // o: {t, flap (radians phase), glide (0..1), tilt, streamers, maxStreamers, roll (0..1), blink, wet, scale, glow}
  function wing(c, s, far) {
    // canonical wing pointing up & back from the shoulder; s = vertical scale (-0.8..1) fakes the flap
    c.save(); c.scale(1, s);
    c.beginPath();
    c.moveTo(9, 0);
    c.bezierCurveTo(6, -18, -2, -36, -14, -52);     // leading edge to the tip
    c.bezierCurveTo(-16, -40, -15, -22, -12, 0);    // trailing edge back to the body
    c.closePath();
    c.fillStyle = far ? '#d9dde3' : '#ffffff'; c.fill();
    c.save(); c.clip();
    // black outer primaries (wing tip)
    c.fillStyle = far ? '#2a2d33' : '#14161a';
    c.beginPath(); c.moveTo(4, -30); c.lineTo(-30, -60); c.lineTo(-9, -66); c.lineTo(8, -40); c.closePath(); c.fill();
    // the diagonal black bar across the inner wing
    c.beginPath(); c.moveTo(9, -6); c.lineTo(5, -13); c.lineTo(-14, -2); c.lineTo(-14, 6); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = 'rgba(40,50,60,0.35)'; c.lineWidth = 1.2 / Math.max(0.3, Math.abs(s)); c.stroke();
    c.restore();
  }
  R.bird = function (c, x, y, o) {
    var sc = o.scale || 1, t = o.t || 0;
    c.save(); c.translate(x, y); c.scale(sc, sc);
    if (o.glow) { var g = c.createRadialGradient(0, 0, 4, 0, 0, 70); g.addColorStop(0, 'rgba(255,255,230,' + o.glow + ')'); g.addColorStop(1, 'rgba(255,255,230,0)'); c.fillStyle = g; c.fillRect(-70, -70, 140, 140); }
    c.rotate(o.tilt || 0);
    if (o.roll) c.scale(1, Math.cos(o.roll * TAU));
    var flapS = o.glide > 0.5 ? 0.18 + Math.sin(t * 3) * 0.04 : Math.cos(o.flap || 0) * 0.95 - 0.05;
    // tail streamers (health): long white ribbons that wave behind the bird
    var n = o.streamers, maxN = o.maxStreamers || 4;
    for (var i = 0; i < maxN; i++) {
      var lost = i >= n;
      var len = lost ? 10 : 78 + (i % 2) * 14 - i * 4, amp = 7 + i * 1.5, ph = t * 9 + i * 0.9;
      var spread = (i - (maxN - 1) / 2) * 3.2;
      c.beginPath(); c.moveTo(-20, 3 + spread * 0.3);
      var pts = [];
      for (var k = 1; k <= 8; k++) {
        var u = k / 8, px = -20 - len * u, py = 3 + spread * u * 1.6 + Math.sin(ph - u * 4) * amp * u + (o.vyTail || 0) * u * u * 18;
        pts.push(px, py);
      }
      for (var k2 = 0; k2 < pts.length; k2 += 2) c.lineTo(pts[k2], pts[k2 + 1]);
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = 'rgba(30,50,70,0.28)'; c.lineWidth = 4.4; c.stroke();
      c.strokeStyle = o.wet ? '#dfe9f0' : '#ffffff'; c.lineWidth = 2.6; c.stroke();
    }
    // far wing
    c.save(); c.translate(-2, -5); wing(c, flapS * 0.85 + 0.1, true); c.restore();
    // body
    var bg = c.createLinearGradient(0, -12, 0, 12); bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.65, '#f1f4f7'); bg.addColorStop(1, '#c9d2dc');
    c.fillStyle = bg; ell(c, 0, 0, 24, 10.5, -0.05); c.fill();
    c.strokeStyle = 'rgba(40,55,70,0.35)'; c.lineWidth = 1.2; c.stroke();
    // tail base
    c.fillStyle = '#eef2f5'; poly(c, [-18, -5, -30, 1, -18, 7]); c.fill();
    // head
    c.fillStyle = '#ffffff'; ell(c, 19, -4, 10, 9); c.fill(); c.strokeStyle = 'rgba(40,55,70,0.3)'; c.stroke();
    // black eye stripe (crescent through the eye)
    c.fillStyle = '#121418';
    c.beginPath(); c.moveTo(29, -6); c.quadraticCurveTo(21, -11, 12, -6); c.quadraticCurveTo(20, -7.5, 29, -4); c.closePath(); c.fill();
    ell(c, 22, -6.5, 2.4, 2.4); c.fill();
    c.fillStyle = '#fff'; ell(c, 22.7, -7.2, 0.8, 0.8); c.fill();
    // orange-yellow bill
    var bl = c.createLinearGradient(27, -6, 43, -2); bl.addColorStop(0, '#ff9d1c'); bl.addColorStop(1, '#ffd23a');
    c.fillStyle = bl; poly(c, [27, -7.5, 44, -3, 27, -1.5]); c.fill();
    c.strokeStyle = 'rgba(120,60,0,0.6)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(28, -4.4); c.lineTo(42, -3.1); c.stroke();
    // near wing
    c.save(); c.translate(2, -3); wing(c, flapS, false); c.restore();
    if (o.blink) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,80,80,0.45)'; c.fillRect(-120, -80, 200, 160); }
    c.restore();
  };

  // ---------------- fish ----------------
  R.fish = function (c, x, y, ang, size, deep, t) {
    c.save(); c.translate(x, y); c.rotate(ang || 0); var s = size || 1; c.scale(s, s);
    if (deep) { c.globalAlpha = 0.55; }
    var g = c.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, deep ? '#1b4a63' : '#4b8fb5'); g.addColorStop(0.5, deep ? '#3d7c96' : '#cfe8f5'); g.addColorStop(1, deep ? '#2a5d73' : '#f4fbff');
    c.fillStyle = g; ell(c, 0, 0, 12, 5.2); c.fill();
    var wag = Math.sin((t || 0) * 18) * 3;
    poly(c, [-10, 0, -19, -6 + wag, -18, 6 + wag]); c.fill();
    c.fillStyle = '#0b1a24'; ell(c, 7, -1.2, 1.4, 1.4); c.fill();
    if (!deep) { c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-6, -1); c.lineTo(6, -2); c.stroke(); }
    c.restore();
  };
  R.flyingFish = function (c, x, y, t) {
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(160,210,240,0.85)'; var fw = Math.sin(t * 30) * 2;
    poly(c, [2, -1, -8, -11 - fw, -10, -1]); c.fill();
    c.restore(); R.fish(c, x, y, 0, 0.9, false, t);
  };

  // ---------------- beach & coast ----------------
  R.umbrella = function (c, x, ground, h, col, t) {
    c.save(); c.translate(x, ground);
    c.strokeStyle = '#6b4a2b'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(2, -h); c.stroke();
    var w = 52;
    for (var i = 0; i < 6; i++) {
      c.fillStyle = i % 2 ? '#ffffff' : col;
      c.beginPath(); c.moveTo(2, -h - 22);
      var a0 = -w + i * (2 * w / 6), a1 = a0 + 2 * w / 6;
      c.lineTo(2 + a0, -h + 4); c.quadraticCurveTo(2 + (a0 + a1) / 2, -h - 2, 2 + a1, -h + 4); c.closePath(); c.fill();
    }
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(2 - w, -h + 4); c.quadraticCurveTo(2, -h - 30, 2 + w, -h + 4); c.stroke();
    c.restore();
  };
  R.towel = function (c, x, ground, col) { c.fillStyle = col; c.fillRect(x - 22, ground - 3, 44, 5); };
  R.kite = function (c, ax, ay, kx, ky, col, t) {
    c.strokeStyle = 'rgba(40,40,40,0.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(ax, ay);
    c.quadraticCurveTo((ax + kx) / 2 + 20, (ay + ky) / 2 + 30, kx, ky); c.stroke();
    c.save(); c.translate(kx, ky); c.rotate(Math.sin(t * 2) * 0.15);
    c.fillStyle = col; poly(c, [0, -26, 18, 0, 0, 30, -18, 0]); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -26); c.lineTo(0, 30); c.moveTo(-18, 0); c.lineTo(18, 0); c.stroke();
    c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 30);
    for (var i = 1; i < 6; i++) c.lineTo(Math.sin(t * 5 + i) * 6, 30 + i * 9); c.stroke();
    c.restore();
  };
  R.child = function (c, x, ground, col) {
    c.fillStyle = '#7a4a2a'; ell(c, x, ground - 30, 5, 5); c.fill();
    c.fillStyle = col; c.fillRect(x - 5, ground - 25, 10, 14);
    c.strokeStyle = '#7a4a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 3, ground - 11); c.lineTo(x - 4, ground); c.moveTo(x + 3, ground - 11); c.lineTo(x + 4, ground); c.moveTo(x + 4, ground - 22); c.lineTo(x + 10, ground - 32); c.stroke();
  };
  // traditional Mauritian pirogue (wooden fishing boat), hull bright colours
  R.pirogue = function (c, x, sea, len, col, t, opts) {
    opts = opts || {};
    var bob = Math.sin(t * 2 + x * 0.01) * 2;
    c.save(); c.translate(x, sea + bob);
    c.fillStyle = col;
    c.beginPath(); c.moveTo(-len / 2, -16); c.quadraticCurveTo(-len / 2 + 6, 6, -len / 2 + 18, 6); c.lineTo(len / 2 - 14, 6); c.quadraticCurveTo(len / 2 + 2, 2, len / 2 + 6, -18); c.closePath(); c.fill();
    c.fillStyle = '#ffffff'; c.fillRect(-len / 2 + 4, -14, len - 6, 4);
    c.fillStyle = opts.stripe || '#f5c400'; c.fillRect(-len / 2 + 8, -8, len - 20, 3);
    if (opts.name) { c.fillStyle = '#fff'; c.font = 'bold 9px sans-serif'; c.fillText(opts.name, -14, -1); }
    if (opts.fisher) { // fisherman with hat
      c.fillStyle = '#5a3a22'; ell(c, opts.fisher, -30, 5, 5); c.fill();
      c.fillStyle = '#e9d7a0'; ell(c, opts.fisher, -34, 9, 2.5); c.fill(); c.fillRect(opts.fisher - 4, -40, 8, 6);
      c.fillStyle = opts.shirt || '#2b7bd6'; c.fillRect(opts.fisher - 5, -26, 10, 12);
    }
    c.restore();
  };
  R.sail = function (c, mx, top, boomY, back, front, col, t, opts) {
    // lateen / triangular sail: mast at mx from top to deck, sail triangle back to the boom
    opts = opts || {};
    c.strokeStyle = '#4b3420'; c.lineWidth = 3; c.beginPath(); c.moveTo(mx, top - 4); c.lineTo(mx, boomY + 34); c.stroke();
    var bel = Math.sin(t * 1.7) * 3 + 8;
    c.fillStyle = col; c.beginPath(); c.moveTo(mx, top); c.quadraticCurveTo(mx - back * 0.45 - bel, (top + boomY) / 2, mx - back, boomY); c.lineTo(mx, boomY); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.5; c.stroke();
    if (opts.stripe) { c.save(); c.clip(); c.fillStyle = opts.stripe; c.fillRect(mx - back, (top + boomY) / 2 - 10, back, 14); c.restore(); }
    if (front) { c.fillStyle = R.shade(col.charAt(0) === '#' ? col : '#ffffff', -0.08); c.beginPath(); c.moveTo(mx + 2, top + 10); c.lineTo(mx + front, boomY + 6); c.lineTo(mx + 2, boomY + 6); c.closePath(); c.fill(); }
    c.strokeStyle = '#4b3420'; c.lineWidth = 3; c.beginPath(); c.moveTo(mx - back - 4, boomY); c.lineTo(mx + 6, boomY); c.stroke();
    if (opts.num) { c.fillStyle = '#fff'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText(opts.num, mx - back * 0.32, boomY - (boomY - top) * 0.28); c.textAlign = 'left'; }
  };
  R.net = function (c, x, top, bottom, w, t) {
    c.save();
    c.strokeStyle = 'rgba(20,30,30,0.85)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x - w / 2, top); c.lineTo(x + w / 2, top); c.stroke();
    c.lineWidth = 1.1; c.strokeStyle = 'rgba(40,60,60,0.75)';
    for (var i = 0; i <= 6; i++) { var xx = x - w / 2 + (w * i) / 6; c.beginPath(); c.moveTo(xx, top); c.lineTo(xx + Math.sin(t * 2 + i) * 2, bottom); c.stroke(); }
    for (var y = top; y < bottom; y += 12) { c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y + Math.sin(t + y) * 1.5); c.stroke(); }
    c.fillStyle = '#ff8a00';
    for (var j = 0; j <= 3; j++) { ell(c, x - w / 2 + (w * j) / 3, top, 4.5, 4.5); c.fill(); }
    c.restore();
  };
  R.hookLine = function (c, x, bottom, t) {
    c.strokeStyle = 'rgba(30,30,30,0.85)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, -40); c.lineTo(x, bottom); c.stroke();
    c.strokeStyle = '#9aa3a8'; c.lineWidth = 2.4; c.beginPath(); c.arc(x - 5, bottom + 6, 6, 0, Math.PI); c.stroke();
    c.fillStyle = '#e83a2e'; ell(c, x, bottom - 26, 6, 9); c.fill(); c.fillStyle = '#fff'; ell(c, x, bottom - 31, 6, 3.5); c.fill();
    for (var i = 0; i < 4; i++) { c.fillStyle = '#3d3d3d'; ell(c, x, bottom - 60 - i * 70, 3, 3); c.fill(); }
  };
  R.church = function (c, x, base, s) { // Notre-Dame Auxiliatrice, Cap Malheureux - the famous red roof
    c.save(); c.translate(x, base); c.scale(s, s);
    c.fillStyle = '#f7f3ea'; c.fillRect(-60, -70, 120, 70);
    c.fillStyle = '#c8261c'; poly(c, [-70, -68, 0, -122, 70, -68]); c.fill();
    c.fillStyle = '#f7f3ea'; c.fillRect(42, -110, 26, 110);
    c.fillStyle = '#c8261c'; poly(c, [38, -108, 55, -150, 72, -108]); c.fill();
    c.strokeStyle = '#333'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(55, -150); c.lineTo(55, -166); c.moveTo(49, -160); c.lineTo(61, -160); c.stroke();
    c.fillStyle = '#7b4b2a'; c.fillRect(-12, -40, 24, 40);
    c.fillStyle = '#5a7da1'; for (var i = -1; i <= 1; i += 2) { c.fillRect(i * 36 - 7, -54, 14, 22); }
    c.fillStyle = '#5a7da1'; c.fillRect(50, -92, 10, 16);
    c.restore();
  };
  R.palm = function (c, x, ground, h, t, col) {
    c.save(); c.translate(x, ground);
    c.strokeStyle = '#7b5b3a'; c.lineWidth = 7; c.lineCap = 'round';
    var lean = 18;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(lean * 0.2, -h * 0.5, lean, -h); c.stroke();
    c.fillStyle = col || '#2f8f3a';
    for (var i = 0; i < 7; i++) {
      var a = -Math.PI + i * (Math.PI / 6) + Math.sin(t * 1.5 + i) * 0.05;
      c.save(); c.translate(lean, -h); c.rotate(a);
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(28, -14, 58, 8); c.quadraticCurveTo(28, 2, 0, 4); c.closePath(); c.fill();
      c.restore();
    }
    c.fillStyle = '#5b3a1e'; ell(c, lean, -h + 4, 6, 5); c.fill();
    c.restore();
  };

  // ---------------- Coin de Mire ----------------
  R.rockPath = function (c, pts, top, col, dark) {
    // pts: [x0,y0,x1,y1,...] edge profile, top=true means rock hangs from the top edge
    c.beginPath(); c.moveTo(pts[0], top ? -60 : 640);
    for (var i = 0; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.lineTo(pts[pts.length - 2], top ? -60 : 640); c.closePath();
    var g = c.createLinearGradient(0, top ? 0 : 200, 0, top ? 300 : 540);
    g.addColorStop(0, top ? dark : col); g.addColorStop(1, top ? col : dark);
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 3; c.beginPath();
    for (var j = 0; j < pts.length; j += 2) { if (j === 0) c.moveTo(pts[j], pts[j + 1]); else c.lineTo(pts[j], pts[j + 1]); } c.stroke();
    // basalt column strokes
    c.save(); c.clip && 0; c.restore();
  };
  R.booby = function (c, x, y, diving, t) { // masked booby: white, black flight feathers, dark face mask, yellow bill
    c.save(); c.translate(x, y);
    if (diving) {
      c.rotate(Math.PI / 2);
      c.fillStyle = '#fff'; ell(c, 0, 0, 22, 8); c.fill();
      c.fillStyle = '#1b1b1f'; poly(c, [-6, -4, -30, -10, -26, -2]); c.fill(); poly(c, [-6, 4, -30, 10, -26, 2]); c.fill();
      c.fillStyle = '#1b1b1f'; poly(c, [-20, 0, -28, -5, -28, 5]); c.fill();
      c.fillStyle = '#2b2b33'; ell(c, 16, 0, 6, 6); c.fill();
      c.fillStyle = '#f4d23c'; poly(c, [19, -3, 34, 0, 19, 3]); c.fill();
    } else {
      var f = Math.sin(t * 12) * 0.9;
      c.fillStyle = '#1b1b1f'; c.save(); c.scale(1, f); poly(c, [-4, 0, -16, -34, 6, 0]); c.fill(); c.restore();
      c.fillStyle = '#fff'; ell(c, 0, 0, 20, 8); c.fill();
      c.fillStyle = '#2b2b33'; ell(c, 16, -2, 6, 6); c.fill();
      c.fillStyle = '#f4d23c'; poly(c, [19, -4, 33, -1, 19, 2]); c.fill();
    }
    c.restore();
  };

  // ---------------- boats ----------------
  R.catamaran = function (c, x, sea, o, t) {
    var bob = Math.sin(t * 1.6 + o.seed) * 2.5;
    c.save(); c.translate(0, bob);
    // hulls
    c.fillStyle = '#f5f7fa'; c.beginPath(); c.moveTo(x - 110, sea - 22); c.lineTo(x + 120, sea - 22); c.quadraticCurveTo(x + 112, sea, x + 92, sea + 4); c.lineTo(x - 100, sea + 4); c.closePath(); c.fill();
    c.fillStyle = '#1f6fb2'; c.fillRect(x - 106, sea - 12, 208, 4);
    c.fillStyle = '#d4dbe2'; c.fillRect(x - 70, sea - 38, 120, 16); // cabin
    c.fillStyle = '#334b5e'; for (var i = 0; i < 4; i++) c.fillRect(x - 62 + i * 28, sea - 34, 18, 7);
    // tourists on deck
    for (var j = 0; j < (o.tourists || 0); j++) {
      var tx = x - 95 + j * 22; c.fillStyle = ['#e9473f', '#f5b400', '#2fb36b', '#7c4dff', '#ff7aa8'][j % 5];
      c.fillRect(tx - 4, sea - 50, 8, 12); c.fillStyle = '#c99a6e'; ell(c, tx, sea - 55, 4, 4); c.fill();
      if (j === 1 && o.cam) { c.fillStyle = '#222'; c.fillRect(tx + 3, sea - 55, 7, 5); }
    }
    // mast & sails (mainsail back to the boom, jib forward)
    R.sail(c, x + o.mastDx, o.top, o.boomY, o.back, o.front, o.sailCol, t, { stripe: o.stripe });
    c.restore();
  };
  R.speedboat = function (c, x, sea, dir, col, t) {
    var bob = Math.sin(t * 6) * 1.5;
    c.save(); c.translate(x, sea + bob); c.scale(dir, 1);
    c.fillStyle = col; c.beginPath(); c.moveTo(-48, -14); c.lineTo(42, -14); c.quadraticCurveTo(60, -14, 64, -22); c.lineTo(52, 4); c.lineTo(-44, 4); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.fillRect(-46, -14, 90, 4);
    c.fillStyle = 'rgba(160,220,255,0.8)'; poly(c, [6, -14, 18, -28, 26, -14]); c.fill();
    c.fillStyle = '#222'; ell(c, -10, -22, 4, 4); c.fill(); c.fillStyle = '#ff6a00'; c.fillRect(-14, -18, 8, 6);
    c.restore();
    // wake spray
    for (var i = 0; i < 6; i++) { c.fillStyle = 'rgba(255,255,255,' + (0.6 - i * 0.09) + ')'; ell(c, x - dir * (50 + i * 16), sea + 2 - Math.abs(Math.sin(t * 9 + i)) * 6, 10 - i, 4); c.fill(); }
  };
  R.parasail = function (c, px, py, col, col2, t) {
    c.save(); c.translate(px, py);
    var w = 62;
    c.fillStyle = col; c.beginPath(); c.moveTo(-w, 0); c.quadraticCurveTo(0, -70, w, 0); c.quadraticCurveTo(0, -38, -w, 0); c.closePath(); c.fill();
    c.save(); c.clip(); c.fillStyle = col2; for (var i = -3; i <= 3; i += 2) c.fillRect(i * 18 - 9, -80, 18, 90); c.restore();
    c.strokeStyle = 'rgba(30,30,30,0.6)'; c.lineWidth = 1;
    for (var k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(k * 26, -4 - (2 - Math.abs(k)) * 9); c.lineTo(0, 50); c.stroke(); }
    // rider
    c.fillStyle = '#c38d5f'; ell(c, 0, 52, 5, 5); c.fill(); c.fillStyle = '#ff3b30'; c.fillRect(-5, 56, 10, 12);
    c.strokeStyle = '#c38d5f'; c.lineWidth = 3; c.beginPath(); c.moveTo(-3, 68); c.lineTo(-6 + Math.sin(t * 3) * 3, 82); c.moveTo(3, 68); c.lineTo(6, 82); c.stroke();
    c.restore();
  };
  R.banana = function (c, x, sea, t) {
    var bob = Math.sin(t * 5) * 2;
    c.save(); c.translate(x, sea - 6 + bob);
    c.fillStyle = '#ffd400'; c.beginPath(); c.moveTo(-70, -4); c.quadraticCurveTo(0, 14, 70, -14); c.quadraticCurveTo(76, -4, 64, 2); c.quadraticCurveTo(0, 26, -66, 8); c.closePath(); c.fill();
    c.strokeStyle = '#c99a00'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#5a3a22'; c.fillRect(60, -18, 6, 6);
    var cols = ['#ff3b30', '#2b7bd6', '#2fb36b', '#ff7aa8'];
    for (var i = 0; i < 4; i++) { var rx = -45 + i * 30; c.fillStyle = cols[i]; c.fillRect(rx - 5, -14 - i * 2, 10, 12); c.fillStyle = '#c38d5f'; ell(c, rx, -19 - i * 2 + Math.sin(t * 7 + i) * 1.5, 4.5, 4.5); c.fill(); }
    c.restore();
  };
  R.golfBall = function (c, x, y, vx, vy) {
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x - vx * 0.12, y - vy * 0.12); c.stroke();
    c.fillStyle = '#ffffff'; ell(c, x, y, 9, 9); c.fill(); c.strokeStyle = '#6b7680'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.12)'; ell(c, x + 2, y + 1, 1.2, 1.2); c.fill(); ell(c, x - 2, y + 2, 1.2, 1.2); c.fill();
  };
  R.flag = function (c, x, ground, col) {
    c.strokeStyle = '#eee'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, ground); c.lineTo(x, ground - 46); c.stroke();
    c.fillStyle = col || '#e63b2e'; poly(c, [x, ground - 46, x + 22, ground - 40, x, ground - 34]); c.fill();
  };
  R.cloudDark = function (c, x, y, w, t) {
    var puffs = [[-0.36, 0.06, 0.2], [-0.18, -0.08, 0.25], [0.02, -0.12, 0.28], [0.22, -0.05, 0.24], [0.38, 0.06, 0.19], [-0.05, 0.08, 0.3], [0.2, 0.1, 0.22]];
    for (var i = 0; i < puffs.length; i++) {
      var p = puffs[i], px = x + p[0] * w + Math.sin(t * 0.7 + i) * 3, py = y + p[1] * w, r = p[2] * w;
      var g = c.createRadialGradient(px - r * 0.3, py - r * 0.4, r * 0.1, px, py, r);
      g.addColorStop(0, 'rgba(110,118,138,0.98)'); g.addColorStop(0.6, 'rgba(58,63,80,0.97)'); g.addColorStop(1, 'rgba(40,44,58,0)');
      c.fillStyle = g; c.beginPath(); c.arc(px, py, r, 0, 6.2832); c.fill();
    }
    c.strokeStyle = 'rgba(170,190,220,0.35)'; c.lineWidth = 1.2;
    for (var k = 0; k < 7; k++) { var rx = x - w * 0.3 + k * w * 0.1; c.beginPath(); c.moveTo(rx, y + w * 0.18); c.lineTo(rx - 6, y + w * 0.18 + 30 + (k % 3) * 10); c.stroke(); }
  };

  // ---------------- Mahebourg ----------------
  R.frigate = function (c, x, sea, s, alpha, t) { // ghost 1810 frigate
    c.save(); c.globalAlpha = alpha; c.translate(x, sea); c.scale(s, s);
    var g = c.createLinearGradient(0, -260, 0, 0); g.addColorStop(0, 'rgba(170,255,230,0.25)'); g.addColorStop(1, 'rgba(120,220,200,0.6)');
    c.fillStyle = 'rgba(70,120,115,0.85)';
    c.beginPath(); c.moveTo(-150, -50); c.lineTo(140, -50); c.lineTo(170, -78); c.lineTo(150, -20); c.lineTo(-130, 0); c.lineTo(-165, -70); c.closePath(); c.fill();
    c.fillStyle = 'rgba(20,40,40,0.9)'; for (var i = 0; i < 7; i++) c.fillRect(-110 + i * 34, -38, 12, 9);
    c.strokeStyle = 'rgba(60,90,85,0.9)'; c.lineWidth = 5;
    [-80, 10, 95].forEach(function (mx, k) { c.beginPath(); c.moveTo(mx, -50); c.lineTo(mx, -260 + k * 15); c.stroke(); });
    c.fillStyle = g;
    [-80, 10, 95].forEach(function (mx, k) {
      for (var r = 0; r < 3; r++) {
        var y0 = -235 + k * 15 + r * 62, ww = 48 - r * 3 + Math.sin(t * 1.3 + r + k) * 2;
        c.beginPath(); c.moveTo(mx - ww, y0); c.lineTo(mx + ww, y0); c.quadraticCurveTo(mx + ww + 8, y0 + 28, mx + ww - 4, y0 + 52); c.lineTo(mx - ww + 4, y0 + 52); c.quadraticCurveTo(mx - ww + 8, y0 + 28, mx - ww, y0); c.fill();
      }
    });
    c.fillStyle = 'rgba(30,60,60,0.8)'; poly(c, [10, -262, 40, -256, 10, -248]); c.fill();
    c.restore();
  };
  R.cannonball = function (c, x, y) {
    c.fillStyle = '#16191c'; ell(c, x, y, 10, 10); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.35)'; ell(c, x - 3, y - 3, 3, 3); c.fill();
  };
  R.smoke = function (c, x, y, r, a) {
    var g = c.createRadialGradient(x, y, r * 0.15, x, y, r);
    g.addColorStop(0, 'rgba(205,210,214,' + a + ')'); g.addColorStop(1, 'rgba(190,196,200,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  };
  R.fort = function (c, x, base, s, col) { // Ile de la Passe fort ruins
    c.save(); c.translate(x, base); c.scale(s, s); c.fillStyle = col;
    c.beginPath(); c.moveTo(-160, 0); c.quadraticCurveTo(-120, -40, -80, -46); c.lineTo(110, -46); c.quadraticCurveTo(150, -30, 170, 0); c.closePath(); c.fill();
    c.fillRect(-70, -90, 150, 46); c.fillRect(-40, -120, 60, 30);
    for (var i = 0; i < 6; i++) c.fillRect(-70 + i * 28, -100, 14, 12);
    c.restore();
  };
  R.buoy = function (c, x, y, col, t, light) {
    var bob = Math.sin(t * 3 + x) * 3;
    c.fillStyle = col; c.beginPath(); c.moveTo(x - 10, y + bob); c.lineTo(x + 10, y + bob); c.lineTo(x + 5, y - 26 + bob); c.lineTo(x - 5, y - 26 + bob); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.fillRect(x - 7, y - 14 + bob, 14, 4);
    if (light) { var on = Math.sin(t * 4 + x) > 0; c.fillStyle = on ? '#fff59a' : '#6a6a3a'; ell(c, x, y - 30 + bob, 4, 4); c.fill(); }
  };

  // ---------------- night ----------------
  R.reef = function (c, x, sea, w, h, seed) {
    c.fillStyle = '#3d4552';
    c.beginPath(); c.moveTo(x - w / 2, sea + 20);
    var n = 6;
    for (var i = 0; i <= n; i++) { var u = i / n, px = x - w / 2 + w * u, py = sea - h * Math.sin(Math.PI * u) * (0.75 + 0.25 * Math.sin(seed + i * 2.3)); c.lineTo(px, py); }
    c.lineTo(x + w / 2, sea + 20); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#c4566b'; for (var k = 0; k < 3; k++) { ell(c, x - w / 4 + k * w / 4, sea - h * 0.35 + k * 6, 6, 4); c.fill(); }
  };
  R.lighthouse = function (c, x, base, s, lit) { // 1864 Ile aux Fouquets lighthouse (ruined tower) on its rock
    c.save(); c.translate(x, base); c.scale(s, s);
    c.fillStyle = '#1b2231'; poly(c, [-150, 14, -128, -6, -104, -14, -86, -30, -60, -34, -38, -50, -10, -46, 22, -52, 44, -44, 70, -36, 92, -22, 118, -16, 140, 0, 160, 14]); c.fill(); c.fillStyle = '#273047'; poly(c, [-86, -30, -60, -34, -38, -50, -30, -30, -70, -20]); c.fill(); poly(c, [44, -44, 70, -36, 92, -22, 60, -24]); c.fill();
    c.fillStyle = '#2c3446'; poly(c, [-22, -46, -16, -170, 16, -170, 22, -46]); c.fill();
    c.fillStyle = '#394259'; c.fillRect(-20, -186, 40, 16);
    c.fillStyle = lit ? '#fff7b0' : '#555'; c.fillRect(-12, -206, 24, 20);
    c.fillStyle = '#2c3446'; poly(c, [-16, -206, 0, -222, 16, -206]); c.fill();
    c.restore();
  };
  R.tortoise = function (c, x, ground, t, s) { // Aldabra giant tortoise on the Aigrettes shore
    s = s || 1; c.save(); c.translate(x, ground); c.scale(s, s);
    var step = Math.sin(t * 2) * 2;
    c.fillStyle = '#6b6152'; c.fillRect(-26 + step, -10, 8, 12); c.fillRect(16 - step, -10, 8, 12);
    c.fillStyle = '#7d7262'; ell(c, 36, -16, 10, 7); c.fill(); c.fillRect(24, -20, 12, 8);
    c.fillStyle = '#5a5040'; c.beginPath(); c.ellipse(0, -14, 34, 26, 0, Math.PI, TAU); c.fill();
    c.strokeStyle = '#3e372c'; c.lineWidth = 2;
    for (var i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 12, -14); c.lineTo(i * 10, -32 + Math.abs(i) * 4); c.stroke(); }
    c.fillStyle = '#111'; ell(c, 41, -18, 1.6, 1.6); c.fill();
    c.restore();
  };
  R.nestPost = function (c, x, ground, t) {
    c.fillStyle = '#8b6a3e'; c.fillRect(x - 3, ground - 40, 6, 40);
    var p = 0.6 + 0.4 * Math.sin(t * 4 + x);
    c.fillStyle = 'rgba(255,214,90,' + p + ')'; c.fillRect(x - 16, ground - 54, 32, 18);
    c.fillStyle = '#4a2d00'; c.font = 'bold 8px sans-serif'; c.textAlign = 'center'; c.fillText('NIDS', x, ground - 42); c.textAlign = 'left';
  };
  R.nest = function (c, x, ground) {
    c.fillStyle = '#9b7b4c'; ell(c, x, ground - 3, 14, 5); c.fill();
    c.fillStyle = '#f2ecd8'; ell(c, x - 4, ground - 7, 4, 5); c.fill(); ell(c, x + 4, ground - 7, 4, 5); c.fill();
  };
  R.mast = function (c, x, sea, top, col, t) { // a moored boat with a tall mast (obstacle)
    R.pirogue(c, x, sea, 90, col, t);
    c.strokeStyle = '#5a4430'; c.lineWidth = 4; c.beginPath(); c.moveTo(x, sea - 14); c.lineTo(x, top); c.stroke();
    c.strokeStyle = 'rgba(60,60,60,0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, top); c.lineTo(x - 42, sea - 14); c.moveTo(x, top); c.lineTo(x + 42, sea - 14); c.stroke();
    c.fillStyle = '#ff3b30'; poly(c, [x, top, x + 16, top + 5, x, top + 10]); c.fill();
  };
  window.PQArt = R;
})();
