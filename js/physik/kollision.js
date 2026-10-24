/* ============================================================================
 * js/physik/kollision.js – Paket A: Spatial-Hash Kollisions-Grid (OBB & Kreis in 2D + Höhe)
 * WICHTIG: A-Frame-frei, DOM-frei, THREE-frei (reines JavaScript).
 * ============================================================================ */
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.kollision = '1.0.0';

  var ZELL_GROESSE = 8.0; // 8-m-Zellen gemäß s-world-collisions-003
  var hindernisse = [];
  var hindernisById = {};
  var zellen = {};
  var nextHindernisNum = 1;

  function zelleKey(cx, cz) {
    return cx + ':' + cz;
  }

  function berechneAABB(h) {
    if (h.form === 'kreis') {
      var r = h.radius || 0.5;
      h.minX = h.x - r;
      h.maxX = h.x + r;
      h.minZ = h.z - r;
      h.maxZ = h.z + r;
    } else {
      var hb = h.halbBreite || 1.0;
      var hl = h.halbTiefe || h.halbLaenge || 1.0;
      var yaw = h.yaw || 0;
      var c = Math.abs(Math.cos(yaw));
      var s = Math.abs(Math.sin(yaw));
      var ex = hb * c + hl * s;
      var ez = hb * s + hl * c;
      h.minX = h.x - ex;
      h.maxX = h.x + ex;
      h.minZ = h.z - ez;
      h.maxZ = h.z + ez;
    }
  }

  function trageInZellenEin(h) {
    berechneAABB(h);
    var cx0 = Math.floor(h.minX / ZELL_GROESSE);
    var cx1 = Math.floor(h.maxX / ZELL_GROESSE);
    var cz0 = Math.floor(h.minZ / ZELL_GROESSE);
    var cz1 = Math.floor(h.maxZ / ZELL_GROESSE);
    for (var cx = cx0; cx <= cx1; cx++) {
      for (var cz = cz0; cz <= cz1; cz++) {
        var k = zelleKey(cx, cz);
        if (!zellen[k]) zellen[k] = [];
        zellen[k].push(h);
      }
    }
  }

  function baueGridNeu() {
    zellen = {};
    for (var i = 0; i < hindernisse.length; i++) {
      trageInZellenEin(hindernisse[i]);
    }
  }

  // --------------------------------------------------------------------------
  // 1. Geometrische Schnitt-Tests (Kreis-Kreis, Kreis-OBB, OBB-OBB / SAT)
  // --------------------------------------------------------------------------
  function schnittKreisKreis(ax, az, ar, bx, bz, br) {
    var dx = ax - bx;
    var dz = az - bz;
    var d2 = dx * dx + dz * dz;
    var rSum = ar + br;
    if (d2 >= rSum * rSum) return null;
    var d = Math.sqrt(d2);
    var nx = d > 1e-5 ? (dx / d) : 0;
    var nz = d > 1e-5 ? (dz / d) : 1;
    return {
      normalX: nx,
      normalZ: nz,
      eindringtiefe: rSum - d
    };
  }

  // Kreis (ax, az, ar) gegen gedrehte Box (bx, bz, hb, hl, byaw)
  // Normale zeigt von der Box zum Kreis (Herausschieberichtung für A)
  function schnittKreisBox(ax, az, ar, bx, bz, hb, hl, byaw) {
    var dx = ax - bx;
    var dz = az - bz;
    var c = Math.cos(byaw);
    var s = Math.sin(byaw);
    var lx = dx * c - dz * s;
    var lz = dx * s + dz * c;

    var cx = Math.max(-hb, Math.min(hb, lx));
    var cz = Math.max(-hl, Math.min(hl, lz));
    var ex = lx - cx;
    var ez = lz - cz;
    var d2 = ex * ex + ez * ez;

    if (d2 > ar * ar) return null;

    var lnx = 0, lnz = 0, tiefe = 0;
    if (d2 > 1e-6) {
      var d = Math.sqrt(d2);
      lnx = ex / d;
      lnz = ez / d;
      tiefe = ar - d;
    } else {
      // Kreismittelpunkt liegt innerhalb der Box -> kürzester Weg zur Kante
      var penX = hb - Math.abs(lx);
      var penZ = hl - Math.abs(lz);
      if (penX < penZ) {
        lnx = lx >= 0 ? 1 : -1;
        lnz = 0;
        tiefe = penX + ar;
      } else {
        lnx = 0;
        lnz = lz >= 0 ? 1 : -1;
        tiefe = penZ + ar;
      }
    }

    var cw = Math.cos(byaw);
    var sw = Math.sin(byaw);
    return {
      normalX: lnx * cw + lnz * sw,
      normalZ: -lnx * sw + lnz * cw,
      eindringtiefe: tiefe
    };
  }

  // OBB A gegen OBB B per Separating Axis Theorem (SAT) in 2D
  function schnittBoxBox(ax, az, ahb, ahl, ayaw, bx, bz, bhb, bhl, byaw) {
    var ac = Math.cos(ayaw), as = Math.sin(ayaw);
    var bc = Math.cos(byaw), bs = Math.sin(byaw);

    // 4 Achsen (2 von A, 2 von B)
    var achsen = [
      { x: ac,  z: -as },
      { x: as,  z: ac },
      { x: bc,  z: -bs },
      { x: bs,  z: bc }
    ];

    var dx = ax - bx;
    var dz = az - bz;
    var minTiefe = Infinity;
    var bestNx = 0, bestNz = 1;

    for (var i = 0; i < 4; i++) {
      var ux = achsen[i].x;
      var uz = achsen[i].z;

      var ra = ahb * Math.abs(ux * ac - uz * as) + ahl * Math.abs(ux * as + uz * ac);
      var rb = bhb * Math.abs(ux * bc - uz * bs) + bhl * Math.abs(ux * bs + uz * bc);
      var distProj = dx * ux + dz * uz;
      var overlap = (ra + rb) - Math.abs(distProj);
      if (overlap <= 0) return null;

      if (overlap < minTiefe) {
        minTiefe = overlap;
        var sign = distProj >= 0 ? 1 : -1;
        bestNx = ux * sign;
        bestNz = uz * sign;
      }
    }

    return {
      normalX: bestNx,
      normalZ: bestNz,
      eindringtiefe: minTiefe
    };
  }

  function pruefePaar(koerper, h) {
    // Hindernisse < 0.25 m Höhe blockieren nicht (s-world-collisions-003)
    var hHoehe = typeof h.hoehe === 'number' ? h.hoehe : 3.0;
    if (hHoehe < 0.25) return null;

    var kForm = (koerper.typ === 'lara' || koerper.form === 'kreis') ? 'kreis' : 'box';
    var kr = koerper.radius || Math.max(koerper.halbBreite || 0.35, koerper.halbLaenge || 0.35);
    var khb = koerper.halbBreite || 0.95;
    var khl = koerper.halbLaenge || 2.35;
    var kyaw = koerper.yaw || 0;

    var kontakt = null;
    if (kForm === 'kreis' && h.form === 'kreis') {
      kontakt = schnittKreisKreis(koerper.x, koerper.z, kr, h.x, h.z, h.radius || 0.5);
    } else if (kForm === 'kreis' && h.form !== 'kreis') {
      kontakt = schnittKreisBox(koerper.x, koerper.z, kr, h.x, h.z, h.halbBreite || 1, h.halbTiefe || 1, h.yaw || 0);
    } else if (kForm !== 'kreis' && h.form === 'kreis') {
      var umgekehrt = schnittKreisBox(h.x, h.z, h.radius || 0.5, koerper.x, koerper.z, khb, khl, kyaw);
      if (umgekehrt) {
        kontakt = {
          normalX: -umgekehrt.normalX,
          normalZ: -umgekehrt.normalZ,
          eindringtiefe: umgekehrt.eindringtiefe
        };
      }
    } else {
      kontakt = schnittBoxBox(koerper.x, koerper.z, khb, khl, kyaw, h.x, h.z, h.halbBreite || 1, h.halbTiefe || 1, h.yaw || 0);
    }

    if (!kontakt) return null;

    // Vorwärts-Geschwindigkeitsvektor des Körpers (lokal -Z ist vorwärts bei yaw=0)
    var v = koerper.v || 0;
    var fwdX = -Math.sin(kyaw);
    var fwdZ = -Math.cos(kyaw);
    var vx = typeof koerper.vx === 'number' ? koerper.vx : (fwdX * v);
    var vz = typeof koerper.vz === 'number' ? koerper.vz : (fwdZ * v);

    // Relativgeschwindigkeit auf das Hindernis zu (entlang -Normal)
    var hvx = h.vx || 0;
    var hvz = h.vz || 0;
    var relVx = vx - hvx;
    var relVz = vz - hvz;
    var vAufHindernis = -(relVx * kontakt.normalX + relVz * kontakt.normalZ);
    var vImpact = Math.max(0, vAufHindernis);
    if (vImpact < 0.01 && Math.abs(v) > 0.1) {
      vImpact = Math.abs(v);
    }

    return {
      hindernisId: h.id,
      art: h.art || 'hindernis',
      normalX: kontakt.normalX,
      normalZ: kontakt.normalZ,
      eindringtiefe: kontakt.eindringtiefe,
      vImpact: vImpact
    };
  }

  // --------------------------------------------------------------------------
  // 2. Standard-Hindernisse aus welt.html vorab registrieren
  // --------------------------------------------------------------------------
  function registriereStandardHindernisse() {
    hindernisse = [];
    hindernisById = {};
    nextHindernisNum = 1;

    function addBox(id, art, x, z, b, t, hoehe, yawDeg) {
      EEP.kollision.registriereHindernis({
        id: id,
        art: art,
        form: 'box',
        x: x,
        z: z,
        halbBreite: b / 2,
        halbTiefe: t / 2,
        hoehe: hoehe || 4.0,
        yaw: ((yawDeg || 0) * Math.PI) / 180
      }, true);
    }

    function addKreis(id, art, x, z, radius, hoehe) {
      EEP.kollision.registriereHindernis({
        id: id,
        art: art,
        form: 'kreis',
        x: x,
        z: z,
        radius: radius,
        hoehe: hoehe || 5.0
      }, true);
    }

    // 1. Die 3 Wohnhäuser (ki-haus: 3.6 x 3.2 m, 2 Etagen = 4.8 m)
    addBox('haus-de', 'haus', -242, -58, 3.6, 3.2, 5.2, -20);
    addBox('haus-us', 'haus', 292, -36, 3.6, 3.2, 5.2, -35);
    addBox('haus-af', 'haus', 178, 135, 3.6, 3.2, 5.2, -45);

    // 2. Die 3 Bahnhöfe (ki-bahnhof Hauptgebäude: 7.5 x 2.8 m, Offset -0.4 lokal)
    addBox('bahnhof-de', 'bahnhof', -258, -22, 7.5, 2.8, 5.0, -95);
    addBox('bahnhof-us', 'bahnhof', 298, -42, 7.5, 2.8, 5.0, -135);
    addBox('bahnhof-af', 'bahnhof', 148, 173, 7.5, 2.8, 5.0, 12);

    // 3. New York Wolkenkratzer (ki-wolkenkratzer)
    addBox('ny-turm-1', 'wolkenkratzer', 302, -62, 6.5, 6.5, 30, 0);
    addBox('ny-turm-2', 'wolkenkratzer', 312, -58, 5.8, 5.8, 24, 0);
    addBox('ny-turm-3', 'wolkenkratzer', 294, -56, 5.2, 5.2, 20, 0);
    addBox('ny-turm-4', 'wolkenkratzer', 318, -48, 6.0, 5.5, 26, 0);

    // 4. Flughäfen (Terminal + Tower für DE, USA, Ägypten)
    var airports = [
      { prefix: 'ap-de', cx: -312, cz: -6,  len: 52, side: -1 },
      { prefix: 'ap-us', cx: 306,  cz: 14,  len: 58, side: 1 },
      { prefix: 'ap-af', cx: 68,   cz: 190, len: 48, side: -1 }
    ];
    for (var a = 0; a < airports.length; a++) {
      var ap = airports[a];
      addBox(ap.prefix + '-terminal', 'terminal', ap.cx + ap.side * 16.5, ap.cz - 1, 7.5, ap.len * 0.55, 4.6, 0);
      var towerZ = ap.side < 0 ? (-ap.len * 0.44) : (ap.len * 0.44);
      addKreis(ap.prefix + '-tower', 'tower', ap.cx + ap.side * 14, ap.cz + towerZ, 1.5, 13.0);
    }

    // 5. Pyramiden von Gizeh + Tempelportal bei (146, 212)
    // Cone mit 4 Segmenten um 45° gedreht -> Kantenlänge = r * sqrt(2)
    addBox('pyramide-cheops',   'pyramide', 146,       212,      21.8, 21.8, 21.5, 0);
    addBox('pyramide-chefren',  'pyramide', 146 - 19,  212 + 7,  18.4, 18.4, 18.0, 0);
    addBox('pyramide-mykerinos','pyramide', 146 + 17,  212 + 9,  12.7, 12.7, 12.0, 0);
    addBox('pyramide-pylon-l',  'tempel',   146 - 2.4, 212 - 12.2, 2.6, 2.2, 5.2, 0);
    addBox('pyramide-pylon-r',  'tempel',   146 + 2.4, 212 - 12.2, 2.6, 2.2, 5.2, 0);

    // 6. Alle Bäume (Kreis r = 0.35 * Modell-Scale gemäß s-world-collisions-003)
    var baeume = [
      { id: 'baum-insel-1', x: 135,  z: -22, s: 2.2 },
      { id: 'baum-insel-2', x: 118,  z: 10,  s: 2.2 },
      { id: 'baum-de-fluss', x: -231, z: 10, s: 1.8 },
      { id: 'baum-de-1',    x: -325, z: 36,  s: 3.2 },
      { id: 'baum-de-2',    x: -318, z: 38,  s: 3.5 },
      { id: 'baum-de-3',    x: -310, z: 37,  s: 3.0 },
      { id: 'baum-de-4',    x: -302, z: 38,  s: 3.4 },
      { id: 'baum-de-5',    x: -295, z: 36,  s: 3.2 },
      { id: 'palme-af-1',   x: 38,   z: 168, s: 3.4 },
      { id: 'palme-af-2',   x: 98,   z: 152, s: 3.4 },
      { id: 'palme-af-3',   x: 128,  z: 148, s: 3.8 },
      { id: 'palme-af-4',   x: 168,  z: 150, s: 4.2 }
    ];
    for (var b = 0; b < baeume.length; b++) {
      var bm = baeume[b];
      addKreis(bm.id, 'baum', bm.x, bm.z, 0.35 * bm.s, bm.s * 3.0);
    }

    // 7. Hafen- & Kaimauern (DE, USA, Ägypten)
    // Hafen DE
    addBox('kai-de-haupt', 'kaimauer', -262, 45, 32,  4.5, 0.8, 0);
    addBox('kai-de-west',  'kaimauer', -276, 50, 4.5, 14,  0.8, 0);
    addBox('kai-de-ost',   'kaimauer', -248, 50, 4.5, 14,  0.8, 0);
    // Hafen USA
    addBox('kai-us-haupt', 'kaimauer', 225, -36, 5.0, 28,  0.8, 0);
    addBox('kai-us-pier1', 'kaimauer', 218, -46, 12,  3.5, 0.8, 0);
    addBox('kai-us-pier2', 'kaimauer', 218, -36, 12,  3.5, 0.8, 0);
    addBox('kai-us-pier3', 'kaimauer', 218, -26, 12,  3.5, 0.8, 0);
    // Hafen Ägypten
    addBox('kai-af-haupt', 'kaimauer', 156, 118, 28,  4.2, 0.85, 0);
    addBox('kai-af-pier1', 'kaimauer', 144, 113, 4.0, 12,  0.85, 0);
    addBox('kai-af-pier2', 'kaimauer', 156, 112, 4.0, 14,  0.85, 0);
    addBox('kai-af-pier3', 'kaimauer', 168, 113, 4.0, 12,  0.85, 0);

    // 8. Schild & geparktes Küsten-Auto in Ägypten
    addBox('schild-af-strasse', 'schild', 162, 146, 1.2, 0.3, 3.2, 0);
    addBox('auto-af-deko', 'fahrzeug', 134, 124, 1.8, 3.8, 1.4, 90);

    // 9. Leitpfosten entlang der Alpen-Pass-Teststrecke (d-world-collisions-004: alle 4 m links & rechts)
    for (var pz = -60; pz >= -84; pz -= 4) {
      addKreis('leitpfosten-l-' + Math.abs(pz), 'leitpfosten', -256.15, pz, 0.10, 0.9);
      addKreis('leitpfosten-r-' + Math.abs(pz), 'leitpfosten', -251.85, pz, 0.10, 0.9);
    }

    baueGridNeu();
  }

  // --------------------------------------------------------------------------
  // 3. Öffentliche API (EEP.kollision)
  // --------------------------------------------------------------------------
  EEP.kollision = {
    hindernisse: hindernisse,

    registriereHindernis: function (h, ohneRebuild) {
      if (!h) return null;
      var id = h.id || ('hindernis-' + (nextHindernisNum++));
      h.id = id;
      h.form = h.form || 'box';
      h.hoehe = typeof h.hoehe === 'number' ? h.hoehe : 3.0;
      if (hindernisById[id]) {
        var altIdx = hindernisse.indexOf(hindernisById[id]);
        if (altIdx !== -1) hindernisse.splice(altIdx, 1);
      }
      hindernisse.push(h);
      hindernisById[id] = h;
      if (!ohneRebuild) {
        trageInZellenEin(h);
      }
      return id;
    },

    entferneHindernis: function (id) {
      var h = hindernisById[id];
      if (!h) return false;
      var idx = hindernisse.indexOf(h);
      if (idx !== -1) hindernisse.splice(idx, 1);
      delete hindernisById[id];
      baueGridNeu();
      return true;
    },

    anzahl: function () {
      return hindernisse.length;
    },

    pruefe: function (koerper) {
      if (!koerper) return null;
      var rMax = Math.max(koerper.radius || 0.5, (koerper.halbBreite || 1) + (koerper.halbLaenge || 2.5));
      var cx0 = Math.floor((koerper.x - rMax) / ZELL_GROESSE);
      var cx1 = Math.floor((koerper.x + rMax) / ZELL_GROESSE);
      var cz0 = Math.floor((koerper.z - rMax) / ZELL_GROESSE);
      var cz1 = Math.floor((koerper.z + rMax) / ZELL_GROESSE);

      var geprueft = {};
      var tiefsterTreffer = null;

      for (var cx = cx0; cx <= cx1; cx++) {
        for (var cz = cz0; cz <= cz1; cz++) {
          var liste = zellen[zelleKey(cx, cz)];
          if (!liste) continue;
          for (var i = 0; i < liste.length; i++) {
            var h = liste[i];
            if (geprueft[h.id] || h.id === koerper.id) continue;
            geprueft[h.id] = true;
            var res = pruefePaar(koerper, h);
            if (res && (!tiefsterTreffer || res.eindringtiefe > tiefsterTreffer.eindringtiefe)) {
              tiefsterTreffer = res;
            }
          }
        }
      }

      // Bewegliche Körper aus EEP.sim gegeneinander prüfen (s-world-collisions-003)
      if (EEP.sim && typeof EEP.sim.alle === 'function') {
        var alleKoerper = EEP.sim.alle();
        for (var k = 0; k < alleKoerper.length; k++) {
          var anderer = alleKoerper[k];
          if (!anderer || anderer.id === koerper.id || anderer.entfernt) continue;
          var dx = koerper.x - anderer.x;
          var dz = koerper.z - anderer.z;
          if (dx * dx + dz * dz > 400) continue; // > 20 m entfernt

          var dynH = {
            id: anderer.id,
            art: anderer.typ || 'fahrzeug',
            form: anderer.typ === 'lara' ? 'kreis' : 'box',
            x: anderer.x,
            z: anderer.z,
            radius: anderer.radius || 0.35,
            halbBreite: anderer.halbBreite || 0.95,
            halbTiefe: anderer.halbLaenge || 2.35,
            hoehe: anderer.hoehe || 1.9,
            yaw: anderer.yaw || 0,
            vx: -Math.sin(anderer.yaw || 0) * (anderer.v || 0),
            vz: -Math.cos(anderer.yaw || 0) * (anderer.v || 0)
          };
          var dynRes = pruefePaar(koerper, dynH);
          if (dynRes && (!tiefsterTreffer || dynRes.eindringtiefe > tiefsterTreffer.eindringtiefe)) {
            dynRes.istBeweglicherKoerper = true;
            tiefsterTreffer = dynRes;
          }
        }
      }

      return tiefsterTreffer;
    },

    resetStandard: function () {
      registriereStandardHindernisse();
    }
  };

  EEP.kollision.resetStandard();
})();
