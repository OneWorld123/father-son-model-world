/* ============================================================================
 * js/core/alpenvorland-ui.js – 3D-Alpenvorland, Panoramastraße, Hochalpen-Massiv,
 * Tauern-Autobahntunnel mit rotierenden Jet-Fans & Selbsttest (?vorlandtest=1).
 * ============================================================================ */
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.alpenvorlandUI = '1.0.0';

  var state = {
    initialisiert: false,
    weltGruppe: null,
    tunnelGruppe: null,
    fanRotoren: [],
    portalLichter: [],
    pointLights: [],
    audioGain: null,
    audioCtx: null
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
  // 1. WebAudio: Tiefes Lüfter- & Strömungsrauschen im Tunnel (Gain <= 0.06)
  // --------------------------------------------------------------------------
  function initialisiereAudio() {
    if (state.audioCtx || typeof window === 'undefined') return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      state.audioCtx = ctx;

      var masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0, ctx.currentTime);
      masterGain.connect(ctx.destination);
      state.audioGain = masterGain;

      var bufSize = ctx.sampleRate * 2;
      var nBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      var out = nBuf.getChannelData(0);
      for (var i = 0; i < bufSize; i++) out[i] = Math.random() * 2 - 1;

      var wNoise = ctx.createBufferSource();
      wNoise.buffer = nBuf;
      wNoise.loop = true;
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 160;
      wNoise.connect(filter);
      filter.connect(masterGain);
      wNoise.start();

      var hum = ctx.createOscillator();
      hum.type = 'triangle';
      hum.frequency.value = 52;
      var humGain = ctx.createGain();
      humGain.gain.value = 0.35;
      hum.connect(humGain);
      humGain.connect(masterGain);
      hum.start();
    } catch (e) {}
  }

  function aktualisiereTunnelAudio(imTunnel) {
    if (!state.audioGain || !state.audioCtx) return;
    var t = state.audioCtx.currentTime;
    state.audioGain.gain.linearRampToValueAtTime(imTunnel ? 0.055 : 0.0, t + 1.0);
  }

  // --------------------------------------------------------------------------
  // 2. Terrain-Mesh: 280 x 385 m mit Vertex-Farben & Straßennivellierung
  // --------------------------------------------------------------------------
  function baueTerrainMesh(alpen) {
    var geo = new THREE.PlaneGeometry(280, 385, 140, 190);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var count = pos.count;
    var colors = new Float32Array(count * 3);

    var cWiese = new THREE.Color(0x4a8522), cKuppe = new THREE.Color(0x7cb342);
    var cSenke = new THREE.Color(0x2e6319), cFels  = new THREE.Color(0x525c66);
    var tmpC = new THREE.Color();

    for (var i = 0; i < count; i++) {
      var wx = pos.getX(i) - 260.0;
      var wz = pos.getZ(i) - 277.5;
      var h = alpen.hoehe(wx, wz);
      if (alpen.abstandZurStrasse(wx, wz) <= 4.25) h -= 0.02;

      pos.setX(i, wx); pos.setY(i, h); pos.setZ(i, wz);

      var tH = (h - 0.25) / 16.0;
      if (tH < 0.35) tmpC.copy(cSenke).lerp(cWiese, tH / 0.35);
      else if (tH < 0.85) tmpC.copy(cWiese).lerp(cKuppe, (tH - 0.35) / 0.50);
      else tmpC.copy(cKuppe).lerp(cFels, (tH - 0.85) / 0.15);

      colors[i * 3] = tmpC.r; colors[i * 3 + 1] = tmpC.g; colors[i * 3 + 2] = tmpC.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    var mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    var terrainMesh = new THREE.Mesh(geo, mat);
    terrainMesh.receiveShadow = true;
    return terrainMesh;
  }

  // --------------------------------------------------------------------------
  // 3. Zweispurige Panoramastraße: Band-Mesh, Randlinien, Mittellinie, Pfosten
  // --------------------------------------------------------------------------
  function baueStrasse(parent, alpen) {
    var pts = alpen.vorlandPunkte;
    var n = pts.length;
    var strassenGeo = new THREE.BufferGeometry();
    var vertList = [], normList = [], idxList = [];
    var halbeB = 4.25;

    for (var i = 0; i < n; i++) {
      var p = pts[i];
      var fX = (i < n - 1 ? pts[i + 1].x - p.x : p.x - pts[i - 1].x);
      var fZ = (i < n - 1 ? pts[i + 1].z - p.z : p.z - pts[i - 1].z);
      var len = Math.sqrt(fX * fX + fZ * fZ) || 1;
      fX /= len; fZ /= len;
      var nX = -fZ, nZ = fX, yS = p.y + 0.03;

      vertList.push(p.x - nX * halbeB, yS, p.z - nZ * halbeB);
      vertList.push(p.x + nX * halbeB, yS, p.z + nZ * halbeB);
      normList.push(0, 1, 0, 0, 1, 0);

      if (i < n - 1) {
        var base = i * 2;
        idxList.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }
    strassenGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertList, 3));
    strassenGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normList, 3));
    strassenGeo.setIndex(idxList);

    var asphaltMat = new THREE.MeshStandardMaterial({ color: 0x33373b, roughness: 0.85, metalness: 0.05 });
    var strMesh = new THREE.Mesh(strassenGeo, asphaltMat);
    strMesh.receiveShadow = true;
    parent.add(strMesh);

    // Weiße Randlinien (links & rechts)
    function baueBandLinie(offNorm, bBreite, yOff, mat) {
      var lGeo = new THREE.BufferGeometry();
      var v = [], idx = [];
      for (var j = 0; j < n; j++) {
        var pJ = pts[j];
        var fwdX = (j < n - 1 ? pts[j + 1].x - pJ.x : pJ.x - pts[j - 1].x);
        var fwdZ = (j < n - 1 ? pts[j + 1].z - pJ.z : pJ.z - pts[j - 1].z);
        var lJ = Math.sqrt(fwdX * fwdX + fwdZ * fwdZ) || 1;
        var normX = -fwdZ / lJ, normZ = fwdX / lJ;
        var cx = pJ.x + normX * offNorm, cz = pJ.z + normZ * offNorm;
        v.push(cx - normX * (bBreite * 0.5), pJ.y + yOff, cz - normZ * (bBreite * 0.5));
        v.push(cx + normX * (bBreite * 0.5), pJ.y + yOff, cz + normZ * (bBreite * 0.5));
        if (j < n - 1) {
          var bIdx = j * 2;
          idx.push(bIdx, bIdx + 1, bIdx + 2, bIdx + 1, bIdx + 3, bIdx + 2);
        }
      }
      lGeo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      lGeo.setIndex(idx);
      parent.add(new THREE.Mesh(lGeo, mat));
    }

    var matWeiss = new THREE.MeshBasicMaterial({ color: 0xffffff });
    baueBandLinie(-(halbeB - 0.08), 0.15, 0.035, matWeiss);
    baueBandLinie((halbeB - 0.08), 0.15, 0.035, matWeiss);

    // Gelbe gestrichelte Mittellinie (3m Strich / 3m Lücke)
    var matGelb = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    var mittelGeo = new THREE.BufferGeometry();
    var mVerts = [], mIdx = [], distSum = 0;
    for (var m = 0; m < n - 1; m++) {
      var pA = pts[m], pB = pts[m + 1];
      var dSeg = Math.sqrt((pB.x - pA.x) * (pB.x - pA.x) + (pB.z - pA.z) * (pB.z - pA.z));
      if ((distSum % 6.0) < 3.0) {
        var sx = (pB.x - pA.x) / dSeg, sz = (pB.z - pA.z) / dSeg;
        var nx = -sz, nz = sx, bM = mVerts.length / 3;
        mVerts.push(pA.x - nx * 0.09, pA.y + 0.036, pA.z - nz * 0.09);
        mVerts.push(pA.x + nx * 0.09, pA.y + 0.036, pA.z + nz * 0.09);
        mVerts.push(pB.x - nx * 0.09, pB.y + 0.036, pB.z - nz * 0.09);
        mVerts.push(pB.x + nx * 0.09, pB.y + 0.036, pB.z + nz * 0.09);
        mIdx.push(bM, bM + 1, bM + 2, bM + 1, bM + 3, bM + 2);
      }
      distSum += dSeg;
    }
    mittelGeo.setAttribute('position', new THREE.Float32BufferAttribute(mVerts, 3));
    mittelGeo.setIndex(mIdx);
    parent.add(new THREE.Mesh(mittelGeo, matGelb));

    // Leitpfosten alle 12 m
    var pfostenGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6);
    var pfostenMat = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 });
    var pCount = Math.floor(alpen.strassenLaenge / 12) * 2;
    var pfInst = new THREE.InstancedMesh(pfostenGeo, pfostenMat, pCount);
    var dummy = new THREE.Object3D(), pIdx = 0, dCounter = 0;
    for (var pf = 0; pf < n - 1; pf++) {
      var p1 = pts[pf], p2 = pts[pf + 1];
      var dStep = Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.z - p1.z) * (p2.z - p1.z));
      dCounter += dStep;
      if (dCounter >= 12.0) {
        dCounter -= 12.0;
        var lx = -(p2.z - p1.z) / dStep, lz = (p2.x - p1.x) / dStep;
        dummy.position.set(p1.x - lx * 4.65, p1.y + 0.5, p1.z - lz * 4.65);
        dummy.updateMatrix(); pfInst.setMatrixAt(pIdx++, dummy.matrix);
        dummy.position.set(p1.x + lx * 4.65, p1.y + 0.5, p1.z + lz * 4.65);
        dummy.updateMatrix(); pfInst.setMatrixAt(pIdx++, dummy.matrix);
      }
    }
    pfInst.instanceMatrix.needsUpdate = true;
    parent.add(pfInst);
  }

  // --------------------------------------------------------------------------
  // 4. Natur: Bäume, Blumenwiesen, 3 Bergseen & 2 Almhütten (InstancedMesh)
  // --------------------------------------------------------------------------
  function baueNatur(parent, alpen) {
    var bList = alpen.baeume;
    var nadelList = [], laubList = [];
    for (var b = 0; b < bList.length; b++) {
      if (bList[b].typ === 'nadel') nadelList.push(bList[b]);
      else laubList.push(bList[b]);
    }

    var dummy = new THREE.Object3D();
    var stammMat = new THREE.MeshLambertMaterial({ color: 0x422006 });
    var nadelMat = new THREE.MeshLambertMaterial({ color: 0x1b4332 });
    var laubMat  = new THREE.MeshLambertMaterial({ color: 0x2d6a4f });

    var stammGeo = new THREE.CylinderGeometry(0.22, 0.35, 2.5, 8);
    var kronGeo  = new THREE.ConeGeometry(1.8, 3.8, 8);
    var nadelStammInst = new THREE.InstancedMesh(stammGeo, stammMat, nadelList.length);
    var nadelKroneInst = new THREE.InstancedMesh(kronGeo, nadelMat, nadelList.length * 3);

    var kIdx = 0;
    for (var nIdx = 0; nIdx < nadelList.length; nIdx++) {
      var nb = nadelList[nIdx], s = nb.scale || 1.0;
      dummy.scale.set(s, s, s); dummy.rotation.set(0, (nIdx * 1.7) % 6.28, 0);

      dummy.position.set(nb.x, nb.y + 1.25 * s, nb.z);
      dummy.updateMatrix(); nadelStammInst.setMatrixAt(nIdx, dummy.matrix);

      dummy.position.set(nb.x, nb.y + 3.2 * s, nb.z);
      dummy.updateMatrix(); nadelKroneInst.setMatrixAt(kIdx++, dummy.matrix);

      dummy.position.set(nb.x, nb.y + 5.0 * s, nb.z);
      dummy.scale.set(s * 0.8, s * 0.8, s * 0.8);
      dummy.updateMatrix(); nadelKroneInst.setMatrixAt(kIdx++, dummy.matrix);

      dummy.position.set(nb.x, nb.y + 6.6 * s, nb.z);
      dummy.scale.set(s * 0.6, s * 0.6, s * 0.6);
      dummy.updateMatrix(); nadelKroneInst.setMatrixAt(kIdx++, dummy.matrix);
    }
    nadelStammInst.instanceMatrix.needsUpdate = true;
    nadelKroneInst.instanceMatrix.needsUpdate = true;
    parent.add(nadelStammInst); parent.add(nadelKroneInst);

    // Laubbäume
    var laubGeo = new THREE.DodecahedronGeometry(2.3, 1);
    var laubStammInst = new THREE.InstancedMesh(stammGeo, stammMat, laubList.length);
    var laubKroneInst = new THREE.InstancedMesh(laubGeo, laubMat, laubList.length);
    for (var lIdx = 0; lIdx < laubList.length; lIdx++) {
      var lb = laubList[lIdx], ls = lb.scale || 1.0;
      dummy.scale.set(ls, ls, ls); dummy.rotation.set(0, (lIdx * 2.1) % 6.28, 0);
      dummy.position.set(lb.x, lb.y + 1.25 * ls, lb.z);
      dummy.updateMatrix(); laubStammInst.setMatrixAt(lIdx, dummy.matrix);
      dummy.position.set(lb.x, lb.y + 3.8 * ls, lb.z);
      dummy.updateMatrix(); laubKroneInst.setMatrixAt(lIdx, dummy.matrix);
    }
    laubStammInst.instanceMatrix.needsUpdate = true;
    laubKroneInst.instanceMatrix.needsUpdate = true;
    parent.add(laubStammInst); parent.add(laubKroneInst);

    // Blumen (InstancedMesh)
    var blumenList = alpen.blumen;
    var blumGeo = new THREE.OctahedronGeometry(0.24, 0);
    var blumInst = new THREE.InstancedMesh(blumGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), blumenList.length);
    for (var f = 0; f < blumenList.length; f++) {
      var fl = blumenList[f];
      dummy.position.set(fl.x, fl.y + 0.15, fl.z);
      dummy.scale.set(fl.scale, fl.scale * 1.5, fl.scale);
      dummy.rotation.set(0, f, 0); dummy.updateMatrix();
      blumInst.setMatrixAt(f, dummy.matrix);
      blumInst.setColorAt(f, new THREE.Color(fl.farbe));
    }
    blumInst.instanceMatrix.needsUpdate = true;
    if (blumInst.instanceColor) blumInst.instanceColor.needsUpdate = true;
    parent.add(blumInst);

    // 3 Bergseen
    var seeMat = new THREE.MeshStandardMaterial({ color: 0x1b6ca8, roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.90 });
    for (var si = 0; si < alpen.seen.length; si++) {
      var sObj = alpen.seen[si];
      var sGeo = new THREE.CircleGeometry(sObj.r, 32);
      sGeo.rotateX(-Math.PI / 2);
      addMesh(parent, sGeo, seeMat, sObj.x, sObj.y + 0.04, sObj.z);
    }

    // 2 Almhütten
    var holzMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    var dachMat = new THREE.MeshLambertMaterial({ color: 0x451a03 });
    var steinMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
    for (var hi = 0; hi < alpen.huetten.length; hi++) {
      var hut = alpen.huetten[hi];
      var hutGroup = new THREE.Group();
      hutGroup.position.set(hut.x, hut.y, hut.z);
      hutGroup.rotation.y = hut.yaw || 0;
      addMesh(hutGroup, new THREE.BoxGeometry(hut.halbBreite * 2, hut.hoehe * 0.65, hut.halbTiefe * 2), holzMat, 0, (hut.hoehe * 0.65) * 0.5, 0);
      var dB = hut.halbBreite * 2 + 1.2, dH = hut.halbTiefe + 1.0;
      addMesh(hutGroup, new THREE.BoxGeometry(dB, 0.25, dH), dachMat, 0, hut.hoehe * 0.85, -hut.halbTiefe * 0.45, 0.45, 0, 0);
      addMesh(hutGroup, new THREE.BoxGeometry(dB, 0.25, dH), dachMat, 0, hut.hoehe * 0.85,  hut.halbTiefe * 0.45, -0.45, 0, 0);
      addMesh(hutGroup, new THREE.BoxGeometry(0.7, 1.8, 0.7), steinMat, hut.halbBreite * 0.5, hut.hoehe + 0.3, 0);
      for (var zA = 0; zA < 14; zA++) {
        var ang = (zA / 14) * Math.PI * 2;
        addMesh(hutGroup, new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6), holzMat, Math.cos(ang) * hut.zaunRadius, 0.55, Math.sin(ang) * hut.zaunRadius);
      }
      parent.add(hutGroup);
      if (EEP.lod && typeof EEP.lod.registriere === 'function') {
        var hProxy = new THREE.Object3D();
        hProxy.position.set(hut.x, hut.y, hut.z);
        EEP.lod.registriere(hProxy, 'gebaeude');
      }
    }
    if (EEP.lod && typeof EEP.lod.registriere === 'function') {
      for (var bLod = 0; bLod < bList.length; bLod++) {
        var bProxy = new THREE.Object3D();
        bProxy.position.set(bList[bLod].x, bList[bLod].y, bList[bLod].z);
        EEP.lod.registriere(bProxy, 'baum');
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. Hochalpen-Massiv: Schroffe Gipfel, Schneekappen & Felszahn
  // --------------------------------------------------------------------------
  function baueHochalpen(parent, alpen) {
    var felsMat = new THREE.MeshStandardMaterial({ color: 0x5d6b7a, roughness: 0.92 });
    var schneeMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
    var felsZahnMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.95 });

    var gipfelList = alpen.hochalpenGipfel;
    for (var g = 0; g < gipfelList.length; g++) {
      var gp = gipfelList[g];
      var gMesh = addMesh(parent, new THREE.ConeGeometry(gp.radius, gp.hoehe, gp.segmente || 8), felsMat, gp.x, gp.hoehe * 0.5, gp.z);
      gMesh.rotation.y = (g * 1.3) % Math.PI;

      var capH = gp.hoehe * 0.35, capR = gp.radius * 0.35;
      var cMesh = addMesh(parent, new THREE.ConeGeometry(capR, capH, gp.segmente || 8), schneeMat, gp.x, gp.hoehe - capH * 0.5, gp.z);
      cMesh.rotation.y = gMesh.rotation.y;

      if (gp.mitFelszahn) {
        addMesh(parent, new THREE.ConeGeometry(4.5, 24.0, 7), felsZahnMat, gp.x - 2.0, gp.hoehe + 10.0, gp.z + 1.5, 0.08, 0.2, 0.05);
      }
    }
    addMesh(parent, new THREE.BoxGeometry(130, 85, 45), felsMat, -310, 42.5, -475);
    addMesh(parent, new THREE.BoxGeometry(130, 85, 45), felsMat, -170, 42.5, -475);
    addMesh(parent, new THREE.BoxGeometry(22, 55, 35), felsMat, -240, 52.0, -478);
  }

  // --------------------------------------------------------------------------
  // 6. Tauern-Autobahntunnel (Z = -470..-790): Hufeisenprofil, Jet-Fans, Deckenleuchten
  // --------------------------------------------------------------------------
  function baueTauernTunnel(parent, alpen) {
    var tData = alpen.tunnel;
    var tGroup = new THREE.Group();
    tGroup.id = 'tauern-tunnel-gruppe';
    state.tunnelGruppe = tGroup;

    var betonMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.82 });
    var gewoelbeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.90, side: THREE.DoubleSide });
    var fliesenMat = new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.30, metalness: 0.15, side: THREE.DoubleSide });
    var fahrbahnMat = new THREE.MeshStandardMaterial({ color: 0x272a2e, roughness: 0.85 });
    var bordsteinMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.65 });
    var leuchtenMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3b0, emissiveIntensity: 2.2 });
    var ledMat = new THREE.MeshStandardMaterial({ color: 0xfffaed, emissive: 0xfff6c7, emissiveIntensity: 2.5 });

    // Portal (immer sichtbar auf parent)
    addMesh(parent, new THREE.TorusGeometry(5.8, 1.2, 16, 24, Math.PI), betonMat, -240, 17.5, -470);
    addMesh(parent, new THREE.BoxGeometry(1.6, 7.5, 3.2), betonMat, -245.8, 19.5, -470);
    addMesh(parent, new THREE.BoxGeometry(1.6, 7.5, 3.2), betonMat, -234.2, 19.5, -470);
    addMesh(parent, new THREE.BoxGeometry(10.5, 1.8, 0.5), betonMat, -240, 24.2, -469.6);
    var schildGruenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, emissive: 0x14532d, emissiveIntensity: 0.5 });
    addMesh(parent, new THREE.CylinderGeometry(0.18, 0.18, 6.2, 8), betonMat, -246.8, 3.3, -62);
    addMesh(parent, new THREE.CylinderGeometry(0.18, 0.18, 6.2, 8), betonMat, -233.2, 3.3, -62);
    addMesh(parent, new THREE.BoxGeometry(14.2, 1.8, 0.25), schildGruenMat, -240.0, 5.8, -62);
    var ampelMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 3.5 });
    state.portalLichter.push(addMesh(parent, new THREE.SphereGeometry(0.45, 12, 12), ampelMat, -245.5, 22.8, -469.2));
    state.portalLichter.push(addMesh(parent, new THREE.SphereGeometry(0.45, 12, 12), ampelMat, -234.5, 22.8, -469.2));

    // Fahrbahn & Gehwege (320 m)
    addMesh(tGroup, new THREE.BoxGeometry(8.5, 0.2, 320), fahrbahnMat, -240, 15.9, -630);
    addMesh(tGroup, new THREE.BoxGeometry(0.75, 0.35, 320), bordsteinMat, -244.625, 16.15, -630);
    addMesh(tGroup, new THREE.BoxGeometry(0.75, 0.35, 320), bordsteinMat, -235.375, 16.15, -630);

    // Wände & Gewölbe
    addMesh(tGroup, new THREE.BoxGeometry(0.3, 3.0, 320), fliesenMat, -245.0, 17.5, -630);
    addMesh(tGroup, new THREE.BoxGeometry(0.3, 3.0, 320), fliesenMat, -235.0, 17.5, -630);
    var gewGeo = new THREE.CylinderGeometry(5.0, 5.0, 320, 24, 1, true, 0, Math.PI);
    gewGeo.rotateZ(Math.PI / 2); gewGeo.rotateY(Math.PI / 2);
    addMesh(tGroup, gewGeo, gewoelbeMat, -240, 19.0, -630);

    // Deckenleuchten (InstancedMesh)
    var leuchtenGeo = new THREE.BoxGeometry(1.8, 0.15, 0.45);
    var deckenInst = new THREE.InstancedMesh(leuchtenGeo, leuchtenMat, tData.deckenLeuchten.length);
    var dummyL = new THREE.Object3D();
    for (var dl = 0; dl < tData.deckenLeuchten.length; dl++) {
      dummyL.position.set(tData.deckenLeuchten[dl].x, tData.deckenLeuchten[dl].y, tData.deckenLeuchten[dl].z);
      dummyL.updateMatrix(); deckenInst.setMatrixAt(dl, dummyL.matrix);
    }
    deckenInst.instanceMatrix.needsUpdate = true;
    tGroup.add(deckenInst);

    // Durchgehende LED-Streifen
    addMesh(tGroup, new THREE.BoxGeometry(0.08, 0.10, 320), ledMat, -244.9, 17.2, -630);
    addMesh(tGroup, new THREE.BoxGeometry(0.08, 0.10, 320), ledMat, -235.1, 17.2, -630);

    // Jet-Fans (5 Paare = 10 Turbinen)
    var fanGeo = new THREE.CylinderGeometry(0.60, 0.60, 3.5, 16);
    fanGeo.rotateX(Math.PI / 2);
    var fanMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.6 });
    var rotorMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.8 });
    state.fanRotoren = [];

    for (var fp = 0; fp < tData.fanPaare.length; fp++) {
      var pair = tData.fanPaare[fp];
      [pair.links, pair.rechts].forEach(function (fan) {
        var fg = new THREE.Group();
        fg.position.set(fan.x, fan.y, fan.z);
        addMesh(fg, fanGeo, fanMat, 0, 0, 0);
        addMesh(fg, new THREE.BoxGeometry(0.18, 1.2, 1.4), fanMat, 0, 0.75, 0);

        var rg = new THREE.Group();
        rg.position.set(0, 0, 1.6);
        addMesh(rg, new THREE.CylinderGeometry(0.16, 0.16, 0.25, 12), fanMat, 0, 0, 0, Math.PI / 2);
        addMesh(rg, new THREE.BoxGeometry(1.05, 0.18, 0.04), rotorMat, 0, 0, 0, 0, 0, Math.PI / 4);
        addMesh(rg, new THREE.BoxGeometry(1.05, 0.18, 0.04), rotorMat, 0, 0, 0, 0, 0, -Math.PI / 4);
        fg.add(rg); tGroup.add(fg); state.fanRotoren.push(rg);
      });
    }

    // SOS-Nischen & Fluchtschilder
    var sosMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, emissive: 0x2563eb, emissiveIntensity: 1.5 });
    for (var sIdx = 0; sIdx < tData.sosNischen.length; sIdx++) {
      var sn = tData.sosNischen[sIdx];
      addMesh(tGroup, new THREE.BoxGeometry(0.8, 2.2, 1.8), fliesenMat, sn.x, 17.2, sn.z);
      addMesh(tGroup, new THREE.BoxGeometry(0.1, 0.6, 0.6), sosMat, sn.seite === 'links' ? sn.x + 0.35 : sn.x - 0.35, 17.6, sn.z);
    }
    var exitMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x22c55e, emissiveIntensity: 1.8 });
    for (var es = 0; es < tData.fluchtSchilder.length; es++) {
      var fs = tData.fluchtSchilder[es];
      addMesh(tGroup, new THREE.BoxGeometry(0.08, 0.35, 0.75), exitMat, fs.x, fs.y, fs.z);
    }

    // Baustellenwand Nordende (Z = -790)
    var bGroup = new THREE.Group();
    bGroup.id = 'tauern-tunnel-baustelle';
    bGroup.name = 'tauern-tunnel-baustelle';
    addMesh(bGroup, new THREE.BoxGeometry(10.0, 6.5, 0.6), betonMat, -240, 19.0, -790);
    var bSchildMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xb91c1c, emissiveIntensity: 0.6 });
    addMesh(bGroup, new THREE.BoxGeometry(6.5, 1.2, 0.1), bSchildMat, -240, 18.5, -789.6);
    tGroup.add(bGroup);

    // 2 PointLights im Tunnel
    var pl1 = new THREE.PointLight(0xfff3b0, 0.0, 25.0, 1.2);
    var pl2 = new THREE.PointLight(0xfff3b0, 0.0, 25.0, 1.2);
    tGroup.add(pl1); tGroup.add(pl2);
    state.pointLights = [pl1, pl2];

    parent.add(tGroup);
  }

  // --------------------------------------------------------------------------
  // 7. Initialisierung & A-Frame Szenenaufbau
  // --------------------------------------------------------------------------
  function baueVorlandWelt(sceneEl) {
    if (!EEP.alpenvorland) return;
    var alpen = EEP.alpenvorland;
    alpen.initialisiere();

    var entity = document.getElementById('alpenvorland-welt');
    if (!entity) {
      entity = document.createElement('a-entity');
      entity.id = 'alpenvorland-welt';
      sceneEl.appendChild(entity);
    }
    var group = new THREE.Group();
    state.weltGruppe = group;

    group.add(baueTerrainMesh(alpen));
    baueStrasse(group, alpen);
    baueNatur(group, alpen);
    baueHochalpen(group, alpen);
    baueTauernTunnel(group, alpen);

    entity.object3D.add(group);
    [{ v: 'TAUERN-TUNNEL & SCHNEEWELT (400m)', p: '-240 5.85 -61.8', r: '0 0 0', w: '22', c: '#ffffff' }, { v: 'TAUERN-TUNNEL & SCHNEEWELT (400m)', p: '-240 5.85 -62.2', r: '0 180 0', w: '22', c: '#ffffff' }, { v: 'TAUERN-TUNNEL (88.8 MHz)', p: '-240 24.2 -469.2', r: '0 0 0', w: '26', c: '#fef08a' }].forEach(function (st) { var tEl = document.createElement('a-text'); tEl.setAttribute('value', st.v); tEl.setAttribute('color', st.c); tEl.setAttribute('width', st.w); tEl.setAttribute('align', 'center'); tEl.setAttribute('position', st.p); tEl.setAttribute('rotation', st.r); entity.appendChild(tEl); });
  }

  // --------------------------------------------------------------------------
  // 8. Selbsttest gemäß Spezifikation t-alpine-foreland-tunnel-001 (?vorlandtest=1)
  // --------------------------------------------------------------------------
  function starteVorlandSelbsttest() {
    if (!EEP.alpenvorland || !EEP.welt || !EEP.kollision) return;
    var alpen = EEP.alpenvorland;

    // 1. hoeheOk
    var abfTest = EEP.welt.abfrage(-300, -300);
    var hExp = alpen.hoehe(-300, -300);
    var hoeheOk = (Math.abs(abfTest.hoehe - hExp) <= 0.05) && (abfTest.hoehe >= 3.0 && abfTest.hoehe <= 23.0);

    // 2. strasseOk
    var stuetzen = [
      [-242, -53], [-238, -95], [-226, -150], [-248, -210], [-272, -262],
      [-258, -318], [-236, -372], [-240, -428], [-240, -470]
    ];
    var alleStuetzenOk = true;
    for (var s = 0; s < stuetzen.length; s++) {
      var sp = stuetzen[s];
      var sAbf = EEP.welt.abfrage(sp[0], sp[1]);
      if (sAbf.untergrund !== 'strasse' || Math.abs(sAbf.hoehe - alpen.strassenHoehe(sp[1])) > 0.1) {
        alleStuetzenOk = false;
      }
    }
    var strasseOk = Boolean(alleStuetzenOk && alpen.strassenLaenge >= 420 && alpen.maxSteigung < 0.06);

    // 3. baeumeFreiOk
    var baumFrei = true;
    for (var b = 0; b < alpen.baeume.length; b++) {
      if (alpen.abstandZurStrasse(alpen.baeume[b].x, alpen.baeume[b].z) < 6.0) baumFrei = false;
    }
    var baeumeFreiOk = Boolean(baumFrei && alpen.baeume.length >= 350);

    // 4. massivKollisionOk
    var pMassiv = { x: -270, y: 16.0, z: -520, vorherX: -270, vorherZ: -519, halbBreite: 0.98, halbLaenge: 2.42, hoehe: 1.95, radius: 1.5 };
    var kMassiv = EEP.kollision.pruefe(pMassiv);
    var pTunnel = { x: -240, y: 16.0, z: -520, vorherX: -240, vorherZ: -519, halbBreite: 0.98, halbLaenge: 2.42, hoehe: 1.95, radius: 1.5 };
    var kTunnel = EEP.kollision.pruefe(pTunnel);
    var massivKollisionOk = Boolean(kMassiv && (!kTunnel || kTunnel.eindringtiefe <= 0));

    // 5. tunnelOk
    var t = alpen.tunnel;
    var tunnelOk = Boolean(
      t.fanPaare.length >= 5 && t.deckenLeuchten.length >= 50 &&
      t.ledStreifen && t.ledStreifen.links && t.ledStreifen.rechts &&
      t.sosNischen.length >= 3
    );

    // 6. uebergangEventOk
    var eventFired = false;
    var cb = function (ev) { if (ev && ev.richtung === 'nord') eventFired = true; };
    EEP.bus.on('tunnel-uebergang', cb);
    var prevCam = EEP.aktiveKamera;
    EEP.aktiveKamera = 8;
    alpen.zustand.uebergangGemeldet = false;
    alpen.aktualisiere(0.016, { x: -240, y: 16.0, z: -705 }, 'g-klasse');
    EEP.bus.off('tunnel-uebergang', cb);
    EEP.aktiveKamera = prevCam;
    var uebergangEventOk = Boolean(eventFired);

    var res = {
      hoeheOk: hoeheOk,
      strasseOk: strasseOk,
      baeumeFreiOk: baeumeFreiOk,
      massivKollisionOk: massivKollisionOk,
      tunnelOk: tunnelOk,
      uebergangEventOk: uebergangEventOk
    };

    console.log('VORLAND_TEST_RESULT:' + JSON.stringify(res));
    if (hoeheOk && strasseOk && baeumeFreiOk && massivKollisionOk && tunnelOk && uebergangEventOk) {
      console.log('VORLAND_TEST_OK');
    }

    var stEl = document.querySelector('[ki-steuerung]');
    if (stEl && stEl.components && stEl.components['ki-steuerung']) {
      stEl.components['ki-steuerung'].setzeKamera(8);
    }
    if (EEP.autoComp && typeof EEP.autoComp.teleportiereZu === 'function') {
      EEP.autoComp.teleportiereZu(-240, 15.6, -445, 0);
    }
  }

  // --------------------------------------------------------------------------
  // 9. Frame-Tick, Fan-Rotation, Leuchten & Audio
  // --------------------------------------------------------------------------
  EEP.alpenvorlandUI = {
    init: function () {
      if (state.initialisiert) return;
      var sceneEl = document.querySelector('a-scene');
      if (!sceneEl) return;
      state.initialisiert = true;
      initialisiereAudio();
      baueVorlandWelt(sceneEl);

      if (typeof window !== 'undefined' && window.location && window.location.search) {
        if (window.location.search.indexOf('vorlandtest=1') !== -1) {
          setTimeout(starteVorlandSelbsttest, 500);
        }
      }
    },

    tick: function (timeMs, deltaSec) {
      if (!state.initialisiert) this.init();
      var zeitSek = (timeMs || 0) * 0.001;

      for (var f = 0; f < state.fanRotoren.length; f++) {
        state.fanRotoren[f].rotation.z = zeitSek * 9.0;
      }
      var blink = (Math.floor(zeitSek * 2) % 2 === 0);
      for (var p = 0; p < state.portalLichter.length; p++) {
        state.portalLichter[p].visible = blink;
      }

      var ac = EEP.autoComp;
      var autoPos = (ac && ac.el && ac.el.object3D) ? ac.el.object3D.position : null;

      var laraEl = document.querySelector('#lara-spieler');
      var laraPos = (laraEl && laraEl.object3D) ? laraEl.object3D.position : null;
      var rig = document.querySelector('#kamera-rig');
      var rigPos = (rig && rig.object3D) ? rig.object3D.position : null;
      var refPos = (EEP.aktiveKamera === 8 && autoPos) ? autoPos : ((EEP.aktiveKamera === 1 && laraPos) ? laraPos : (autoPos || rigPos));
      var cX = refPos ? refPos.x : -240, cZ = refPos ? refPos.z : -50;
      var dPortal = Math.sqrt((cX - (-240)) * (cX - (-240)) + (cZ - (-470)) * (cZ - (-470)));
      var imKorridor = (cZ <= -430 && cZ >= -815 && Math.abs(cX - (-240)) <= 35.0);
      if (state.tunnelGruppe) {
        state.tunnelGruppe.visible = (dPortal <= 220.0 || imKorridor || EEP.aktiveKamera === 8);
      }

      if (autoPos && EEP.alpenvorland) {
        EEP.alpenvorland.aktualisiere(deltaSec, autoPos, (ac.data && ac.data.name) || 'g-klasse');

        var imTunnel = (autoPos.z <= -470 && autoPos.z >= -790 && Math.abs(autoPos.x - (-240)) <= 6.0);
        aktualisiereTunnelAudio(imTunnel);

        if (state.pointLights.length >= 2) {
          if (imTunnel) {
            state.pointLights[0].intensity = 1.2;
            state.pointLights[0].position.set(autoPos.x, autoPos.y + 2.5, autoPos.z - 10);
            state.pointLights[1].intensity = 0.8;
            state.pointLights[1].position.set(autoPos.x, autoPos.y + 2.5, autoPos.z + 10);
          } else {
            state.pointLights[0].intensity = 0.0;
            state.pointLights[1].intensity = 0.0;
          }
        }
      }
    }
  };

  function koppleAnSzene() {
    if (typeof AFRAME === 'undefined' || !AFRAME.components) return;
    var steuerDef = AFRAME.components['ki-steuerung'];
    if (steuerDef && steuerDef.Component && !steuerDef.Component.prototype._vorlandGekoppelt) {
      var proto = steuerDef.Component.prototype;
      var origTick = proto.tick;
      proto._vorlandGekoppelt = true;
      proto.tick = function (time, dt) {
        if (origTick) origTick.call(this, time, dt);
        var deltaSec = dt ? Math.min(dt / 1000, 0.08) : 0.016;
        EEP.alpenvorlandUI.tick(time || 0, deltaSec);
      };
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    EEP.alpenvorlandUI.init();
    koppleAnSzene();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      EEP.alpenvorlandUI.init();
      koppleAnSzene();
    });
  }
})();
