/* ============================================================================
 * js/core/schneewelt-ui.js – 3D-Schneewelt, Partikelsystem, Bergdorf St. Kristall,
 * Gondel-Seilbahn, Eisbogen, YouTube-Soundtrack (5w3rRFWzjcM) & Selbsttest (?schneewelttest=1).
 * ============================================================================ */
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.schneeweltUI = '1.0.0';

  var sState = {
    initialisiert: false, wandAusgeblendet: false, schneeGruppe: null, fadeOverlayEl: null, hudEl: null,
    gondeln: [], gondelProgress: 0.0, kristallMonument: null, ytPlayer: null,
    ytBereit: false, ytSpieltGerade: false, ytApiGeladen: false,
    ambientGain: null, ambientOscs: null,
    schneeFlockenGeo: null, schneeFlockenPos: null, schneeFlockenVel: null, schneeFlockenMesh: null
  };

  function addMesh(p, geo, mat, x, y, z, rx, ry, rz) {
    var m = new THREE.Mesh(geo, mat);
    if (typeof x === 'number') m.position.set(x, y || 0, z || 0);
    if (rx) m.rotation.x = rx; if (ry) m.rotation.y = ry; if (rz) m.rotation.z = rz;
    p.add(m); return m;
  }

  // --------------------------------------------------------------------------
  // 1. YouTube IFrame Player (5w3rRFWzjcM) & WebAudio Winter-Pad Fallback
  // --------------------------------------------------------------------------
  function initialisiereMusikSystem() {
    if (typeof document === 'undefined' || sState.ytApiGeladen) return;
    sState.ytApiGeladen = true;
    var ytWrap = document.createElement('div');
    ytWrap.id = 'eep-yt-schneewelt-wrap';
    ytWrap.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;overflow:hidden;';
    var ytInner = document.createElement('div');
    ytInner.id = 'eep-yt-schneewelt-player';
    ytWrap.appendChild(ytInner);
    document.body.appendChild(ytWrap);

    function erzeugeYT() {
      if (!window.YT || !window.YT.Player || sState.ytPlayer) return;
      try {
        sState.ytPlayer = new window.YT.Player('eep-yt-schneewelt-player', {
          height: '1', width: '1', videoId: '5w3rRFWzjcM',
          playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, loop: 1, playlist: '5w3rRFWzjcM', modestbranding: 1, rel: 0, origin: window.location.origin },
          events: { onReady: function (ev) { sState.ytBereit = true; ev.target.setVolume(0); } }
        });
      } catch (e) {}
    }
    if (window.YT && window.YT.Player) { erzeugeYT(); } else {
      var prevCb = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (typeof prevCb === 'function') prevCb(); erzeugeYT(); };
      var tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api'; tag.async = true;
      document.head.appendChild(tag);
    }
  }

  function aktualisiereMusik(z) {
    if (!z) return;
    initialisiereMusikSystem();
    if (sState.ytBereit && sState.ytPlayer && typeof sState.ytPlayer.setVolume === 'function') {
      try {
        sState.ytPlayer.setVolume(Math.round(z.musikLautstaerke));
        var hasGT = typeof sState.ytPlayer.getCurrentTime === 'function';
        if ((z.musikStatus === 'spielt' || z.musikStatus === 'fadein') && !sState.ytSpieltGerade) {
          if (hasGT) {
            var cT = sState.ytPlayer.getCurrentTime() || 0;
            if (Math.abs(cT - z.musikPositionSek) > 1.5 && z.musikPositionSek > 0.2) sState.ytPlayer.seekTo(z.musikPositionSek, true);
          }
          sState.ytPlayer.playVideo();
          sState.ytSpieltGerade = true;
        } else if (z.musikStatus === 'pausiert' && sState.ytSpieltGerade) {
          if (hasGT) {
            var stT = sState.ytPlayer.getCurrentTime();
            if (typeof stT === 'number' && stT > 0) z.musikPositionSek = Math.round(stT * 1000) / 1000;
          }
          sState.ytPlayer.pauseVideo();
          sState.ytSpieltGerade = false;
        } else if (sState.ytSpieltGerade && hasGT) {
          var runT = sState.ytPlayer.getCurrentTime();
          if (typeof runT === 'number' && runT > 0) z.musikPositionSek = Math.round(runT * 1000) / 1000;
        }
      } catch (e) {}
    }

    // WebAudio-Winter-Pad Fallback
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = EEP.audioCtx || (EEP.audioCtx = new AC());
      if ((z.musikStatus === 'spielt' || z.musikStatus === 'fadein') && !sState.ambientGain) {
        var master = ctx.createGain(); master.gain.value = 0.0001; master.connect(ctx.destination);
        var freqs = [196.0, 293.66, 392.0, 587.33];
        sState.ambientOscs = freqs.map(function (f) {
          var o = ctx.createOscillator(), gN = ctx.createGain();
          o.type = 'sine'; o.frequency.value = f; gN.gain.value = 0.012;
          o.connect(gN); gN.connect(master); o.start(); return o;
        });
        sState.ambientGain = master;
      }
      if (sState.ambientGain && ctx) {
        sState.ambientGain.gain.setTargetAtTime((z.musikLautstaerke / 100) * 0.12, ctx.currentTime, 0.1);
      }
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // 2. Vollbild-Schwarzblende & Schneewelt-HUD
  // --------------------------------------------------------------------------
  function baueOverlayUndHUD() {
    if (typeof document === 'undefined') return;
    if (!sState.fadeOverlayEl) {
      var fade = document.createElement('div');
      fade.id = 'eep-schneewelt-fade';
      fade.style.cssText = 'position:fixed;inset:0;background:#000;pointer-events:none;z-index:99999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.12s ease-out;';
      var text = document.createElement('div');
      text.style.cssText = 'color:#e0f2fe;font:700 24px system-ui,sans-serif;text-shadow:0 0 16px #38bdf8;text-align:center;letter-spacing:1px;';
      text.innerHTML = '❄️ Magische Schneewelt wird geladen...';
      fade.appendChild(text); document.body.appendChild(fade);
      sState.fadeOverlayEl = fade;
    }
    if (!sState.hudEl) {
      var hud = document.createElement('div');
      hud.id = 'eep-schneewelt-hud';
      hud.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10006;background:rgba(15,23,42,0.88);color:#f8fafc;padding:8px 14px;border-radius:14px;font:600 13px system-ui,sans-serif;border:1px solid #38bdf8;display:none;box-shadow:0 8px 24px rgba(0,0,0,0.5);white-space:nowrap;backdrop-filter:blur(6px);';
      document.body.appendChild(hud);
      sState.hudEl = hud;

      hud.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var akt = btn.dataset.akt;
        if (akt === 'wetter') EEP.schneewelt.naechstesWetter();
        else if (akt === 'tp-schneewelt' && EEP.autoComp) EEP.autoComp.teleportiereZu(-242, 18.2, -990, 0.15);
        else if (akt === 'tp-tunnel' && EEP.autoComp) EEP.autoComp.teleportiereZu(-240, 16.0, -600, 0);
        else if (akt === 'tp-vorland' && EEP.autoComp) EEP.autoComp.teleportiereZu(-240, 15.6, -445, 0);
      });
    }

    window.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key.toLowerCase() === 'n' && EEP.schneewelt) EEP.schneewelt.naechstesWetter();
    });
  }

  function aktualisiereHUD(z) {
    if (!sState.hudEl) return;
    if (!z.inSchneewelt && z.transitionAlpha <= 0.01) {
      sState.hudEl.style.display = 'none';
      return;
    }
    sState.hudEl.style.display = 'flex';
    var wIcons = { schneefall: '🌨️', schneesturm: '🌪️', wintersonne: '☀️', eisnebel: '🌫️' };
    var wIcon = wIcons[z.wetterModus] || '❄️';
    var mIcon = z.musikStatus === 'spielt' ? '▶️' : (z.musikStatus === 'fadein' ? '↗️' : (z.musikStatus === 'fadeout' ? '↘️' : '⏸️'));

    sState.hudEl.innerHTML =
      '<span style="color:#7dd3fc;margin-right:10px;">❄️ Magische Schneewelt</span>' +
      '<button data-akt="wetter" style="background:#1e293b;color:#f8fafc;border:1px solid #64748b;padding:4px 9px;border-radius:8px;font:inherit;cursor:pointer;margin-right:8px;">[N] Wetter: ' + wIcon + ' ' + z.wetterModus + '</button>' +
      '<span style="color:#94a3b8;margin-right:10px;">🎵 ' + mIcon + ' ' + Math.round(z.musikLautstaerke) + '% (' + Math.floor(z.musikPositionSek) + 's)</span>' +
      '<button data-akt="tp-schneewelt" style="background:#0284c7;color:#fff;border:none;padding:4px 8px;border-radius:8px;font:inherit;cursor:pointer;margin-right:4px;">❄️ Tal</button>' +
      '<button data-akt="tp-tunnel" style="background:#334155;color:#fff;border:none;padding:4px 8px;border-radius:8px;font:inherit;cursor:pointer;margin-right:4px;">🚇 Tunnel</button>' +
      '<button data-akt="tp-vorland" style="background:#334155;color:#fff;border:none;padding:4px 8px;border-radius:8px;font:inherit;cursor:pointer;">🏔️ Vorland</button>';
  }

  // --------------------------------------------------------------------------
  // 3. Schneetal-Terrain: 340 x 590 m mit Vertex-Farben
  // --------------------------------------------------------------------------
  function baueTerrainMesh(schnee) {
    var geo = new THREE.PlaneGeometry(340, 590, 110, 160);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position, count = pos.count;
    var colors = new Float32Array(count * 3);
    var cSchnee = new THREE.Color(0xf8fafc), cEis = new THREE.Color(0xe0f2fe), cFels = new THREE.Color(0x64748b), tmpC = new THREE.Color();

    for (var i = 0; i < count; i++) {
      var wx = pos.getX(i) - 250.0, wz = pos.getZ(i) - 1085.0;
      var h = schnee.hoehe(wx, wz);
      if (schnee.abstandZurStrasse(wx, wz) <= 4.25) h -= 0.02;
      pos.setX(i, wx); pos.setY(i, h); pos.setZ(i, wz);

      var tH = (h - 16.0) / 100.0;
      if (tH < 0.15) tmpC.copy(cSchnee);
      else if (tH < 0.55) tmpC.copy(cSchnee).lerp(cEis, (tH - 0.15) / 0.40);
      else tmpC.copy(cEis).lerp(cFels, (tH - 0.55) / 0.45);

      colors[i * 3]     = tmpC.r;
      colors[i * 3 + 1] = tmpC.g;
      colors[i * 3 + 2] = tmpC.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    var mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    var tMesh = new THREE.Mesh(geo, mat);
    tMesh.receiveShadow = true;
    return tMesh;
  }

  // --------------------------------------------------------------------------
  // 4. Winterstraße: Schneefahrbahn, Schneewälle, Schneestangen & Wendeplatz
  // --------------------------------------------------------------------------
  function baueStrasse(parent, schnee) {
    var pts = schnee.strassenPunkte, n = pts.length;
    var strGeo = new THREE.BufferGeometry(), vertList = [], normList = [], idxList = [], halbeB = 4.25;

    for (var i = 0; i < n; i++) {
      var p = pts[i];
      var fX = (i < n - 1 ? pts[i + 1].x - p.x : p.x - pts[i - 1].x);
      var fZ = (i < n - 1 ? pts[i + 1].z - p.z : p.z - pts[i - 1].z);
      var l = Math.sqrt(fX * fX + fZ * fZ) || 1, nX = -fZ / l, nZ = fX / l, yS = p.y + 0.03;

      vertList.push(p.x - nX * halbeB, yS, p.z - nZ * halbeB, p.x + nX * halbeB, yS, p.z + nZ * halbeB);
      normList.push(0, 1, 0, 0, 1, 0);
      if (i < n - 1) {
        var base = i * 2;
        idxList.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }
    strGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertList, 3));
    strGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normList, 3));
    strGeo.setIndex(idxList);

    var schneeStrMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.78, metalness: 0.05 });
    parent.add(new THREE.Mesh(strGeo, schneeStrMat));

    var wendeGeo = new THREE.CircleGeometry(18.0, 32);
    wendeGeo.rotateX(-Math.PI / 2);
    addMesh(parent, wendeGeo, schneeStrMat, -240.0, 19.53, -1290.0);

    var wallGeoL = new THREE.BufferGeometry(), wallGeoR = new THREE.BufferGeometry();
    var wLVerts = [], wRVerts = [], wIdx = [];
    var schneeWallMat = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 });

    for (var j = 0; j < n; j++) {
      var pJ = pts[j];
      var fwdX = (j < n - 1 ? pts[j + 1].x - pJ.x : pJ.x - pts[j - 1].x);
      var fwdZ = (j < n - 1 ? pts[j + 1].z - pJ.z : pJ.z - pts[j - 1].z);
      var lenJ = Math.sqrt(fwdX * fwdX + fwdZ * fwdZ) || 1, normX = -fwdZ / lenJ, normZ = fwdX / lenJ;

      var lx = pJ.x - normX * halbeB, lz = pJ.z - normZ * halbeB;
      var rx = pJ.x + normX * halbeB, rz = pJ.z + normZ * halbeB;
      wLVerts.push(lx, pJ.y + 0.03, lz, lx - normX * 0.85, pJ.y + 0.90, lz - normZ * 0.85);
      wRVerts.push(rx, pJ.y + 0.03, rz, rx + normX * 0.85, pJ.y + 0.90, rz + normZ * 0.85);

      if (j < n - 1) {
        var bIdx = j * 2;
        wIdx.push(bIdx, bIdx + 1, bIdx + 2, bIdx + 1, bIdx + 3, bIdx + 2);
      }
    }
    wallGeoL.setAttribute('position', new THREE.Float32BufferAttribute(wLVerts, 3)); wallGeoL.setIndex(wIdx);
    parent.add(new THREE.Mesh(wallGeoL, schneeWallMat));
    wallGeoR.setAttribute('position', new THREE.Float32BufferAttribute(wRVerts, 3)); wallGeoR.setIndex(wIdx);
    parent.add(new THREE.Mesh(wallGeoR, schneeWallMat));

    var stangeGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6);
    var stangeMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
    var sCount = Math.floor(schnee.strassenLaenge / 14) * 2;
    var stangeInst = new THREE.InstancedMesh(stangeGeo, stangeMat, sCount);
    var dummy = new THREE.Object3D(), sIdx = 0, distSum = 0;

    for (var s = 0; s < n - 1; s++) {
      var p1 = pts[s], p2 = pts[s + 1];
      var d = Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.z - p1.z) * (p2.z - p1.z));
      distSum += d;
      if (distSum >= 14.0) {
        distSum -= 14.0;
        var lxS = -(p2.z - p1.z) / d, lzS = (p2.x - p1.x) / d;
        dummy.position.set(p1.x - lxS * 5.1, p1.y + 1.1, p1.z - lzS * 5.1);
        dummy.updateMatrix(); stangeInst.setMatrixAt(sIdx++, dummy.matrix);
        dummy.position.set(p1.x + lxS * 5.1, p1.y + 1.1, p1.z + lzS * 5.1);
        dummy.updateMatrix(); stangeInst.setMatrixAt(sIdx++, dummy.matrix);
      }
    }
    stangeInst.instanceMatrix.needsUpdate = true;
    parent.add(stangeInst);
  }

  // --------------------------------------------------------------------------
  // 5. Hochgebirgsgipfel & 5 Erlebnis-Stationen
  // --------------------------------------------------------------------------
  function baueStationenUndGipfel(parent, schnee, sceneEl) {
    var schneeFelsMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.88 });
    var holzMat = new THREE.MeshLambertMaterial({ color: 0x5c3a21 });
    var fensterMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfbbf24, emissiveIntensity: 2.2 });
    var eisGlanzMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 1.2, transparent: true, opacity: 0.82 });

    // Gipfel
    for (var g = 0; g < schnee.gipfel.length; g++) {
      var gp = schnee.gipfel[g];
      var gMesh = addMesh(parent, new THREE.ConeGeometry(gp.radius, gp.hoehe, gp.segmente || 8), schneeFelsMat, gp.x, gp.hoehe * 0.5, gp.z);
      gMesh.rotation.y = (g * 1.4) % Math.PI;
    }

    // Station 1: Lawinengalerie am Nordportal (Z = -790..-825)
    var galerieGroup = new THREE.Group();
    galerieGroup.id = 'schneewelt-galerie';
    galerieGroup.name = 'schneewelt-galerie';
    addMesh(galerieGroup, new THREE.BoxGeometry(11.5, 0.45, 35), schneeFelsMat, -240, 22.8, -807.5, 0.12, 0, 0);
    for (var pz = -792; pz >= -824; pz -= 4.0) {
      addMesh(galerieGroup, new THREE.BoxGeometry(0.7, 6.2, 0.7), holzMat, -245.5, 19.3, pz);
      addMesh(galerieGroup, new THREE.ConeGeometry(0.12, 1.4, 6), eisGlanzMat, -245.5, 22.0, pz, Math.PI);
    }
    parent.add(galerieGroup);

    // Station 2: Gletschersee & Brücke (Z = -890..-950)
    var seeGroup = new THREE.Group();
    seeGroup.id = 'schneewelt-gletschersee';
    seeGroup.name = 'schneewelt-gletschersee';
    var seeGeo = new THREE.CircleGeometry(32, 32);
    seeGeo.rotateX(-Math.PI / 2);
    addMesh(seeGroup, seeGeo, new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.88 }), -222, 16.45, -920);
    addMesh(seeGroup, new THREE.BoxGeometry(9.5, 0.4, 38), holzMat, -222, 16.85, -900);
    addMesh(seeGroup, new THREE.BoxGeometry(0.3, 1.2, 38), holzMat, -226.5, 17.5, -900);
    addMesh(seeGroup, new THREE.BoxGeometry(0.3, 1.2, 38), holzMat, -217.5, 17.5, -900);
    parent.add(seeGroup);

    // Station 3: Bergdorf St. Kristall & Gondelbahn (Z = -1000..-1090)
    var dorfGroup = new THREE.Group();
    dorfGroup.id = 'schneewelt-bergdorf';
    dorfGroup.name = 'schneewelt-bergdorf';
    var cList = schnee.stationen.bergdorf.chalets;
    for (var c = 0; c < cList.length; c++) {
      var ch = cList[c], cG = new THREE.Group();
      cG.position.set(ch.x, schnee.hoehe(ch.x, ch.z), ch.z);
      cG.rotation.y = ch.yaw || 0;
      addMesh(cG, new THREE.BoxGeometry(9.0, 5.0, 7.5), holzMat, 0, 2.5, 0);
      addMesh(cG, new THREE.BoxGeometry(10.5, 0.4, 9.0), schneeFelsMat, 0, 5.6, 0);
      addMesh(cG, new THREE.BoxGeometry(1.2, 1.2, 0.2), fensterMat, 2.2, 2.4, 3.8);
      addMesh(cG, new THREE.BoxGeometry(1.2, 1.2, 0.2), fensterMat, -2.2, 2.4, 3.8);
      if (ch.turm) {
        addMesh(cG, new THREE.BoxGeometry(3.5, 9.0, 3.5), holzMat, 0, 9.5, 0);
        addMesh(cG, new THREE.ConeGeometry(2.4, 5.5, 8), schneeFelsMat, 0, 16.5, 0);
      }
      dorfGroup.add(cG);
    }

    var gbGroup = new THREE.Group();
    gbGroup.id = 'schneewelt-gondelbahn';
    gbGroup.name = 'schneewelt-gondelbahn';
    var gb = schnee.stationen.bergdorf.gondelbahn;
    addMesh(gbGroup, new THREE.CylinderGeometry(0.8, 1.2, 35, 8), holzMat, gb.stuetze.x, 35.0, gb.stuetze.z);
    addMesh(gbGroup, new THREE.BoxGeometry(12, 0.8, 1.2), holzMat, gb.stuetze.x, 52.0, gb.stuetze.z);

    sState.gondeln = [];
    var gondelMatRot = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
    var gondelMatBlau = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
    [gondelMatRot, gondelMatBlau].forEach(function (mat, gIdx) {
      var gObj = new THREE.Group();
      addMesh(gObj, new THREE.BoxGeometry(2.4, 2.2, 1.8), mat, 0, 0, 0);
      addMesh(gObj, new THREE.BoxGeometry(2.0, 0.9, 1.85), fensterMat, 0, 0.2, 0);
      addMesh(gObj, new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), holzMat, 0, 1.8, 0);
      gbGroup.add(gObj);
      sState.gondeln.push({ obj: gObj, offset: gIdx * 0.5 });
    });
    dorfGroup.add(gbGroup);
    parent.add(dorfGroup);

    // Station 4: Magischer Eisgletscher-Torbogen (Z = -1140..-1195)
    var bogenGroup = new THREE.Group();
    bogenGroup.id = 'schneewelt-eisbogen';
    bogenGroup.name = 'schneewelt-eisbogen';
    var eb = schnee.stationen.eisbogen;
    addMesh(bogenGroup, new THREE.TorusGeometry(8.5, 2.2, 16, 24, Math.PI), eisGlanzMat, eb.x, eb.y + 4.5, eb.z);
    addMesh(bogenGroup, new THREE.CylinderGeometry(1.6, 2.2, 10, 8), eisGlanzMat, eb.x - 7.5, eb.y + 5.0, eb.z);
    addMesh(bogenGroup, new THREE.CylinderGeometry(1.6, 2.2, 10, 8), eisGlanzMat, eb.x + 7.5, eb.y + 5.0, eb.z);
    parent.add(bogenGroup);

    // Station 5: Panorama-Wendeplatz mit Eiskristall-Monument (Z = -1260..-1310)
    var wendeGroup = new THREE.Group();
    wendeGroup.id = 'schneewelt-wendeplatz';
    wendeGroup.name = 'schneewelt-wendeplatz';
    var wp = schnee.stationen.wendeplatz;
    addMesh(wendeGroup, new THREE.CylinderGeometry(2.4, 3.2, 1.4, 8), schneeFelsMat, wp.x, wp.y + 0.7, wp.z);
    sState.kristallMonument = addMesh(wendeGroup, new THREE.OctahedronGeometry(2.6, 2), eisGlanzMat, wp.x, wp.y + 4.2, wp.z);
    parent.add(wendeGroup);

    // DOM-Knoten für Scene-Graph Referenzierung
    if (sceneEl) {
      if (!document.getElementById('schneewelt-gondelbahn')) {
        var gbEnt = document.createElement('a-entity'); gbEnt.id = 'schneewelt-gondelbahn'; sceneEl.appendChild(gbEnt);
      }
      if (!document.getElementById('schneewelt-eisbogen')) {
        var ebEnt = document.createElement('a-entity'); ebEnt.id = 'schneewelt-eisbogen'; sceneEl.appendChild(ebEnt);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 6. 240+ verschneite Tannen (InstancedMesh) & Schneefall-Partikelsystem
  // --------------------------------------------------------------------------
  function baueNaturUndPartikel(parent, schnee) {
    var tList = schnee.schneeTannen;
    var stammGeo = new THREE.CylinderGeometry(0.22, 0.35, 2.5, 8);
    var kronGeo  = new THREE.ConeGeometry(1.9, 3.8, 8);
    var stammMat = new THREE.MeshLambertMaterial({ color: 0x3e2723 });
    var nadelMat = new THREE.MeshLambertMaterial({ color: 0x14532d });
    var haubeMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });

    var stammInst = new THREE.InstancedMesh(stammGeo, stammMat, tList.length);
    var kroneInst = new THREE.InstancedMesh(kronGeo, nadelMat, tList.length * 2);
    var haubeInst = new THREE.InstancedMesh(kronGeo, haubeMat, tList.length * 2);
    var dummy = new THREE.Object3D(), kIdx = 0;

    for (var i = 0; i < tList.length; i++) {
      var t = tList[i], s = t.scale || 1.0;
      dummy.scale.set(s, s, s); dummy.rotation.set(0, (i * 1.5) % 6.28, 0);
      dummy.position.set(t.x, t.y + 1.25 * s, t.z); dummy.updateMatrix(); stammInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.x, t.y + 3.2 * s, t.z); dummy.updateMatrix(); kroneInst.setMatrixAt(kIdx, dummy.matrix);
      dummy.position.set(t.x, t.y + 3.6 * s, t.z); dummy.scale.set(s * 0.95, s * 0.45, s * 0.95); dummy.updateMatrix(); haubeInst.setMatrixAt(kIdx, dummy.matrix);
      kIdx++;

      dummy.scale.set(s * 0.75, s * 0.75, s * 0.75);
      dummy.position.set(t.x, t.y + 5.2 * s, t.z); dummy.updateMatrix(); kroneInst.setMatrixAt(kIdx, dummy.matrix);
      dummy.position.set(t.x, t.y + 5.5 * s, t.z); dummy.scale.set(s * 0.70, s * 0.38, s * 0.70); dummy.updateMatrix(); haubeInst.setMatrixAt(kIdx, dummy.matrix);
      kIdx++;

      if (EEP.lod && typeof EEP.lod.registriere === 'function') {
        var pObj = new THREE.Object3D(); pObj.position.set(t.x, t.y, t.z); EEP.lod.registriere(pObj, 'baum');
      }
    }
    stammInst.instanceMatrix.needsUpdate = true; kroneInst.instanceMatrix.needsUpdate = true; haubeInst.instanceMatrix.needsUpdate = true;
    parent.add(stammInst); parent.add(kroneInst); parent.add(haubeInst);

    // Schneefall-Partikelsystem (450 tanzende Schneeflocken)
    var pCount = 450, pGeo = new THREE.BufferGeometry();
    var pPos = new Float32Array(pCount * 3), pVel = new Float32Array(pCount * 3);
    for (var p = 0; p < pCount; p++) {
      pPos[p * 3]     = (Math.random() - 0.5) * 80;
      pPos[p * 3 + 1] = Math.random() * 35;
      pPos[p * 3 + 2] = (Math.random() - 0.5) * 80;

      pVel[p * 3]     = (Math.random() - 0.5) * 0.8;
      pVel[p * 3 + 1] = -(1.5 + Math.random() * 2.5);
      pVel[p * 3 + 2] = (Math.random() - 0.5) * 0.8;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    var pSystem = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.85 }));
    parent.add(pSystem);

    sState.schneeFlockenGeo = pGeo;
    sState.schneeFlockenPos = pPos;
    sState.schneeFlockenVel = pVel;
    sState.schneeFlockenMesh = pSystem;
  }

  // --------------------------------------------------------------------------
  // 7. Initialisierung & A-Frame Szenenaufbau
  // --------------------------------------------------------------------------
  function initialisiereSchneeweltUI() {
    if (sState.initialisiert || !EEP.schneewelt) return;
    var sceneEl = document.querySelector('a-scene');
    if (!sceneEl) return;
    sState.initialisiert = true;

    EEP.schneewelt.initialisiere();
    baueOverlayUndHUD();

    var entity = document.getElementById('magische-schneewelt');
    if (!entity) {
      entity = document.createElement('a-entity');
      entity.id = 'magische-schneewelt';
      sceneEl.appendChild(entity);
    }
    var group = new THREE.Group();
    sState.schneeGruppe = group;

    var alpen = EEP.schneewelt;
    group.add(baueTerrainMesh(alpen));
    baueStrasse(group, alpen);
    baueStationenUndGipfel(group, alpen, sceneEl);
    baueNaturUndPartikel(group, alpen);

    entity.object3D.add(group);

    if (typeof window !== 'undefined' && window.location && window.location.search) {
      if (window.location.search.indexOf('schneewelttest=1') !== -1) {
        setTimeout(starteSchneeweltSelbsttest, 550);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 8. Selbsttest gemäß Spezifikation t-snow-world-001 (?schneewelttest=1)
  // --------------------------------------------------------------------------
  function starteSchneeweltSelbsttest() {
    if (!EEP.schneewelt || !EEP.welt || !EEP.kollision) return;
    var sw = EEP.schneewelt;

    // 1. talHoeheOk (EEP.welt.abfrage(-240, -900).hoehe liegt bei 16..20 m, untergrund 'strasse' auf der Stützpunktlinie)
    var aTal = EEP.welt.abfrage(-240, -900);
    var aStr = EEP.welt.abfrage(-222, -900);
    var hTalOk = aTal.hoehe >= 16.0 && aTal.hoehe <= 20.0;
    var hStrOk = (aStr.hoehe >= 16.0 && aStr.hoehe <= 20.0 && aStr.untergrund === 'strasse') ||
                 (aTal.hoehe >= 16.0 && aTal.hoehe <= 20.0 && aTal.untergrund === 'strasse');
    var talHoeheOk = Boolean(hTalOk && hStrOk && sw.hoehe(-390, -1000) >= 60.0 && sw.hoehe(-110, -1000) >= 60.0 && sw.hoehe(-240, -1360) >= 60.0);

    // 2. kesselKollisionOk
    var kWest = EEP.kollision.pruefe({ x: -360, y: 20, z: -1000, vorherX: -359, vorherZ: -1000, halbBreite: 1, halbLaenge: 2, hoehe: 2 });
    var kOst  = EEP.kollision.pruefe({ x: -120, y: 20, z: -1000, vorherX: -121, vorherZ: -1000, halbBreite: 1, halbLaenge: 2, hoehe: 2 });
    var kNord = EEP.kollision.pruefe({ x: -240, y: 20, z: -1340, vorherX: -240, vorherZ: -1339, halbBreite: 1, halbLaenge: 2, hoehe: 2 });
    var kPortal = EEP.kollision.pruefe({ x: -240, y: 16, z: -790, vorherX: -240, vorherZ: -789, halbBreite: 1, halbLaenge: 2, hoehe: 2 });
    var kesselKollisionOk = Boolean(kWest && kOst && kNord && (!kPortal || kPortal.eindringtiefe <= 0));

    // 3. transitionOk
    var zVor = sw.aktualisiere(0.016, { x: -240, z: -740 });
    var tAlphaVor = zVor.transitionAlpha;
    var zNach = sw.aktualisiere(0.016, { x: -240, z: -820 });
    var transitionOk = Boolean(tAlphaVor >= 0.5 && zNach.inSchneewelt === true);

    // 4. musikResumeOk
    var mOk1 = (sw.konfig.youtubeVideoId === '5w3rRFWzjcM');
    for (var s = 0; s < 50; s++) sw.aktualisiere(0.1, { x: -240, z: -820 });
    var mOk2 = (sw.gibZustand().musikPositionSek >= 4.5 && sw.gibZustand().musikLautstaerke > 80);
    sw.aktualisiere(0.1, { x: -240, z: -750 });
    var mStatFade = sw.gibZustand().musikStatus;
    for (var fo = 0; fo < 35; fo++) sw.aktualisiere(0.1, { x: -240, z: -750 });
    var mStatPause = sw.gibZustand().musikStatus;
    var mOk3 = (mStatFade === 'fadeout' && mStatPause === 'pausiert' && sw.gibZustand().musikLautstaerke === 0);
    sw.aktualisiere(0.1, { x: -240, z: -820 });
    var mOk4 = (sw.gibZustand().musikPositionSek >= 4.5 && sw.gibZustand().musikStatus === 'fadein');
    var musikResumeOk = Boolean(mOk1 && mOk2 && mOk3 && mOk4);

    // 5. wetterUndSzeneOk
    var wOk = sw.setzeWetter('schneesturm') && sw.setzeWetter('wintersonne') && sw.setzeWetter('schneefall');
    var tannenOk = sw.schneeTannen.length >= 220;
    var gbOk = Boolean(document.getElementById('schneewelt-gondelbahn') || (sState.schneeGruppe && sState.schneeGruppe.getObjectByName('schneewelt-gondelbahn')));
    var ebOk = Boolean(document.getElementById('schneewelt-eisbogen') || (sState.schneeGruppe && sState.schneeGruppe.getObjectByName('schneewelt-eisbogen')));
    var wetterUndSzeneOk = Boolean(wOk && tannenOk && gbOk && ebOk);

    var res = {
      talHoeheOk: talHoeheOk,
      kesselKollisionOk: kesselKollisionOk,
      transitionOk: transitionOk,
      musikResumeOk: musikResumeOk,
      wetterUndSzeneOk: wetterUndSzeneOk
    };

    console.log('SCHNEEWELT_TEST_RESULT:' + JSON.stringify(res));
    if (talHoeheOk && kesselKollisionOk && transitionOk && musikResumeOk && wetterUndSzeneOk) {
      console.log('SCHNEEWELT_TEST_OK');
    }

    var stEl = document.querySelector('[ki-steuerung]');
    if (stEl && stEl.components && stEl.components['ki-steuerung']) {
      stEl.components['ki-steuerung'].setzeKamera(8);
    }
    if (EEP.autoComp && typeof EEP.autoComp.teleportiereZu === 'function') {
      EEP.autoComp.teleportiereZu(-242, 18.2, -990, 0.15);
    }
  }

  // --------------------------------------------------------------------------
  // 9. Frame-Tick: Animationen, Partikel, Wetter & Transition
  // --------------------------------------------------------------------------
  EEP.schneeweltUI = {
    init: function () {
      initialisiereSchneeweltUI();
    },

    tick: function (timeMs, deltaSec) {
      if (!sState.initialisiert) this.init();
      var zeitSek = (timeMs || 0) * 0.001;

      // Baustellenwand ausblenden, sobald Scene-Graph verfügbar
      if (!sState.wandAusgeblendet) {
        var sceneEl = document.querySelector('a-scene');
        if (sceneEl && sceneEl.object3D) {
          sceneEl.object3D.traverse(function (obj) {
            if (obj && (obj.id === 'tauern-tunnel-baustelle' || obj.name === 'tauern-tunnel-baustelle')) {
              obj.visible = false;
              sState.wandAusgeblendet = true;
            }
          });
        }
      }

      var ac = EEP.autoComp;
      var autoPos = (ac && ac.el && ac.el.object3D) ? ac.el.object3D.position : null;
      var cam = document.querySelector('#haupt-kamera');
      var camPos = (cam && cam.object3D) ? cam.object3D.position : null;
      var rig = document.querySelector('#kamera-rig');
      var rigPos = (rig && rig.object3D) ? rig.object3D.position : null;

      var cX = (camPos && rigPos) ? (rigPos.x + camPos.x) : (autoPos ? autoPos.x : -240);
      var cY = (camPos && rigPos) ? (rigPos.y + camPos.y) : (autoPos ? autoPos.y : 16);
      var cZ = (camPos && rigPos) ? (rigPos.z + camPos.z) : (autoPos ? autoPos.z : -790);

      if (EEP.schneewelt) {
        var z = EEP.schneewelt.aktualisiere(deltaSec, autoPos || { x: cX, z: cZ });
        aktualisiereMusik(z);
        aktualisiereHUD(z);

        if (sState.fadeOverlayEl) {
          sState.fadeOverlayEl.style.opacity = Math.max(0, Math.min(1, z.transitionAlpha));
        }

        // Gondel-Seilbahn Animation
        sState.gondelProgress = (sState.gondelProgress + deltaSec * 0.035) % 1.0;
        var gbData = EEP.schneewelt.stationen.bergdorf.gondelbahn;
        for (var gi = 0; gi < sState.gondeln.length; gi++) {
          var gItem = sState.gondeln[gi];
          var gProg = (sState.gondelProgress + gItem.offset) % 1.0;
          var tFrac = gProg < 0.5 ? (gProg * 2.0) : ((1.0 - gProg) * 2.0);
          var gx = gbData.talStation.x + (gbData.bergStation.x - gbData.talStation.x) * tFrac;
          var gy = gbData.talStation.y + (gbData.bergStation.y - gbData.talStation.y) * tFrac;
          gItem.obj.position.set(gx, gy + 1.2, gbData.talStation.z);
        }

        // Eiskristall Monument Rotation
        if (sState.kristallMonument) {
          sState.kristallMonument.rotation.y = zeitSek * 1.4;
          sState.kristallMonument.rotation.z = Math.sin(zeitSek * 1.8) * 0.15;
        }

        // Schneefall Partikelsystem um die Kamera
        if (sState.schneeFlockenPos && sState.schneeFlockenVel && sState.schneeFlockenGeo) {
          var wDat = EEP.schneewelt.wetterDaten[z.wetterModus] || EEP.schneewelt.wetterDaten.schneefall;
          var pArray = sState.schneeFlockenPos;
          var vArray = sState.schneeFlockenVel;
          var wWind = wDat.windStaerke * (z.wetterModus === 'schneesturm' ? 3.2 : 1.0);

          for (var p = 0; p < pArray.length / 3; p++) {
            var idx = p * 3;
            pArray[idx]     += (vArray[idx] + wWind * 0.4) * deltaSec * 8;
            pArray[idx + 1] += vArray[idx + 1] * deltaSec * 8;
            pArray[idx + 2] += vArray[idx + 2] * deltaSec * 8;

            if (pArray[idx + 1] < cY - 8.0) {
              pArray[idx]     = cX + (Math.random() - 0.5) * 60;
              pArray[idx + 1] = cY + 16.0 + Math.random() * 8;
              pArray[idx + 2] = cZ + (Math.random() - 0.5) * 60;
            }
          }
          sState.schneeFlockenGeo.attributes.position.needsUpdate = true;
          if (sState.schneeFlockenMesh) sState.schneeFlockenMesh.visible = z.inSchneewelt;
        }

        // Dynamische Wetter-Atmosphäre (Himmel, Nebel)
        if (z.inSchneewelt) {
          var wD = EEP.schneewelt.wetterDaten[z.wetterModus];
          var himmel = document.querySelector('#himmel');
          if (himmel && wD) himmel.setAttribute('color', wD.himmelFarbe);

          var sceneEl = document.querySelector('a-scene');
          if (sceneEl && sceneEl.object3D && sceneEl.object3D.fog && wD) {
            sceneEl.object3D.fog.color.set(wD.nebelFarbe);
            sceneEl.object3D.fog.near = wD.nebelNear;
            sceneEl.object3D.fog.far  = wD.nebelFar;
          }
        }
      }
    }
  };

  function koppleAnSzene() {
    if (typeof AFRAME === 'undefined' || !AFRAME.components) return;
    var steuerDef = AFRAME.components['ki-steuerung'];
    if (steuerDef && steuerDef.Component && !steuerDef.Component.prototype._schneeweltGekoppelt) {
      var proto = steuerDef.Component.prototype;
      var origTick = proto.tick;
      proto._schneeweltGekoppelt = true;
      proto.tick = function (time, dt) {
        if (origTick) origTick.call(this, time, dt);
        var deltaSec = dt ? Math.min(dt / 1000, 0.08) : 0.016;
        EEP.schneeweltUI.tick(time || 0, deltaSec);
      };
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    EEP.schneeweltUI.init();
    koppleAnSzene();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      EEP.schneeweltUI.init();
      koppleAnSzene();
    });
  }
})();
