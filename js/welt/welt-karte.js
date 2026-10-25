/* ============================================================================
 * js/welt/welt-karte.js – Paket A: Weltkarte, Untergründe, Höhen, Steigungen & Wasserkörper
 * WICHTIG: Frei von Rendering-Engines und DOM-Zugriffen (reines JavaScript).
 * ============================================================================ */
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.welt = '1.0.0';

  var KENNWERTE = {
    strasse:   { reibung: 1.00, rollwiderstand: 0.015 },
    bordstein: { reibung: 0.90, rollwiderstand: 0.015 },
    schiene:   { reibung: 0.60, rollwiderstand: 0.020 },
    gras:      { reibung: 0.65, rollwiderstand: 0.080 },
    waldboden: { reibung: 0.55, rollwiderstand: 0.100 },
    sand:      { reibung: 0.40, rollwiderstand: 0.300 },
    fels:      { reibung: 0.70, rollwiderstand: 0.060 },
    wasser:    { reibung: 0.00, rollwiderstand: 0.500 },
    riff:      { reibung: 0.30, rollwiderstand: 0.350 }
  };

  var WASSER_SPIEGEL = 0.05;
  var RASTER_ZELLE = 16;
  var zonenListe = [];
  var landRechtecke = [];
  var rasterIndex = {};

  function zelleKey(cx, cz) {
    return cx + ':' + cz;
  }

  function fuegeInRasterEin(zone, minX, maxX, minZ, maxZ) {
    var cx0 = Math.floor(minX / RASTER_ZELLE);
    var cx1 = Math.floor(maxX / RASTER_ZELLE);
    var cz0 = Math.floor(minZ / RASTER_ZELLE);
    var cz1 = Math.floor(maxZ / RASTER_ZELLE);
    for (var cx = cx0; cx <= cx1; cx++) {
      for (var cz = cz0; cz <= cz1; cz++) {
        var k = zelleKey(cx, cz);
        if (!rasterIndex[k]) rasterIndex[k] = [];
        rasterIndex[k].push(zone);
      }
    }
  }

  function baueRasterNeu() {
    rasterIndex = {};
    landRechtecke = [];
    zonenListe.sort(function (a, b) {
      return (b.prioritaet || 0) - (a.prioritaet || 0);
    });
    for (var i = 0; i < zonenListe.length; i++) {
      var z = zonenListe[i];
      if (z.prioritaet >= 10 && z.prioritaet <= 20 && z.untergrund !== 'wasser' && z.untergrund !== 'riff') {
        landRechtecke.push(z);
      }
      if (typeof z.minX === 'number') {
        fuegeInRasterEin(z, z.minX, z.maxX, z.minZ, z.maxZ);
      }
    }
  }

  function abstandPunktSegmentQuadrat(px, pz, ax, az, bx, bz) {
    var vx = bx - ax;
    var vz = bz - az;
    var wx = px - ax;
    var wz = pz - az;
    var c1 = wx * vx + wz * vz;
    if (c1 <= 0) return wx * wx + wz * wz;
    var c2 = vx * vx + vz * vz;
    if (c2 <= c1) {
      var dx = px - bx;
      var dz = pz - bz;
      return dx * dx + dz * dz;
    }
    var b = c1 / c2;
    var ex = px - (ax + b * vx);
    var ez = pz - (az + b * vz);
    return ex * ex + ez * ez;
  }

  // Centripetal Catmull-Rom (alpha = 0.5)
  function catmullRomCentripetalPunkt(p0, p1, p2, p3, u) {
    function knotDelta(a, b) {
      var dx = b.x - a.x;
      var dy = (b.y || 0) - (a.y || 0);
      var dz = b.z - a.z;
      return Math.pow(Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1e-4), 0.5);
    }
    var dt0 = knotDelta(p0, p1);
    var dt1 = knotDelta(p1, p2);
    var dt2 = knotDelta(p2, p3);
    function interp(k0, k1, k2, k3) {
      var t1 = ((k1 - k0) / dt0 - (k2 - k0) / (dt0 + dt1) + (k2 - k1) / dt1) * dt1;
      var t2 = ((k2 - k1) / dt1 - (k3 - k1) / (dt1 + dt2) + (k3 - k2) / dt2) * dt1;
      var c2 = -3 * k1 + 3 * k2 - 2 * t1 - t2;
      var c3 = 2 * k1 - 2 * k2 + t1 + t2;
      return k1 + t1 * u + c2 * u * u + c3 * u * u * u;
    }
    return {
      x: interp(p0.x, p1.x, p2.x, p3.x),
      y: interp(p0.y || 0.28, p1.y || 0.28, p2.y || 0.28, p3.y || 0.28),
      z: interp(p0.z, p1.z, p2.z, p3.z)
    };
  }

  function sampleCatmullRomKurve(kontrollPunkte, geschlossen) {
    var n = kontrollPunkte.length;
    if (n < 2) return kontrollPunkte.slice();
    var ergebnis = [];
    var segCount = geschlossen ? n : n - 1;
    for (var i = 0; i < segCount; i++) {
      var p1 = kontrollPunkte[i];
      var p2 = kontrollPunkte[(i + 1) % n];
      var p0 = geschlossen ? kontrollPunkte[(i - 1 + n) % n] : (i === 0 ? {
        x: p1.x - (p2.x - p1.x), y: (p1.y || 0), z: p1.z - (p2.z - p1.z)
      } : kontrollPunkte[i - 1]);
      var p3 = geschlossen ? kontrollPunkte[(i + 2) % n] : (i + 2 >= n ? {
        x: p2.x + (p2.x - p1.x), y: (p2.y || 0), z: p2.z + (p2.z - p1.z)
      } : kontrollPunkte[i + 2]);
      var segDist = Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.z - p1.z) * (p2.z - p1.z));
      var steps = Math.max(8, Math.ceil(segDist * 1.2));
      for (var s = 0; s < steps; s++) {
        ergebnis.push(catmullRomCentripetalPunkt(p0, p1, p2, p3, s / steps));
      }
    }
    ergebnis.push(geschlossen ? ergebnis[0] : kontrollPunkte[n - 1]);
    return ergebnis;
  }

  function pruefeZone(zone, x, z) {
    if (typeof zone.minX === 'number') {
      if (x < zone.minX || x > zone.maxX || z < zone.minZ || z > zone.maxZ) return null;
    }
    var form = zone.form;
    if (form === 'rechteck') {
      if (zone.yawRad) {
        var dx = x - zone.cx, dz = z - zone.cz;
        var c = Math.cos(zone.yawRad), s = Math.sin(zone.yawRad);
        if (Math.abs(dx * c - dz * s) > zone.halbBreite || Math.abs(dx * s + dz * c) > zone.halbTiefe) return null;
      }
      var h = typeof zone.hoehe === 'function' ? zone.hoehe(x, z) : (zone.hoehe || 0.25);
      return { untergrund: zone.untergrund, hoehe: h, tiefe: zone.tiefe || 0, kontinent: zone.kontinent, spitz: Boolean(zone.spitz) };
    }
    if (form === 'ellipse' || form === 'kreis') {
      var edx = x - zone.cx, edz = z - zone.cz;
      if (zone.yawRad) {
        var ec = Math.cos(zone.yawRad), es = Math.sin(zone.yawRad);
        var elx = edx * ec - edz * es;
        edz = edx * es + edz * ec;
        edx = elx;
      }
      var rx = zone.rx || zone.r || 1, rz = zone.rz || zone.r || 1;
      if ((edx * edx) / (rx * rx) + (edz * edz) / (rz * rz) > 1.0) return null;
      var eh = typeof zone.hoehe === 'function' ? zone.hoehe(x, z) : (zone.hoehe || 0.25);
      return { untergrund: zone.untergrund, hoehe: eh, tiefe: zone.tiefe || 0, kontinent: zone.kontinent, spitz: Boolean(zone.spitz) };
    }
    if (form === 'kegelfeld') {
      var maxH = -Infinity, getroffen = false;
      for (var i = 0; i < zone.kegel.length; i++) {
        var k = zone.kegel[i];
        var dist = Math.sqrt((x - (zone.cx + k.x)) * (x - (zone.cx + k.x)) + (z - (zone.cz + k.z)) * (z - (zone.cz + k.z)));
        if (dist <= k.r) {
          getroffen = true;
          var kh = (zone.basisHoehe || 0.25) + k.h * (1 - dist / k.r);
          if (kh > maxH) maxH = kh;
        }
      }
      if (!getroffen) return null;
      return { untergrund: zone.untergrund, hoehe: maxH, tiefe: 0, kontinent: zone.kontinent, spitz: Boolean(zone.spitz) };
    }
    if (form === 'hoehenfunktion') {
      var res = zone.fn(x, z);
      if (!res) return null;
      return {
        untergrund: res.untergrund || zone.untergrund,
        hoehe: typeof res.hoehe === 'number' ? res.hoehe : 0.25,
        tiefe: res.tiefe || 0,
        kontinent: res.kontinent || zone.kontinent,
        spitz: typeof res.spitz === 'boolean' ? res.spitz : Boolean(zone.spitz)
      };
    }
    if (form === 'polylinie') {
      var pts = zone.punkte;
      if (!pts || pts.length < 2) return null;
      var halbB = zone.halbBreite || 1.8, bordB = zone.bordsteinBreite || 0;
      var gesamtB = halbB + bordB, gesamtB2 = gesamtB * gesamtB, minD2 = Infinity;
      for (var p = 0; p < pts.length - 1; p++) {
        var a = pts[p], b = pts[p + 1];
        if (x < Math.min(a.x, b.x) - gesamtB || x > Math.max(a.x, b.x) + gesamtB) continue;
        if (z < Math.min(a.z, b.z) - gesamtB || z > Math.max(a.z, b.z) + gesamtB) continue;
        var d2 = abstandPunktSegmentQuadrat(x, z, a.x, a.z, b.x, b.z);
        if (d2 < minD2) minD2 = d2;
      }
      if (minD2 > gesamtB2) return null;
      if (Math.sqrt(minD2) <= halbB) {
        return { untergrund: zone.untergrund, hoehe: zone.hoehe || 0.28, tiefe: 0, kontinent: zone.kontinent, spitz: false, prioritaetOverride: zone.prioritaet };
      }
      return { untergrund: 'bordstein', hoehe: (zone.hoehe || 0.28) + 0.08, tiefe: 0, kontinent: zone.kontinent, spitz: false, prioritaetOverride: 90 };
    }
    return null;
  }

  function abstandZuNaechstemLand(x, z) {
    var minDist = Infinity;
    for (var i = 0; i < landRechtecke.length; i++) {
      var l = landRechtecke[i];
      if (l.form === 'rechteck' && !l.yawRad) {
        var dx = x < l.minX ? (l.minX - x) : (x > l.maxX ? (x - l.maxX) : 0);
        var dz = z < l.minZ ? (l.minZ - z) : (z > l.maxZ ? (z - l.maxZ) : 0);
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d < minDist) minDist = d;
      }
    }
    return minDist === Infinity ? 100 : minDist;
  }

  function basisAbfrageOhneGradient(x, z) {
    var kandidaten = rasterIndex[zelleKey(Math.floor(x / RASTER_ZELLE), Math.floor(z / RASTER_ZELLE))];
    var besterTreffer = null, bestePrio = -Infinity, kontinentGefunden = null;
    if (kandidaten) {
      for (var i = 0; i < kandidaten.length; i++) {
        var zone = kandidaten[i];
        if (zone.prioritaet < bestePrio && zone.prioritaet > 30) continue;
        var treffer = pruefeZone(zone, x, z);
        if (treffer) {
          if (treffer.kontinent && !kontinentGefunden && zone.prioritaet >= 10 && zone.prioritaet <= 35) {
            kontinentGefunden = treffer.kontinent;
          }
          var effPrio = typeof treffer.prioritaetOverride === 'number' ? treffer.prioritaetOverride : zone.prioritaet;
          if (effPrio > bestePrio) {
            bestePrio = effPrio;
            besterTreffer = treffer;
          }
        }
      }
    }
    if (!besterTreffer) {
      var tf = Math.min(40, 0.2 + 0.35 * abstandZuNaechstemLand(x, z));
      return { untergrund: 'wasser', hoehe: WASSER_SPIEGEL - tf, tiefe: tf, kontinent: 'ozean', spitz: false };
    }
    var ug = besterTreffer.untergrund;
    var kont = besterTreffer.kontinent || kontinentGefunden || (x < -100 ? 'europa' : (x > 200 ? 'amerika' : (z > 105 ? 'afrika' : 'ozean')));
    if (ug === 'wasser' || ug === 'riff') {
      var tiefe = (besterTreffer.tiefe && besterTreffer.tiefe > 0) ? besterTreffer.tiefe : Math.min(40, 0.2 + 0.35 * abstandZuNaechstemLand(x, z));
      return { untergrund: ug, hoehe: WASSER_SPIEGEL - tiefe, tiefe: tiefe, kontinent: kont, spitz: false };
    }
    return { untergrund: ug, hoehe: besterTreffer.hoehe, tiefe: 0, kontinent: kont, spitz: Boolean(besterTreffer.spitz) };
  }

  function registriereStandardZonen() {
    zonenListe = [];
    var reg = EEP.welt.registriereZone;
    reg({ id: 'weltmeer', form: 'rechteck', prioritaet: 0, untergrund: 'wasser', kontinent: 'ozean', minX: -540, maxX: 540, minZ: -250, maxZ: 370, tiefe: 0 }, true);
    reg({ id: 'kontinent-europa', form: 'rechteck', prioritaet: 10, untergrund: 'gras', kontinent: 'europa', hoehe: 0.25, minX: -346, maxX: -218, minZ: -85, maxZ: 41 }, true);
    reg({ id: 'kontinent-amerika', form: 'rechteck', prioritaet: 10, untergrund: 'gras', kontinent: 'amerika', hoehe: 0.25, minX: 223.5, maxX: 348.5, minZ: -82.5, maxZ: 82.5 }, true);
    reg({ id: 'kontinent-afrika', form: 'rechteck', prioritaet: 10, untergrund: 'sand', kontinent: 'afrika', hoehe: 0.25, minX: 20, maxX: 190, minZ: 120, maxZ: 256 }, true);
    reg({ id: 'strand-europa', form: 'rechteck', prioritaet: 20, untergrund: 'sand', kontinent: 'europa', hoehe: 0.21, minX: -346, maxX: -218, minZ: 39, maxZ: 49 }, true);
    reg({ id: 'strand-amerika', form: 'rechteck', prioritaet: 20, untergrund: 'sand', kontinent: 'amerika', hoehe: 0.21, minX: 216, maxX: 228, minZ: -82.5, maxZ: 82.5 }, true);
    reg({ id: 'strand-afrika', form: 'rechteck', prioritaet: 20, untergrund: 'sand', kontinent: 'afrika', hoehe: 0.21, minX: 24, maxX: 132, minZ: 112.5, maxZ: 121.5 }, true);

    var inseln = [
      { id: 'insel-1', cx: 135, cz: -22, rx: 8.5 * 0.7, rz: 8.5 * 1.6, yawDeg: -15, kont: 'insel' },
      { id: 'insel-2', cx: 118, cz: 10,  rx: 7.5 * 0.7, rz: 7.5 * 1.5, yawDeg: 12,  kont: 'insel' },
      { id: 'insel-3', cx: 152, cz: 44,  rx: 6.0 * 0.7, rz: 6.0 * 1.4, yawDeg: 0,   kont: 'insel' },
      { id: 'insel-4', cx: 168, cz: 62,  rx: 5.0 * 0.7, rz: 5.0 * 1.3, yawDeg: 0,   kont: 'insel' },
      { id: 'insel-de-fluss', cx: -231, cz: 10, rx: 2.4 * 0.8, rz: 2.4 * 2.6, yawDeg: 0, kont: 'europa' }
    ];
    for (var idx = 0; idx < inseln.length; idx++) {
      var ins = inseln[idx], rMax = Math.max(ins.rx, ins.rz) + 1;
      reg({
        id: ins.id, form: 'ellipse', prioritaet: 35, untergrund: 'sand', kontinent: ins.kont, hoehe: 0.45,
        cx: ins.cx, cz: ins.cz, rx: ins.rx, rz: ins.rz, yawRad: (ins.yawDeg || 0) * Math.PI / 180,
        minX: ins.cx - rMax, maxX: ins.cx + rMax, minZ: ins.cz - rMax, maxZ: ins.cz + rMax
      }, true);
    }

    var fluesse = [
      { id: 'fluss-de-haupt', cx: -232, cz: -4,  b: 8.5, t: 108, yawDeg: -8,  kont: 'europa', tiefe: 1.5 },
      { id: 'fluss-de-arm',   cx: -224, cz: -18, b: 24,  t: 6.5, yawDeg: -18, kont: 'europa', tiefe: 1.5 },
      { id: 'fluss-us-oben',  cx: 255,  cz: -22, b: 5.5, t: 62,  yawDeg: 68,  kont: 'amerika', tiefe: 1.5 },
      { id: 'fluss-us-unten', cx: 238,  cz: 34,  b: 7.5, t: 48,  yawDeg: -38, kont: 'amerika', tiefe: 1.5 },
      { id: 'fluss-nil-west', cx: 30,   cz: 176, b: 8.0, t: 118, yawDeg: -6,  kont: 'afrika',  tiefe: 1.5 },
      { id: 'fluss-nil-sued', cx: 80,   cz: 236, b: 96,  t: 7.5, yawDeg: 2,   kont: 'afrika',  tiefe: 1.5 }
    ];
    for (var fIdx = 0; fIdx < fluesse.length; fIdx++) {
      var fl = fluesse[fIdx], diag = Math.sqrt(fl.b * fl.b + fl.t * fl.t) * 0.55;
      reg({
        id: fl.id, form: 'rechteck', prioritaet: 32, untergrund: 'wasser', kontinent: fl.kont, tiefe: fl.tiefe,
        cx: fl.cx, cz: fl.cz, halbBreite: fl.b / 2, halbTiefe: fl.t / 2, yawRad: fl.yawDeg * Math.PI / 180,
        minX: fl.cx - diag, maxX: fl.cx + diag, minZ: fl.cz - diag, maxZ: fl.cz + diag
      }, true);
    }

    reg({ id: 'rotes-meer-riff', form: 'ellipse', prioritaet: 50, untergrund: 'riff', kontinent: 'afrika', tiefe: 0.8, cx: 125, cz: 95, rx: 22, rz: 7, minX: 103, maxX: 147, minZ: 88, maxZ: 102 }, true);

    var baumStandorte = [
      { x: -325, z: 36, s: 3.2 }, { x: -318, z: 38, s: 3.5 }, { x: -310, z: 37, s: 3.0 },
      { x: -302, z: 38, s: 3.4 }, { x: -295, z: 36, s: 3.2 }
    ];
    for (var bIdx = 0; bIdx < baumStandorte.length; bIdx++) {
      var bm = baumStandorte[bIdx], rW = 1.2 * bm.s;
      reg({ id: 'wald-de-' + bIdx, form: 'kreis', prioritaet: 60, untergrund: 'waldboden', kontinent: 'europa', hoehe: 0.25, cx: bm.x, cz: bm.z, r: rW, minX: bm.x - rW, maxX: bm.x + rW, minZ: bm.z - rW, maxZ: bm.z + rW }, true);
    }

    var alpenKegel = [
      { x: -20, z: -2, r: 12, h: 30 * 0.85 }, { x: -8, z: -4, r: 15, h: 30 * 1.05 },
      { x: 6,   z: -3, r: 14, h: 30 * 0.95 }, { x: 18, z: -1, r: 11, h: 30 * 0.78 },
      { x: -14, z: 4,  r: 9,  h: 30 * 0.62 }, { x: 0,  z: 5,  r: 10, h: 30 * 0.68 },
      { x: 12,  z: 4,  r: 9,  h: 30 * 0.60 }
    ];
    reg({ id: 'gebirge-alpen', form: 'kegelfeld', prioritaet: 70, untergrund: 'fels', kontinent: 'europa', spitz: true, cx: -290, cz: -66, basisHoehe: 0.20, kegel: alpenKegel, minX: -325, maxX: -258, minZ: -86, maxZ: -48 }, true);

    var rockiesKegel = [
      { x: -5.5, z: -6.5, r: 7.5, h: 29 * 0.92 }, { x: 1.0,  z: -1.5, r: 9.2, h: 29 * 1.00 },
      { x: 5.8,  z: -5.0, r: 7.0, h: 29 * 0.84 }, { x: -4.8, z: 2.5,  r: 8.0, h: 29 * 0.88 },
      { x: 4.5,  z: 4.2,  r: 7.8, h: 29 * 0.86 }, { x: -1.2, z: 8.0,  r: 7.2, h: 29 * 0.78 },
      { x: -7.5, z: -1.0, r: 5.8, h: 29 * 0.66 }, { x: 7.2,  z: 0.5,  r: 6.0, h: 29 * 0.68 }
    ];
    reg({ id: 'gebirge-rockies', form: 'kegelfeld', prioritaet: 70, untergrund: 'fels', kontinent: 'amerika', spitz: true, cx: 252, cz: 6, basisHoehe: 0.25, kegel: rockiesKegel, minX: 238, maxX: 266, minZ: -9, maxZ: 22 }, true);

    reg({
      id: 'gebirge-canyon', form: 'hoehenfunktion', prioritaet: 70, untergrund: 'fels', kontinent: 'amerika', spitz: true,
      minX: 243, maxX: 289, minZ: 32, maxZ: 76,
      fn: function (x, z) {
        var lx = x - 266, lz = z - 54;
        if (Math.abs(lx) > 23 || Math.abs(lz) > 22) return null;
        var gorgeX = Math.sin(lz * 0.09) * 5 + Math.sin(lz * 0.23) * 1.5;
        var dist = Math.abs(lx - gorgeX);
        if (dist <= 1.8) return { untergrund: 'wasser', hoehe: -0.95, tiefe: 1.0, kontinent: 'amerika', spitz: false };
        if (dist <= 3.2) return { untergrund: 'sand', hoehe: 0.28, tiefe: 0, kontinent: 'amerika', spitz: false };
        return { untergrund: 'fels', hoehe: 0.25 + Math.max(0.5, Math.min(22, 22 - dist * 0.32)), tiefe: 0, kontinent: 'amerika', spitz: true };
      }
    }, true);

    reg({
      id: 'alpen-pass-teststrecke', form: 'hoehenfunktion', prioritaet: 75, untergrund: 'fels', kontinent: 'europa', spitz: false,
      minX: -256.5, maxX: -251.5, minZ: -88.5, maxZ: -59.5,
      fn: function (x, z) {
        if (x < -256.0 || x > -252.0 || z > -60.0 || z < -88.0) return null;
        var h = 0.25;
        if (z >= -68.0) h = 0.25 + ((-60.0 - z) / 8.0) * 1.0;
        else if (z >= -76.0) h = 0.25 + 1.0 + ((-68.0 - z) / 8.0) * 2.0;
        else if (z >= -84.0) h = 0.25 + 3.0 + ((-76.0 - z) / 8.0) * 3.0;
        else h = 0.25 + 6.0;
        return { untergrund: 'fels', hoehe: h, tiefe: 0, kontinent: 'europa', spitz: false };
      }
    }, true);

    var regPoly = EEP.welt.registrierePolylinie;
    regPoly({ id: 'gleis-de-bahn', untergrund: 'schiene', prioritaet: 80, breite: 2.3, geschlossen: true, kontinent: 'europa', punkteText: '-265 0.30 -44, -286 0.30 -25, -292 0.30 2, -285 0.30 26, -274 0.30 39, -256 0.30 39, -254 0.30 18, -258 0.30 -12, -260 0.30 -35' }, true);
    regPoly({ id: 'gleis-us-bahn', untergrund: 'schiene', prioritaet: 80, breite: 2.3, geschlossen: true, kontinent: 'amerika', punkteText: '256 0.30 -68, 242 0.30 -56, 258 0.30 -44, 288 0.30 -56, 306 0.30 -46, 286 0.30 -30, 268 0.30 -10, 278 0.30 22, 296 0.30 48, 288 0.30 76, 244 0.30 76, 234 0.30 46, 234 0.30 8, 230 0.30 -32, 252 0.30 -40, 268 0.30 -58' }, true);
    regPoly({ id: 'gleis-afrika-bahn', untergrund: 'schiene', prioritaet: 80, breite: 2.3, geschlossen: true, kontinent: 'afrika', punkteText: '38 0.30 222, 46 0.30 165, 68 0.30 142, 84 0.30 158, 52 0.30 188, 54 0.30 224, 82 0.30 224, 92 0.30 160, 108 0.30 162, 98 0.30 218, 120 0.30 228, 126 0.30 196, 108 0.30 192, 104 0.30 214, 128 0.30 226, 152 0.30 176, 178 0.30 186, 178 0.30 232, 138 0.30 242, 75 0.30 242' }, true);
    regPoly({ id: 'strasse-de', untergrund: 'strasse', prioritaet: 100, breite: 3.8, bordsteinBreite: 0.30, geschlossen: false, kontinent: 'europa', punkteText: '-242 0.28 -53, -254 0.28 -42, -248 0.28 -20, -240 0.28 5, -238 0.28 28, -248 0.28 42' }, true);
    regPoly({ id: 'strasse-us', untergrund: 'strasse', prioritaet: 100, breite: 3.6, bordsteinBreite: 0.30, geschlossen: false, kontinent: 'amerika', punkteText: '292 0.28 -31, 298 0.28 -20, 312 0.28 -10' }, true);
    regPoly({ id: 'strasse-afrika-kueste', untergrund: 'strasse', prioritaet: 100, breite: 3.8, bordsteinBreite: 0.30, geschlossen: false, kontinent: 'afrika', punkteText: '32 0.28 125, 78 0.28 125, 132 0.28 124, 158 0.28 124, 178 0.28 128' }, true);
    regPoly({ id: 'strasse-afrika-abzweig', untergrund: 'strasse', prioritaet: 100, breite: 3.6, bordsteinBreite: 0.30, geschlossen: false, kontinent: 'afrika', punkteText: '158 0.28 124, 158 0.28 152, 160 0.28 178' }, true);

    var flughaefen = [
      { id: 'flughafen-de', cx: -312, cz: -6,  len: 52, side: -1, kont: 'europa' },
      { id: 'flughafen-us', cx: 306,  cz: 14,  len: 58, side: 1,  kont: 'amerika' },
      { id: 'flughafen-af', cx: 68,   cz: 190, len: 48, side: -1, kont: 'afrika' }
    ];
    for (var aIdx = 0; aIdx < flughaefen.length; aIdx++) {
      var ap = flughaefen[aIdx], rfX = ap.cx + ap.side * 10, rfLen = ap.len * 0.65;
      reg({ id: ap.id + '-piste', form: 'rechteck', prioritaet: 100, untergrund: 'strasse', kontinent: ap.kont, hoehe: 0.31, minX: ap.cx - 5.5, maxX: ap.cx + 5.5, minZ: ap.cz - ap.len / 2, maxZ: ap.cz + ap.len / 2 }, true);
      reg({ id: ap.id + '-rollfeld', form: 'rechteck', prioritaet: 100, untergrund: 'strasse', kontinent: ap.kont, hoehe: 0.30, minX: rfX - 5.0, maxX: rfX + 5.0, minZ: ap.cz + 2 - rfLen / 2, maxZ: ap.cz + 2 + rfLen / 2 }, true);
    }

    baueRasterNeu();
  }

  EEP.welt = {
    bereit: false,
    zonen: zonenListe,
    kennwerte: KENNWERTE,

    registriereZone: function (zone, ohneRebuild) {
      if (!zone || !zone.id) return;
      for (var i = zonenListe.length - 1; i >= 0; i--) {
        if (zonenListe[i].id === zone.id) zonenListe.splice(i, 1);
      }
      zonenListe.push(zone);
      if (!ohneRebuild) baueRasterNeu();
    },

    entferneZone: function (id) {
      for (var i = zonenListe.length - 1; i >= 0; i--) {
        if (zonenListe[i].id === id) {
          zonenListe.splice(i, 1);
          baueRasterNeu();
          return true;
        }
      }
      return false;
    },

    registrierePolylinie: function (cfg, ohneRebuild) {
      var rohePunkte = cfg.punkte || [];
      if (cfg.punkteText && (!rohePunkte || rohePunkte.length === 0)) {
        var teile = cfg.punkteText.split(',');
        for (var i = 0; i < teile.length; i++) {
          var nums = teile[i].trim().split(/\s+/).map(Number);
          if (nums.length >= 3 && !isNaN(nums[0])) rohePunkte.push({ x: nums[0], y: nums[1], z: nums[2] });
        }
      }
      if (rohePunkte.length < 2) return;
      var kurvenPunkte = sampleCatmullRomKurve(rohePunkte, Boolean(cfg.geschlossen));
      var halbB = (cfg.breite || 3.6) / 2, bordB = cfg.bordsteinBreite || 0, pad = halbB + bordB + 0.5;
      var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (var k = 0; k < kurvenPunkte.length; k++) {
        var pt = kurvenPunkte[k];
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.z < minZ) minZ = pt.z;
        if (pt.z > maxZ) maxZ = pt.z;
      }
      EEP.welt.registriereZone({
        id: cfg.id || ('poly-' + zonenListe.length),
        form: 'polylinie', prioritaet: cfg.prioritaet || 100, untergrund: cfg.untergrund || 'strasse',
        kontinent: cfg.kontinent || null, hoehe: (rohePunkte[0] && rohePunkte[0].y) ? rohePunkte[0].y : 0.28,
        halbBreite: halbB, bordsteinBreite: bordB, punkte: kurvenPunkte,
        minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad
      }, ohneRebuild);
    },

    hoeheBei: function (x, z) {
      return basisAbfrageOhneGradient(x, z).hoehe;
    },

    untergrundBei: function (x, z) {
      return basisAbfrageOhneGradient(x, z).untergrund;
    },

    abfrage: function (x, z) {
      var b = basisAbfrageOhneGradient(x, z);
      var ug = b.untergrund;
      var kw = KENNWERTE[ug] || KENNWERTE.gras;
      var sx = 0, sz = 0, steigungProzent = 0;
      if (ug !== 'wasser' && ug !== 'riff') {
        sx = basisAbfrageOhneGradient(x + 0.5, z).hoehe - basisAbfrageOhneGradient(x - 0.5, z).hoehe;
        sz = basisAbfrageOhneGradient(x, z + 0.5).hoehe - basisAbfrageOhneGradient(x, z - 0.5).hoehe;
        steigungProzent = 100 * Math.sqrt(sx * sx + sz * sz);
      }
      return {
        untergrund: ug, hoehe: b.hoehe, steigungX: sx, steigungZ: sz, steigung: steigungProzent,
        reibung: kw.reibung, rollwiderstand: kw.rollwiderstand, tiefe: b.tiefe, kontinent: b.kontinent, spitz: b.spitz
      };
    },

    resetStandard: function () {
      registriereStandardZonen();
      EEP.welt.bereit = true;
    }
  };

  EEP.welt.resetStandard();
})();
