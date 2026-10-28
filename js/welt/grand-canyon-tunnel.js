/* ============================================================================
 * js/welt/grand-canyon-tunnel.js – Reines Domänenmodul für den Grand-Canyon-Tunnel
 * (Reine Simulationslogik & Kollision ohne DOM- oder 3D-Renderer-Bindung)
 * ============================================================================ */
(function () {
  'use strict';

  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.grandCanyonTunnel = '1.0.0';

  var KONFIG = {
    xMitte: 286.0,
    zStart: 48.0,
    zEnde: 76.0,
    yBoden: 0.30,
    breite: 7.5,
    hoehe: 5.5,
    joche: [52.0, 58.0, 64.0, 70.0],
    portalNord: { x: 286.0, y: 0.30, z: 48.0 },
    portalSued: { x: 286.0, y: 0.30, z: 76.0 },
    palette: [
      '#6e3220', '#8f4127', '#a9532f', '#c0693d', '#9a4a2c',
      '#cf8752', '#dfa86f', '#b8603a', '#e9c79a', '#c47a4a'
    ]
  };

  var zustand = {
    initialisiert: false,
    fahrzeugeImTunnel: {}
  };

  function istImTunnel(x, z) {
    if (typeof x !== 'number' || typeof z !== 'number') return false;
    var xMin = KONFIG.xMitte - KONFIG.breite * 0.5;
    var xMax = KONFIG.xMitte + KONFIG.breite * 0.5;
    var zMin = Math.min(KONFIG.zStart, KONFIG.zEnde);
    var zMax = Math.max(KONFIG.zStart, KONFIG.zEnde);
    return (x >= xMin && x <= xMax && z >= zMin && z <= zMax);
  }

  function initialisiere() {
    if (zustand.initialisiert) return;
    zustand.initialisiert = true;

    // 1. Zone in EEP.welt registrieren
    if (EEP.welt && typeof EEP.welt.registriereZone === 'function') {
      EEP.welt.registriereZone({
        id: 'grand-canyon-tunnel-boden',
        name: 'Grand-Canyon-Tunnel',
        form: 'rechteck',
        kontinent: 'amerika',
        untergrund: 'schotter',
        prioritaet: 85,
        xMin: KONFIG.xMitte - KONFIG.breite * 0.5 - 1.0,
        xMax: KONFIG.xMitte + KONFIG.breite * 0.5 + 1.0,
        zMin: 34.0,
        zMax: KONFIG.zEnde,
        hoehe: KONFIG.yBoden
      });
    }

    // 2. Felswände links und rechts in EEP.kollision registrieren
    if (EEP.kollision && typeof EEP.kollision.registriereHindernis === 'function') {
      var halbeTiefe = (KONFIG.zEnde - KONFIG.zStart) * 0.5;
      var zMitte = (KONFIG.zStart + KONFIG.zEnde) * 0.5;

      // Westliche Felswand (Richtung Canyon-Schlucht)
      EEP.kollision.registriereHindernis({
        typ: 'box',
        name: 'canyon-tunnel-wand-west',
        x: KONFIG.xMitte - KONFIG.breite * 0.5 - 0.75,
        y: KONFIG.yBoden + 5.0,
        z: zMitte,
        halbBreite: 0.75,
        halbTiefe: halbeTiefe,
        hoehe: 18.0
      });

      // Östliche Felswand (Richtung Außenrand)
      EEP.kollision.registriereHindernis({
        typ: 'box',
        name: 'canyon-tunnel-wand-ost',
        x: KONFIG.xMitte + KONFIG.breite * 0.5 + 0.75,
        y: KONFIG.yBoden + 5.0,
        z: zMitte,
        halbBreite: 0.75,
        halbTiefe: halbeTiefe,
        hoehe: 18.0
      });
    }
  }

  function aktualisiere(dt, pos, id) {
    if (!pos) return false;
    var imTunnel = istImTunnel(pos.x, pos.z);
    if (id) {
      zustand.fahrzeugeImTunnel[id] = imTunnel;
    }
    return imTunnel;
  }

  EEP.grandCanyonTunnel = {
    konfig: KONFIG,
    zustand: zustand,
    istImTunnel: istImTunnel,
    initialisiere: initialisiere,
    aktualisiere: aktualisiere
  };
})();
