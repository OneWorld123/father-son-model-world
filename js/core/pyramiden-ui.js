/* ============================================================================
 * js/core/pyramiden-ui.js – 3D-High-Poly-Pyramidenwelt, Geheimknopf, Steintor,
 * Laras Fackel & YouTube-Musik-Player (Lgqv6LGtCvA) mit Fade-In/Out & Resume.
 * ============================================================================ */
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.pyramidenUI = '1.0.0';

  var pState = {
    initialisiert: false,
    pyramideUmgebaut: false,
    torGroup: null,
    knopfSteinMesh: null,
    knopfJuwelMesh: null,
    horusKristall: null,
    horusRing: null,
    diamantenMeshes: [],
    schalenFlammeGroups: [],
    schalenLights: [],
    fackelGroup: null,
    fackelFlamme: null,
    fackelLight: null,
    hudBannerEl: null,
    ytPlayer: null,
    ytBereit: false,
    ytSpieltGerade: false,
    ytApiGeladen: false,
    ambientGain: null,
    ambientOscs: null
  };

  function addMesh(parent, geo, mat, x, y, z, rx, ry, rz) {
    var m = new THREE.Mesh(geo, mat);
    if (typeof x === 'number') m.position.set(x, y || 0, z || 0);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    parent.add(m);
    return m;
  }

  // --------------------------------------------------------------------------
  // 1. YouTube Audio-Spur (https://youtu.be/Lgqv6LGtCvA) + WebAudio-Begleitung
  //    mit sanftem Fade-In, langsamem Fade-Out beim Rausgehen & exakt Resume!
  // --------------------------------------------------------------------------
  function initialisiereMusikSystem() {
    if (typeof document === 'undefined' || pState.ytApiGeladen) return;
    pState.ytApiGeladen = true;

    var ytHost = document.createElement('div');
    ytHost.id = 'eep-yt-pyramide-wrap';
    ytHost.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;overflow:hidden;';
    var ytInner = document.createElement('div');
    ytInner.id = 'eep-yt-pyramide-player';
    ytHost.appendChild(ytInner);
    document.body.appendChild(ytHost);

    function erzeugeYTPlayer() {
      if (!window.YT || !window.YT.Player || pState.ytPlayer) return;
      try {
        pState.ytPlayer = new window.YT.Player('eep-yt-pyramide-player', {
          height: '1',
          width: '1',
          videoId: 'Lgqv6LGtCvA',
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            loop: 1,
            playlist: 'Lgqv6LGtCvA',
            modestbranding: 1,
            rel: 0,
            origin: window.location.origin
          },
          events: {
            onReady: function (ev) {
              pState.ytBereit = true;
              ev.target.setVolume(0);
            }
          }
        });
      } catch (e) {}
    }

    if (window.YT && window.YT.Player) {
      erzeugeYTPlayer();
    } else {
      var prevCb = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof prevCb === 'function') prevCb();
        erzeugeYTPlayer();
      };
      var tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    }
  }

  function aktualisierePyramidenMusik(z) {
    if (!z) return;
    initialisiereMusikSystem();

    // 1. YouTube IFrame Player für https://youtu.be/Lgqv6LGtCvA steuern
    if (pState.ytBereit && pState.ytPlayer && typeof pState.ytPlayer.setVolume === 'function') {
      try {
        var volProzent = Math.round(Math.max(0, Math.min(1, z.musikLautstaerke)) * 100);
        pState.ytPlayer.setVolume(volProzent);

        if (z.musikSpielt && !pState.ytSpieltGerade) {
          // Exakt an der gemerkten Stelle fortsetzen!
          if (typeof pState.ytPlayer.getCurrentTime === 'function') {
            var istZeit = pState.ytPlayer.getCurrentTime() || 0;
            if (Math.abs(istZeit - z.musikPositionSek) > 1.5 && z.musikPositionSek > 0.2) {
              pState.ytPlayer.seekTo(z.musikPositionSek, true);
            }
          }
          pState.ytPlayer.playVideo();
          pState.ytSpieltGerade = true;
        } else if (z.musikSpielt && pState.ytSpieltGerade) {
          if (typeof pState.ytPlayer.getCurrentTime === 'function') {
            var ytT = pState.ytPlayer.getCurrentTime();
            if (typeof ytT === 'number' && ytT > 0) {
              z.musikPositionSek = Math.round(ytT * 1000) / 1000;
            }
          }
        } else if (!z.musikSpielt && pState.ytSpieltGerade) {
          // Erst wenn Lautstärke komplett ausgeblendet (0.0) ist -> pausieren, Position bleibt erhalten!
          if (typeof pState.ytPlayer.getCurrentTime === 'function') {
            var stopT = pState.ytPlayer.getCurrentTime();
            if (typeof stopT === 'number' && stopT > 0) {
              z.musikPositionSek = Math.round(stopT * 1000) / 1000;
            }
          }
          pState.ytPlayer.pauseVideo();
          pState.ytSpieltGerade = false;
        }
      } catch (e) {}
    }

    // 2. Sanfter ägyptischer WebAudio-Begleitklang (falls Offline / Autoplay-Schutz)
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (z.musikSpielt && !pState.ambientGain) {
        var ctx = EEP.audioCtx || (EEP.audioCtx = new AudioCtx());
        var master = ctx.createGain();
        master.gain.value = 0.0001;
        master.connect(ctx.destination);
        var freqs = [146.83, 220.0, 293.66, 369.99]; // D-Phrygisch-Dominant (Ägyptische Skala)
        pState.ambientOscs = freqs.map(function (f) {
          var o = ctx.createOscillator();
          var gNode = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = f;
          gNode.gain.value = 0.012;
          o.connect(gNode);
          gNode.connect(master);
          o.start();
          return o;
        });
        pState.ambientGain = master;
      }
      if (pState.ambientGain && EEP.audioCtx) {
        var zielGain = z.musikSpielt ? (z.musikLautstaerke * 0.25) : 0.0001;
        pState.ambientGain.gain.setTargetAtTime(zielGain, EEP.audioCtx.currentTime, 0.08);
      }
    } catch (e) {}
  }

  function spieleGeheimnisUndTorSound() {
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      var ctx = EEP.audioCtx || (EEP.audioCtx = new AudioCtx());
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      [440, 554.37, 659.25, 880].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.14);
        gain.gain.setValueAtTime(0.001, now + i * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.11, now + i * 0.14 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + i * 0.14 + 1.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.14);
        osc.stop(now + i * 0.14 + 1.15);
      });
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // 2. High-Poly-Vasen-Generator per THREE.LatheGeometry (32 Segmente)
  // --------------------------------------------------------------------------
  function erzeugeHighPolyVase(typIdx, matHaupt, matGold) {
    var vGroup = new THREE.Group();
    var pts = [];
    for (var i = 0; i <= 16; i++) {
      var t = i / 16;
      var y = t * 0.95;
      var r = (typIdx % 3 === 0)
        ? (0.11 + Math.sin(t * Math.PI) * 0.22 - Math.sin(t * Math.PI * 2) * 0.06 + (t > 0.78 ? (t - 0.78) * 0.45 : 0))
        : ((typIdx % 3 === 1) ? (0.14 + Math.sin(Math.pow(t, 0.7) * Math.PI) * 0.20) : (0.10 + Math.pow(Math.sin(t * Math.PI * 0.85), 1.4) * 0.18 + (t > 0.82 ? (t - 0.82) * 0.55 : 0)));
      pts.push(new THREE.Vector2(Math.max(0.06, r), y));
    }
    var vaseMesh = addMesh(vGroup, new THREE.LatheGeometry(pts, 32), matHaupt, 0, 0, 0);
    vaseMesh.castShadow = true;
    addMesh(vGroup, new THREE.TorusGeometry(0.28, 0.018, 14, 32), matGold, 0, 0.46, 0, Math.PI / 2);
    addMesh(vGroup, new THREE.TorusGeometry(0.15, 0.015, 12, 32), matGold, 0, 0.78, 0, Math.PI / 2);
    [-1, 1].forEach(function (s) {
      addMesh(vGroup, new THREE.TorusGeometry(0.13, 0.018, 12, 24, Math.PI * 1.15), matGold, s * 0.22, 0.62, 0, 0, 0, s * 0.25);
    });
    return vGroup;
  }

  // --------------------------------------------------------------------------
  // 3. Begehbare Cheops-Pyramide + Geheimknopf + Steintor + High-Poly-Schatzkammer
  // --------------------------------------------------------------------------
  function baueBegehbarePyramidenWelt() {
    if (pState.pyramideUmgebaut || typeof document === 'undefined' || typeof THREE === 'undefined') return;
    var pyrEl = document.getElementById('afrika-pyramiden');
    if (!pyrEl || !pyrEl.object3D) return;
    pState.pyramideUmgebaut = true;
    if (EEP.pyramide) EEP.pyramide.initialisiere();

    var group = new THREE.Group();
    var sandsteinMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.82 });
    var stufenMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.76 });
    var tempelMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 });
    var innenWandMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.65, metalness: 0.25, side: THREE.DoubleSide });
    var obsidianMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.18, metalness: 0.75 });
    var goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.14, metalness: 0.94 });
    var goldEmissiveMat = new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xb45309, emissiveIntensity: 0.35, roughness: 0.18, metalness: 0.90 });
    var lapisMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.22, metalness: 0.65 });
    var tuerkisMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.20, metalness: 0.55 });
    var alabasterMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.25, metalness: 0.15 });
    var rubinMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xbe123c, emissiveIntensity: 0.55, roughness: 0.06, metalness: 0.88 });

    var diamantMats = [
      new THREE.MeshStandardMaterial({ color: 0xe0f2fe, emissive: 0x38bdf8, emissiveIntensity: 0.65, roughness: 0.04, metalness: 0.95 }),
      new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x059669, emissiveIntensity: 0.60, roughness: 0.05, metalness: 0.92 }),
      new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x2563eb, emissiveIntensity: 0.60, roughness: 0.05, metalness: 0.92 }),
      new THREE.MeshStandardMaterial({ color: 0xfb7185, emissive: 0xe11d48, emissiveIntensity: 0.60, roughness: 0.05, metalness: 0.92 }),
      new THREE.MeshStandardMaterial({ color: 0xc084fc, emissive: 0x7c3aed, emissiveIntensity: 0.60, roughness: 0.05, metalness: 0.92 })
    ];

    // A. Chefren & Mykerinos
    [{ x: -19, z: 7, r: 13.0, h: 18.0 }, { x: 17, z: 9, r: 9.0, h: 12.0 }].forEach(function (p) {
      addMesh(group, new THREE.ConeGeometry(p.r, p.h, 4), sandsteinMat, p.x, p.h * 0.5, p.z, 0, Math.PI / 4);
      for (var s = 0; s < 5; s++) {
        var frac = s / 5, sb = p.r * 1.40 * (1 - frac * 0.72), sh = (p.h * 0.65) / 5;
        addMesh(group, new THREE.BoxGeometry(sb, sh * 0.55, sb), stufenMat, p.x, frac * p.h * 0.68 + sh * 0.3, p.z);
      }
      addMesh(group, new THREE.ConeGeometry(p.r * 0.17, p.h * 0.16, 4), goldMat, p.x, p.h - p.h * 0.08, p.z, 0, Math.PI / 4);
    });

    // B. Begehbare Cheops-Pyramide (Oberteil ab y=5.0m + 4 Außenmauern mit offenem Nordportal)
    addMesh(group, new THREE.ConeGeometry(11.8, 16.5, 4), sandsteinMat, 0, 5.0 + 8.25, 0, 0, Math.PI / 4);
    addMesh(group, new THREE.ConeGeometry(2.6, 3.5, 4), goldMat, 0, 21.5 - 1.7, 0, 0, Math.PI / 4);
    addMesh(group, new THREE.BoxGeometry(3.2, 5.4, 21.8), stufenMat, -9.3, 2.7, 0);
    addMesh(group, new THREE.BoxGeometry(3.2, 5.4, 21.8), stufenMat,  9.3, 2.7, 0);
    addMesh(group, new THREE.BoxGeometry(21.8, 5.4, 3.2), stufenMat, 0, 2.7, 9.3);
    addMesh(group, new THREE.BoxGeometry(7.7, 5.4, 3.2), stufenMat, -5.55, 2.7, -9.3);
    addMesh(group, new THREE.BoxGeometry(7.7, 5.4, 3.2), stufenMat,  5.55, 2.7, -9.3);
    for (var st = 2; st < 5; st++) {
      var fr = st / 5, br = 15.5 * 1.40 * (1 - fr * 0.72), ho = (21.5 * 0.65) / 5;
      addMesh(group, new THREE.BoxGeometry(br, ho * 0.58, br), stufenMat, 0, fr * 21.5 * 0.68 + ho * 0.3, 0);
    }

    // C. Tempelportal + Versteckter Skarabäus-Schalter an der Vorderseite der rechten Tempelsäule (x=2.55, y=1.40, z=-13.38)
    addMesh(group, new THREE.BoxGeometry(2.6, 5.2, 2.2), tempelMat, -2.6, 2.6, -12.2);
    addMesh(group, new THREE.BoxGeometry(2.6, 5.2, 2.2), tempelMat,  2.6, 2.6, -12.2);
    addMesh(group, new THREE.BoxGeometry(8.4, 1.3, 2.6), stufenMat, 0, 5.5, -12.2);
    addMesh(group, new THREE.CylinderGeometry(0.95, 0.95, 0.42, 32), goldMat, 0, 5.5, -13.5, Math.PI / 2);

    // Dunkle Obsidian-Schalternische an der Vorderseite des rechten Pylons + goldene Trittplatte davor
    var nischeMesh = addMesh(group, new THREE.BoxGeometry(0.85, 0.95, 0.28), obsidianMat, 2.55, 1.40, -13.28);
    var rahmenMesh = addMesh(group, new THREE.TorusGeometry(0.28, 0.045, 16, 32), goldMat, 2.55, 1.40, -13.40);
    pState.knopfSteinMesh = addMesh(group, new THREE.SphereGeometry(0.20, 24, 18), tuerkisMat, 2.55, 1.40, -13.42);
    pState.knopfSteinMesh.scale.set(0.90, 1.20, 0.65);
    pState.knopfJuwelMesh = addMesh(group, new THREE.OctahedronGeometry(0.12, 2), diamantMats[1], 2.55, 1.40, -13.52);
    var trittPlatte = addMesh(group, new THREE.BoxGeometry(1.3, 0.08, 1.1), goldEmissiveMat, 2.55, 0.05, -14.05);
    pState.klickbareKnopfMeshes = [nischeMesh, rahmenMesh, pState.knopfSteinMesh, pState.knopfJuwelMesh, trittPlatte];

    var knopfGlowLight = new THREE.PointLight(0x10b981, 2.2, 5.5, 1.5);
    knopfGlowLight.position.set(2.55, 1.55, -13.85);
    group.add(knopfGlowLight);

    // D. Schweres Hieroglyphen-Steintor
    var torGroup = new THREE.Group();
    torGroup.position.set(0, 2.40, -11.8);
    addMesh(torGroup, new THREE.BoxGeometry(2.9, 4.8, 0.55), tempelMat, 0, 0, 0);
    [-1.4, -0.4, 0.6, 1.5].forEach(function (yOff) {
      addMesh(torGroup, new THREE.BoxGeometry(2.7, 0.14, 0.60), goldMat, 0, yOff, 0);
    });
    addMesh(torGroup, new THREE.CylinderGeometry(0.65, 0.65, 0.62, 32), goldEmissiveMat, 0, 0.1, 0, Math.PI / 2);
    addMesh(torGroup, new THREE.OctahedronGeometry(0.28, 2), rubinMat, 0, 0.1, -0.32);
    group.add(torGroup);
    pState.torGroup = torGroup;

    // E. Dunkles Granit-Innengewölbe & Goldpfad
    addMesh(group, new THREE.BoxGeometry(16.6, 0.12, 22.0), obsidianMat, 0, 0.06, -1.0);
    addMesh(group, new THREE.BoxGeometry(2.2, 0.14, 19.5), goldMat, 0, 0.07, -2.2);
    addMesh(group, new THREE.BoxGeometry(16.2, 0.4, 16.4), innenWandMat, 0, 9.2, 0);
    addMesh(group, new THREE.BoxGeometry(3.4, 0.35, 5.2), innenWandMat, 0, 4.9, -10.2);
    addMesh(group, new THREE.BoxGeometry(0.35, 4.9, 5.2), innenWandMat, -1.55, 2.45, -10.2);
    addMesh(group, new THREE.BoxGeometry(0.35, 4.9, 5.2), innenWandMat,  1.55, 2.45, -10.2);
    addMesh(group, new THREE.BoxGeometry(0.35, 9.2, 16.0), innenWandMat, -7.75, 4.6, 0);
    addMesh(group, new THREE.BoxGeometry(0.35, 9.2, 16.0), innenWandMat,  7.75, 4.6, 0);
    addMesh(group, new THREE.BoxGeometry(15.8, 9.2, 0.35), innenWandMat, 0, 4.6, 7.75);

    // F. 148 High-Poly-Diamanten & Edelsteine an allen Wänden
    pState.diamantenMeshes = [];
    var dGeo1 = new THREE.OctahedronGeometry(0.22, 2);
    var dGeo2 = new THREE.IcosahedronGeometry(0.19, 1);
    var dFassungGeo = new THREE.BoxGeometry(0.34, 0.34, 0.10);
    var dCount = 0;

    function platziereWandDiamant(x, y, z) {
      addMesh(group, dFassungGeo, goldMat, x, y, z);
      var dMesh = addMesh(group, (dCount % 2 === 0) ? dGeo1 : dGeo2, diamantMats[dCount % diamantMats.length], x, y, z);
      pState.diamantenMeshes.push(dMesh);
      dCount++;
    }

    for (var reihe = 0; reihe < 4; reihe++) {
      var yPos = 1.4 + reihe * 1.65;
      addMesh(group, new THREE.BoxGeometry(0.12, 0.18, 14.8), goldMat, -7.52, yPos, 0);
      addMesh(group, new THREE.BoxGeometry(0.12, 0.18, 14.8), goldMat,  7.52, yPos, 0);
      for (var sp = 0; sp < 12; sp++) {
        var zPos = -6.6 + sp * 1.2;
        platziereWandDiamant(-7.45, yPos, zPos);
        platziereWandDiamant( 7.45, yPos, zPos);
      }
    }
    for (var rS = 0; rS < 3; rS++) {
      var yS = 1.6 + rS * 1.85;
      addMesh(group, new THREE.BoxGeometry(14.6, 0.18, 0.12), goldMat, 0, yS, 7.52);
      for (var spS = 0; spS < 12; spS++) {
        platziereWandDiamant(-6.6 + spS * 1.2, yS, 7.45);
      }
    }
    for (var kIdx = 0; kIdx < 8; kIdx++) {
      var zK = -11.4 + kIdx * 0.52;
      platziereWandDiamant(-1.32, 1.85, zK);
      platziereWandDiamant( 1.32, 1.85, zK);
    }

    // G. 14 seltene gedrechselte High-Poly-Vasen & Amphoren (LatheGeometry, 32 Segmente)
    var vasenMatListe = [lapisMat, tuerkisMat, alabasterMat, goldMat, rubinMat];
    var vasenPos = [
      { x: -1.1, z: -8.6 }, { x: 1.1, z: -8.6 },
      { x: -6.4, z: -5.8 }, { x: -6.4, z: -2.2 }, { x: -6.4, z: 2.2 }, { x: -6.4, z: 5.8 },
      { x:  6.4, z: -5.8 }, { x:  6.4, z: -2.2 }, { x:  6.4, z: 2.2 }, { x:  6.4, z: 5.8 },
      { x: -3.8, z:  6.5 }, { x:  3.8, z:  6.5 }, { x: -2.2, z: 0.8 }, { x:  2.2, z: 0.8 }
    ];
    vasenPos.forEach(function (vp, idx) {
      addMesh(group, new THREE.CylinderGeometry(0.32, 0.38, 0.45, 24), obsidianMat, vp.x, 0.28, vp.z);
      addMesh(group, new THREE.CylinderGeometry(0.35, 0.35, 0.06, 24), goldMat, vp.x, 0.50, vp.z);
      var vase = erzeugeHighPolyVase(idx, vasenMatListe[idx % vasenMatListe.length], goldMat);
      vase.position.set(vp.x, 0.52, vp.z);
      group.add(vase);
    });

    // H. 4 monumentale Lotus-Säulen (32 Segmente)
    [{ x: -4.2, z: -3.8 }, { x: 4.2, z: -3.8 }, { x: -4.2, z: 3.8 }, { x: 4.2, z: 3.8 }].forEach(function (sp) {
      addMesh(group, new THREE.CylinderGeometry(0.85, 0.98, 0.55, 32), obsidianMat, sp.x, 0.32, sp.z);
      addMesh(group, new THREE.CylinderGeometry(0.62, 0.72, 7.6, 32), tempelMat, sp.x, 4.3, sp.z);
      [1.8, 3.6, 5.4, 7.0].forEach(function (ry) {
        addMesh(group, new THREE.TorusGeometry(0.69, 0.05, 16, 32), goldMat, sp.x, ry, sp.z, Math.PI / 2);
      });
      addMesh(group, new THREE.ConeGeometry(1.15, 1.1, 32), goldMat, sp.x, 8.35, sp.z, Math.PI);
    });

    // I. Goldener Sarkophag des Pharaos, schwebendes "Herz des Osiris" & 2 Anubis-Wächter
    addMesh(group, new THREE.BoxGeometry(4.6, 0.30, 5.8), obsidianMat, 0, 0.22, 1.2);
    addMesh(group, new THREE.BoxGeometry(3.6, 0.28, 4.8), goldMat, 0, 0.50, 1.2);
    addMesh(group, new THREE.BoxGeometry(1.55, 0.85, 3.10), lapisMat, 0, 1.05, 1.2);
    var deckel = addMesh(group, new THREE.CylinderGeometry(0.76, 0.76, 3.08, 32), goldMat, 0, 1.50, 1.2, Math.PI / 2);
    deckel.scale.set(1.0, 0.55, 1.0);
    addMesh(group, new THREE.SphereGeometry(0.38, 32, 24), goldEmissiveMat, 0, 1.82, 0.25);

    pState.horusKristall = addMesh(group, new THREE.OctahedronGeometry(0.58, 2), diamantMats[0], 0, 3.25, 1.2);
    pState.horusRing = addMesh(group, new THREE.TorusKnotGeometry(0.82, 0.045, 96, 20), goldEmissiveMat, 0, 3.25, 1.2);

    [-2.8, 2.8].forEach(function (ax) {
      addMesh(group, new THREE.BoxGeometry(1.1, 0.7, 1.3), obsidianMat, ax, 0.42, 1.5);
      addMesh(group, new THREE.CylinderGeometry(0.28, 0.36, 1.65, 24), obsidianMat, ax, 1.55, 1.5);
      addMesh(group, new THREE.ConeGeometry(0.42, 0.35, 24), goldMat, ax, 2.25, 1.5);
      addMesh(group, new THREE.ConeGeometry(0.26, 0.65, 24), obsidianMat, ax, 2.55, 1.30, Math.PI / 2);
      [-0.10, 0.10].forEach(function (ox) {
        addMesh(group, new THREE.ConeGeometry(0.06, 0.38, 12), goldMat, ax + ox, 2.85, 1.48);
        addMesh(group, new THREE.SphereGeometry(0.035, 12, 12), rubinMat, ax + ox * 0.85, 2.60, 1.12);
      });
      addMesh(group, new THREE.BoxGeometry(1.1, 0.55, 0.75), tempelMat, ax * 1.25, 0.35, 4.8);
      var goldBerg = addMesh(group, new THREE.IcosahedronGeometry(0.45, 2), goldEmissiveMat, ax * 1.25, 0.68, 4.8);
      goldBerg.scale.set(1.1, 0.55, 0.75);
    });

    // J. 4 goldene Feuerschalen
    pState.schalenFlammeGroups = [];
    pState.schalenLights = [];
    var flammeMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, emissive: 0xf97316, emissiveIntensity: 1.8, roughness: 0.1 });
    [{ x: -4.8, z: -4.8 }, { x: 4.8, z: -4.8 }, { x: -4.8, z: 4.8 }, { x: 4.8, z: 4.8 }].forEach(function (fp) {
      addMesh(group, new THREE.CylinderGeometry(0.18, 0.32, 0.95, 24), goldMat, fp.x, 0.55, fp.z);
      addMesh(group, new THREE.SphereGeometry(0.48, 24, 16, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.6), obsidianMat, fp.x, 1.15, fp.z);
      var flGroup = new THREE.Group();
      flGroup.position.set(fp.x, 1.18, fp.z);
      var flKern = addMesh(flGroup, new THREE.OctahedronGeometry(0.28, 2), flammeMat, 0, 0, 0);
      flKern.scale.set(1.0, 1.8, 1.0);
      flGroup.visible = false;
      group.add(flGroup);
      pState.schalenFlammeGroups.push(flGroup);

      var sLight = new THREE.PointLight(0xff922b, 0.0, 12.0, 1.5);
      sLight.position.set(fp.x, 1.65, fp.z);
      group.add(sLight);
      pState.schalenLights.push(sLight);
    });

    var kristallLight = new THREE.PointLight(0x38bdf8, 0.75, 16.0, 1.6);
    kristallLight.position.set(0, 3.6, 1.2);
    group.add(kristallLight);

    pyrEl.setObject3D('mesh', group);
    if (EEP.pyramide) {
      EEP.pyramide.zustand.diamantenAnzahl = pState.diamantenMeshes.length;
      EEP.pyramide.zustand.vasenAnzahl = vasenPos.length;
      EEP.pyramide.zustand.sarkophagOk = true;
    }
  }

  // --------------------------------------------------------------------------
  // 4. 3D-Fackel an Laras rechter Hand (laraComp.armR.wrist) + PointLight
  // --------------------------------------------------------------------------
  function stelleLaraFackelSicher() {
    var lc = EEP.laraComp;
    if (!lc || !lc.armR || !lc.armR.wrist || pState.fackelGroup || typeof THREE === 'undefined') return;

    var fGroup = new THREE.Group();
    fGroup.position.set(0, -0.04, -0.04);
    fGroup.rotation.x = Math.PI * 0.38;

    var holzMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    var bronzeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35, metalness: 0.80 });
    var glutMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf97316, emissiveIntensity: 2.4, roughness: 0.1 });
    var flammeAussenMat = new THREE.MeshStandardMaterial({ color: 0xfb923c, emissive: 0xea580c, emissiveIntensity: 1.8, transparent: true, opacity: 0.85 });

    addMesh(fGroup, new THREE.CylinderGeometry(0.026, 0.018, 0.52, 16), holzMat, 0, 0.20, 0);
    addMesh(fGroup, new THREE.CylinderGeometry(0.048, 0.028, 0.12, 16), bronzeMat, 0, 0.44, 0);

    var flammeGroup = new THREE.Group();
    flammeGroup.position.set(0, 0.54, 0);
    addMesh(flammeGroup, new THREE.ConeGeometry(0.055, 0.22, 16), glutMat, 0, 0, 0);
    var huelle = addMesh(flammeGroup, new THREE.OctahedronGeometry(0.075, 2), flammeAussenMat, 0, 0, 0);
    huelle.scale.set(1.0, 1.9, 1.0);
    fGroup.add(flammeGroup);

    var light = new THREE.PointLight(0xffa94d, 2.8, 19.0, 1.35);
    light.position.set(0, 0.62, 0);
    fGroup.add(light);

    fGroup.visible = false;
    lc.armR.wrist.add(fGroup);
    pState.fackelGroup = fGroup;
    pState.fackelFlamme = flammeGroup;
    pState.fackelLight = light;
  }

  // --------------------------------------------------------------------------
  // 5. Interaktives Abenteuer-HUD & Teleport vor den Pyramideneingang
  // --------------------------------------------------------------------------
  function teleportiereLaraVorPyramide() {
    var lc = EEP.laraComp;
    if (!lc) return;
    if (EEP.einstieg && EEP.einstieg.aktuellInFahrzeug) EEP.einstieg.steigeAus();
    if (typeof lc.teleportiereZu === 'function') {
      lc.teleportiereZu(146.5, 0.26, 196.2, 180);
    } else if (lc.el && lc.el.object3D) {
      lc.el.object3D.position.set(146.5, 0.26, 196.2);
      lc.el.object3D.rotation.y = Math.PI;
    }
    if (EEP.pyramide) EEP.pyramide.setzeFackel(true);
    var steuerEl = document.querySelector('[ki-steuerung]');
    if (steuerEl && steuerEl.components && steuerEl.components['ki-steuerung']) {
      steuerEl.components['ki-steuerung'].setzeKamera(1);
    }
  }

  function bauePyramidenHUD() {
    if (typeof document === 'undefined' || pState.hudBannerEl) return;
    var div = document.createElement('div');
    div.id = 'eep-pyramiden-hud';
    div.style.cssText = 'position:fixed;top:166px;left:50%;transform:translateX(-50%);z-index:10006;background:rgba(24,18,11,0.92);color:#fef3c7;padding:6px 14px;border-radius:10px;font:600 12px system-ui,sans-serif;border:1px solid #f59e0b;display:none;box-shadow:0 4px 16px rgba(0,0,0,0.55);white-space:nowrap;';
    document.body.appendChild(div);
    pState.hudBannerEl = div;

    div.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-pyr]');
      if (!btn) return;
      var akt = btn.getAttribute('data-pyr');
      if (akt === 'teleport') teleportiereLaraVorPyramide();
      else if (akt === 'knopf' && EEP.pyramide) { EEP.pyramide.drueckeGeheimKnopf(); }
      else if (akt === 'fackel' && EEP.pyramide) EEP.pyramide.setzeFackel();
      aktualisierePyramidenHUD();
    });

    if (EEP.bus) {
      EEP.bus.on('pyramide-tor', function () {
        spieleGeheimnisUndTorSound();
      });
    }

    // 3D-Mausklick-Raycaster direkt auf den Skarabäus-Knopf an der rechten Säule
    window.addEventListener('pointerdown', function (ev) {
      if (!pState.klickbareKnopfMeshes || !pState.klickbareKnopfMeshes.length || typeof THREE === 'undefined') return;
      if (ev.target && ev.target.tagName !== 'CANVAS') return;
      var sceneEl = document.querySelector('a-scene');
      if (!sceneEl || !sceneEl.camera) return;
      var rect = ev.target.getBoundingClientRect();
      var mouse = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1
      );
      var raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, sceneEl.camera);
      var hits = raycaster.intersectObjects(pState.klickbareKnopfMeshes, true);
      if (hits && hits.length > 0 && EEP.pyramide) {
        EEP.pyramide.drueckeGeheimKnopf();
        aktualisierePyramidenHUD();
      }
    });

    window.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (EEP.aktiveKamera !== 1 && EEP.aktiveKamera !== 7) return;
      var k = e.key.toLowerCase();
      if (k === 'g') {
        if (EEP.pyramide && (EEP.pyramide.zustand.naheAmKnopf || EEP.pyramide.zustand.inKammer)) {
          EEP.pyramide.drueckeGeheimKnopf();
        } else {
          teleportiereLaraVorPyramide();
        }
        e.preventDefault();
      } else if (k === 't') {
        if (EEP.pyramide) EEP.pyramide.setzeFackel();
        e.preventDefault();
      } else if (k === 'e' && EEP.pyramide && EEP.pyramide.zustand.naheAmKnopf) {
        EEP.pyramide.drueckeGeheimKnopf();
        e.preventDefault();
      }
    });
  }

  function aktualisierePyramidenHUD() {
    if (!pState.hudBannerEl || !EEP.pyramide) return;
    if (EEP.aktiveKamera !== 1 && EEP.aktiveKamera !== 7) {
      pState.hudBannerEl.style.display = 'none';
      return;
    }
    pState.hudBannerEl.style.display = 'block';
    var z = EEP.pyramide.zustand;
    var musikTxt = z.musikSpielt
      ? (' · 🎵 Musik ' + Math.round(z.musikLautstaerke * 100) + '% @ ' + z.musikPositionSek.toFixed(1) + 's')
      : (z.musikPositionSek > 0 ? (' · 🎵 Pausiert @ ' + z.musikPositionSek.toFixed(1) + 's') : '');

    var hinweis = z.inKammer
      ? ('💎 <b>Schatzkammer</b> (' + z.diamantenAnzahl + ' Diamanten · ' + z.vasenAnzahl + ' Vasen · 🔥 ' + z.entzuendeteSchalen + '/4' + musikTxt + ') ')
      : ((z.naheAmKnopf && !z.torOffen)
        ? '🪲 <span style="color:#4ade80;font-weight:800;">Skarabäus-Schalter an rechter Säule! Drücke [E] oder [G]!</span> '
        : ('🏺 <b>Tomb-Raider-Pyramide' + musikTxt + ':</b> '));

    var btnStyle = 'background:#78350f;color:#fef08a;border:1px solid #f59e0b;border-radius:6px;padding:3px 8px;cursor:pointer;font:600 11px system-ui;margin:0 3px;';
    pState.hudBannerEl.innerHTML =
      hinweis +
      '<button data-pyr="teleport" style="' + btnStyle + '">🏃‍♀️ Vor Pyramiden-Portal [G]</button>' +
      '<button data-pyr="knopf" style="' + btnStyle + '">🪲 Geheim-Knopf & Tor: ' + (z.torOffen ? 'OFFEN' : 'ZU') + '</button>' +
      '<button data-pyr="fackel" style="' + btnStyle + '">🔥 Fackel [T]: ' + (z.fackelAktiv ? 'BRENNT' : 'AUS') + '</button>';
  }

  // --------------------------------------------------------------------------
  // 6. Selbsttest für ?pyramidentest=1 (Spec t-pyramid-chamber-001)
  // --------------------------------------------------------------------------
  function startePyramidenSelbsttest() {
    if (!EEP.pyramide || !EEP.kollision) return;
    baueBegehbarePyramidenWelt();
    stelleLaraFackelSicher();

    EEP.pyramide.reset();
    var z = EEP.pyramide.zustand;

    // 1. Tor blockiert vor Knopfdruck
    var laraProbe = { id: 'lara-pyr-test', typ: 'lara', x: 146.0, y: 0.26, z: 200.2, vorherX: 146.0, vorherZ: 199.1, radius: 0.35, hoehe: 1.75 };
    var kollBeiGeschlossen = EEP.kollision.pruefe(laraProbe);
    var torVorherBlockiert = Boolean(!z.torOffen && kollBeiGeschlossen && kollBeiGeschlossen.eindringtiefe > 0);

    // 2. Knopf drücken -> Tor gleitet auf -> Lara läuft frei hinein
    EEP.pyramide.drueckeGeheimKnopf(true);
    for (var i = 0; i < 20; i++) EEP.pyramide.schritt(0.1, { x: 149.3, z: 199.1 }, i * 0.1);
    var freiImGang = true;
    for (var zStep = 199.0; zStep <= 210.0; zStep += 1.0) {
      laraProbe.vorherX = 146.0; laraProbe.vorherZ = zStep - 0.5;
      laraProbe.x = 146.0; laraProbe.z = zStep;
      var kRes = EEP.kollision.pruefe(laraProbe);
      if (kRes && kRes.eindringtiefe > 0) freiImGang = false;
    }
    var knopfUndTorOffenOk = Boolean(z.knopfGedrueckt && z.torOffen && z.torFortschritt >= 0.99 && freiImGang);

    // 3. Fackel & 4 Feuerschalen + Musik Fade-In beim Betreten
    EEP.pyramide.setzeFackel(true);
    for (var m = 0; m < 25; m++) EEP.pyramide.schritt(0.1, { x: 141.2, z: 207.2 }, m * 0.1);
    EEP.pyramide.schritt(0.1, { x: 150.8, z: 207.2 }, 2.6);
    EEP.pyramide.schritt(0.1, { x: 141.2, z: 216.8 }, 2.7);
    EEP.pyramide.schritt(0.1, { x: 150.8, z: 216.8 }, 2.8);
    var fackelUndSchalenOk = Boolean(z.fackelAktiv && z.entzuendeteSchalen === 4 && z.inKammer);
    var musikDrinnenOk = Boolean(z.musikSpielt && z.musikLautstaerke >= 0.95 && z.musikPositionSek >= 2.5);

    // 4. Rausgehen -> langsames Fade-Out -> Pause bei gemerkter Sekunde -> Wiedereintreten -> exakt Resume!
    EEP.pyramide.schritt(0.1, { x: 146.0, z: 195.0 }, 3.0); // Draußen vor dem Tor
    var lautstaerkeBeimFadeOut = z.musikLautstaerke; // Noch > 0 (langsames Ausblenden!)
    for (var fo = 0; fo < 35; fo++) EEP.pyramide.schritt(0.1, { x: 146.0, z: 195.0 }, 3.1 + fo * 0.1);
    var posGemerkteStelle = z.musikPositionSek;
    var nachFadeOutPausiert = Boolean(!z.musikSpielt && z.musikLautstaerke === 0 && posGemerkteStelle > 4.0);

    // Wieder eintreten -> setzt genau bei posGemerkteStelle fort!
    EEP.pyramide.schritt(0.1, { x: 146.0, z: 208.0 }, 7.0);
    var resumeDiff = Math.abs(z.musikPositionSek - (posGemerkteStelle + 0.1));
    var musikFadeResumeOk = Boolean(musikDrinnenOk && lautstaerkeBeimFadeOut > 0.5 && nachFadeOutPausiert && z.musikSpielt && resumeDiff < 0.05);

    var highPolySchaetzeOk = Boolean(z.diamantenAnzahl >= 120 && z.vasenAnzahl >= 10 && z.sarkophagOk);

    // Für Kamera-1-Screenshot Lara mit brennender Fackel direkt in die Schatzkammer vor den Gold-Sarkophag stellen!
    var steuerEl = document.querySelector('[ki-steuerung]');
    if (steuerEl && steuerEl.components && steuerEl.components['ki-steuerung']) {
      steuerEl.components['ki-steuerung'].setzeKamera(1);
    }
    if (EEP.laraComp && typeof EEP.laraComp.teleportiereZu === 'function') {
      EEP.laraComp.teleportiereZu(146.0, 0.26, 206.5, 180);
    }

    console.log('PYRAMIDEN_TEST_RESULT:', JSON.stringify({
      torVorherBlockiert: torVorherBlockiert,
      knopfUndTorOffenOk: knopfUndTorOffenOk,
      fackelUndSchalenOk: fackelUndSchalenOk,
      highPolySchaetzeOk: highPolySchaetzeOk,
      musikFadeResumeOk: musikFadeResumeOk,
      diamantenAnzahl: z.diamantenAnzahl,
      vasenAnzahl: z.vasenAnzahl,
      musikResumeSek: posGemerkteStelle
    }));
  }

  // --------------------------------------------------------------------------
  // 7. Laufender Animations-Tick & A-Frame-Anbindung an ki-lara
  // --------------------------------------------------------------------------
  EEP.pyramidenUI = {
    init: function () {
      if (pState.initialisiert) return;
      pState.initialisiert = true;
      bauePyramidenHUD();
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        if (window.location.search.indexOf('pyramidentest=1') !== -1) {
          setTimeout(startePyramidenSelbsttest, 500);
        }
      }
    },

    tick: function (timeMs, deltaSec) {
      if (!pState.initialisiert) this.init();
      baueBegehbarePyramidenWelt();
      stelleLaraFackelSicher();

      var lc = EEP.laraComp;
      var laraPos = (lc && lc.el && lc.el.object3D) ? lc.el.object3D.position : null;
      var zeitSek = (timeMs || 0) * 0.001;

      if (EEP.pyramide) {
        var z = EEP.pyramide.schritt(deltaSec, laraPos, zeitSek);
        aktualisierePyramidenMusik(z);

        if (pState.torGroup) pState.torGroup.position.y = 2.40 + z.torFortschritt * 4.35;
        if (pState.knopfSteinMesh && pState.knopfJuwelMesh) {
          pState.knopfSteinMesh.position.z = z.knopfGedrueckt ? -13.30 : -13.42;
          pState.knopfJuwelMesh.rotation.y = zeitSek * 2.4;
        }
        if (pState.horusKristall && pState.horusRing) {
          pState.horusKristall.rotation.y = zeitSek * 1.2;
          pState.horusKristall.position.y = 3.25 + Math.sin(zeitSek * 2.2) * 0.14;
          pState.horusRing.rotation.x = zeitSek * 0.8;
          pState.horusRing.rotation.y = -zeitSek * 1.1;
          pState.horusRing.position.y = pState.horusKristall.position.y;
        }
        for (var i = 0; i < z.schalen.length; i++) {
          var brennt = z.schalen[i].brennt;
          if (pState.schalenFlammeGroups[i]) {
            pState.schalenFlammeGroups[i].visible = brennt;
            if (brennt) {
              pState.schalenFlammeGroups[i].scale.set(1.0, 0.9 + Math.sin(zeitSek * 14 + i * 2) * 0.18, 1.0);
              pState.schalenFlammeGroups[i].rotation.y = zeitSek * 3.0;
            }
          }
          if (pState.schalenLights[i]) {
            pState.schalenLights[i].intensity = brennt ? (1.85 + Math.sin(zeitSek * 11 + i) * 0.25) : 0.0;
          }
        }
        if (pState.fackelGroup && pState.fackelLight && pState.fackelFlamme) {
          pState.fackelGroup.visible = Boolean(z.fackelAktiv);
          pState.fackelLight.intensity = z.flackerIntensitaet;
          if (z.fackelAktiv) {
            pState.fackelFlamme.scale.set(1.0, 0.92 + Math.sin(zeitSek * 18.0) * 0.20, 1.0);
            pState.fackelFlamme.rotation.y = zeitSek * 5.0;
            if (lc && lc.armR && lc.armR.shoulder && lc.armR.elbow) {
              lc.armR.shoulder.rotation.x = -1.18;
              lc.armR.shoulder.rotation.z = -0.15;
              lc.armR.elbow.rotation.x = -0.42;
            }
          }
        }
      }
      aktualisierePyramidenHUD();
    }
  };

  function koppleAnLara() {
    if (typeof AFRAME === 'undefined' || !AFRAME.components) return;
    var laraDef = AFRAME.components['ki-lara'];
    if (laraDef && laraDef.Component && !laraDef.Component.prototype._pyramideGekoppelt) {
      var proto = laraDef.Component.prototype;
      var origTick = proto.tick;
      proto._pyramideGekoppelt = true;
      proto.tick = function (time, dt) {
        if (origTick) origTick.call(this, time, dt);
        var deltaSec = dt ? Math.min(dt / 1000, 0.08) : 0.016;
        EEP.pyramidenUI.tick(time || 0, deltaSec);
      };
    }
  }
  koppleAnLara();
})();
