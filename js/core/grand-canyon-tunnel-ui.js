/* ============================================================================
 * js/core/grand-canyon-tunnel-ui.js – 3D-Darstellung des Grand-Canyon-Felsentunnels
 * (Holzjoche, Grubenlaternen, Portale, Sound & Selbsttest ?canyontest=1)
 * ============================================================================ */
(function () {
  'use strict';

  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.grandCanyonTunnelUI = '1.0.0';

  var state = {
    initialisiert: false,
    weltGruppe: null,
    audioCtx: null,
    audioGain: null,
    laternenLichter: []
  };

  function addMesh(p, geo, mat, x, y, z, rx, ry, rz) {
    var m = new THREE.Mesh(geo, mat);
    if (typeof x === 'number') m.position.set(x, y || 0, z || 0);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    p.add(m);
    return m;
  }

  // --------------------------------------------------------------------------
  // 1. Audio-Effekt (Fels-Hohlraumklang)
  // --------------------------------------------------------------------------
  function initialisiereAudio() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = EEP.audioCtx || (EEP.audioCtx = new AC());
      state.audioCtx = ctx;

      var gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(ctx.destination);

      var osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.value = 58.0;
      var osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 87.0;

      var subGain = ctx.createGain();
      subGain.gain.value = 0.035;
      osc1.connect(subGain);
      osc2.connect(subGain);
      subGain.connect(gain);

      osc1.start();
      osc2.start();
      state.audioGain = gain;
    } catch (e) {}
  }

  function aktualisiereAudio(imTunnel) {
    if (!state.audioGain || !state.audioCtx) return;
    try {
      var ziel = imTunnel ? 0.05 : 0.0001;
      state.audioGain.gain.setTargetAtTime(ziel, state.audioCtx.currentTime, 0.25);
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // 2. 3D-Aufbau: Felsgewölbe, Holzjoche, Grubenlaternen & Portale
  // --------------------------------------------------------------------------
  function baueCanyonTunnel(sceneEl) {
    if (!EEP.grandCanyonTunnel) return;
    var gc = EEP.grandCanyonTunnel;
    gc.initialisiere();

    var entity = document.getElementById('grand-canyon-tunnel-welt');
    if (!entity) {
      entity = document.createElement('a-entity');
      entity.id = 'grand-canyon-tunnel-welt';
      sceneEl.appendChild(entity);
    }

    var group = new THREE.Group();
    state.weltGruppe = group;

    var felsFarben = [0xa9532f, 0xc0693d, 0x9a4a2c, 0xcf8752];
    var felsMat = new THREE.MeshStandardMaterial({
      color: 0x9a4a2c,
      roughness: 0.92,
      metalness: 0.05,
      side: THREE.DoubleSide
    });
    var felsDunkelMat = new THREE.MeshStandardMaterial({
      color: 0x6e3220,
      roughness: 0.95,
      side: THREE.DoubleSide
    });
    var holzMat = new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.85
    });
    var holzHellMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.80
    });
    var laternMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.2
    });
    var metallMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.4,
      metalness: 0.8
    });
    var schotterMat = new THREE.MeshStandardMaterial({
      color: 0x52433d,
      roughness: 0.95
    });

    var xM = gc.konfig.xMitte;
    var zS = gc.konfig.zStart;
    var zE = gc.konfig.zEnde;
    var laenge = zE - zS;
    var zM = (zS + zE) * 0.5;
    var yB = gc.konfig.yBoden;
    var b = gc.konfig.breite;
    var h = gc.konfig.hoehe;

    // 1. Fahrbahnboden / Schotterbett
    addMesh(group, new THREE.BoxGeometry(b, 0.2, laenge), schotterMat, xM, yB - 0.05, zM);

    // 2. Felsgewölbe des Tunnels (Halbzylinder / Tonnengewölbe)
    var gewGeo = new THREE.CylinderGeometry(b * 0.5, b * 0.5, laenge, 18, 1, true, 0, Math.PI);
    gewGeo.rotateZ(Math.PI / 2);
    gewGeo.rotateY(Math.PI / 2);
    addMesh(group, gewGeo, felsMat, xM, yB + h * 0.5, zM);

    // Seitenwände bis zum Gewölbeansatz
    addMesh(group, new THREE.BoxGeometry(0.4, h * 0.5, laenge), felsDunkelMat, xM - b * 0.5 + 0.2, yB + h * 0.25, zM);
    addMesh(group, new THREE.BoxGeometry(0.4, h * 0.5, laenge), felsDunkelMat, xM + b * 0.5 - 0.2, yB + h * 0.25, zM);

    // Felsüberdeckung über dem Tunnel (Mesa-Block, der den Berg formt)
    addMesh(group, new THREE.BoxGeometry(b + 4.0, 6.0, laenge), felsMat, xM, yB + h + 2.5, zM);

    // 3. Holzjoche & Grubenlaternen
    for (var ji = 0; ji < gc.konfig.joche.length; ji++) {
      var jZ = gc.konfig.joche[ji];
      var jg = new THREE.Group();
      jg.position.set(xM, yB, jZ);

      // Linker und rechter Holzständer
      addMesh(jg, new THREE.BoxGeometry(0.35, h, 0.35), holzMat, -b * 0.5 + 0.35, h * 0.5, 0);
      addMesh(jg, new THREE.BoxGeometry(0.35, h, 0.35), holzMat, b * 0.5 - 0.35, h * 0.5, 0);

      // Querbalken oben
      addMesh(jg, new THREE.BoxGeometry(b - 0.2, 0.4, 0.35), holzMat, 0, h - 0.2, 0);

      // Kopfstreben (Kopfbänder)
      addMesh(jg, new THREE.BoxGeometry(0.25, 1.2, 0.25), holzMat, -b * 0.5 + 0.9, h - 0.7, 0, 0, 0, Math.PI / 4);
      addMesh(jg, new THREE.BoxGeometry(0.25, 1.2, 0.25), holzMat, b * 0.5 - 0.9, h - 0.7, 0, 0, 0, -Math.PI / 4);

      // Mitteltrenngeländer (trennt Gleis links von Straße rechts)
      addMesh(jg, new THREE.BoxGeometry(0.18, 1.1, 0.18), holzHellMat, 0, 0.55, 0);

      // Grubenlaterne links und rechts
      [-b * 0.5 + 0.65, b * 0.5 - 0.65].forEach(function (lx) {
        addMesh(jg, new THREE.BoxGeometry(0.08, 0.35, 0.15), metallMat, lx, 3.2, 0);
        addMesh(jg, new THREE.CylinderGeometry(0.15, 0.2, 0.4, 8), laternMat, lx, 3.0, 0);
      });

      group.add(jg);
    }

    // Durchgehendes Holzgeländer in der Mitte (Z = 48..76 bei X = 286)
    addMesh(group, new THREE.BoxGeometry(0.12, 0.15, laenge), holzHellMat, xM, yB + 0.95, zM);
    addMesh(group, new THREE.BoxGeometry(0.12, 0.15, laenge), holzHellMat, xM, yB + 0.45, zM);

    // 4. Zwei sanfte PointLights im Tunnel für atmosphärische Beleuchtung
    var plNord = new THREE.PointLight(0xf59e0b, 1.2, 22.0, 1.2);
    plNord.position.set(xM, yB + 3.2, zS + 8.0);
    group.add(plNord);

    var plSued = new THREE.PointLight(0xf59e0b, 1.2, 22.0, 1.2);
    plSued.position.set(xM, yB + 3.2, zE - 8.0);
    group.add(plSued);
    state.laternenLichter = [plNord, plSued];

    // 5. Portale (Nordost bei Z = 48 und Süd bei Z = 76)
    [zS, zE].forEach(function (pz, pIdx) {
      var pg = new THREE.Group();
      pg.position.set(xM, yB, pz);

      // Felsrahmen (Portalbogen)
      addMesh(pg, new THREE.TorusGeometry(b * 0.5 + 0.4, 1.2, 12, 16, Math.PI), felsMat, 0, h * 0.45, 0);
      addMesh(pg, new THREE.BoxGeometry(2.2, h + 2.0, 1.8), felsDunkelMat, -b * 0.5 - 0.8, (h + 2.0) * 0.5, 0);
      addMesh(pg, new THREE.BoxGeometry(2.2, h + 2.0, 1.8), felsDunkelMat, b * 0.5 + 0.8, (h + 2.0) * 0.5, 0);

      // Rustikaler Holzportalrahmen
      addMesh(pg, new THREE.BoxGeometry(0.45, h + 0.6, 0.55), holzMat, -b * 0.5 + 0.1, (h + 0.6) * 0.5, (pIdx === 0 ? -0.3 : 0.3));
      addMesh(pg, new THREE.BoxGeometry(0.45, h + 0.6, 0.55), holzMat, b * 0.5 - 0.1, (h + 0.6) * 0.5, (pIdx === 0 ? -0.3 : 0.3));
      addMesh(pg, new THREE.BoxGeometry(b + 0.6, 0.6, 0.55), holzMat, 0, h + 0.2, (pIdx === 0 ? -0.3 : 0.3));

      // Holzschild-Balken
      addMesh(pg, new THREE.BoxGeometry(7.2, 1.2, 0.15), holzHellMat, 0, h + 1.2, (pIdx === 0 ? -0.4 : 0.4));

      // Zwei Portallaternen
      [-b * 0.5 - 0.2, b * 0.5 + 0.2].forEach(function (plx) {
        addMesh(pg, new THREE.CylinderGeometry(0.18, 0.22, 0.5, 8), laternMat, plx, h * 0.65, (pIdx === 0 ? -0.5 : 0.5));
      });

      group.add(pg);
    });

    entity.setObject3D('mesh', group);
    

    // 3D-Beschriftungen an beiden Portalen
    var schildTexte = [
      { v: 'GRAND CANYON TUNNEL', p: xM + ' ' + (yB + h + 1.2) + ' ' + (zS - 0.48), r: '0 180 0', w: '18', c: '#fef08a' },
      { v: 'GRAND CANYON TUNNEL', p: xM + ' ' + (yB + h + 1.2) + ' ' + (zE + 0.48), r: '0 180 0', w: '18', c: '#fef08a' }
    ];
    schildTexte.forEach(function (st) {
      var tEl = document.createElement('a-text');
      tEl.setAttribute('value', st.v);
      tEl.setAttribute('color', st.c);
      tEl.setAttribute('width', st.w);
      tEl.setAttribute('align', 'center');
      tEl.setAttribute('position', st.p);
      tEl.setAttribute('rotation', st.r);
      entity.appendChild(tEl);
    });
  }

  // --------------------------------------------------------------------------
  // 3. Schnellreise-HUD Anbindung
  // --------------------------------------------------------------------------
  function initialisiereHUD() {
    var checkTimer = setInterval(function () {
      var hud = document.getElementById('eep-schneewelt-hud');
      if (hud && !hud.querySelector('[data-akt="tp-canyon"]')) {
        var btn = document.createElement('button');
        btn.setAttribute('data-akt', 'tp-canyon');
        btn.setAttribute('title', 'Direkt vor das Portal des Grand-Canyon-Tunnels in Amerika');
        btn.style.cssText = 'background:#b45309;color:#fff;border:none;padding:4px 8px;border-radius:8px;font:inherit;cursor:pointer;margin-left:4px;';
        btn.innerHTML = '🏜️ Grand Canyon';
        btn.addEventListener('click', function () {
          var stEl = document.querySelector('[ki-steuerung]');
          if (stEl && stEl.components && stEl.components['ki-steuerung'] && EEP.aktiveKamera !== 8) {
            stEl.components['ki-steuerung'].setzeKamera(8);
          }
          if (EEP.autoComp && typeof EEP.autoComp.teleportiereZu === 'function') {
            EEP.autoComp.teleportiereZu(286.0, 0.35, 41.0, 180);
          }
        });
        hud.appendChild(btn);
        clearInterval(checkTimer);
      }
    }, 400);
    setTimeout(function () { clearInterval(checkTimer); }, 15000);
  }

  // --------------------------------------------------------------------------
  // 4. Selbsttest (?canyontest=1)
  // --------------------------------------------------------------------------
  function starteCanyonSelbsttest() {
    if (!EEP.grandCanyonTunnel || !EEP.welt || !EEP.kollision) return;
    var gc = EEP.grandCanyonTunnel;

    // 1. korridorOk: Mitte frei, Wände links und rechts blockierend
    var pMitte = { x: 286.0, y: 0.30, z: 62.0, vorherX: 286.0, vorherZ: 61.9, halbBreite: 1.0, halbLaenge: 2.0, hoehe: 2.0 };
    var kMitte = EEP.kollision.pruefe(pMitte);
    var pWest = { x: 281.5, y: 0.30, z: 62.0, vorherX: 282.0, vorherZ: 62.0, halbBreite: 1.0, halbLaenge: 2.0, hoehe: 2.0 };
    var kWest = EEP.kollision.pruefe(pWest);
    var pOst = { x: 290.5, y: 0.30, z: 62.0, vorherX: 290.0, vorherZ: 62.0, halbBreite: 1.0, halbLaenge: 2.0, hoehe: 2.0 };
    var kOst = EEP.kollision.pruefe(pOst);
    var korridorOk = Boolean((!kMitte || kMitte.eindringtiefe <= 0) && kWest && kOst);

    // 2. ausstattungOk: 4 Holzjoche, Tunnel-Gruppe vorhanden, Zonenabfrage liefert schotter
    var abf = EEP.welt.abfrage(286.0, 62.0);
    var zoneOk = (abf.untergrund === 'schotter' && Math.abs(abf.hoehe - 0.30) <= 0.1);
    var jocheOk = (gc.konfig.joche.length === 4);
    var lichterOk = (state.laternenLichter.length >= 2);
    var ausstattungOk = Boolean(zoneOk && jocheOk && lichterOk && state.weltGruppe);

    // 3. istImTunnelOk
    var imTunnelNord = gc.istImTunnel(286.0, 55.0);
    var ausserhalb = gc.istImTunnel(286.0, 30.0);
    var logikOk = Boolean(imTunnelNord && !ausserhalb);

    var res = {
      korridorOk: korridorOk,
      ausstattungOk: ausstattungOk,
      logikOk: logikOk
    };

    console.log('CANYON_TEST_RESULT:' + JSON.stringify(res));
    if (korridorOk && ausstattungOk && logikOk) {
      console.log('CANYON_TEST_OK');
    }

    // Für visuellen Screenshot die G-Klasse vor das Nordportal platzieren
    var stEl = document.querySelector('[ki-steuerung]');
    if (stEl && stEl.components && stEl.components['ki-steuerung']) {
      stEl.components['ki-steuerung'].setzeKamera(8);
    }
    if (EEP.autoComp && typeof EEP.autoComp.teleportiereZu === 'function') {
      EEP.autoComp.teleportiereZu(286.0, 0.35, 41.0, 180);
    }
  }

  // --------------------------------------------------------------------------
  // 5. Lifecycle & Kopplung
  // --------------------------------------------------------------------------
  EEP.grandCanyonTunnelUI = {
    init: function () {
      if (state.initialisiert) return;
      var sceneEl = document.querySelector('a-scene');
      if (!sceneEl) return;
      state.initialisiert = true;

      initialisiereAudio();
      baueCanyonTunnel(sceneEl);
      initialisiereHUD();

      if (typeof window !== 'undefined' && window.location && window.location.search) {
        if (window.location.search.indexOf('canyontest=1') !== -1) {
          setTimeout(starteCanyonSelbsttest, 600);
        }
      }
    },

    tick: function (timeMs, deltaSec) {
      if (!state.initialisiert) this.init();

      var ac = EEP.autoComp;
      var autoPos = (ac && ac.el && ac.el.object3D) ? ac.el.object3D.position : null;
      if (autoPos && EEP.grandCanyonTunnel) {
        var imTunnel = EEP.grandCanyonTunnel.aktualisiere(deltaSec, autoPos, 'g-klasse');
        aktualisiereAudio(imTunnel);
      }
    }
  };

  function koppleAnSzene() {
    if (typeof AFRAME === 'undefined' || !AFRAME.components) return;
    var steuerDef = AFRAME.components['ki-steuerung'];
    if (steuerDef && steuerDef.Component && !steuerDef.Component.prototype._canyonTunnelGekoppelt) {
      var proto = steuerDef.Component.prototype;
      var origTick = proto.tick;
      proto._canyonTunnelGekoppelt = true;
      proto.tick = function (time, dt) {
        if (origTick) origTick.call(this, time, dt);
        var deltaSec = dt ? Math.min(dt / 1000, 0.08) : 0.016;
        EEP.grandCanyonTunnelUI.tick(time || 0, deltaSec);
      };
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    EEP.grandCanyonTunnelUI.init();
    koppleAnSzene();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      EEP.grandCanyonTunnelUI.init();
      koppleAnSzene();
    });
  }
})();
