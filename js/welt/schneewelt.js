/* ============================================================================
 * js/welt/schneewelt.js – Paket L: Magische Schneewelt (Reine Simulationslogik)
 * WICHTIG: Frei von Rendering-Engines und DOM-Zugriffen (reines JavaScript).
 * ============================================================================ */
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.schneewelt = '1.0.0';

  var KONFIG = {
    portalNord: { x: -240.0, y: 16.0, z: -790.0 },
    talBounds: { xMin: -420, xMax: -80, zMin: -1380, zMax: -790 },
    youtubeVideoId: '5w3rRFWzjcM',
    musikZielLautstaerke: 85,
    musikFadeInRate: 55,
    musikFadeOutRate: 45,
    wetterModi: ['schneefall', 'schneesturm', 'wintersonne', 'eisnebel']
  };

  var KONTROLL_PUNKTE = [
    [-240, -790],
    [-240, -835],
    [-222, -900],
    [-218, -960],
    [-248, -1035],
    [-272, -1110],
    [-252, -1185],
    [-235, -1245],
    [-240, -1300]
  ];

  function strassenHoehe(z) {
    if (z >= -790) return 16.0;
    if (z <= -1300) return 19.5;
    return 16.0 + 3.5 * ((-790 - z) / 510.0);
  }

  function catmullRomCentripetal(p0, p1, p2, p3, u) {
    function knotDelta(a, b) {
      var dx = b.x - a.x, dz = b.z - a.z;
      return Math.pow(Math.max(Math.sqrt(dx * dx + dz * dz), 1e-4), 0.5);
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
    var rx = interp(p0.x, p1.x, p2.x, p3.x);
    var rz = interp(p0.z, p1.z, p2.z, p3.z);
    return { x: rx, y: strassenHoehe(rz), z: rz };
  }

  function generiereStrassenPunkte() {
    var raw = [];
    for (var i = 0; i < KONTROLL_PUNKTE.length; i++) {
      raw.push({ x: KONTROLL_PUNKTE[i][0], z: KONTROLL_PUNKTE[i][1] });
    }
    var pts = [];
    var n = raw.length;
    for (var seg = 0; seg < n - 1; seg++) {
      var p1 = raw[seg], p2 = raw[seg + 1];
      var p0 = seg === 0 ? { x: p1.x - (p2.x - p1.x), z: p1.z - (p2.z - p1.z) } : raw[seg - 1];
      var p3 = seg + 2 < n ? raw[seg + 2] : { x: p2.x + (p2.x - p1.x), z: p2.z + (p2.z - p1.z) };
      var segDist = Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.z - p1.z) * (p2.z - p1.z));
      var steps = Math.max(8, Math.ceil(segDist / 2.0));
      for (var s = 0; s < steps; s++) {
        pts.push(catmullRomCentripetal(p0, p1, p2, p3, s / steps));
      }
    }
    pts.push({ x: raw[n - 1].x, y: strassenHoehe(raw[n - 1].z), z: raw[n - 1].z });

    var len = 0;
    for (var k = 0; k < pts.length - 1; k++) {
      var dx = pts[k + 1].x - pts[k].x;
      var dz = pts[k + 1].z - pts[k].z;
      len += Math.sqrt(dx * dx + dz * dz);
    }
    return { punkte: pts, laenge: len };
  }

  var strassenDaten = generiereStrassenPunkte();
  var strassenPunkte = strassenDaten.punkte;

  function abstandPunktSegmentQuadrat(px, pz, ax, az, bx, bz) {
    var vx = bx - ax, vz = bz - az;
    var wx = px - ax, wz = pz - az;
    var c1 = wx * vx + wz * vz;
    if (c1 <= 0) return wx * wx + wz * wz;
    var c2 = vx * vx + vz * vz;
    if (c2 <= c1) {
      var dx = px - bx, dz = pz - bz;
      return dx * dx + dz * dz;
    }
    var b = c1 / c2;
    var ex = px - (ax + b * vx);
    var ez = pz - (az + b * vz);
    return ex * ex + ez * ez;
  }

  function abstandZurStrasse(x, z) {
    var minD2 = Infinity;
    for (var i = 0; i < strassenPunkte.length - 1; i++) {
      var a = strassenPunkte[i], b = strassenPunkte[i + 1];
      if (x < Math.min(a.x, b.x) - 40 || x > Math.max(a.x, b.x) + 40) continue;
      if (z < Math.min(a.z, b.z) - 40 || z > Math.max(a.z, b.z) + 40) continue;
      var d2 = abstandPunktSegmentQuadrat(x, z, a.x, a.z, b.x, b.z);
      if (d2 < minD2) minD2 = d2;
    }
    if (minD2 === Infinity) {
      for (var j = 0; j < strassenPunkte.length - 1; j++) {
        var d2All = abstandPunktSegmentQuadrat(x, z, strassenPunkte[j].x, strassenPunkte[j].z, strassenPunkte[j + 1].x, strassenPunkte[j + 1].z);
        if (d2All < minD2) minD2 = d2All;
      }
    }
    var polyDist = Math.sqrt(minD2);

    // Wendeplatz-Kreis bei (-240, -1295) mit Radius 18m
    var dWendeX = x - (-240.0);
    var dWendeZ = z - (-1295.0);
    var dWendeDist = Math.sqrt(dWendeX * dWendeX + dWendeZ * dWendeZ);
    var wendeDist = Math.max(0, dWendeDist - 18.0);

    return Math.min(polyDist, wendeDist);
  }

  function hoehe(x, z) {
    var tZ = Math.max(0, Math.min(1, (-790 - z) / 510.0));
    var talBoden = 16.2 + 3.3 * tZ + 0.25 * Math.sin(x * 0.035) * Math.cos(z * 0.028) + 0.15 * Math.sin((x + z) * 0.018);

    // Steile Talkesselwände
    var wandWest = 0, wandOst = 0, wandNord = 0, wandSued = 0;
    if (x < -305) {
      var dxW = -305 - x;
      wandWest = Math.pow(dxW / 12.0, 2) * 1.85;
    }
    if (x > -175) {
      var dxE = x - (-175);
      wandOst = Math.pow(dxE / 12.0, 2) * 1.85;
    }
    if (z < -1310) {
      var dzN = -1310 - z;
      wandNord = Math.pow(dzN / 10.0, 2) * 2.6;
    }
    if (z > -808) {
      var dxPortal = Math.max(0, Math.abs(x - (-240.0)) - 8.5);
      if (dxPortal > 0) {
        var dzS = z - (-808);
        wandSued = Math.pow(dzS / 4.5, 2) * 4.2 + Math.pow(dxPortal / 9.0, 2) * 3.5;
      }
    }

    var wandGesamt = Math.min(135.0, wandWest + wandOst + wandNord + wandSued);
    var gelaende = talBoden + wandGesamt;

    var d = abstandZurStrasse(x, z);
    var u = Math.max(0, Math.min(1, (d - 5.0) / 9.0));
    var w = u * u * (3 - 2 * u);

    return (1 - w) * strassenHoehe(z) + w * gelaende;
  }

  function erstellePrng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var prng = erstellePrng(12345);

  var schneeTannen = [];
  var versuche = 0;
  while (schneeTannen.length < 250 && versuche < 4000) {
    versuche++;
    var tx = -360 + prng() * (360 - 130);
    var tz = -1315 + prng() * (1315 - 805);
    if (abstandZurStrasse(tx, tz) < 6.5) continue;
    // Nicht im Gletschersee (Z -890..-950, X -270..-175)
    if (tz <= -890 && tz >= -950 && tx >= -270 && tx <= -175) continue;
    schneeTannen.push({
      id: 'schneetanne-' + schneeTannen.length,
      x: tx,
      z: tz,
      y: hoehe(tx, tz),
      scale: 0.9 + prng() * 0.65,
      r: 0.6
    });
  }

  var gipfel = [
    { id: 'gipfel-w1', x: -375, z: -830, hoehe: 110, radius: 52, segmente: 8 },
    { id: 'gipfel-w2', x: -365, z: -920, hoehe: 125, radius: 56, segmente: 8 },
    { id: 'gipfel-w3', x: -380, z: -1010, hoehe: 138, radius: 60, segmente: 9 },
    { id: 'gipfel-w4', x: -370, z: -1100, hoehe: 130, radius: 58, segmente: 8 },
    { id: 'gipfel-w5', x: -360, z: -1190, hoehe: 122, radius: 54, segmente: 8 },
    { id: 'gipfel-w6', x: -375, z: -1280, hoehe: 135, radius: 58, segmente: 9 },
    { id: 'gipfel-o1', x: -125, z: -830, hoehe: 108, radius: 50, segmente: 8 },
    { id: 'gipfel-o2', x: -115, z: -920, hoehe: 120, radius: 54, segmente: 8 },
    { id: 'gipfel-o3', x: -105, z: -1010, hoehe: 132, radius: 58, segmente: 9 },
    { id: 'gipfel-o4', x: -110, z: -1100, hoehe: 128, radius: 56, segmente: 8 },
    { id: 'gipfel-o5', x: -120, z: -1190, hoehe: 118, radius: 52, segmente: 8 },
    { id: 'gipfel-o6', x: -115, z: -1280, hoehe: 126, radius: 54, segmente: 9 },
    { id: 'gipfel-n1', x: -320, z: -1355, hoehe: 136, radius: 60, segmente: 9 },
    { id: 'gipfel-n2', x: -240, z: -1365, hoehe: 140, radius: 62, segmente: 9 },
    { id: 'gipfel-n3', x: -160, z: -1355, hoehe: 134, radius: 58, segmente: 8 },
    { id: 'gipfel-s1', x: -325, z: -805, hoehe: 115, radius: 52, segmente: 8 },
    { id: 'gipfel-s2', x: -155, z: -805, hoehe: 112, radius: 52, segmente: 8 }
  ];

  var stationen = {
    galerie: { zStart: -790, zEnde: -825, x: -240.0, y: 16.0 },
    gletschersee: {
      zStart: -890, zEnde: -950,
      seeZentrum: { x: -222, y: 16.4, z: -920, rx: 32, rz: 35 },
      bruecke: { x: -222, y: 16.8, z: -900, laenge: 42, breite: 8.5 }
    },
    bergdorf: {
      zStart: -1000, zEnde: -1090,
      chalets: [
        { id: 'chalet-1', x: -270, z: -1015, yaw: 0.15 },
        { id: 'chalet-2', x: -282, z: -1045, yaw: -0.22 },
        { id: 'chalet-3', x: -272, z: -1075, yaw: 0.10 },
        { id: 'chalet-kirche', x: -290, z: -1060, yaw: -0.05, turm: true },
        { id: 'chalet-4', x: -212, z: -1025, yaw: -0.30 },
        { id: 'chalet-5', x: -210, z: -1070, yaw: 0.25 }
      ],
      gondelbahn: {
        talStation: { x: -218, y: 17.5, z: -1045 },
        bergStation: { x: -135, y: 82.0, z: -1045 },
        stuetze: { x: -176, y: 50.0, z: -1045 }
      }
    },
    eisbogen: { zStart: -1140, zEnde: -1195, x: -262, y: 18.5, z: -1160, breite: 16, hoehe: 11 },
    wendeplatz: { zStart: -1260, zEnde: -1310, x: -240, y: 19.5, z: -1290, radius: 18 }
  };

  var WETTER_DATEN = {
    schneefall:   { windStaerke: 1.2, schneeDichte: 1.0, himmelFarbe: '#94a3b8', nebelFarbe: '#cbd5e1', nebelNear: 35, nebelFar: 280, lichtIntensitaet: 1.2 },
    schneesturm:  { windStaerke: 3.8, schneeDichte: 2.2, himmelFarbe: '#64748b', nebelFarbe: '#94a3b8', nebelNear: 15, nebelFar: 140, lichtIntensitaet: 0.7 },
    wintersonne:  { windStaerke: 0.4, schneeDichte: 0.3, himmelFarbe: '#38bdf8', nebelFarbe: '#e0f2fe', nebelNear: 80, nebelFar: 600, lichtIntensitaet: 2.4 },
    eisnebel:     { windStaerke: 0.8, schneeDichte: 0.8, himmelFarbe: '#7dd3fc', nebelFarbe: '#bfdbfe', nebelNear: 20, nebelFar: 180, lichtIntensitaet: 1.0 }
  };

  var zustand = {
    initialisiert: false,
    inSchneewelt: false,
    transitionAlpha: 0.0,
    transitionTimer: 0.0,
    wetterModus: 'schneefall',
    wetterTimer: 0.0,
    musikVideoId: KONFIG.youtubeVideoId,
    musikStatus: 'gestoppt', // 'gestoppt', 'fadein', 'spielt', 'fadeout', 'pausiert'
    musikLautstaerke: 0.0,
    musikPositionSek: 0.0
  };

  function initialisiere() {
    if (zustand.initialisiert) return;

    if (EEP.welt && typeof EEP.welt.registriereZone === 'function') {
      EEP.welt.registriereZone({
        id: 'Schneewelt',
        xMin: -420,
        xMax: -80,
        zMin: -1380,
        zMax: -790,
        prioritaet: 32,
        untergrund: 'schnee',
        kontinent: 'europa',
        hoeheFn: EEP.schneewelt.hoehe
      }, true);

      EEP.welt.registriereZone({
        id: 'Schneewelt-Strasse',
        xMin: -310,
        xMax: -190,
        zMin: -1318,
        zMax: -790,
        prioritaet: 42,
        untergrund: 'strasse',
        kontinent: 'europa',
        enthaltenFn: function (x, z) {
          return EEP.schneewelt.abstandZurStrasse(x, z) <= 4.25;
        },
        hoeheFn: function (x, z) {
          return EEP.schneewelt.strassenHoehe(z);
        }
      }, false);
    }

    if (EEP.kollision && typeof EEP.kollision.registriereHindernis === 'function') {
      var waende = [
        { id: 'schneewelt-wand-west', x: -377.5, z: -1085, halbBreite: 42.5, halbTiefe: 295, hoehe: 140 },
        { id: 'schneewelt-wand-ost', x: -112.5, z: -1085, halbBreite: 32.5, halbTiefe: 295, hoehe: 140 },
        { id: 'schneewelt-wand-nord', x: -250, z: -1350, halbBreite: 170, halbTiefe: 30, hoehe: 140 },
        { id: 'schneewelt-wand-sued-west', x: -332.75, z: -796.5, halbBreite: 87.25, halbTiefe: 8.5, hoehe: 140 },
        { id: 'schneewelt-wand-sued-ost', x: -157.25, z: -796.5, halbBreite: 77.25, halbTiefe: 8.5, hoehe: 140 }
      ];
      for (var wIdx = 0; wIdx < waende.length; wIdx++) {
        var wd = waende[wIdx];
        EEP.kollision.registriereHindernis({
          id: wd.id, art: 'gebirge', form: 'box', x: wd.x, z: wd.z,
          halbBreite: wd.halbBreite, halbTiefe: wd.halbTiefe, halbLaenge: wd.halbTiefe, hoehe: wd.hoehe, yaw: 0
        });
      }

      // Schneetannen
      for (var b = 0; b < schneeTannen.length; b++) {
        var st = schneeTannen[b];
        EEP.kollision.registriereHindernis({
          id: st.id,
          art: 'baum',
          form: 'kreis',
          x: st.x,
          z: st.z,
          radius: st.r,
          r: st.r,
          hoehe: 9.0 * (st.scale || 1.0)
        });
      }

      // Chalets
      var cList = stationen.bergdorf.chalets;
      for (var c = 0; c < cList.length; c++) {
        var ch = cList[c];
        EEP.kollision.registriereHindernis({
          id: ch.id,
          art: 'gebaeude',
          form: 'box',
          x: ch.x,
          z: ch.z,
          halbBreite: 5.0,
          halbTiefe: 4.2,
          halbLaenge: 4.2,
          hoehe: ch.turm ? 14.0 : 6.5,
          yaw: ch.yaw || 0
        });
      }
    }

    if (EEP.bus && typeof EEP.bus.on === 'function') {
      EEP.bus.on('tunnel-uebergang', function (ev) {
        zustand.transitionTimer = 1.4;
      });
    }

    zustand.initialisiert = true;
  }

  function setzeWetter(modus) {
    if (WETTER_DATEN[modus]) {
      zustand.wetterModus = modus;
      zustand.wetterTimer = 0.0;
      if (EEP.bus && typeof EEP.bus.emit === 'function') {
        EEP.bus.emit('schneewelt-wetter', { modus: modus, daten: WETTER_DATEN[modus] });
      }
      return true;
    }
    return false;
  }

  function naechstesWetter() {
    var modi = KONFIG.wetterModi;
    var idx = modi.indexOf(zustand.wetterModus);
    var nextIdx = (idx + 1) % modi.length;
    setzeWetter(modi[nextIdx]);
    return zustand.wetterModus;
  }

  function aktualisiere(dt, pos) {
    var deltaSec = Math.max(0.001, Math.min(dt || 0.016, 0.1));
    var pX = pos && typeof pos.x === 'number' ? pos.x : -240.0;
    var pZ = pos && typeof pos.z === 'number' ? pos.z : -790.0;

    // 1. Level-Transition Schwarzblende
    if (zustand.transitionTimer > 0) {
      zustand.transitionTimer = Math.max(0, zustand.transitionTimer - deltaSec);
    }
    var posAlpha = 0.0;
    if (pZ <= -715 && pZ >= -765 && Math.abs(pX - (-240.0)) <= 12.0) {
      posAlpha = Math.max(0, 1.0 - Math.abs(pZ - (-740.0)) / 25.0);
    }
    var timerAlpha = zustand.transitionTimer > 0 ? Math.sin((zustand.transitionTimer / 1.4) * Math.PI) : 0;
    zustand.transitionAlpha = Math.max(posAlpha, timerAlpha);

    // 2. inSchneewelt
    if (pZ < -790 && pX >= -420 && pX <= -80) {
      zustand.inSchneewelt = true;
    } else if (pZ >= -780) {
      zustand.inSchneewelt = false;
    }

    // 3. YouTube-Musik-Zustandsautomat (5w3rRFWzjcM)
    if (zustand.inSchneewelt) {
      if (zustand.musikStatus !== 'spielt' && zustand.musikStatus !== 'fadein') {
        zustand.musikStatus = 'fadein';
      }
      zustand.musikLautstaerke = Math.min(KONFIG.musikZielLautstaerke, zustand.musikLautstaerke + KONFIG.musikFadeInRate * deltaSec);
      if (zustand.musikLautstaerke >= KONFIG.musikZielLautstaerke) {
        zustand.musikStatus = 'spielt';
      }
      zustand.musikPositionSek = Math.round((zustand.musikPositionSek + deltaSec) * 1000) / 1000;
    } else {
      if (zustand.musikLautstaerke > 0.0) {
        zustand.musikStatus = 'fadeout';
        zustand.musikLautstaerke = Math.max(0.0, zustand.musikLautstaerke - KONFIG.musikFadeOutRate * deltaSec);
        if (zustand.musikLautstaerke > 0.01) {
          zustand.musikPositionSek = Math.round((zustand.musikPositionSek + deltaSec) * 1000) / 1000;
        } else {
          zustand.musikLautstaerke = 0.0;
          zustand.musikStatus = 'pausiert';
        }
      } else if (zustand.musikStatus === 'fadeout') {
        zustand.musikStatus = 'pausiert';
      }
    }

    // 4. Wetter-Timer
    if (zustand.inSchneewelt) {
      zustand.wetterTimer += deltaSec;
      if (zustand.wetterTimer >= 45.0) {
        naechstesWetter();
      }
    }

    return zustand;
  }

  function gibZustand() {
    return zustand;
  }

  EEP.schneewelt = {
    konfig: KONFIG,
    strassenHoehe: strassenHoehe,
    strassenPunkte: strassenPunkte,
    strassenLaenge: strassenDaten.laenge,
    abstandZurStrasse: abstandZurStrasse,
    hoehe: hoehe,
    schneeTannen: schneeTannen,
    gipfel: gipfel,
    stationen: stationen,
    wetterDaten: WETTER_DATEN,
    zustand: zustand,
    initialisiere: initialisiere,
    setzeWetter: setzeWetter,
    naechstesWetter: naechstesWetter,
    aktualisiere: aktualisiere,
    gibZustand: gibZustand
  };
})();
