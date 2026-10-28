/* ============================================================================
 * js/welt/mexiko.js – Reines Domänenmodul für das Land MEXIKO (Paket N)
 * Strikte Einhaltung der Architekturregeln:
 * - 0 Zugriffe auf AFRAME, THREE oder document (vollkommen renderer-unabhängig)
 * - Pure mathematische Topographie, Zonen- & Kollisionsdaten
 * - Getestet über automatisierte Headless-Tests
 * ============================================================================ */
(function () {
  'use strict';

  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.mexiko = '1.0.0';

  var KONFIG = {
    grenzen: {
      xMin: 200.0,
      xMax: 385.0,
      zMin: 80.0,
      zMax: 260.0
    },
    bodenHoehe: 0.30,
    wasserSpiegel: 0.0,

    // Landmarken
    pyramidenStadt: {
      mitteX: 265.0,
      mitteZ: 155.0,
      breiteX: 30.0,
      tiefeZ: 35.0,
      basisHoehe: 0.30,
      pyramideGross: { x: 262.0, z: 150.0, basisB: 18.0, basisT: 18.0, hoehe: 14.0, stufen: 5 },
      pyramideKlein: { x: 274.0, z: 162.0, basisB: 12.0, basisT: 12.0, hoehe: 9.0, stufen: 4 }
    },

    bergMassiv: {
      mitteX: 300.0,
      mitteZ: 172.0,
      radiusX: 22.0,
      radiusZ: 25.0,
      gipfelHoehe: 32.0,
      fussHoehe: 0.30
    },

    waldNW: {
      xMin: 225.0,
      xMax: 285.0,
      zMin: 90.0,
      zMax: 135.0
    },

    vulkanPopo: {
      mitteX: 352.0,
      mitteZ: 124.0,
      radiusX: 26.0,
      radiusZ: 26.0,
      kraterHoehe: 45.0,
      kraterRadius: 5.5,
      fussHoehe: 0.30
    },

    felder: [
      { id: 'mais-nw', name: 'Maisfeld Nordwest', x: 236.0, z: 114.0, rx: 18.0, rz: 14.0 },
      { id: 'agaven-mitte', name: 'Zentrales Agavenfeld', x: 312.0, z: 125.0, rx: 16.0, rz: 14.0 },
      { id: 'getreide-ost', name: 'Ost-Tal-Feld', x: 362.0, z: 172.0, rx: 15.0, rz: 13.0 }
    ],

    straende: [
      { id: 'strand-sued', xMin: 225.0, xMax: 350.0, zMin: 238.0, zMax: 260.0 },
      { id: 'strand-ost', xMin: 362.0, xMax: 385.0, zMin: 185.0, zMax: 250.0 }
    ],

    hafen: {
      name: 'Puerto Pacífico',
      moleStart: { x: 362.0, z: 224.0 },
      moleEnde: { x: 382.0, z: 224.0 },
      breite: 6.0,
      deckHoehe: 0.65
    },

    pueblos: [
      { id: 'pueblo-ruinas', name: 'Pueblo de las Ruinas', x: 246.0, z: 168.0, radius: 16.0 },
      { id: 'pueblo-monte', name: 'San Pedro del Monte', x: 326.0, z: 176.0, radius: 15.0 },
      { id: 'pueblo-puerto', name: 'Villa del Mar', x: 356.0, z: 212.0, radius: 14.0 }
    ],

    bahenhoefe: [
      { id: 'bf-ruinas', name: 'Estación Ruinas', x: 252.0, y: 0.30, z: 144.0, rotY: 25 },
      { id: 'bf-monte', name: 'Estación El Monte', x: 298.0, y: 8.50, z: 196.0, rotY: -70 },
      { id: 'bf-vulkan', name: 'Estación Popocatépetl', x: 342.0, y: 1.20, z: 152.0, rotY: 45 },
      { id: 'bf-hafen', name: 'Estación Puerto Pacífico', x: 360.0, y: 0.40, z: 218.0, rotY: 0 }
    ],

    teleportMexiko: {
      x: 278.0,
      y: 0.35,
      z: 192.0,
      rotY: 15
    }
  };

  // Eisenbahnrundkurs 'el-chepe' Stützpunkte (geschlossene Schleife ca. 480 m)
  var BAHN_PUNKTE = [
    { x: 252.0, y: 0.30, z: 144.0 }, // Bf 1: Ruinas
    { x: 242.0, y: 0.30, z: 125.0 },
    { x: 246.0, y: 0.30, z: 104.0 },
    { x: 268.0, y: 0.30, z: 96.0 },
    { x: 294.0, y: 1.50, z: 110.0 },
    { x: 312.0, y: 3.50, z: 136.0 },
    { x: 304.0, y: 6.20, z: 165.0 },
    { x: 298.0, y: 8.50, z: 196.0 }, // Bf 2: El Monte (Hangstation)
    { x: 315.0, y: 5.40, z: 206.0 },
    { x: 334.0, y: 2.80, z: 192.0 },
    { x: 342.0, y: 1.20, z: 152.0 }, // Bf 3: Popocatépetl
    { x: 364.0, y: 0.80, z: 135.0 },
    { x: 374.0, y: 0.50, z: 160.0 },
    { x: 372.0, y: 0.40, z: 195.0 },
    { x: 360.0, y: 0.40, z: 218.0 }, // Bf 4: Puerto Pacífico
    { x: 336.0, y: 0.30, z: 232.0 },
    { x: 298.0, y: 0.30, z: 236.0 },
    { x: 268.0, y: 0.30, z: 220.0 },
    { x: 255.0, y: 0.30, z: 185.0 }
  ];

  var zustand = {
    initialisiert: false
  };

  function istInMexiko(x, z) {
    if (typeof x !== 'number' || typeof z !== 'number') return false;
    var g = KONFIG.grenzen;
    return (x >= g.xMin && x <= g.xMax && z >= g.zMin && z <= g.zMax);
  }

  // Mathematische Höhenfunktion für das mexikanische Terrain
  function getTerrainHeight(x, z) {
    if (!istInMexiko(x, z)) return KONFIG.bodenHoehe;

    var h = KONFIG.bodenHoehe;

    // 1. Vulkan Popocatépetl (hoher parabolischer Kegel)
    var v = KONFIG.vulkanPopo;
    var dxV = (x - v.mitteX) / v.radiusX;
    var dzV = (z - v.mitteZ) / v.radiusZ;
    var distV2 = dxV * dxV + dzV * dzV;
    if (distV2 < 1.0) {
      var d = Math.sqrt(distV2);
      // Krater-Absenkung in der Mitte
      if (d < (v.kraterRadius / v.radiusX)) {
        var kraterFaktor = d / (v.kraterRadius / v.radiusX);
        h = Math.max(h, v.kraterHoehe - 4.5 + 4.5 * kraterFaktor);
      } else {
        var faktor = Math.cos(d * Math.PI * 0.5);
        h = Math.max(h, v.fussHoehe + (v.kraterHoehe - v.fussHoehe) * Math.pow(faktor, 1.4));
      }
    }

    // 2. Zentrales Bergmassiv (felsiger Berg mit Graten)
    var b = KONFIG.bergMassiv;
    var dxB = (x - b.mitteX) / b.radiusX;
    var dzB = (z - b.mitteZ) / b.radiusZ;
    var distB2 = dxB * dxB + dzB * dzB;
    if (distB2 < 1.0) {
      var dB = Math.sqrt(distB2);
      var bergFaktor = Math.cos(dB * Math.PI * 0.5);
      // Grat-Variation
      var grat = 0.85 + 0.15 * Math.sin(dxB * 5.0) * Math.cos(dzB * 4.0);
      h = Math.max(h, b.fussHoehe + (b.gipfelHoehe - b.fussHoehe) * Math.pow(bergFaktor, 1.2) * grat);
    }

    // 3. Nordwest-Wald (leichtes Hügelland)
    var w = KONFIG.waldNW;
    if (x >= w.xMin && x <= w.xMax && z >= w.zMin && z <= w.zMax) {
      var huegel = Math.sin((x - w.xMin) * 0.12) * Math.cos((z - w.zMin) * 0.10);
      h = Math.max(h, KONFIG.bodenHoehe + Math.max(0, huegel * 2.8));
    }

    // 4. Pyramiden-Terrassenstufen
    var pG = KONFIG.pyramidenStadt.pyramideGross;
    var dxPG = Math.abs(x - pG.x);
    var dzPG = Math.abs(z - pG.z);
    var halbeB = pG.basisB * 0.5;
    var halbeT = pG.basisT * 0.5;
    if (dxPG < halbeB && dzPG < halbeT) {
      var relAbstand = Math.max(dxPG / halbeB, dzPG / halbeT);
      var stufe = Math.floor((1.0 - relAbstand) * pG.stufen);
      var stufenHoehe = (pG.hoehe / pG.stufen) * Math.max(0, Math.min(stufe, pG.stufen));
      h = Math.max(h, pG.basisHoehe || KONFIG.bodenHoehe + stufenHoehe);
    }

    return h;
  }

  // Zonenabfrage für Untergrund-Physik
  function abfrageZone(x, z) {
    if (!istInMexiko(x, z)) {
      return { inMexiko: false, untergrund: 'wasser', hoehe: 0.0 };
    }

    var h = getTerrainHeight(x, z);

    // Strände
    for (var i = 0; i < KONFIG.straende.length; i++) {
      var s = KONFIG.straende[i];
      if (x >= s.xMin && x <= s.xMax && z >= s.zMin && z <= s.zMax) {
        return { inMexiko: true, zoneId: s.id, untergrund: 'sand', hoehe: h, kontinent: 'mexiko' };
      }
    }

    // Vulkan
    var v = KONFIG.vulkanPopo;
    var dxV = (x - v.mitteX) / v.radiusX;
    var dzV = (z - v.mitteZ) / v.radiusZ;
    if (dxV * dxV + dzV * dzV < 0.85) {
      return { inMexiko: true, zoneId: 'vulkan-popocatepetl', untergrund: 'fels', hoehe: h, kontinent: 'mexiko' };
    }

    // Bergmassiv
    var b = KONFIG.bergMassiv;
    var dxB = (x - b.mitteX) / b.radiusX;
    var dzB = (z - b.mitteZ) / b.radiusZ;
    if (dxB * dxB + dzB * dzB < 0.80) {
      return { inMexiko: true, zoneId: 'bergmassiv', untergrund: 'fels', hoehe: h, kontinent: 'mexiko' };
    }

    // Felder
    for (var j = 0; j < KONFIG.felder.length; j++) {
      var f = KONFIG.felder[j];
      var dxF = (x - f.x) / f.rx;
      var dzF = (z - f.z) / f.rz;
      if (dxF * dxF + dzF * dzF <= 1.0) {
        return { inMexiko: true, zoneId: f.id, untergrund: 'erde', hoehe: h, kontinent: 'mexiko' };
      }
    }

    // Wald
    var w = KONFIG.waldNW;
    if (x >= w.xMin && x <= w.xMax && z >= w.zMin && z <= w.zMax) {
      return { inMexiko: true, zoneId: 'wald-nw', untergrund: 'erde', hoehe: h, kontinent: 'mexiko' };
    }

    // Pyramidenstadt
    var p = KONFIG.pyramidenStadt;
    if (Math.abs(x - p.mitteX) <= p.breiteX * 0.5 && Math.abs(z - p.mitteZ) <= p.tiefeZ * 0.5) {
      return { inMexiko: true, zoneId: 'pyramiden-plaza', untergrund: 'schotter', hoehe: h, kontinent: 'mexiko' };
    }

    // Standardlandmasse Wiese
    return { inMexiko: true, zoneId: 'mexiko-wiese', untergrund: 'gras', hoehe: h, kontinent: 'mexiko' };
  }

  function initialisiere() {
    if (zustand.initialisiert) return;
    zustand.initialisiert = true;

    // 1. Zonen in EEP.welt registrieren (sofern EEP.welt verfügbar)
    if (EEP.welt && typeof EEP.welt.registriereZone === 'function') {
      // Gesamtkontinent Mexiko
      EEP.welt.registriereZone({
        id: 'kontinent-mexiko',
        name: 'Mexiko',
        form: 'rechteck',
        kontinent: 'mexiko',
        untergrund: 'gras',
        prioritaet: 15,
        minX: KONFIG.grenzen.xMin,
        maxX: KONFIG.grenzen.xMax,
        minZ: KONFIG.grenzen.zMin,
        maxZ: KONFIG.grenzen.zMax,
        hoeheFn: getTerrainHeight
      }, true);

      // Strände Süd & Ost
      EEP.welt.registriereZone({
        id: 'mexiko-strand-sued',
        name: 'Mexiko Südstrand',
        kontinent: 'mexiko',
        untergrund: 'sand',
        prioritaet: 25,
        minX: KONFIG.straende[0].xMin,
        maxX: KONFIG.straende[0].xMax,
        minZ: KONFIG.straende[0].zMin,
        maxZ: KONFIG.straende[0].zMax,
        hoehe: 0.22
      }, true);

      EEP.welt.registriereZone({
        id: 'mexiko-strand-ost',
        name: 'Mexiko Oststrand',
        kontinent: 'mexiko',
        untergrund: 'sand',
        prioritaet: 25,
        minX: KONFIG.straende[1].xMin,
        maxX: KONFIG.straende[1].xMax,
        minZ: KONFIG.straende[1].zMin,
        maxZ: KONFIG.straende[1].zMax,
        hoehe: 0.22
      }, true);

      // Wald NW
      EEP.welt.registriereZone({
        id: 'mexiko-wald-nw',
        name: 'Dichter Bergwald Nordwest',
        kontinent: 'mexiko',
        untergrund: 'erde',
        prioritaet: 28,
        minX: KONFIG.waldNW.xMin,
        maxX: KONFIG.waldNW.xMax,
        minZ: KONFIG.waldNW.zMin,
        maxZ: KONFIG.waldNW.zMax,
        hoeheFn: getTerrainHeight
      }, true);

      // Bergmassiv
      EEP.welt.registriereZone({
        id: 'mexiko-bergmassiv',
        name: 'Zentrales Bergmassiv',
        kontinent: 'mexiko',
        untergrund: 'fels',
        prioritaet: 32,
        minX: KONFIG.bergMassiv.mitteX - KONFIG.bergMassiv.radiusX,
        maxX: KONFIG.bergMassiv.mitteX + KONFIG.bergMassiv.radiusX,
        minZ: KONFIG.bergMassiv.mitteZ - KONFIG.bergMassiv.radiusZ,
        maxZ: KONFIG.bergMassiv.mitteZ + KONFIG.bergMassiv.radiusZ,
        hoeheFn: getTerrainHeight
      }, true);

      // Vulkan Popocatépetl
      EEP.welt.registriereZone({
        id: 'mexiko-vulkan',
        name: 'Vulkan Popocatépetl',
        kontinent: 'mexiko',
        untergrund: 'fels',
        prioritaet: 35,
        minX: KONFIG.vulkanPopo.mitteX - KONFIG.vulkanPopo.radiusX,
        maxX: KONFIG.vulkanPopo.mitteX + KONFIG.vulkanPopo.radiusX,
        minZ: KONFIG.vulkanPopo.mitteZ - KONFIG.vulkanPopo.radiusZ,
        maxZ: KONFIG.vulkanPopo.mitteZ + KONFIG.vulkanPopo.radiusZ,
        hoeheFn: getTerrainHeight
      }, true);
    }

    // 2. Feste Hindernisse in EEP.kollision registrieren
    if (EEP.kollision && typeof EEP.kollision.registriereHindernis === 'function') {
      // Große Stufenpyramide
      var pG = KONFIG.pyramidenStadt.pyramideGross;
      EEP.kollision.registriereHindernis({
        id: 'pyramide-gross-kern',
        typ: 'quader',
        x: pG.x,
        y: 5.0,
        z: pG.z,
        halbBreite: 7.0,
        halbHoehe: 5.0,
        halbLaenge: 7.0,
        name: 'Große Pyramide (Kern)'
      });

      // Kleine Stufenpyramide
      var pK = KONFIG.pyramidenStadt.pyramideKlein;
      EEP.kollision.registriereHindernis({
        id: 'pyramide-klein-kern',
        typ: 'quader',
        x: pK.x,
        y: 3.5,
        z: pK.z,
        halbBreite: 4.5,
        halbHoehe: 3.5,
        halbLaenge: 4.5,
        name: 'Kleine Pyramide (Kern)'
      });

      // Hafenmole Puerto Pacífico
      var hf = KONFIG.hafen;
      EEP.kollision.registriereHindernis({
        id: 'hafen-kollision-begrenzung',
        typ: 'quader',
        x: (hf.moleStart.x + hf.moleEnde.x) * 0.5,
        y: 0.3,
        z: hf.moleStart.z - hf.breite * 0.5 - 0.5,
        halbBreite: (hf.moleEnde.x - hf.moleStart.x) * 0.5,
        halbHoehe: 0.8,
        halbLaenge: 0.5,
        name: 'Hafenmole Begrenzung'
      });
    }
  }

  // Exportiertes API-Objekt
  EEP.mexiko = {
    konfig: KONFIG,
    bahnPunkte: BAHN_PUNKTE,
    istInMexiko: istInMexiko,
    getTerrainHeight: getTerrainHeight,
    abfrageZone: abfrageZone,
    initialisiere: initialisiere
  };

  // Automatische Vor-Initialisierung
  initialisiere();
})();
