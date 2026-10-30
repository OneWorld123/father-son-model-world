/* ============================================================================
 * js/core/alpenvorland-ui.js – 3D-Alpenvorland, Panoramastraße, Hochalpen-Massiv,
 * Tauern-Autobahntunnel, Laras Blumenkörbchen mit Pflückanimation & Selbsttest.
 * ============================================================================ */
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.alpenvorlandUI = '1.1.0';

  var state = {
    initialisiert: false, weltGruppe: null, tunnelGruppe: null,
    fanRotoren: [], portalLichter: [], pointLights: [],
    audioGain: null, audioCtx: null, blumenInst: null,
    standKorbGroup: null, standKorbInhalt: null, standKlickMeshes: [],
    laraKorbPivot: null, laraKorbGroup: null, laraKorbInhalt: null,
    handBlumeGroup: null, handBlumeBlossom: null,
    angezeigteKorbAnzahl: -1, hudEl: null
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

  function initialisiereAudio() {
    if (state.audioCtx || typeof window === 'undefined') return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC(); state.audioCtx = ctx;
      var masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0, ctx.currentTime);
      masterGain.connect(ctx.destination); state.audioGain = masterGain;
      var bufSize = ctx.sampleRate * 2, nBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate), out = nBuf.getChannelData(0);
      for (var i = 0; i < bufSize; i++) out[i] = Math.random() * 2 - 1;
      var wNoise = ctx.createBufferSource(); wNoise.buffer = nBuf; wNoise.loop = true;
      var filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 160;
      wNoise.connect(filter); filter.connect(masterGain); wNoise.start();
      var hum = ctx.createOscillator(); hum.type = 'triangle'; hum.frequency.value = 52;
      var humGain = ctx.createGain(); humGain.gain.value = 0.35;
      hum.connect(humGain); humGain.connect(masterGain); hum.start();
    } catch (e) {}
  }

  function aktualisiereTunnelAudio(imTunnel) {
    if (!state.audioGain || !state.audioCtx) return;
    state.audioGain.gain.linearRampToValueAtTime(imTunnel ? 0.055 : 0.0, state.audioCtx.currentTime + 1.0);
  }

  function spielePflueckKlang(noten) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = state.audioCtx || (state.audioCtx = new AC());
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      (noten || [523.25, 659.25, 783.99]).forEach(function (freq, idx) {
        var osc = ctx.createOscillator(), gn = ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gn.gain.setValueAtTime(0.001, now + idx * 0.09);
        gn.gain.exponentialRampToValueAtTime(0.07, now + idx * 0.09 + 0.02);
        gn.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.09 + 0.35);
        osc.connect(gn); gn.connect(ctx.destination);
        osc.start(now + idx * 0.09); osc.stop(now + idx * 0.09 + 0.38);
      });
    } catch (e) {}
  }

  function baueTerrainMesh(alpen) {
    var geo = new THREE.PlaneGeometry(280, 385, 140, 190); geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position, count = pos.count, colors = new Float32Array(count * 3);
    var cWiese = new THREE.Color(0x4a8522), cKuppe = new THREE.Color(0x7cb342);
    var cSenke = new THREE.Color(0x2e6319), cFels  = new THREE.Color(0x525c66), tmpC = new THREE.Color();
    for (var i = 0; i < count; i++) {
      var wx = pos.getX(i) - 260.0, wz = pos.getZ(i) - 277.5, h = alpen.hoehe(wx, wz);
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
    var terrainMesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    terrainMesh.receiveShadow = true;
    return terrainMesh;
  }

  function baueStrasse(parent, alpen) {
    var pts = alpen.vorlandPunkte, n = pts.length, halbeB = 4.25;
    var strassenGeo = new THREE.BufferGeometry(), vertList = [], normList = [], idxList = [];
    for (var i = 0; i < n; i++) {
      var p = pts[i];
      var fX = (i < n - 1 ? pts[i + 1].x - p.x : p.x - pts[i - 1].x);
      var fZ = (i < n - 1 ? pts[i + 1].z - p.z : p.z - pts[i - 1].z);
      var len = Math.sqrt(fX * fX + fZ * fZ) || 1, nX = -fZ / len, nZ = fX / len, yS = p.y + 0.03;
      vertList.push(p.x - nX * halbeB, yS, p.z - nZ * halbeB, p.x + nX * halbeB, yS, p.z + nZ * halbeB);
      normList.push(0, 1, 0, 0, 1, 0);
      if (i < n - 1) { var base = i * 2; idxList.push(base, base + 1, base + 2, base + 1, base + 3, base + 2); }
    }
    strassenGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertList, 3));
    strassenGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normList, 3));
    strassenGeo.setIndex(idxList);
    var strMesh = new THREE.Mesh(strassenGeo, new THREE.MeshStandardMaterial({ color: 0x33373b, roughness: 0.85, metalness: 0.05 }));
    strMesh.receiveShadow = true; parent.add(strMesh);

    function baueBandLinie(offNorm, bBreite, yOff, mat) {
      var lGeo = new THREE.BufferGeometry(), v = [], idx = [];
      for (var j = 0; j < n; j++) {
        var pJ = pts[j];
        var fwdX = (j < n - 1 ? pts[j + 1].x - pJ.x : pJ.x - pts[j - 1].x);
        var fwdZ = (j < n - 1 ? pts[j + 1].z - pJ.z : pJ.z - pts[j - 1].z);
        var lJ = Math.sqrt(fwdX * fwdX + fwdZ * fwdZ) || 1, normX = -fwdZ / lJ, normZ = fwdX / lJ;
        var cx = pJ.x + normX * offNorm, cz = pJ.z + normZ * offNorm;
        v.push(cx - normX * (bBreite * 0.5), pJ.y + yOff, cz - normZ * (bBreite * 0.5), cx + normX * (bBreite * 0.5), pJ.y + yOff, cz + normZ * (bBreite * 0.5));
        if (j < n - 1) { var bIdx = j * 2; idx.push(bIdx, bIdx + 1, bIdx + 2, bIdx + 1, bIdx + 3, bIdx + 2); }
      }
      lGeo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      lGeo.setIndex(idx); parent.add(new THREE.Mesh(lGeo, mat));
    }

    var matWeiss = new THREE.MeshBasicMaterial({ color: 0xffffff });
    baueBandLinie(-(halbeB - 0.08), 0.15, 0.035, matWeiss);
    baueBandLinie((halbeB - 0.08), 0.15, 0.035, matWeiss);

    var mittelGeo = new THREE.BufferGeometry(), mVerts = [], mIdx = [], distSum = 0;
    for (var m = 0; m < n - 1; m++) {
      var pA = pts[m], pB = pts[m + 1], dSeg = Math.sqrt((pB.x - pA.x) * (pB.x - pA.x) + (pB.z - pA.z) * (pB.z - pA.z));
      if ((distSum % 6.0) < 3.0) {
        var sx = (pB.x - pA.x) / dSeg, sz = (pB.z - pA.z) / dSeg, nx = -sz, nz = sx, bM = mVerts.length / 3;
        mVerts.push(pA.x - nx * 0.09, pA.y + 0.036, pA.z - nz * 0.09, pA.x + nx * 0.09, pA.y + 0.036, pA.z + nz * 0.09);
        mVerts.push(pB.x - nx * 0.09, pB.y + 0.036, pB.z - nz * 0.09, pB.x + nx * 0.09, pB.y + 0.036, pB.z + nz * 0.09);
        mIdx.push(bM, bM + 1, bM + 2, bM + 1, bM + 3, bM + 2);
      }
      distSum += dSeg;
    }
    mittelGeo.setAttribute('position', new THREE.Float32BufferAttribute(mVerts, 3));
    mittelGeo.setIndex(mIdx); parent.add(new THREE.Mesh(mittelGeo, new THREE.MeshBasicMaterial({ color: 0xfacc15 })));

    var pfInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6), new THREE.MeshLambertMaterial({ color: 0xf1f5f9 }), Math.floor(alpen.strassenLaenge / 12) * 2);
    var dummy = new THREE.Object3D(), pIdx = 0, dCounter = 0;
    for (var pf = 0; pf < n - 1; pf++) {
      var p1 = pts[pf], p2 = pts[pf + 1], dStep = Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.z - p1.z) * (p2.z - p1.z));
      dCounter += dStep;
      if (dCounter >= 12.0) {
        dCounter -= 12.0;
        var lx = -(p2.z - p1.z) / dStep, lz = (p2.x - p1.x) / dStep;
        dummy.position.set(p1.x - lx * 4.65, p1.y + 0.5, p1.z - lz * 4.65); dummy.updateMatrix(); pfInst.setMatrixAt(pIdx++, dummy.matrix);
        dummy.position.set(p1.x + lx * 4.65, p1.y + 0.5, p1.z + lz * 4.65); dummy.updateMatrix(); pfInst.setMatrixAt(pIdx++, dummy.matrix);
      }
    }
    pfInst.instanceMatrix.needsUpdate = true; parent.add(pfInst);
  }

  function baueNatur(parent, alpen) {
    var bList = alpen.baeume, nadelList = [], laubList = [];
    for (var b = 0; b < bList.length; b++) {
      if (bList[b].typ === 'nadel') nadelList.push(bList[b]); else laubList.push(bList[b]);
    }
    var dummy = new THREE.Object3D();
    var stammMat = new THREE.MeshLambertMaterial({ color: 0x422006 }), nadelMat = new THREE.MeshLambertMaterial({ color: 0x1b4332 }), laubMat = new THREE.MeshLambertMaterial({ color: 0x2d6a4f });
    var stammGeo = new THREE.CylinderGeometry(0.22, 0.35, 2.5, 8), kronGeo = new THREE.ConeGeometry(1.8, 3.8, 8);
    var nadelStammInst = new THREE.InstancedMesh(stammGeo, stammMat, nadelList.length);
    var nadelKroneInst = new THREE.InstancedMesh(kronGeo, nadelMat, nadelList.length * 3);
    var kIdx = 0;
    for (var nIdx = 0; nIdx < nadelList.length; nIdx++) {
      var nb = nadelList[nIdx], s = nb.scale || 1.0;
      dummy.scale.set(s, s, s); dummy.rotation.set(0, (nIdx * 1.7) % 6.28, 0);
      dummy.position.set(nb.x, nb.y + 1.25 * s, nb.z); dummy.updateMatrix(); nadelStammInst.setMatrixAt(nIdx, dummy.matrix);
      dummy.position.set(nb.x, nb.y + 3.2 * s, nb.z); dummy.updateMatrix(); nadelKroneInst.setMatrixAt(kIdx++, dummy.matrix);
      dummy.position.set(nb.x, nb.y + 5.0 * s, nb.z); dummy.scale.set(s * 0.8, s * 0.8, s * 0.8); dummy.updateMatrix(); nadelKroneInst.setMatrixAt(kIdx++, dummy.matrix);
      dummy.position.set(nb.x, nb.y + 6.6 * s, nb.z); dummy.scale.set(s * 0.6, s * 0.6, s * 0.6); dummy.updateMatrix(); nadelKroneInst.setMatrixAt(kIdx++, dummy.matrix);
    }
    nadelStammInst.instanceMatrix.needsUpdate = true; nadelKroneInst.instanceMatrix.needsUpdate = true;
    parent.add(nadelStammInst); parent.add(nadelKroneInst);

    var laubStammInst = new THREE.InstancedMesh(stammGeo, stammMat, laubList.length);
    var laubKroneInst = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(2.3, 1), laubMat, laubList.length);
    for (var lIdx = 0; lIdx < laubList.length; lIdx++) {
      var lb = laubList[lIdx], ls = lb.scale || 1.0;
      dummy.scale.set(ls, ls, ls); dummy.rotation.set(0, (lIdx * 2.1) % 6.28, 0);
      dummy.position.set(lb.x, lb.y + 1.25 * ls, lb.z); dummy.updateMatrix(); laubStammInst.setMatrixAt(lIdx, dummy.matrix);
      dummy.position.set(lb.x, lb.y + 3.8 * ls, lb.z); dummy.updateMatrix(); laubKroneInst.setMatrixAt(lIdx, dummy.matrix);
    }
    laubStammInst.instanceMatrix.needsUpdate = true; laubKroneInst.instanceMatrix.needsUpdate = true;
    parent.add(laubStammInst); parent.add(laubKroneInst);

    var blumenList = alpen.blumen;
    var blumInst = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.24, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), blumenList.length);
    for (var f = 0; f < blumenList.length; f++) {
      var fl = blumenList[f];
      if (fl.gepflueckt) { dummy.position.set(fl.x, -100, fl.z); dummy.scale.set(0, 0, 0); }
      else { dummy.position.set(fl.x, fl.y + 0.15, fl.z); dummy.scale.set(fl.scale, fl.scale * 1.5, fl.scale); }
      dummy.rotation.set(0, f, 0); dummy.updateMatrix();
      blumInst.setMatrixAt(f, dummy.matrix); blumInst.setColorAt(f, new THREE.Color(fl.farbe));
    }
    blumInst.instanceMatrix.needsUpdate = true;
    if (blumInst.instanceColor) blumInst.instanceColor.needsUpdate = true;
    parent.add(blumInst); state.blumenInst = blumInst;

    var seeMat = new THREE.MeshStandardMaterial({ color: 0x1b6ca8, roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.90 });
    for (var si = 0; si < alpen.seen.length; si++) {
      var sObj = alpen.seen[si], sGeo = new THREE.CircleGeometry(sObj.r, 32);
      sGeo.rotateX(-Math.PI / 2); addMesh(parent, sGeo, seeMat, sObj.x, sObj.y + 0.04, sObj.z);
    }

    var holzMat = new THREE.MeshLambertMaterial({ color: 0x78350f }), dachMat = new THREE.MeshLambertMaterial({ color: 0x451a03 }), steinMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
    for (var hi = 0; hi < alpen.huetten.length; hi++) {
      var hut = alpen.huetten[hi], hutGroup = new THREE.Group();
      hutGroup.position.set(hut.x, hut.y, hut.z); hutGroup.rotation.y = hut.yaw || 0;
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
        var hProxy = new THREE.Object3D(); hProxy.position.set(hut.x, hut.y, hut.z); EEP.lod.registriere(hProxy, 'gebaeude');
      }
    }
    if (EEP.lod && typeof EEP.lod.registriere === 'function') {
      for (var bLod = 0; bLod < bList.length; bLod++) {
        var bProxy = new THREE.Object3D(); bProxy.position.set(bList[bLod].x, bList[bLod].y, bList[bLod].z); EEP.lod.registriere(bProxy, 'baum');
      }
    }
  }

  function erzeuge3DKorb() {
    var kGroup = new THREE.Group();
    var korbHellMat = new THREE.MeshStandardMaterial({ color: 0xc28e5c, roughness: 0.78, side: THREE.DoubleSide });
    var korbDunkelMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.82 });
    var moosMat = new THREE.MeshLambertMaterial({ color: 0x2d6a4f });
    addMesh(kGroup, new THREE.CylinderGeometry(0.14, 0.14, 0.03, 16), korbDunkelMat, 0, 0.015, 0);
    addMesh(kGroup, new THREE.CylinderGeometry(0.22, 0.14, 0.17, 18, 1, true), korbHellMat, 0, 0.10, 0);
    addMesh(kGroup, new THREE.TorusGeometry(0.16, 0.016, 10, 20), korbDunkelMat, 0, 0.06, 0, Math.PI / 2);
    addMesh(kGroup, new THREE.TorusGeometry(0.19, 0.016, 10, 20), korbHellMat, 0, 0.12, 0, Math.PI / 2);
    addMesh(kGroup, new THREE.TorusGeometry(0.22, 0.024, 12, 24), korbDunkelMat, 0, 0.18, 0, Math.PI / 2);
    addMesh(kGroup, new THREE.CylinderGeometry(0.19, 0.14, 0.07, 16), moosMat, 0, 0.10, 0);
    addMesh(kGroup, new THREE.TorusGeometry(0.21, 0.020, 10, 24, Math.PI), korbDunkelMat, 0, 0.18, 0);
    var inhalt = new THREE.Group(); inhalt.name = 'korb-inhalt'; kGroup.add(inhalt);
    return { group: kGroup, inhalt: inhalt };
  }

  function erzeugeEinzelBlumeMesh(farbeHex, scale) {
    var gBl = new THREE.Group(), c = new THREE.Color(farbeHex || '#ec4899');
    var stielMat = new THREE.MeshLambertMaterial({ color: 0x16a34a });
    var blMat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.25, metalness: 0.2 });
    addMesh(gBl, new THREE.CylinderGeometry(0.014, 0.014, 0.15, 6), stielMat, 0, 0.075, 0);
    var kr = addMesh(gBl, new THREE.OctahedronGeometry(0.078 * (scale || 1.0), 0), blMat, 0, 0.17, 0);
    kr.scale.set(1.0, 1.35, 1.0);
    return gBl;
  }

  function baueKorbStand(parent, entity, alpen) {
    var st = alpen.korbStandort, standGroup = new THREE.Group();
    standGroup.position.set(st.x, st.y, st.z);
    var holzMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    var tischMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.78 });
    var schildMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
    var sockel = addMesh(standGroup, new THREE.CylinderGeometry(0.45, 0.52, 0.08, 16), holzMat, 0, 0.04, 0);
    var pfahl = addMesh(standGroup, new THREE.CylinderGeometry(0.12, 0.15, 0.72, 12), holzMat, 0, 0.40, 0);
    var platte = addMesh(standGroup, new THREE.CylinderGeometry(0.42, 0.38, 0.07, 18), tischMat, 0, 0.76, 0);
    addMesh(standGroup, new THREE.CylinderGeometry(0.05, 0.05, 1.65, 8), holzMat, 0.55, 0.82, -0.20);
    var tafel = addMesh(standGroup, new THREE.BoxGeometry(1.45, 0.46, 0.08), schildMat, 0.55, 1.52, -0.20);

    var standKorb = erzeuge3DKorb();
    standKorb.group.position.set(0, 0.80, 0); standGroup.add(standKorb.group);
    state.standKorbGroup = standKorb.group; state.standKorbInhalt = standKorb.inhalt;
    state.standKlickMeshes = [sockel, pfahl, platte, tafel, standKorb.group];
    parent.add(standGroup);

    [
      { v: 'BLUMENKOERBCHEN [B]', p: (st.x + 0.55) + ' ' + (st.y + 1.52) + ' ' + (st.z - 0.14), r: '0 0 0' },
      { v: 'BLUMENKOERBCHEN [B]', p: (st.x + 0.55) + ' ' + (st.y + 1.52) + ' ' + (st.z - 0.26), r: '0 180 0' }
    ].forEach(function (tx) {
      var tEl = document.createElement('a-text');
      tEl.setAttribute('value', tx.v); tEl.setAttribute('color', '#fef08a');
      tEl.setAttribute('width', '6.5'); tEl.setAttribute('align', 'center');
      tEl.setAttribute('position', tx.p); tEl.setAttribute('rotation', tx.r);
      entity.appendChild(tEl);
    });
  }

  function stelleLaraKorbUndHandSicher() {
    var lc = EEP.laraComp;
    if (!lc || !lc.armL || !lc.armL.wrist || !lc.armR || !lc.armR.wrist || state.laraKorbPivot || typeof THREE === 'undefined') return;
    var pivot = new THREE.Group(); pivot.position.set(-0.06, -0.05, 0);
    var laraKorb = erzeuge3DKorb();
    laraKorb.group.scale.set(0.82, 0.82, 0.82); laraKorb.group.position.set(0, -0.32, 0);
    pivot.add(laraKorb.group); pivot.visible = false; lc.armL.wrist.add(pivot);
    state.laraKorbPivot = pivot; state.laraKorbGroup = laraKorb.group; state.laraKorbInhalt = laraKorb.inhalt;

    var handGroup = new THREE.Group(); handGroup.position.set(0, -0.06, -0.03);
    addMesh(handGroup, new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6), new THREE.MeshLambertMaterial({ color: 0x16a34a }), 0, -0.02, 0);
    var blossomMat = new THREE.MeshStandardMaterial({ color: 0xec4899, emissive: 0xec4899, emissiveIntensity: 0.4, roughness: 0.2 });
    var blossom = addMesh(handGroup, new THREE.OctahedronGeometry(0.08, 0), blossomMat, 0, -0.09, 0);
    blossom.scale.set(1.0, 1.35, 1.0); handGroup.visible = false; lc.armR.wrist.add(handGroup);
    state.handBlumeGroup = handGroup; state.handBlumeBlossom = blossom;
  }

  function blendeWiesenBlumeAus(index) {
    if (!state.blumenInst || !EEP.alpenvorland) return;
    var fl = EEP.alpenvorland.blumen[index]; if (!fl) return;
    var dummy = new THREE.Object3D();
    dummy.position.set(fl.x, -100, fl.z); dummy.scale.set(0, 0, 0); dummy.updateMatrix();
    state.blumenInst.setMatrixAt(index, dummy.matrix);
    state.blumenInst.instanceMatrix.needsUpdate = true;
  }

  function stelleAlleWiesenBlumenWiederHer() {
    if (!state.blumenInst || !EEP.alpenvorland) return;
    var blumenList = EEP.alpenvorland.blumen, dummy = new THREE.Object3D();
    for (var i = 0; i < blumenList.length; i++) {
      var fl = blumenList[i];
      dummy.position.set(fl.x, fl.y + 0.15, fl.z); dummy.scale.set(fl.scale, fl.scale * 1.5, fl.scale);
      dummy.rotation.set(0, i, 0); dummy.updateMatrix();
      state.blumenInst.setMatrixAt(i, dummy.matrix);
    }
    state.blumenInst.instanceMatrix.needsUpdate = true;
  }

  function synchronisiereKorbInhalt3D() {
    if (!EEP.alpenvorland) return;
    var gesammelt = EEP.alpenvorland.korbZustand.gesammelt;
    if (state.angezeigteKorbAnzahl === gesammelt.length) return;
    state.angezeigteKorbAnzahl = gesammelt.length;
    [state.laraKorbInhalt, state.standKorbInhalt].forEach(function (inhaltGroup) {
      if (!inhaltGroup) return;
      while (inhaltGroup.children.length > 0) inhaltGroup.remove(inhaltGroup.children[0]);
      for (var i = 0; i < gesammelt.length; i++) {
        var item = gesammelt[i], mesh = erzeugeEinzelBlumeMesh(item.farbe, item.scale || 1.0);
        var ring = i === 0 ? 0 : (i < 7 ? 0.085 : 0.135), winkel = i * 1.05;
        var lageY = 0.08 + Math.min(0.06, Math.floor(i / 7) * 0.03);
        mesh.position.set(Math.cos(winkel) * ring, lageY, Math.sin(winkel) * ring);
        mesh.rotation.set(Math.sin(winkel) * 0.28, winkel, -Math.cos(winkel) * 0.28);
        inhaltGroup.add(mesh);
      }
    });
  }

  function baueHochalpen(parent, alpen) {
    var felsMat = new THREE.MeshStandardMaterial({ color: 0x5d6b7a, roughness: 0.92 });
    var schneeMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
    var felsZahnMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.95 });
    var gipfelList = alpen.hochalpenGipfel;
    for (var g = 0; g < gipfelList.length; g++) {
      var gp = gipfelList[g], gMesh = addMesh(parent, new THREE.ConeGeometry(gp.radius, gp.hoehe, gp.segmente || 8), felsMat, gp.x, gp.hoehe * 0.5, gp.z);
      gMesh.rotation.y = (g * 1.3) % Math.PI;
      var capH = gp.hoehe * 0.35, capR = gp.radius * 0.35, cMesh = addMesh(parent, new THREE.ConeGeometry(capR, capH, gp.segmente || 8), schneeMat, gp.x, gp.hoehe - capH * 0.5, gp.z);
      cMesh.rotation.y = gMesh.rotation.y;
      if (gp.mitFelszahn) addMesh(parent, new THREE.ConeGeometry(4.5, 24.0, 7), felsZahnMat, gp.x - 2.0, gp.hoehe + 10.0, gp.z + 1.5, 0.08, 0.2, 0.05);
    }
    addMesh(parent, new THREE.BoxGeometry(130, 85, 45), felsMat, -310, 42.5, -475);
    addMesh(parent, new THREE.BoxGeometry(130, 85, 45), felsMat, -170, 42.5, -475);
    addMesh(parent, new THREE.BoxGeometry(22, 55, 35), felsMat, -240, 52.0, -478);
  }

  function baueTauernTunnel(parent, alpen) {
    var tData = alpen.tunnel, tGroup = new THREE.Group();
    tGroup.id = 'tauern-tunnel-gruppe'; state.tunnelGruppe = tGroup;
    var betonMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.82 });
    var gewoelbeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.90, side: THREE.DoubleSide });
    var fliesenMat = new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.30, metalness: 0.15, side: THREE.DoubleSide });
    var fahrbahnMat = new THREE.MeshStandardMaterial({ color: 0x272a2e, roughness: 0.85 });
    var bordsteinMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.65 });
    var leuchtenMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3b0, emissiveIntensity: 2.2 });
    var ledMat = new THREE.MeshStandardMaterial({ color: 0xfffaed, emissive: 0xfff6c7, emissiveIntensity: 2.5 });

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

    addMesh(tGroup, new THREE.BoxGeometry(8.5, 0.2, 320), fahrbahnMat, -240, 15.9, -630);
    addMesh(tGroup, new THREE.BoxGeometry(0.75, 0.35, 320), bordsteinMat, -244.625, 16.15, -630);
    addMesh(tGroup, new THREE.BoxGeometry(0.75, 0.35, 320), bordsteinMat, -235.375, 16.15, -630);
    addMesh(tGroup, new THREE.BoxGeometry(0.3, 3.0, 320), fliesenMat, -245.0, 17.5, -630);
    addMesh(tGroup, new THREE.BoxGeometry(0.3, 3.0, 320), fliesenMat, -235.0, 17.5, -630);
    var gewGeo = new THREE.CylinderGeometry(5.0, 5.0, 320, 24, 1, true, 0, Math.PI);
    gewGeo.rotateZ(Math.PI / 2); gewGeo.rotateY(Math.PI / 2);
    addMesh(tGroup, gewGeo, gewoelbeMat, -240, 19.0, -630);

    var deckenInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.15, 0.45), leuchtenMat, tData.deckenLeuchten.length);
    var dummyL = new THREE.Object3D();
    for (var dl = 0; dl < tData.deckenLeuchten.length; dl++) {
      dummyL.position.set(tData.deckenLeuchten[dl].x, tData.deckenLeuchten[dl].y, tData.deckenLeuchten[dl].z);
      dummyL.updateMatrix(); deckenInst.setMatrixAt(dl, dummyL.matrix);
    }
    deckenInst.instanceMatrix.needsUpdate = true; tGroup.add(deckenInst);

    addMesh(tGroup, new THREE.BoxGeometry(0.08, 0.10, 320), ledMat, -244.9, 17.2, -630);
    addMesh(tGroup, new THREE.BoxGeometry(0.08, 0.10, 320), ledMat, -235.1, 17.2, -630);

    var fanGeo = new THREE.CylinderGeometry(0.60, 0.60, 3.5, 16); fanGeo.rotateX(Math.PI / 2);
    var fanMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.6 });
    var rotorMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.8 });
    state.fanRotoren = [];
    for (var fp = 0; fp < tData.fanPaare.length; fp++) {
      var pair = tData.fanPaare[fp];
      [pair.links, pair.rechts].forEach(function (fan) {
        var fg = new THREE.Group(); fg.position.set(fan.x, fan.y, fan.z);
        addMesh(fg, fanGeo, fanMat, 0, 0, 0);
        addMesh(fg, new THREE.BoxGeometry(0.18, 1.2, 1.4), fanMat, 0, 0.75, 0);
        var rg = new THREE.Group(); rg.position.set(0, 0, 1.6);
        addMesh(rg, new THREE.CylinderGeometry(0.16, 0.16, 0.25, 12), fanMat, 0, 0, 0, Math.PI / 2);
        addMesh(rg, new THREE.BoxGeometry(1.05, 0.18, 0.04), rotorMat, 0, 0, 0, 0, 0, Math.PI / 4);
        addMesh(rg, new THREE.BoxGeometry(1.05, 0.18, 0.04), rotorMat, 0, 0, 0, 0, 0, -Math.PI / 4);
        fg.add(rg); tGroup.add(fg); state.fanRotoren.push(rg);
      });
    }

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

    var bGroup = new THREE.Group(); bGroup.id = 'tauern-tunnel-baustelle'; bGroup.name = 'tauern-tunnel-baustelle';
    addMesh(bGroup, new THREE.BoxGeometry(10.0, 6.5, 0.6), betonMat, -240, 19.0, -790);
    addMesh(bGroup, new THREE.BoxGeometry(6.5, 1.2, 0.1), new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xb91c1c, emissiveIntensity: 0.6 }), -240, 18.5, -789.6);
    tGroup.add(bGroup);

    var pl1 = new THREE.PointLight(0xfff3b0, 0.0, 25.0, 1.2), pl2 = new THREE.PointLight(0xfff3b0, 0.0, 25.0, 1.2);
    tGroup.add(pl1); tGroup.add(pl2); state.pointLights = [pl1, pl2];
    parent.add(tGroup);
  }

  function teleportiereLaraZumKorbStand() {
    var lc = EEP.laraComp, alpen = EEP.alpenvorland;
    if (!lc || !alpen) return;
    if (EEP.einstieg && EEP.einstieg.aktuellInFahrzeug) EEP.einstieg.steigeAus();
    var tx = -233.5, tz = -89.6, ty = alpen.hoehe(tx, tz);
    if (typeof lc.teleportiereZu === 'function') lc.teleportiereZu(tx, ty, tz, 0);
    var steuerEl = document.querySelector('[ki-steuerung]');
    if (steuerEl && steuerEl.components && steuerEl.components['ki-steuerung']) steuerEl.components['ki-steuerung'].setzeKamera(1);
  }

  function loesePflueckenAus(blumenIdxOptional) {
    var alpen = EEP.alpenvorland, lc = EEP.laraComp;
    if (!alpen || !lc || !lc.el || !lc.el.object3D) return;
    var res = alpen.startePfluecken(lc.el.object3D.position, blumenIdxOptional);
    if (res.erfolg) spielePflueckKlang([523.25, 659.25]);
    aktualisiereVorlandKorbHUD();
  }

  function baueVorlandKorbHUD() {
    if (typeof document === 'undefined' || state.hudEl) return;
    var div = document.createElement('div'); div.id = 'eep-vorland-korb-hud';
    div.style.cssText = 'position:fixed;top:204px;left:50%;transform:translateX(-50%);z-index:10006;background:rgba(20,40,22,0.92);color:#ecfccb;padding:6px 14px;border-radius:10px;font:600 12px system-ui,sans-serif;border:1px solid #84cc16;display:none;box-shadow:0 4px 16px rgba(0,0,0,0.5);white-space:nowrap;';
    document.body.appendChild(div); state.hudEl = div;

    div.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-vkorb]');
      if (!btn || !EEP.alpenvorland) return;
      var akt = btn.getAttribute('data-vkorb');
      if (akt === 'teleport') teleportiereLaraZumKorbStand();
      else if (akt === 'korb') { EEP.alpenvorland.schalteKorb(); spielePflueckKlang([392.0, 523.25]); }
      else if (akt === 'pfluecken') loesePflueckenAus();
      aktualisiereVorlandKorbHUD();
    });

    if (EEP.bus) {
      EEP.bus.on('vorland-blume-gepflueckt', function (ev) {
        if (ev && typeof ev.index === 'number') blendeWiesenBlumeAus(ev.index);
        if (state.handBlumeBlossom && ev && ev.farbe) {
          var c = new THREE.Color(ev.farbe);
          state.handBlumeBlossom.material.color.copy(c);
          state.handBlumeBlossom.material.emissive.copy(c);
        }
      });
      EEP.bus.on('vorland-blume-im-korb', function () {
        synchronisiereKorbInhalt3D(); spielePflueckKlang([659.25, 783.99, 1046.5]);
      });
    }

    window.addEventListener('pointerdown', function (ev) {
      if (!EEP.alpenvorland || typeof THREE === 'undefined') return;
      if (EEP.aktiveKamera !== 1 && EEP.aktiveKamera !== 7) return;
      if (ev.target && ev.target.tagName !== 'CANVAS') return;
      var sceneEl = document.querySelector('a-scene'); if (!sceneEl || !sceneEl.camera) return;
      var rect = ev.target.getBoundingClientRect();
      var mouse = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      var raycaster = new THREE.Raycaster(); raycaster.setFromCamera(mouse, sceneEl.camera);
      if (state.standKlickMeshes && state.standKlickMeshes.length) {
        var standHits = raycaster.intersectObjects(state.standKlickMeshes, true);
        if (standHits && standHits.length > 0) {
          EEP.alpenvorland.schalteKorb(); spielePflueckKlang([392.0, 523.25]); aktualisiereVorlandKorbHUD(); return;
        }
      }
      if (state.blumenInst) {
        var blHits = raycaster.intersectObject(state.blumenInst, false);
        if (blHits && blHits.length > 0 && typeof blHits[0].instanceId === 'number') loesePflueckenAus(blHits[0].instanceId);
      }
    });

    window.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (EEP.aktiveKamera !== 1 && EEP.aktiveKamera !== 7) return;
      if (!EEP.alpenvorland) return;
      var lc = EEP.laraComp, lPos = (lc && lc.el && lc.el.object3D) ? lc.el.object3D.position : null;
      if (!lPos || lPos.x > -80 || lPos.z > 20) return;
      var k = e.key.toLowerCase();
      if (k === 'b') {
        EEP.alpenvorland.schalteKorb(); spielePflueckKlang([392.0, 523.25]); aktualisiereVorlandKorbHUD(); e.preventDefault();
      } else if (k === 'e' || k === 'p') {
        if (EEP.pyramide && EEP.pyramide.zustand && EEP.pyramide.zustand.naheAmKnopf) return;
        if (!EEP.alpenvorland.korbZustand.aufgenommen && EEP.alpenvorland.korbZustand.naheAmStand) {
          EEP.alpenvorland.nehmeKorbAuf(); spielePflueckKlang([392.0, 523.25]);
        } else {
          loesePflueckenAus();
        }
        aktualisiereVorlandKorbHUD(); e.preventDefault();
      }
    });
  }

  function aktualisiereVorlandKorbHUD() {
    if (!state.hudEl || !EEP.alpenvorland) return;
    if (EEP.aktiveKamera !== 1 && EEP.aktiveKamera !== 7) { state.hudEl.style.display = 'none'; return; }
    var lc = EEP.laraComp, lPos = (lc && lc.el && lc.el.object3D) ? lc.el.object3D.position : null;
    if (!lPos || lPos.x > -80 || lPos.z > 15) { state.hudEl.style.display = 'none'; return; }
    state.hudEl.style.display = 'block';
    var kz = EEP.alpenvorland.korbZustand, anz = kz.gesammelt.length;
    var statusTxt = kz.aufgenommen ? ('🧺 <b>Körbchen: ' + anz + ' gesammelt</b>') : ('🧺 <b>Blumenwiese</b> (' + anz + ' im Korb am Stand)');
    var korbBtnTxt = kz.aufgenommen ? '🧺 Körbchen ablegen [B]' : '🧺 Körbchen holen [B]';
    var btnStyle = 'background:#365314;color:#fef08a;border:1px solid #84cc16;border-radius:6px;padding:3px 8px;cursor:pointer;font:600 11px system-ui;margin:0 3px;';
    var pflueckStyle = 'background:' + (kz.aufgenommen && kz.naechsteBlumeDist <= 4.5 ? '#15803d' : '#1e293b') + ';color:#ffffff;border:1px solid #4ade80;border-radius:6px;padding:3px 8px;cursor:pointer;font:600 11px system-ui;margin:0 3px;';
    state.hudEl.innerHTML =
      statusTxt + ' · <span style="color:#fde047;">' + kz.hinweisText + '</span> ' +
      '<button data-vkorb="teleport" style="' + btnStyle + '">🏃‍♀️ Zum Körbchen-Eingang</button>' +
      '<button data-vkorb="korb" style="' + btnStyle + '">' + korbBtnTxt + '</button>' +
      '<button data-vkorb="pfluecken" style="' + pflueckStyle + '">🌸 Pflücken [E]</button>';
  }

  function baueVorlandWelt(sceneEl) {
    if (!EEP.alpenvorland) return;
    var alpen = EEP.alpenvorland; alpen.initialisiere();
    var entity = document.getElementById('alpenvorland-welt');
    if (!entity) { entity = document.createElement('a-entity'); entity.id = 'alpenvorland-welt'; sceneEl.appendChild(entity); }
    var group = new THREE.Group(); state.weltGruppe = group;
    group.add(baueTerrainMesh(alpen));
    baueStrasse(group, alpen); baueNatur(group, alpen);
    baueKorbStand(group, entity, alpen); baueHochalpen(group, alpen); baueTauernTunnel(group, alpen);
    entity.object3D.add(group);
    [
      { v: 'TAUERN-TUNNEL & SCHNEEWELT (400m)', p: '-240 5.85 -61.8', r: '0 0 0', w: '22', c: '#ffffff' },
      { v: 'TAUERN-TUNNEL & SCHNEEWELT (400m)', p: '-240 5.85 -62.2', r: '0 180 0', w: '22', c: '#ffffff' },
      { v: 'TAUERN-TUNNEL (88.8 MHz)', p: '-240 24.2 -469.2', r: '0 0 0', w: '26', c: '#fef08a' }
    ].forEach(function (st) {
      var tEl = document.createElement('a-text');
      tEl.setAttribute('value', st.v); tEl.setAttribute('color', st.c);
      tEl.setAttribute('width', st.w); tEl.setAttribute('align', 'center');
      tEl.setAttribute('position', st.p); tEl.setAttribute('rotation', st.r);
      entity.appendChild(tEl);
    });
  }

  function starteVorlandSelbsttest() {
    if (!EEP.alpenvorland || !EEP.welt || !EEP.kollision) return;
    var alpen = EEP.alpenvorland; stelleLaraKorbUndHandSicher();
    var abfTest = EEP.welt.abfrage(-300, -300), hExp = alpen.hoehe(-300, -300);
    var hoeheOk = (Math.abs(abfTest.hoehe - hExp) <= 0.05) && (abfTest.hoehe >= 3.0 && abfTest.hoehe <= 23.0);
    var stuetzen = [[-242, -53], [-238, -95], [-226, -150], [-248, -210], [-272, -262], [-258, -318], [-236, -372], [-240, -428], [-240, -470]];
    var alleStuetzenOk = true;
    for (var s = 0; s < stuetzen.length; s++) {
      var sp = stuetzen[s], sAbf = EEP.welt.abfrage(sp[0], sp[1]);
      if (sAbf.untergrund !== 'strasse' || Math.abs(sAbf.hoehe - alpen.strassenHoehe(sp[1])) > 0.1) alleStuetzenOk = false;
    }
    var strasseOk = Boolean(alleStuetzenOk && alpen.strassenLaenge >= 420 && alpen.maxSteigung < 0.06);
    var baumFrei = true;
    for (var b = 0; b < alpen.baeume.length; b++) {
      if (alpen.abstandZurStrasse(alpen.baeume[b].x, alpen.baeume[b].z) < 6.0) baumFrei = false;
    }
    var baeumeFreiOk = Boolean(baumFrei && alpen.baeume.length >= 350);
    var pMassiv = { x: -270, y: 16.0, z: -520, vorherX: -270, vorherZ: -519, halbBreite: 0.98, halbLaenge: 2.42, hoehe: 1.95, radius: 1.5 };
    var kMassiv = EEP.kollision.pruefe(pMassiv);
    var pTunnel = { x: -240, y: 16.0, z: -520, vorherX: -240, vorherZ: -519, halbBreite: 0.98, halbLaenge: 2.42, hoehe: 1.95, radius: 1.5 };
    var kTunnel = EEP.kollision.pruefe(pTunnel);
    var massivKollisionOk = Boolean(kMassiv && (!kTunnel || kTunnel.eindringtiefe <= 0));
    var t = alpen.tunnel;
    var tunnelOk = Boolean(t.fanPaare.length >= 5 && t.deckenLeuchten.length >= 50 && t.ledStreifen && t.ledStreifen.links && t.ledStreifen.rechts && t.sosNischen.length >= 3);

    var eventFired = false, cb = function (ev) { if (ev && ev.richtung === 'nord') eventFired = true; };
    EEP.bus.on('tunnel-uebergang', cb);
    var prevCam = EEP.aktiveKamera; EEP.aktiveKamera = 8;
    alpen.zustand.uebergangGemeldet = false;
    alpen.aktualisiere(0.016, { x: -240, y: 16.0, z: -705 }, 'g-klasse');
    EEP.bus.off('tunnel-uebergang', cb); EEP.aktiveKamera = prevCam;
    if (EEP.schneewelt && EEP.schneewelt.zustand) {
      EEP.schneewelt.zustand.inSchneewelt = false;
      EEP.schneewelt.zustand.transitionAlpha = 0;
      EEP.schneewelt.zustand.transitionTimer = 0;
    }
    var swFade = document.getElementById('eep-schneewelt-fade');
    if (swFade) swFade.style.opacity = '0';
    var uebergangEventOk = Boolean(eventFired);

    alpen.resetKorb(); stelleAlleWiesenBlumenWiederHer();
    state.angezeigteKorbAnzahl = -1; synchronisiereKorbInhalt3D();
    var laraTestPos = { x: -232.2, y: alpen.hoehe(-232.2, -92.5), z: -92.5 };
    var versuchOhneKorb = alpen.startePfluecken(laraTestPos);
    var ohneKorbAbgelehnt = Boolean(!versuchOhneKorb.erfolg && versuchOhneKorb.grund === 'kein-korb');

    alpen.nehmeKorbAuf();
    var startPfl1 = alpen.startePfluecken(laraTestPos), warKnien = false, warInHand = false;
    for (var step1 = 0; step1 < 30; step1++) {
      var pose1 = alpen.aktualisierePfluecken(0.05, laraTestPos);
      if (pose1.hocke > 0.85 && pose1.beckenY < 0.65) warKnien = true;
      if (alpen.korbZustand.inRechterHand) warInHand = true;
    }
    synchronisiereKorbInhalt3D();
    var nachErsterBlumeOk = Boolean(startPfl1.erfolg && warKnien && warInHand && alpen.korbZustand.gesammelt.length === 1 && state.laraKorbInhalt && state.laraKorbInhalt.children.length === 1);

    var startPfl2 = alpen.startePfluecken(laraTestPos);
    for (var step2 = 0; step2 < 30; step2++) alpen.aktualisierePfluecken(0.05, laraTestPos);
    synchronisiereKorbInhalt3D();
    var zweiImKorbOk = Boolean(startPfl2.erfolg && alpen.korbZustand.gesammelt.length === 2 && state.laraKorbInhalt && state.laraKorbInhalt.children.length === 2 && state.standKorbInhalt && state.standKorbInhalt.children.length === 2);

    alpen.legeKorbAb();
    var abgelegtMitInhaltOk = Boolean(!alpen.korbZustand.aufgenommen && alpen.korbZustand.gesammelt.length === 2);
    alpen.nehmeKorbAuf();
    wendeLaraKorbPoseAn(0.016); var korbQ = new THREE.Quaternion(), korbUp = new THREE.Vector3(0, 1, 0); if (state.laraKorbPivot) { state.laraKorbPivot.getWorldQuaternion(korbQ); korbUp.applyQuaternion(korbQ); }
    var korbUndPflueckenOk = Boolean(ohneKorbAbgelehnt && nachErsterBlumeOk && zweiImKorbOk && abgelegtMitInhaltOk && korbUp.y > 0.99);

    var res = {
      hoeheOk: hoeheOk, strasseOk: strasseOk, baeumeFreiOk: baeumeFreiOk,
      massivKollisionOk: massivKollisionOk, tunnelOk: tunnelOk,
      uebergangEventOk: uebergangEventOk, korbUndPflueckenOk: korbUndPflueckenOk,
      gesammeltImKorb: alpen.korbZustand.gesammelt.length
    };
    console.log('VORLAND_TEST_RESULT:' + JSON.stringify(res));
    if (hoeheOk && strasseOk && baeumeFreiOk && massivKollisionOk && tunnelOk && uebergangEventOk && korbUndPflueckenOk) {
      console.log('VORLAND_TEST_OK');
    }
    var stEl = document.querySelector('[ki-steuerung]');
    if (stEl && stEl.components && stEl.components['ki-steuerung']) stEl.components['ki-steuerung'].setzeKamera(1);
    if (EEP.laraComp && typeof EEP.laraComp.teleportiereZu === 'function') {
      var laraShotPos = { x: -231.5, y: alpen.hoehe(-231.5, -93.8), z: -93.8 };
      EEP.laraComp.teleportiereZu(laraShotPos.x, laraShotPos.y, laraShotPos.z, 150);
      alpen.startePfluecken(laraShotPos);
    }
  }

  function wendeLaraKorbPoseAn(deltaSec) {
    var lc = EEP.laraComp, alpen = EEP.alpenvorland;
    if (!lc || !alpen || !lc.el || !lc.el.object3D) return;
    stelleLaraKorbUndHandSicher();
    var lPos = lc.el.object3D.position, pose = alpen.aktualisierePfluecken(deltaSec, lPos), kz = alpen.korbZustand;
    if (state.standKorbGroup) state.standKorbGroup.visible = !kz.aufgenommen;
    if (state.laraKorbPivot) { state.laraKorbPivot.visible = Boolean(kz.aufgenommen); state.laraKorbPivot.rotation.x = pose.korbAusgleichX; }
    if (state.handBlumeGroup) state.handBlumeGroup.visible = Boolean(kz.inRechterHand);
    synchronisiereKorbInhalt3D();

    if (kz.aufgenommen && lc.armL && lc.armL.shoulder && lc.armL.elbow) {
      lc.armL.shoulder.rotation.x = pose.armLinksSchulterX;
      lc.armL.shoulder.rotation.z = pose.armLinksSchulterZ;
      lc.armL.elbow.rotation.x = pose.armLinksEllbogenX;
    }
    if (pose.aktiv) {
      lc.el.object3D.rotation.y = kz.zielYaw;
      if (lc.simKoerper) lc.simKoerper.yaw = kz.zielYaw;
      if (lc.pelvisGroup) lc.pelvisGroup.position.y = pose.beckenY;
      if (lc.torsoGroup) { lc.torsoGroup.rotation.x = pose.rumpfNeigungX; lc.torsoGroup.rotation.y = pose.rumpfDrehungY; }
      if (lc.headGroup) { lc.headGroup.rotation.x = pose.kopfNeigungX; lc.headGroup.rotation.y = pose.kopfDrehungY; }
      if (lc.beinL && lc.beinL.hip && lc.beinL.knee && lc.beinL.ankle) {
        lc.beinL.hip.rotation.x = pose.huefteX_L; lc.beinL.knee.rotation.x = pose.knieX_L; lc.beinL.ankle.rotation.x = pose.knochelX_L;
      }
      if (lc.beinR && lc.beinR.hip && lc.beinR.knee && lc.beinR.ankle) {
        lc.beinR.hip.rotation.x = pose.huefteX_R; lc.beinR.knee.rotation.x = pose.knieX_R; lc.beinR.ankle.rotation.x = pose.knochelX_R;
      }
      if (lc.armR && lc.armR.shoulder && lc.armR.elbow && lc.armR.wrist) {
        lc.armR.shoulder.rotation.x = pose.armRechtsSchulterX;
        lc.armR.shoulder.rotation.z = pose.armRechtsSchulterZ;
        lc.armR.elbow.rotation.x = pose.armRechtsEllbogenX;
        lc.armR.wrist.rotation.x = pose.armRechtsHandX;
      }
    } else if (lc.armR && lc.armR.wrist) {
      lc.armR.wrist.rotation.x = 0;
    }
    if (state.laraKorbPivot && kz.aufgenommen && lc.el && lc.el.object3D && lc.armL && lc.armL.wrist) {
      lc.el.object3D.updateMatrixWorld(true);
      var qL = new THREE.Quaternion(), qW = new THREE.Quaternion();
      lc.el.object3D.getWorldQuaternion(qL); lc.armL.wrist.getWorldQuaternion(qW);
      state.laraKorbPivot.quaternion.copy(qW).invert().multiply(qL);
    }
  }

  EEP.alpenvorlandUI = {
    init: function () {
      if (state.initialisiert) return;
      var sceneEl = document.querySelector('a-scene'); if (!sceneEl) return;
      state.initialisiert = true;
      initialisiereAudio(); baueVorlandWelt(sceneEl); baueVorlandKorbHUD();
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        if (window.location.search.indexOf('vorlandtest=1') !== -1) setTimeout(starteVorlandSelbsttest, 500);
      }
    },

    tick: function (timeMs, deltaSec) {
      if (!state.initialisiert) this.init();
      var zeitSek = (timeMs || 0) * 0.001;
      for (var f = 0; f < state.fanRotoren.length; f++) state.fanRotoren[f].rotation.z = zeitSek * 9.0;
      var blink = (Math.floor(zeitSek * 2) % 2 === 0);
      for (var p = 0; p < state.portalLichter.length; p++) state.portalLichter[p].visible = blink;

      var ac = EEP.autoComp, autoPos = (ac && ac.el && ac.el.object3D) ? ac.el.object3D.position : null;
      var laraEl = document.querySelector('#lara-spieler'), laraPos = (laraEl && laraEl.object3D) ? laraEl.object3D.position : null;
      var rig = document.querySelector('#kamera-rig'), rigPos = (rig && rig.object3D) ? rig.object3D.position : null;
      var refPos = (EEP.aktiveKamera === 8 && autoPos) ? autoPos : ((EEP.aktiveKamera === 1 && laraPos) ? laraPos : (autoPos || rigPos));
      var cX = refPos ? refPos.x : -240, cZ = refPos ? refPos.z : -50;
      var dPortal = Math.sqrt((cX - (-240)) * (cX - (-240)) + (cZ - (-470)) * (cZ - (-470)));
      var imKorridor = (cZ <= -430 && cZ >= -815 && Math.abs(cX - (-240)) <= 35.0);
      if (state.tunnelGruppe) state.tunnelGruppe.visible = (dPortal <= 220.0 || imKorridor || EEP.aktiveKamera === 8);

      if (autoPos && EEP.alpenvorland) {
        EEP.alpenvorland.aktualisiere(deltaSec, autoPos, (ac.data && ac.data.name) || 'g-klasse');
        var imTunnel = (autoPos.z <= -470 && autoPos.z >= -790 && Math.abs(autoPos.x - (-240)) <= 6.0);
        aktualisiereTunnelAudio(imTunnel);
        if (state.pointLights.length >= 2) {
          if (imTunnel) {
            state.pointLights[0].intensity = 1.2; state.pointLights[0].position.set(autoPos.x, autoPos.y + 2.5, autoPos.z - 10);
            state.pointLights[1].intensity = 0.8; state.pointLights[1].position.set(autoPos.x, autoPos.y + 2.5, autoPos.z + 10);
          } else {
            state.pointLights[0].intensity = 0.0; state.pointLights[1].intensity = 0.0;
          }
        }
      }
      aktualisiereVorlandKorbHUD();
    }
  };

  function koppleAnSzene() {
    if (typeof AFRAME === 'undefined' || !AFRAME.components) return;
    var steuerDef = AFRAME.components['ki-steuerung'];
    if (steuerDef && steuerDef.Component && !steuerDef.Component.prototype._vorlandGekoppelt) {
      var proto = steuerDef.Component.prototype, origTick = proto.tick;
      proto._vorlandGekoppelt = true;
      proto.tick = function (time, dt) {
        if (origTick) origTick.call(this, time, dt);
        EEP.alpenvorlandUI.tick(time || 0, dt ? Math.min(dt / 1000, 0.08) : 0.016);
      };
    }
    var laraDef = AFRAME.components['ki-lara'];
    if (laraDef && laraDef.Component && !laraDef.Component.prototype._vorlandKorbGekoppelt) {
      var lProto = laraDef.Component.prototype, origLaraTick = lProto.tick;
      lProto._vorlandKorbGekoppelt = true;
      lProto.tick = function (time, dt) {
        if (origLaraTick) origLaraTick.call(this, time, dt);
        wendeLaraKorbPoseAn(dt ? Math.min(dt / 1000, 0.08) : 0.016);
      };
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    EEP.alpenvorlandUI.init(); koppleAnSzene();
  } else {
    document.addEventListener('DOMContentLoaded', function () { EEP.alpenvorlandUI.init(); koppleAnSzene(); });
  }
})();
