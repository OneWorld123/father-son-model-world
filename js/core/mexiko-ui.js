/* ============================================================================
 * js/core/mexiko-ui.js – 3D-Darstellung des Landes MEXIKO (Paket N)
 * - Maya- & Azteken-Stufenpyramiden mit begehbaren Treppen
 * - Zentrales Bergmassiv mit Serpentinenpfad & Bergstation
 * - Vulkan Popocatépetl mit pink-rotem Krater & Rauchpartikeln
 * - Dichter Bergwald (Bosque) mit Bäumen, Kakteen & Waldpiste
 * - Pueblos, Hafen Puerto Pacífico mit Mole & Booten
 * - Eisenbahn-Rundkurs „El Chepe“ mit 4 Bahnhöfen & animiertem Zugverband
 * - HUD-Schnellwahl & Selbsttest (?mexitest=1)
 * ============================================================================ */
(function () {
  'use strict';

  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.mexikoUI = '1.0.0';

  var state = {
    initialisiert: false,
    weltGruppe: null,
    zugEntity: null,
    zugPosition: 0.0,
    zugTempo: 13.5, // m/s
    rauchPartikel: [],
    materialien: null,
    bahnSpline: null,
    bahnLaenge: 0
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
  // 1. Material-Pool
  // --------------------------------------------------------------------------
  function erstelleMaterialien() {
    return {
      steinRot: new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.9, metalness: 0.05 }),
      steinPink: new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.85 }),
      steinHell: new THREE.MeshStandardMaterial({ color: 0xfecdd3, roughness: 0.9 }),
      felsBraun: new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95 }),
      felsDunkel: new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.95 }),
      kraterPink: new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.8 }),
      lavaGlimmen: new THREE.MeshStandardMaterial({ color: 0xfb7185, emissive: 0xe11d48, emissiveIntensity: 1.2 }),
      rauch: new THREE.MeshBasicMaterial({ color: 0xd6d3d1, transparent: true, opacity: 0.45 }),
      sand: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.95 }),
      holz: new THREE.MeshStandardMaterial({ color: 0x5c2e14, roughness: 0.85 }),
      schiene: new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.4 }),
      schotter: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.95 }),
      zugGruen: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4, metalness: 0.3 }),
      zugWeiss: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }),
      zugRot: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, metalness: 0.3 }),
      fenster: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, metalness: 0.9 }),
      kaktus: new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.9 }),
      baumBlatt: new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.9 }),
      palmenBlatt: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 }),
      stamm: new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 }),
      hausWeiss: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85 }),
      hausPink: new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.85 }),
      hausOcker: new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.85 }),
      ziegelRot: new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.8 }),
      wasserHafen: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, metalness: 0.8 })
    };
  }

  // --------------------------------------------------------------------------
  // 2. Landschafts-Mesh mit Vertex-Höhen & Vertex-Farben
  // --------------------------------------------------------------------------
  function baueTerrainMesh(mex, mats) {
    var g = mex.konfig.grenzen;
    var bX = g.xMax - g.xMin; // 185 m
    var bZ = g.zMax - g.zMin; // 180 m
    var segX = 74;
    var segZ = 72;
    var geo = new THREE.PlaneGeometry(bX, bZ, segX, segZ);
    geo.rotateX(-Math.PI / 2);

    var pos = geo.attributes.position;
    var cols = [];
    var mitteX = (g.xMin + g.xMax) * 0.5;
    var mitteZ = (g.zMin + g.zMax) * 0.5;

    var cGras = new THREE.Color(0x3f6212);
    var cWald = new THREE.Color(0x14532d);
    var cFels = new THREE.Color(0x78350f);
    var cVulkan = new THREE.Color(0x451a03);
    var cKrater = new THREE.Color(0xf43f5e);
    var cSand = new THREE.Color(0xeab308);
    var cFeld = new THREE.Color(0xfacc15);
    var cRuine = new THREE.Color(0xbe123c);

    for (var i = 0; i < pos.count; i++) {
      var wx = pos.getX(i) + mitteX;
      var wz = pos.getZ(i) + mitteZ;
      var wy = mex.getTerrainHeight(wx, wz);
      pos.setY(i, wy);

      var zInfo = mex.abfrageZone(wx, wz);
      var c = cGras;

      if (zInfo.zoneId === 'vulkan-popocatepetl') {
        c = wy > 38.0 ? cKrater : cVulkan;
      } else if (zInfo.zoneId === 'bergmassiv') {
        c = cFels;
      } else if (zInfo.zoneId === 'wald-nw') {
        c = cWald;
      } else if (zInfo.untergrund === 'sand') {
        c = cSand;
      } else if (zInfo.untergrund === 'erde') {
        c = cFeld;
      } else if (zInfo.zoneId === 'pyramiden-plaza') {
        c = cRuine;
      }
      cols.push(c.r, c.g, c.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();

    var mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.05
    });

    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(mitteX, 0, mitteZ);
    mesh.receiveShadow = true;
    return mesh;
  }

  // --------------------------------------------------------------------------
  // 3. Maya- & Azteken-Pyramidenstadt
  // --------------------------------------------------------------------------
  function baueStufenPyramide(parent, mats, mex, cfg, rotY) {
    var pG = new THREE.Group();
    pG.position.set(cfg.x, mex.konfig.bodenHoehe, cfg.z);
    if (rotY) pG.rotation.y = rotY;

    var stufen = cfg.stufen || 5;
    var b = cfg.basisB;
    var t = cfg.basisT;
    var h = cfg.hoehe;
    var dH = h / stufen;

    for (var i = 0; i < stufen; i++) {
      var f = 1.0 - (i / stufen) * 0.75;
      var sb = b * f;
      var st = t * f;
      var sy = (i + 0.5) * dH;
      var sMat = (i % 2 === 0) ? mats.steinRot : mats.steinPink;
      addMesh(pG, new THREE.BoxGeometry(sb, dH, st), sMat, 0, sy, 0);

      // Treppenstufen an der Front
      var treppenBreite = sb * 0.22;
      var treppenTiefe = (st * 0.15);
      addMesh(pG, new THREE.BoxGeometry(treppenBreite, dH * 0.9, treppenTiefe), mats.steinHell, 0, sy - dH * 0.05, st * 0.5 + treppenTiefe * 0.4);
    }

    // Tempelaltar / Schrein auf der obersten Plattform
    var topY = h;
    var topB = b * 0.28;
    addMesh(pG, new THREE.BoxGeometry(topB, dH * 1.2, topB), mats.steinHell, 0, topY + dH * 0.6, 0);
    // Säulen am Tempeleingang
    addMesh(pG, new THREE.CylinderGeometry(0.25, 0.25, dH * 1.1, 8), mats.steinRot, -topB * 0.35, topY + dH * 0.55, topB * 0.45);
    addMesh(pG, new THREE.CylinderGeometry(0.25, 0.25, dH * 1.1, 8), mats.steinRot, topB * 0.35, topY + dH * 0.55, topB * 0.45);

    parent.add(pG);
  }

  function bauePyramidenStadt(parent, mats, mex) {
    var c = mex.konfig.pyramidenStadt;
    // Große Pyramide (Haupttempel)
    baueStufenPyramide(parent, mats, mex, c.pyramideGross, 0);
    // Kleine Pyramide (Mondtempel)
    baueStufenPyramide(parent, mats, mex, c.pyramideKlein, 0.2);

    // Plaza & Steinsäulen / Stelen
    var stelenPos = [
      [254, 160], [257, 162], [268, 164], [271, 148], [278, 154]
    ];
    for (var i = 0; i < stelenPos.length; i++) {
      var sp = stelenPos[i];
      addMesh(parent, new THREE.BoxGeometry(0.8, 3.2, 0.8), mats.steinRot, sp[0], mex.konfig.bodenHoehe + 1.6, sp[1]);
    }
  }

  // --------------------------------------------------------------------------
  // 4. Zentrales Bergmassiv & Gipfel
  // --------------------------------------------------------------------------
  function baueBergmassiv(parent, mats, mex) {
    var b = mex.konfig.bergMassiv;
    var g = new THREE.Group();
    g.position.set(b.mitteX, 0, b.mitteZ);

    // Felsformationen und Klippenblöcke
    var felsPunkte = [
      [0, 18.0, 0, 14, 14, 12, mats.felsBraun],
      [-5, 24.0, 2, 9, 10, 8, mats.felsDunkel],
      [4, 28.0, -3, 8, 8, 7, mats.felsBraun],
      [0, 31.5, 0, 4, 3, 4, mats.steinHell],
      // Vorgebirgs-Felsen
      [-12, 10.0, -8, 8, 10, 7, mats.felsDunkel],
      [11, 8.0, 10, 9, 8, 8, mats.felsBraun]
    ];

    for (var i = 0; i < felsPunkte.length; i++) {
      var fp = felsPunkte[i];
      var geo = new THREE.DodecahedronGeometry(fp[3] * 0.5, 1);
      geo.scale(1.0, fp[4] / fp[3], fp[5] / fp[3]);
      addMesh(g, geo, fp[6], fp[0], fp[1], fp[2]);
    }

    // Gipfelkreuz / Aussichtsplattform
    addMesh(g, new THREE.CylinderGeometry(0.12, 0.12, 4.0, 6), mats.steinHell, 0, 33.5, 0);
    addMesh(g, new THREE.CylinderGeometry(0.10, 0.10, 2.0, 6), mats.steinHell, 0, 34.2, 0, 0, 0, Math.PI / 2);

    parent.add(g);
  }

  // --------------------------------------------------------------------------
  // 5. Vulkan Popocatépetl & Rauch-Partikelsystem
  // --------------------------------------------------------------------------
  function baueVulkan(parent, mats, mex) {
    var v = mex.konfig.vulkanPopo;
    var g = new THREE.Group();
    g.position.set(v.mitteX, 0, v.mitteZ);

    // Kraterrand-Gestein (Pink-Rot wie im Buntstiftbild)
    var r = v.kraterRadius;
    var h = v.kraterHoehe;
    for (var i = 0; i < 8; i++) {
      var phi = (i / 8) * Math.PI * 2;
      var kx = Math.cos(phi) * r;
      var kz = Math.sin(phi) * r;
      var geo = new THREE.DodecahedronGeometry(2.4, 0);
      addMesh(g, geo, (i % 2 === 0) ? mats.kraterPink : mats.steinRot, kx, h - 0.5, kz);
    }

    // Glühender Kratersee / Schlot
    addMesh(g, new THREE.CylinderGeometry(r * 0.75, r * 0.5, 1.5, 16), mats.lavaGlimmen, 0, h - 3.2, 0);

    // Initiales Rauchpartikel-Array
    for (var p = 0; p < 16; p++) {
      var pGeo = new THREE.SphereGeometry(1.2 + Math.random() * 0.8, 6, 6);
      var pMesh = new THREE.Mesh(pGeo, mats.rauch);
      pMesh.position.set(
        (Math.random() - 0.5) * 3.0,
        h + Math.random() * 16.0,
        (Math.random() - 0.5) * 3.0
      );
      g.add(pMesh);
      state.rauchPartikel.push({
        mesh: pMesh,
        speedY: 0.8 + Math.random() * 0.7,
        driftX: (Math.random() - 0.4) * 0.3,
        driftZ: (Math.random() - 0.5) * 0.3,
        maxY: h + 28.0,
        baseY: h
      });
    }

    parent.add(g);
  }

  // --------------------------------------------------------------------------
  // 6. Dichter Wald (Bosque), Kakteen & Palmen
  // --------------------------------------------------------------------------
  function baueBaum(parent, mats, x, y, z, typ) {
    var g = new THREE.Group();
    g.position.set(x, y, z);

    if (typ === 'kaktus') {
      // Mexikanischer Saguaro-Kaktus
      addMesh(g, new THREE.CylinderGeometry(0.3, 0.35, 3.2, 8), mats.kaktus, 0, 1.6, 0);
      addMesh(g, new THREE.CylinderGeometry(0.2, 0.2, 1.2, 6), mats.kaktus, -0.6, 2.0, 0, 0, 0, Math.PI / 2);
      addMesh(g, new THREE.CylinderGeometry(0.18, 0.18, 0.9, 6), mats.kaktus, -1.0, 2.4, 0);
      addMesh(g, new THREE.CylinderGeometry(0.2, 0.2, 1.0, 6), mats.kaktus, 0.5, 1.7, 0, 0, 0, Math.PI / 2);
      addMesh(g, new THREE.CylinderGeometry(0.18, 0.18, 0.8, 6), mats.kaktus, 0.9, 2.1, 0);
    } else if (typ === 'palme') {
      // Küsten- & Oasenpalme
      addMesh(g, new THREE.CylinderGeometry(0.25, 0.4, 5.5, 7), mats.stamm, 0, 2.75, 0, 0.1, 0, 0.05);
      for (var f = 0; f < 6; f++) {
        var rotF = (f / 6) * Math.PI * 2;
        addMesh(g, new THREE.ConeGeometry(1.6, 3.0, 4), mats.palmenBlatt, 0, 5.5, 0, 0.8, rotF, 0);
      }
    } else {
      // Waldbaum / Piniengruppe
      addMesh(g, new THREE.CylinderGeometry(0.35, 0.5, 2.5, 6), mats.stamm, 0, 1.25, 0);
      addMesh(g, new THREE.ConeGeometry(2.4, 4.5, 7), mats.baumBlatt, 0, 4.0, 0);
      addMesh(g, new THREE.ConeGeometry(1.8, 3.5, 7), mats.baumBlatt, 0, 5.8, 0);
    }

    parent.add(g);
  }

  function baueVegetation(parent, mats, mex) {
    var w = mex.konfig.waldNW;
    // Dichter Wald im Nordwesten
    for (var x = w.xMin + 4; x <= w.xMax - 4; x += 6.5) {
      for (var z = w.zMin + 4; z <= w.zMax - 4; z += 6.5) {
        var jx = x + (Math.sin(x * 13 + z) * 2.2);
        var jz = z + (Math.cos(z * 11 + x) * 2.2);
        var hy = mex.getTerrainHeight(jx, jz);
        baueBaum(parent, mats, jx, hy, jz, 'wald');
      }
    }

    // Kakteen rund um das Bergmassiv & an Straßenrändern
    var kaktusPos = [
      [275, 130], [282, 135], [290, 142], [320, 148], [328, 155],
      [315, 180], [322, 190], [290, 205], [280, 212], [260, 200]
    ];
    for (var k = 0; k < kaktusPos.length; k++) {
      var kp = kaktusPos[k];
      var ky = mex.getTerrainHeight(kp[0], kp[1]);
      baueBaum(parent, mats, kp[0], ky, kp[1], 'kaktus');
    }

    // Palmen an Stränden und Hafen
    var palmenPos = [
      [240, 245], [255, 248], [270, 246], [290, 248], [315, 245],
      [340, 242], [365, 215], [370, 228], [375, 240]
    ];
    for (var p = 0; p < palmenPos.length; p++) {
      var pp = palmenPos[p];
      var py = mex.getTerrainHeight(pp[0], pp[1]);
      baueBaum(parent, mats, pp[0], py, pp[1], 'palme');
    }
  }

  // --------------------------------------------------------------------------
  // 7. Pueblos (Dörfer) & Hafen Puerto Pacífico
  // --------------------------------------------------------------------------
  function bauePuebloHaus(parent, mats, x, y, z, rotY, farbMat) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    if (rotY) g.rotation.y = rotY;

    // Hauptkorpus
    addMesh(g, new THREE.BoxGeometry(4.5, 3.2, 4.0), farbMat, 0, 1.6, 0);
    // Rotes Ziegeldach
    addMesh(g, new THREE.ConeGeometry(3.5, 1.4, 4), mats.ziegelRot, 0, 3.9, 0, 0, Math.PI / 4, 0);
    // Fenster & Tür
    addMesh(g, new THREE.BoxGeometry(0.9, 1.8, 0.1), mats.holz, 0, 0.9, 2.05);
    addMesh(g, new THREE.BoxGeometry(0.8, 0.8, 0.1), mats.fenster, 1.2, 1.8, 2.05);
    addMesh(g, new THREE.BoxGeometry(0.8, 0.8, 0.1), mats.fenster, -1.2, 1.8, 2.05);

    parent.add(g);
  }

  function bauePueblosUndHafen(parent, mats, mex) {
    // Häuser in Pueblo de las Ruinas
    var hFarben = [mats.hausPink, mats.hausWeiss, mats.hausOcker];
    var h1 = [
      [242, 164, 0], [247, 162, 0.4], [244, 172, -0.3], [250, 175, 0.1]
    ];
    for (var i = 0; i < h1.length; i++) {
      var hp = h1[i];
      var hy = mex.getTerrainHeight(hp[0], hp[1]);
      bauePuebloHaus(parent, mats, hp[0], hy, hp[1], hp[2], hFarben[i % hFarben.length]);
    }

    // Häuser in San Pedro del Monte
    var h2 = [
      [324, 172, 0.2], [328, 178, -0.4], [332, 173, 0.5]
    ];
    for (var j = 0; j < h2.length; j++) {
      var hp2 = h2[j];
      var hy2 = mex.getTerrainHeight(hp2[0], hp2[1]);
      bauePuebloHaus(parent, mats, hp2[0], hy2[1], hp2[1], hp2[2], hFarben[(j + 1) % hFarben.length]);
    }

    // Hafen Puerto Pacífico
    var hf = mex.konfig.hafen;
    var molX = (hf.moleStart.x + hf.moleEnde.x) * 0.5;
    var molLen = hf.moleEnde.x - hf.moleStart.x;
    addMesh(parent, new THREE.BoxGeometry(molLen, 0.6, hf.breite), mats.schotter, molX, hf.deckHoehe, hf.moleStart.z);
    // Holzbohlen oben
    addMesh(parent, new THREE.BoxGeometry(molLen * 0.98, 0.08, hf.breite * 0.95), mats.holz, molX, hf.deckHoehe + 0.32, hf.moleStart.z);

    // Poller
    for (var px = hf.moleStart.x + 2; px <= hf.moleEnde.x - 2; px += 4) {
      addMesh(parent, new THREE.CylinderGeometry(0.12, 0.15, 0.6, 8), mats.schiene, px, hf.deckHoehe + 0.45, hf.moleStart.z - hf.breite * 0.45);
      addMesh(parent, new THREE.CylinderGeometry(0.12, 0.15, 0.6, 8), mats.schiene, px, hf.deckHoehe + 0.45, hf.moleStart.z + hf.breite * 0.45);
    }

    // Kleines mexikanisches Fischerboot
    var bootG = new THREE.Group();
    bootG.position.set(hf.moleEnde.x - 4, 0.15, hf.moleStart.z + 5.5);
    addMesh(bootG, new THREE.BoxGeometry(2.2, 0.8, 5.5), mats.hausWeiss, 0, 0.4, 0);
    addMesh(bootG, new THREE.BoxGeometry(1.6, 0.6, 2.0), mats.steinPink, 0, 0.9, 0.8);
    parent.add(bootG);
  }

  // --------------------------------------------------------------------------
  // 8. Eisenbahnstrecke El Chepe & 4 Bahnhöfe
  // --------------------------------------------------------------------------
  function baueBahnhof(parent, mats, bf) {
    var bg = new THREE.Group();
    bg.position.set(bf.x, bf.y, bf.z);
    if (bf.rotY) bg.rotation.y = (bf.rotY * Math.PI) / 180;

    // Bahnsteig
    addMesh(bg, new THREE.BoxGeometry(16.0, 0.35, 4.2), mats.schotter, 0, 0.18, 2.8);
    // Wartehäuschen im Kolonialstil
    addMesh(bg, new THREE.BoxGeometry(6.0, 2.8, 2.4), mats.hausOcker, 0, 1.55, 3.4);
    addMesh(bg, new THREE.BoxGeometry(6.4, 0.25, 2.8), mats.ziegelRot, 0, 3.0, 3.4);

    // Schild-Ständer
    addMesh(bg, new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), mats.schiene, -3.5, 1.1, 1.5);
    addMesh(bg, new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), mats.schiene, 3.5, 1.1, 1.5);
    addMesh(bg, new THREE.BoxGeometry(7.5, 0.8, 0.15), mats.hausWeiss, 0, 2.1, 1.5);

    parent.add(bg);
  }

  function baueEisenbahnlinie(parent, mats, mex) {
    var punkte = mex.bahnPunkte;
    var vPunkte = [];
    for (var i = 0; i < punkte.length; i++) {
      vPunkte.push(new THREE.Vector3(punkte[i].x, punkte[i].y, punkte[i].z));
    }
    var spline = new THREE.CatmullRomCurve3(vPunkte, true, 'centripetal');
    state.bahnSpline = spline;
    state.bahnLaenge = spline.getLength();

    // Schotterbett & Gleisrohre
    var trackGeo = new THREE.TubeGeometry(spline, 180, 0.25, 6, true);
    var railMesh = new THREE.Mesh(trackGeo, mats.schiene);
    parent.add(railMesh);

    // Schwellen entlang des Splines
    var schwellenAnzahl = 160;
    var schwGeo = new THREE.BoxGeometry(2.2, 0.12, 0.35);
    for (var s = 0; s < schwellenAnzahl; s++) {
      var u = s / schwellenAnzahl;
      var pos = spline.getPointAt(u);
      var tan = spline.getTangentAt(u);
      var up = new THREE.Vector3(0, 1, 0);
      var norm = new THREE.Vector3().crossVectors(tan, up).normalize();

      var schwMesh = new THREE.Mesh(schwGeo, mats.holz);
      schwMesh.position.copy(pos);
      schwMesh.position.y -= 0.06;
      schwMesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), norm);
      parent.add(schwMesh);
    }

    // 4 Bahnhöfe
    for (var b = 0; b < mex.konfig.bahenhoefe.length; b++) {
      baueBahnhof(parent, mats, mex.konfig.bahenhoefe[b]);
    }

    // Zuggarnitur El Chepe (Lok + 3 Personenwagen)
    var trainGroup = new THREE.Group();
    // Lok (Grün-Weiß-Rot)
    addMesh(trainGroup, new THREE.BoxGeometry(2.4, 2.6, 7.5), mats.zugWeiss, 0, 1.5, 0);
    addMesh(trainGroup, new THREE.BoxGeometry(2.42, 1.1, 7.52), mats.zugGruen, 0, 0.7, 0);
    addMesh(trainGroup, new THREE.BoxGeometry(2.42, 0.7, 7.52), mats.zugRot, 0, 2.6, 0);
    addMesh(trainGroup, new THREE.BoxGeometry(2.2, 0.8, 1.5), mats.fenster, 0, 1.9, 2.8);
    // Scheinwerfer
    addMesh(trainGroup, new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8), mats.lavaGlimmen, 0, 1.6, 3.8, Math.PI / 2, 0, 0);

    // Wagen 1 (Grün)
    var w1 = new THREE.Group();
    w1.position.z = -8.8;
    addMesh(w1, new THREE.BoxGeometry(2.3, 2.4, 6.8), mats.zugGruen, 0, 1.4, 0);
    trainGroup.add(w1);

    // Wagen 2 (Weiß)
    var w2 = new THREE.Group();
    w2.position.z = -16.4;
    addMesh(w2, new THREE.BoxGeometry(2.3, 2.4, 6.8), mats.zugWeiss, 0, 1.4, 0);
    trainGroup.add(w2);

    // Wagen 3 (Rot)
    var w3 = new THREE.Group();
    w3.position.z = -24.0;
    addMesh(w3, new THREE.BoxGeometry(2.3, 2.4, 6.8), mats.zugRot, 0, 1.4, 0);
    trainGroup.add(w3);

    parent.add(trainGroup);
    state.zugEntity = trainGroup;
  }

  // --------------------------------------------------------------------------
  // 9. Straßennetz & Verbindung nach Norden
  // --------------------------------------------------------------------------
  function baueStrassenNetz(parent, mats, mex) {
    // Verbindungsstraße von der US-Grenze (X = 286, Z = 78) nach Mexiko
    var strassenPunkte = [
      [286, 78], [284, 96], [276, 120], [268, 145], [264, 165],
      [280, 185], [305, 195], [330, 202], [358, 218]
    ];

    for (var i = 0; i < strassenPunkte.length - 1; i++) {
      var p1 = strassenPunkte[i];
      var p2 = strassenPunkte[i + 1];
      var dx = p2[0] - p1[0];
      var dz = p2[1] - p1[1];
      var len = Math.sqrt(dx * dx + dz * dz);
      var rotY = Math.atan2(dx, dz);
      var mx = (p1[0] + p2[0]) * 0.5;
      var mz = (p1[1] + p2[1]) * 0.5;
      var my = mex.getTerrainHeight(mx, mz) + 0.05;

      addMesh(parent, new THREE.BoxGeometry(5.5, 0.1, len), mats.schotter, mx, my, mz, 0, rotY, 0);
      // Mittelstreifen
      addMesh(parent, new THREE.BoxGeometry(0.2, 0.12, len * 0.9), mats.zugWeiss, mx, my + 0.01, mz, 0, rotY, 0);
    }
  }

  // --------------------------------------------------------------------------
  // 10. Hauptaufbau & Welt-Einhängung
  // --------------------------------------------------------------------------
  function baueMexikoWelt(sceneEl) {
    if (!EEP.mexiko) return;
    var mex = EEP.mexiko;
    mex.initialisiere();

    var entity = document.getElementById('mexiko-welt');
    if (!entity) {
      entity = document.createElement('a-entity');
      entity.id = 'mexiko-welt';
      sceneEl.appendChild(entity);
    }

    var group = new THREE.Group();
    state.weltGruppe = group;
    var mats = state.materialien = erstelleMaterialien();

    // 1. Terrain Mesh
    group.add(baueTerrainMesh(mex, mats));
    // 2. Pyramidenstadt
    bauePyramidenStadt(group, mats, mex);
    // 3. Bergmassiv
    baueBergmassiv(group, mats, mex);
    // 4. Vulkan Popocatépetl
    baueVulkan(group, mats, mex);
    // 5. Vegetation (Wald, Kakteen, Palmen)
    baueVegetation(group, mats, mex);
    // 6. Pueblos & Hafen
    bauePueblosUndHafen(group, mats, mex);
    // 7. Eisenbahnnetz El Chepe & Bahnhöfe
    baueEisenbahnlinie(group, mats, mex);
    // 8. Straßennetz
    baueStrassenNetz(group, mats, mex);

    entity.setObject3D('mesh', group);
  }

  // --------------------------------------------------------------------------
  // 11. HUD-Integration
  // --------------------------------------------------------------------------
  function initialisiereHUD() {
    var checkTimer = setInterval(function () {
      var hud = document.getElementById('cockpit-hud') || document.getElementById('hud-container') || document.querySelector('.reise-quick-nav');
      if (hud && !document.getElementById('btn-teleport-mexiko')) {
        var btn = document.createElement('button');
        btn.id = 'btn-teleport-mexiko';
        btn.innerText = '🇲🇽 Mexiko';
        btn.style.cssText = 'background: rgba(185, 28, 28, 0.85); color: #fff; border: 1px solid #facc15; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: bold; margin: 2px;';
        btn.onclick = function () {
          var t = EEP.mexiko.konfig.teleportMexiko;
          if (EEP.autoComp && typeof EEP.autoComp.teleportiereZu === 'function') {
            EEP.autoComp.teleportiereZu(t.x, t.y, t.z, t.rotY);
          } else {
            var cam = document.querySelector('[camera]') || document.getElementById('rig');
            if (cam && cam.object3D) {
              cam.object3D.position.set(t.x, t.y + 1.6, t.z);
            }
          }
        };
        hud.appendChild(btn);
        clearInterval(checkTimer);
      }
    }, 400);
    setTimeout(function () { clearInterval(checkTimer); }, 15000);
  }

  // --------------------------------------------------------------------------
  // 12. Selbsttest (?mexitest=1)
  // --------------------------------------------------------------------------
  function starteMexikoSelbsttest() {
    if (!EEP.mexiko || !EEP.welt) return;
    var mex = EEP.mexiko;

    // 1. Topographie- & Höhenprüfung
    var yPlaza = mex.getTerrainHeight(270.0, 160.0);
    var yBerg = mex.getTerrainHeight(300.0, 172.0);
    var yVulkan = mex.getTerrainHeight(352.0, 124.0);
    var hoeheOk = (Math.abs(yPlaza - 0.30) <= 0.1) && (yBerg >= 25.0) && (yVulkan >= 40.0);

    // 2. Zonenprüfung (Strand, Wald, Fels)
    var zStrand = mex.abfrageZone(260.0, 245.0);
    var zWald = mex.abfrageZone(250.0, 115.0);
    var zBerg = mex.abfrageZone(300.0, 172.0);
    var zonenOk = (zStrand.untergrund === 'sand') && (zWald.untergrund === 'erde') && (zBerg.untergrund === 'fels');

    // 3. 3D-Ausstattung & Eisenbahnprüfung
    var gruppeOk = Boolean(state.weltGruppe);
    var splineOk = Boolean(state.bahnSpline && state.bahnLaenge >= 400.0);
    var bfOk = (mex.konfig.bahenhoefe.length === 4);
    var ausstattungOk = Boolean(gruppeOk && splineOk && bfOk);

    var res = {
      hoeheOk: hoeheOk,
      zonenOk: zonenOk,
      ausstattungOk: ausstattungOk,
      bahnLaenge: Math.round(state.bahnLaenge)
    };

    console.log('MEXIKO_TEST_RESULT:' + JSON.stringify(res));
    if (hoeheOk && zonenOk && ausstattungOk) {
      console.log('MEXIKO_TEST_OK');
    }

    var stEl = document.querySelector('[ki-steuerung]');
    if (stEl && stEl.components && stEl.components['ki-steuerung']) {
      stEl.components['ki-steuerung'].setzeKamera(8);
    }
    window.EEP.autoAussenAnsicht = true;
    function platziereFokusMexiko() {
      if (window.EEP.autoComp && typeof window.EEP.autoComp.teleportiereZu === 'function') {
        window.EEP.autoComp.teleportiereZu(270.0, 0.35, 160.0, 25);
      }
      if (window.EEP.laraComp && typeof window.EEP.laraComp.teleportiereZu === 'function') {
        window.EEP.laraComp.teleportiereZu(268.0, 0.35, 162.0, 25);
      }
      var rig = document.querySelector('#kamera-rig');
      if (rig && rig.object3D && window.EEP.aktiveKamera !== 8) {
        rig.object3D.position.set(270.0, 5.2, 178.0);
        rig.object3D.rotation.set(-0.12, 0, 0);
      }
    }
    platziereFokusMexiko();
    setTimeout(platziereFokusMexiko, 500);
    setTimeout(platziereFokusMexiko, 1500);
    setTimeout(platziereFokusMexiko, 3000);
  }

  // --------------------------------------------------------------------------
  // 13. Lifecycle & Animation Tick
  // --------------------------------------------------------------------------
  EEP.mexikoUI = {
    init: function () {
      if (state.initialisiert) return;
      var sceneEl = document.querySelector('a-scene');
      if (!sceneEl) return;
      state.initialisiert = true;

      baueMexikoWelt(sceneEl);
      initialisiereHUD();

      if (typeof window !== 'undefined' && window.location && window.location.search) {
        if (window.location.search.indexOf('mexitest=1') !== -1) {
          setTimeout(starteMexikoSelbsttest, 600);
        }
      }
    },

    tick: function (timeMs, deltaSec) {
      if (!state.initialisiert) this.init();

      // 1. Zug El Chepe auf der Rundstrecke bewegen
      if (state.zugEntity && state.bahnSpline && state.bahnLaenge > 0) {
        var dDist = state.zugTempo * deltaSec;
        state.zugPosition = (state.zugPosition + dDist) % state.bahnLaenge;
        var u = state.zugPosition / state.bahnLaenge;

        var pos = state.bahnSpline.getPointAt(u);
        var tan = state.bahnSpline.getTangentAt(u);

        state.zugEntity.position.copy(pos);
        var lookTarget = new THREE.Vector3().addVectors(pos, tan);
        state.zugEntity.lookAt(lookTarget);
      }

      // 2. Rauchpartikel des Vulkans aufsteigen lassen
      for (var r = 0; r < state.rauchPartikel.length; r++) {
        var rp = state.rauchPartikel[r];
        rp.mesh.position.y += rp.speedY * deltaSec * 3.5;
        rp.mesh.position.x += rp.driftX * deltaSec * 3.5;
        rp.mesh.position.z += rp.driftZ * deltaSec * 3.5;
        if (rp.mesh.position.y > rp.maxY) {
          rp.mesh.position.y = rp.baseY;
          rp.mesh.position.x = (Math.random() - 0.5) * 2.5;
          rp.mesh.position.z = (Math.random() - 0.5) * 2.5;
        }
      }
    }
  };

  function koppleAnSzene() {
    if (typeof AFRAME === 'undefined' || !AFRAME.components) return;
    var steuerDef = AFRAME.components['ki-steuerung'];
    if (steuerDef && steuerDef.Component && !steuerDef.Component.prototype._mexikoGekoppelt) {
      var proto = steuerDef.Component.prototype;
      var origTick = proto.tick;
      proto._mexikoGekoppelt = true;
      proto.tick = function (time, dt) {
        if (origTick) origTick.call(this, time, dt);
        var deltaSec = dt ? Math.min(dt / 1000, 0.08) : 0.016;
        EEP.mexikoUI.tick(time || 0, deltaSec);
      };
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    EEP.mexikoUI.init();
    koppleAnSzene();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      EEP.mexikoUI.init();
      koppleAnSzene();
    });
  }
})();
