/* ============================================================================
 * js/core/perf-lod.js – Paket 0: Ehrliche Performance-Anzeige, FPS-Wächter & THREE.LOD
 * ============================================================================ */
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.perf = '1.0.0';

  // --------------------------------------------------------------------------
  // 1. Qualitätsstufen gemäß d-architecture-lod-002
  // --------------------------------------------------------------------------
  var STUFEN = [
    { index: 0, key: 'ultra',   name: 'Ultra',   maxDpr: 2.00, shadowSize: 2048, far: 1200, lodFaktor: 1.00, dekoDichte: 1.00 },
    { index: 1, key: 'hoch',    name: 'Hoch',    maxDpr: 1.50, shadowSize: 2048, far: 1000, lodFaktor: 0.80, dekoDichte: 1.00 },
    { index: 2, key: 'mittel',  name: 'Mittel',  maxDpr: 1.00, shadowSize: 1024, far: 800,  lodFaktor: 0.60, dekoDichte: 0.60 },
    { index: 3, key: 'niedrig', name: 'Niedrig', maxDpr: 0.75, shadowSize: 512,  far: 600,  lodFaktor: 0.40, dekoDichte: 0.30 }
  ];

  // Basis-Distanzen gemäß d-architecture-lod-003
  var BASIS_DISTANZEN = {
    baum: [90, 220],
    gebaeude: [150, 450],
    wolkenkratzer: [200, 1200],
    landschaft: [350, 1200],
    beschriftung: [260],
    deko: [120]
  };

  var perfState = {
    aktiveStufe: 1,          // Startstufe 1 Hoch
    autoModus: true,         // true = Auto-Wächter aktiv
    manuellZyklusIndex: 0,   // 0=Auto, 1=Ultra, 2=Hoch, 3=Mittel, 4=Niedrig
    frameDeltas: [],         // Letzte 1,0 s Frame-Abstände (ms)
    frameWorkMs: [],         // Letzte 1,0 s Rechenzeiten (ms)
    zeitstempel: [],         // Zeitstempel (ms)
    aktuellFps: 60,
    aktuellMs: 4.5,
    aktuellP95Ms: 6.0,
    aktuellLast: 27,
    simFps: null,
    simLast: null,
    unterSchwelleSeit: null,
    ueberSchwelleSeit: null,
    letzterWechselMs: -10000,
    letztesLodUpdateMs: 0,
    letztesBadgeUpdateMs: 0,
    detailOffen: false,
    testZeitMs: 0,
    testModusAktiv: false,
    sceneEl: null
  };

  // URL-Parameter ?qualitaet=ultra|hoch|mittel|niedrig|auto auswerten
  try {
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      var m = window.location.search.match(/[?&]qualitaet=(ultra|hoch|mittel|niedrig|auto)/i);
      if (m) {
        var q = m[1].toLowerCase();
        if (q === 'auto') {
          perfState.autoModus = true;
          perfState.aktiveStufe = 1;
        } else {
          for (var s = 0; s < STUFEN.length; s++) {
            if (STUFEN[s].key === q) {
              perfState.autoModus = false;
              perfState.aktiveStufe = s;
              perfState.manuellZyklusIndex = s + 1;
              break;
            }
          }
        }
      }
    }
  } catch (e) {}

  // --------------------------------------------------------------------------
  // 2. LOD-Registry (EEP.lod)
  // --------------------------------------------------------------------------
  var lodEintraege = [];
  var dekoCounter = 0;

  function baueErsatzGeometrie(kategorie, farbeHex) {
    if (typeof THREE === 'undefined') return null;
    var grp = new THREE.Group();
    if (kategorie === 'baum') {
      var stamm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.25, 2.2, 5),
        new THREE.MeshLambertMaterial({ color: 0x5d4037 })
      );
      stamm.position.y = 1.1;
      var krone = new THREE.Mesh(
        new THREE.ConeGeometry(1.3, 3.6, 6),
        new THREE.MeshLambertMaterial({ color: farbeHex || 0x2e7d32 })
      );
      krone.position.y = 3.2;
      grp.add(stamm);
      grp.add(krone);
      return grp;
    }
    if (kategorie === 'gebaeude') {
      var kasten = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 3.6, 3.2),
        new THREE.MeshLambertMaterial({ color: farbeHex || 0xf3e5ab })
      );
      kasten.position.y = 1.8;
      var dach = new THREE.Mesh(
        new THREE.ConeGeometry(2.6, 1.6, 4),
        new THREE.MeshLambertMaterial({ color: 0xb71c1c })
      );
      dach.position.y = 4.4;
      dach.rotation.y = Math.PI / 4;
      grp.add(kasten);
      grp.add(dach);
      return grp;
    }
    if (kategorie === 'wolkenkratzer') {
      var turm = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 24, 5.6),
        new THREE.MeshLambertMaterial({ color: farbeHex || 0x334155 })
      );
      turm.position.y = 12;
      grp.add(turm);
      return grp;
    }
    return null;
  }

  EEP.lod = {
    eintraege: lodEintraege,

    registriere: function (object3D, kategorie, stufen, zusatz) {
      if (!object3D) return null;
      var kat = kategorie || 'deko';
      var basis = BASIS_DISTANZEN[kat] || [150];
      var faktor = STUFEN[perfState.aktiveStufe].lodFaktor;

      var lodObj = null;
      if (typeof THREE !== 'undefined' && THREE.LOD && !(object3D instanceof THREE.LOD)) {
        lodObj = new THREE.LOD();
        lodObj.position.copy(object3D.position);
        lodObj.rotation.copy(object3D.rotation);
        lodObj.scale.copy(object3D.scale);
      }

      var definierteStufen = stufen;
      if (!definierteStufen || !definierteStufen.length) {
        if (kat === 'baum' || kat === 'gebaeude' || kat === 'wolkenkratzer') {
          var ersatz = baueErsatzGeometrie(kat, zusatz && zusatz.farbe);
          definierteStufen = [
            { dist: 0, object: object3D },
            { dist: basis[0], object: ersatz },
            { dist: basis[1] || 450, object: null }
          ];
        } else {
          definierteStufen = [
            { dist: 0, object: object3D },
            { dist: basis[0], object: null }
          ];
        }
      }

      if (lodObj && definierteStufen) {
        for (var i = 0; i < definierteStufen.length; i++) {
          var st = definierteStufen[i];
          // WICHTIG: Niemals das aktive A-Frame object3D selbst an lodObj.addLevel übergeben!
          // THREE.LOD.addLevel ruft intern this.add(obj) auf und entfernt damit el.object3D
          // aus dem a-scene.object3D Szenengraphen (wodurch Alpen, Canyon, Häuser & Bäume verschwinden).
          var levelNode = (st.object && st.object !== object3D && !st.object.parent) ? st.object : new THREE.Object3D();
          if (!st.object) levelNode.visible = false;
          lodObj.addLevel(levelNode, st.dist * faktor);
        }
      }

      var eintrag = {
        id: 'lod-' + (lodEintraege.length + 1),
        kategorie: kat,
        object3D: object3D,
        lod: lodObj,
        stufen: definierteStufen,
        basisMaxDist: basis[basis.length - 1] || 200,
        dekoIndex: kat === 'deko' ? (dekoCounter++) : -1,
        aktuellesLevel: 0,
        sichtbar: true
      };
      lodEintraege.push(eintrag);
      return eintrag;
    },

    zaehleNachKategorie: function () {
      var res = { baum: 0, gebaeude: 0, wolkenkratzer: 0, landschaft: 0, beschriftung: 0, deko: 0, gesamt: lodEintraege.length };
      for (var i = 0; i < lodEintraege.length; i++) {
        var k = lodEintraege[i].kategorie;
        res[k] = (res[k] || 0) + 1;
      }
      return res;
    },

    aktualisiereDistanzenFuerStufe: function (stufeObj) {
      var faktor = stufeObj.lodFaktor;
      var dichte = stufeObj.dekoDichte;
      for (var i = 0; i < lodEintraege.length; i++) {
        var e = lodEintraege[i];
        if (e.kategorie === 'deko' && e.dekoIndex >= 0) {
          var mod = (e.dekoIndex % 10) / 10;
          var dekoErlaubt = mod < dichte;
          if (e.object3D) e.object3D.visible = dekoErlaubt;
          e.sichtbar = dekoErlaubt;
        }
        if (e.lod && e.lod.levels && e.stufen) {
          for (var j = 0; j < e.lod.levels.length && j < e.stufen.length; j++) {
            e.lod.levels[j].distance = e.stufen[j].dist * faktor;
          }
        }
      }
    },

    updateSichtbarkeit: function (camPos) {
      if (!camPos) return;
      var stufeObj = STUFEN[perfState.aktiveStufe];
      var faktor = stufeObj.lodFaktor;
      var dichte = stufeObj.dekoDichte;
      var worldPos = (typeof THREE !== 'undefined') ? new THREE.Vector3() : null;

      for (var i = 0; i < lodEintraege.length; i++) {
        var e = lodEintraege[i];
        var obj = e.object3D;
        if (!obj) continue;

        if (e.kategorie === 'deko' && e.dekoIndex >= 0) {
          if (((e.dekoIndex % 10) / 10) >= dichte) {
            obj.visible = false;
            e.sichtbar = false;
            continue;
          }
        }

        var px = obj.position.x;
        var py = obj.position.y;
        var pz = obj.position.z;
        if (worldPos && obj.getWorldPosition) {
          obj.getWorldPosition(worldPos);
          px = worldPos.x; py = worldPos.y; pz = worldPos.z;
        }
        var dx = px - camPos.x;
        var dy = py - camPos.y;
        var dz = pz - camPos.z;
        var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Alles < 30 m zur Kamera ist immer in LOD0 sichtbar
        if (dist < 30) {
          obj.visible = true;
          e.sichtbar = true;
          e.aktuellesLevel = 0;
          continue;
        }

        var maxDist = Math.max(e.basisMaxDist * faktor, stufeObj.far * 0.85);
        if (e.kategorie === 'wolkenkratzer' || e.kategorie === 'landschaft' || (EEP.aktiveKamera === 7)) {
          maxDist = Math.max(stufeObj.far, 1500);
        }
        var vis = dist <= maxDist;
        obj.visible = vis;
        e.sichtbar = vis;
        e.aktuellesLevel = (e.stufen && e.stufen.length > 1 && dist > e.stufen[1].dist * faktor) ? 1 : 0;
      }
    },

    scanneSzene: function (sceneEl) {
      if (!sceneEl || typeof document === 'undefined') return;
      // Bereits registrierte Objekte nicht doppelt aufnehmen
      var bek = new Set();
      for (var b = 0; b < lodEintraege.length; b++) bek.add(lodEintraege[b].object3D);

      // 1. Bäume (gltf-model mit tree_)
      var baeume = sceneEl.querySelectorAll('[gltf-model*="tree_"]');
      for (var i = 0; i < baeume.length; i++) {
        var o = baeume[i].object3D;
        if (o && !bek.has(o)) {
          EEP.lod.registriere(o, 'baum');
          bek.add(o);
        }
      }

      // 2. Gebäude (ki-haus, ki-bahnhof, ki-flughafen)
      var geb = sceneEl.querySelectorAll('[ki-haus], [ki-bahnhof], [ki-flughafen]');
      for (var gIdx = 0; gIdx < geb.length; gIdx++) {
        var go = geb[gIdx].object3D;
        if (go && !bek.has(go)) {
          EEP.lod.registriere(go, 'gebaeude');
          bek.add(go);
        }
      }

      // 3. Wolkenkratzer
      var wolk = sceneEl.querySelectorAll('[ki-wolkenkratzer]');
      for (var wIdx = 0; wIdx < wolk.length; wIdx++) {
        var wo = wolk[wIdx].object3D;
        if (wo && !bek.has(wo)) {
          EEP.lod.registriere(wo, 'wolkenkratzer');
          bek.add(wo);
        }
      }

      // 4. Landschaft (Alpen, Canyon, Pyramiden)
      var land = sceneEl.querySelectorAll('[ki-alpen], [ki-canyon], [ki-pyramiden]');
      for (var lIdx = 0; lIdx < land.length; lIdx++) {
        var lo = land[lIdx].object3D;
        if (lo && !bek.has(lo)) {
          EEP.lod.registriere(lo, 'landschaft');
          bek.add(lo);
        }
      }

      // 5. Beschriftungen (a-text auf oberster Szenen-Ebene)
      var texte = sceneEl.querySelectorAll('a-scene > a-text');
      for (var tIdx = 0; tIdx < texte.length; tIdx++) {
        var to = texte[tIdx].object3D;
        if (to && !bek.has(to)) {
          EEP.lod.registriere(to, 'beschriftung');
          bek.add(to);
        }
      }
    }
  };

  // --------------------------------------------------------------------------
  // 3. Qualitätsstufe auf Renderer, Schatten, Kamera & Nebel anwenden
  // --------------------------------------------------------------------------
  function wendeStufeAufSzeneAn(stufeIdx, grund) {
    var vorher = perfState.aktiveStufe;
    perfState.aktiveStufe = stufeIdx;
    var stufe = STUFEN[stufeIdx];

    EEP.lod.aktualisiereDistanzenFuerStufe(stufe);

    var sceneEl = perfState.sceneEl || (typeof document !== 'undefined' ? document.querySelector('a-scene') : null);
    if (sceneEl) {
      var renderer = sceneEl.renderer;
      if (renderer) {
        var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
        renderer.setPixelRatio(Math.min(dpr, stufe.maxDpr));
      }

      // Kamera-Far anpassen (Mindestens 1500m für Großlandschaften wie Alpen/Grand Canyon/Pyramiden)
      var camEl = sceneEl.querySelector('#haupt-kamera');
      if (camEl) {
        var camFar = Math.max(stufe.far, 1500);
        camEl.setAttribute('far', String(camFar));
        var camObj = camEl.getObject3D && camEl.getObject3D('camera');
        if (camObj) {
          camObj.far = camFar;
          if (typeof camObj.updateProjectionMatrix === 'function') camObj.updateProjectionMatrix();
        }
      }

      // Nebel sanft an Sichtweite koppeln (Alpen & Grand Canyon am Horizont sichtbar halten)
      if (sceneEl.object3D && sceneEl.object3D.fog) {
        var fog = sceneEl.object3D.fog;
        if (typeof fog.density === 'number') {
          fog.density = 1.4 / (0.95 * stufe.far);
        }
      }

      // Schattenauflösung anpassen
      var sunEl = sceneEl.querySelector('#licht-sonne');
      if (sunEl && sunEl.getObject3D) {
        var lightObj = sunEl.getObject3D('light');
        if (lightObj && lightObj.shadow && lightObj.shadow.mapSize) {
          if (lightObj.shadow.mapSize.width !== stufe.shadowSize) {
            lightObj.shadow.mapSize.width = stufe.shadowSize;
            lightObj.shadow.mapSize.height = stufe.shadowSize;
            if (lightObj.shadow.map) {
              lightObj.shadow.map.dispose();
              lightObj.shadow.map = null;
            }
          }
        }
      }
    }

    if (vorher !== stufeIdx) {
      var vonName = STUFEN[vorher] ? STUFEN[vorher].name : String(vorher);
      var nachName = stufe.name;
      console.info('PERF_STUFE ' + vonName + '→' + nachName + ' ' + (grund || 'manuell'));
      if (EEP.bus) {
        EEP.bus.emit('qualitaet', { von: vorher, nach: stufeIdx, vonName: vonName, nachName: nachName, grund: grund || 'manuell' });
      }
    }
    aktualisiereBadgeDOM();
  }

  function aktualisiereBadgeDOM() {
    if (typeof document === 'undefined') return;
    var badge = document.getElementById('eep-gpu-badge');
    if (!badge) return;
    var fps = Math.round(perfState.aktuellFps);
    var ms = perfState.aktuellMs.toFixed(1);
    var last = Math.round(perfState.aktuellLast);
    var stufeName = STUFEN[perfState.aktiveStufe].name;
    var modusSuffix = perfState.autoModus ? ' (Auto)' : ' (Fest)';
    var gpuShort = ((EEP && EEP.gpuInfo) ? EEP.gpuInfo : 'GPU')
      .replace(/Intel\(R\) HD Graphics/i, 'Intel HD')
      .replace(/NVIDIA GeForce/i, 'NVIDIA')
      .substring(0, 18);

    badge.textContent = fps + ' FPS · ' + ms + ' ms · Last ' + last + ' % · Stufe ' + stufeName + modusSuffix + ' | ' + gpuShort;

    if (fps >= 55 && last < 70) {
      badge.style.color = '#4ade80';
    } else if (fps < 35 || last > 95) {
      badge.style.color = '#f87171';
    } else {
      badge.style.color = '#fde047';
    }

    var detailEl = document.getElementById('eep-perf-detail');
    if (detailEl && perfState.detailOffen) {
      var sceneEl = perfState.sceneEl || document.querySelector('a-scene');
      var calls = 0, tris = 0;
      if (sceneEl && sceneEl.renderer && sceneEl.renderer.info && sceneEl.renderer.info.render) {
        calls = sceneEl.renderer.info.render.calls || 0;
        tris = sceneEl.renderer.info.render.triangles || 0;
      }
      var katCount = EEP.lod.zaehleNachKategorie();
      detailEl.innerHTML =
        '<b>Performance-Diagnose [F]</b> (Shift+F: Stufe wechseln)<br>' +
        '95%-Framezeit: ' + perfState.aktuellP95Ms.toFixed(1) + ' ms | Draw-Calls: ' + calls + ' | Dreiecke: ' + tris + '<br>' +
        'Stufe: ' + stufeName + modusSuffix + ' (far=' + STUFEN[perfState.aktiveStufe].far + 'm, LOD×' + STUFEN[perfState.aktiveStufe].lodFaktor + ')<br>' +
        'LOD-Objekte: Bäume ' + katCount.baum + ', Gebäude ' + katCount.gebaeude + ', Text ' + katCount.beschriftung;
    }
  }

  // --------------------------------------------------------------------------
  // 4. FPS-Wächter & Hysterese-Prüfung (s-architecture-lod-004)
  // --------------------------------------------------------------------------
  function pruefeWaechter(nowMs) {
    if (!perfState.autoModus) return;

    var fps = perfState.aktuellFps;
    var last = perfState.aktuellLast;
    var p95 = perfState.aktuellP95Ms;

    // Sperrzeit 4,0 s nach jedem Wechsel
    if (nowMs - perfState.letzterWechselMs < 4000) {
      return;
    }

    var zuLangsam = (fps < 52) || (p95 > 22);
    var vielReserve = (fps >= 58) && (last < 60);

    if (zuLangsam) {
      perfState.ueberSchwelleSeit = null;
      if (perfState.unterSchwelleSeit === null) {
        perfState.unterSchwelleSeit = nowMs;
      } else if (nowMs - perfState.unterSchwelleSeit >= 2000) {
        perfState.unterSchwelleSeit = nowMs;
        if (perfState.aktiveStufe < STUFEN.length - 1) {
          perfState.letzterWechselMs = nowMs;
          perfState.unterSchwelleSeit = null;
          wendeStufeAufSzeneAn(perfState.aktiveStufe + 1, 'Einbruch (FPS=' + Math.round(fps) + ', P95=' + p95.toFixed(1) + 'ms)');
        }
      }
    } else {
      perfState.unterSchwelleSeit = null;
      if (vielReserve) {
        if (perfState.ueberSchwelleSeit === null) {
          perfState.ueberSchwelleSeit = nowMs;
        } else if (nowMs - perfState.ueberSchwelleSeit >= 6000) {
          perfState.ueberSchwelleSeit = nowMs;
          if (perfState.aktiveStufe > 0) {
            perfState.letzterWechselMs = nowMs;
            perfState.ueberSchwelleSeit = null;
            wendeStufeAufSzeneAn(perfState.aktiveStufe - 1, 'Erholung (FPS=' + Math.round(fps) + ', Last=' + Math.round(last) + '%)');
          }
        }
      } else {
        perfState.ueberSchwelleSeit = null;
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. Öffentliche API (EEP.perf)
  // --------------------------------------------------------------------------
  EEP.perf = {
    stufen: STUFEN,
    state: perfState,

    init: function (sceneEl) {
      perfState.sceneEl = sceneEl;
      EEP.lod.scanneSzene(sceneEl);
      wendeStufeAufSzeneAn(perfState.aktiveStufe, 'init');

      if (typeof window !== 'undefined' && !perfState._keyRegistered) {
        perfState._keyRegistered = true;
        window.addEventListener('keydown', function (e) {
          if (e.key && e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.altKey) {
            if (e.shiftKey) {
              EEP.perf.zyklusQualitaetsModus();
            } else {
              EEP.perf.toggleDetailOverlay();
            }
          }
        });
      }
    },

    tick: function (dtMs, workMs, camPos) {
      var now = perfState.testModusAktiv ? perfState.testZeitMs : (typeof performance !== 'undefined' ? performance.now() : Date.now());
      var delta = Math.max(1, dtMs || 16.67);
      var work = typeof workMs === 'number' ? workMs : Math.min(delta * 0.45, 14);

      if (perfState.simFps !== null) {
        perfState.aktuellFps = perfState.simFps;
        perfState.aktuellLast = perfState.simLast !== null ? perfState.simLast : (1000 / Math.max(1, perfState.simFps)) / 16.67 * 100;
        perfState.aktuellMs = (perfState.aktuellLast / 100) * 16.67;
        perfState.aktuellP95Ms = perfState.aktuellMs * 1.15;
      } else {
        perfState.zeitstempel.push(now);
        perfState.frameDeltas.push(delta);
        perfState.frameWorkMs.push(work);
        while (perfState.zeitstempel.length > 1 && now - perfState.zeitstempel[0] > 1000) {
          perfState.zeitstempel.shift();
          perfState.frameDeltas.shift();
          perfState.frameWorkMs.shift();
        }
        var sumDelta = 0, sumWork = 0;
        for (var i = 0; i < perfState.frameDeltas.length; i++) {
          sumDelta += perfState.frameDeltas[i];
          sumWork += perfState.frameWorkMs[i];
        }
        var n = Math.max(1, perfState.frameDeltas.length);
        var avgDelta = sumDelta / n;
        var avgWork = sumWork / n;
        var sorted = perfState.frameWorkMs.slice().sort(function (a, b) { return a - b; });
        var p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));

        perfState.aktuellFps = Math.min(144, 1000 / Math.max(1, avgDelta));
        perfState.aktuellMs = avgWork;
        perfState.aktuellP95Ms = sorted[p95Idx] || avgWork;
        perfState.aktuellLast = (avgWork / 16.67) * 100;
      }

      pruefeWaechter(now);

      if (now - perfState.letztesLodUpdateMs >= 100) {
        perfState.letztesLodUpdateMs = now;
        EEP.lod.updateSichtbarkeit(camPos);
      }

      if (now - perfState.letztesBadgeUpdateMs >= 400 || perfState.testModusAktiv) {
        perfState.letztesBadgeUpdateMs = now;
        aktualisiereBadgeDOM();
      }
    },

    simuliereFps: function (fps, lastProzent) {
      if (fps === null || typeof fps === 'undefined') {
        perfState.simFps = null;
        perfState.simLast = null;
        perfState.testModusAktiv = false;
        return;
      }
      perfState.simFps = Number(fps);
      perfState.simLast = typeof lastProzent === 'number' ? Number(lastProzent) : ((1000 / Math.max(1, fps)) / 16.67 * 100);
      perfState.aktuellFps = perfState.simFps;
      perfState.aktuellLast = perfState.simLast;
      perfState.aktuellMs = (perfState.aktuellLast / 100) * 16.67;
      perfState.aktuellP95Ms = perfState.aktuellMs * 1.15;
      aktualisiereBadgeDOM();
    },

    testUhr: function (dauerSekunden, schrittMs) {
      perfState.testModusAktiv = true;
      var step = schrittMs || 100;
      var steps = Math.round((dauerSekunden * 1000) / step);
      for (var i = 0; i < steps; i++) {
        perfState.testZeitMs += step;
        EEP.perf.tick(step, perfState.aktuellMs, { x: -244, y: 7.5, z: -50 });
      }
    },

    setzeStufe: function (stufeIdx, auto) {
      perfState.autoModus = Boolean(auto);
      perfState.unterSchwelleSeit = null;
      perfState.ueberSchwelleSeit = null;
      wendeStufeAufSzeneAn(Math.max(0, Math.min(STUFEN.length - 1, stufeIdx)), auto ? 'auto' : 'manuell');
    },

    zyklusQualitaetsModus: function () {
      // Auto -> Ultra(0) -> Hoch(1) -> Mittel(2) -> Niedrig(3) -> Auto
      perfState.manuellZyklusIndex = (perfState.manuellZyklusIndex + 1) % 5;
      if (perfState.manuellZyklusIndex === 0) {
        perfState.autoModus = true;
        wendeStufeAufSzeneAn(1, 'Zyklus Auto');
      } else {
        perfState.autoModus = false;
        wendeStufeAufSzeneAn(perfState.manuellZyklusIndex - 1, 'Zyklus Fest');
      }
    },

    toggleDetailOverlay: function () {
      perfState.detailOffen = !perfState.detailOffen;
      if (typeof document === 'undefined') return;
      var detailEl = document.getElementById('eep-perf-detail');
      if (!detailEl) {
        detailEl = document.createElement('div');
        detailEl.id = 'eep-perf-detail';
        detailEl.style.cssText = 'position:fixed;top:44px;right:14px;z-index:9999;background:rgba(15,23,42,0.92);color:#e2e8f0;padding:8px 12px;border-radius:8px;font:12px monospace;border:1px solid #38bdf8;pointer-events:none;';
        document.body.appendChild(detailEl);
      }
      detailEl.style.display = perfState.detailOffen ? 'block' : 'none';
      aktualisiereBadgeDOM();
    },

    aktuelleStufe: function () {
      return perfState.aktiveStufe;
    },

    aktuellerFarWert: function () {
      return STUFEN[perfState.aktiveStufe].far;
    }
  };
})();
