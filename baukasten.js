/* ============================================================================
 * BAUKASTEN.JS - Die 3D-Modelleisenbahn-Engine ("EEP-Vibe")
 * Enthält alle A-Frame Components: Gleise, Schwellen, Züge, Waggons, 
 * Gebäude, Licht/Wetter, Sound-Synthesizer und das interaktive Steuerpult.
 * ============================================================================ */

window.EEP = {
  gleise: {},      // Speichert alle THREE.CatmullRomCurve3 Strecken nach ID
  zuege: [],       // Liste aller aktiven Zugverbände für das Steuerpult
  kameras: {},     // Kamera-Referenzen
  aktiveKamera: 1, // 1 = Frei, 2 = Dampflok, 3 = ICE, 4 = Bahnhof
  wetterIndex: 0,  // 0 = Tag (Wald), 1 = Abendrot, 2 = Nacht, 3 = Schnee
  soundAktiv: true,
  audioCtx: null
};

// ============================================================================
// 1. SOUND-ENGINE (WebAudio Synthesizer - funktioniert sofort ohne externe MP3s)
// ============================================================================
window.EEP.initAudio = function () {
  if (!this.audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContext();
  }
  if (this.audioCtx.state === 'suspended') {
    this.audioCtx.resume();
  }
};

// Dampflok-Pfeife (Zweistimmiger Akkord mit leichtem Echo-Vibe)
window.EEP.dampfPfeife = function () {
  this.initAudio();
  const ctx = this.audioCtx;
  const now = ctx.currentTime;

  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = i === 0 ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(freq * 0.98, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.08);
    osc.frequency.setValueAtTime(freq, now + 0.9);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.92, now + 1.3);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(i === 0 ? 0.18 : 0.08, now + 0.08);
    gain.gain.setValueAtTime(i === 0 ? 0.18 : 0.08, now + 0.9);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.4);
  });
};

// ICE Makrofon (Zweiklang-Signalhorn: Hoch - Tief)
window.EEP.iceHorn = function () {
  this.initAudio();
  const ctx = this.audioCtx;
  const now = ctx.currentTime;

  const playTone = (freq, start, duration) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, start);

    // Filter für warmen Blechbläser/Makrofon-Klang
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, start);

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.15, start + 0.04);
    gain.gain.setValueAtTime(0.15, start + duration - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  };

  playTone(659.25, now, 0.45);        // E5
  playTone(554.37, now + 0.42, 0.65); // C#5
};

// Kurzer Dampfstoß ("Tschuff")
window.EEP.dampfTschuff = function (lautstaerke = 0.06) {
  if (!this.soundAktiv || !this.audioCtx || this.audioCtx.state !== 'running') return;
  const ctx = this.audioCtx;
  const now = ctx.currentTime;
  const bufferSize = ctx.sampleRate * 0.12;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(400, now);
  filter.Q.setValueAtTime(1.5, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(lautstaerke, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);
};

// ============================================================================
// 2. GLEIS- & SCHWELLEN-GENERATOR ('ki-gleis')
// Baut Schotterbett, 3D-Holzschwellen und glänzende Stahlschienen entlang einer Kurve
// ============================================================================
AFRAME.registerComponent('ki-gleis', {
  schema: {
    id: { type: 'string', default: 'ring1' },
    radiusX: { type: 'number', default: 25 },
    radiusZ: { type: 'number', default: 18 },
    punkte: { type: 'string', default: '' }, // Optional: "x1 y1 z1, x2 y2 z2, ..."
    schwellenAbstand: { type: 'number', default: 0.7 }
  },

  init: function () {
    const d = this.data;
    const pts = [];

    if (d.punkte.trim().length > 0) {
      // Eigene Wegpunkte parsen
      d.punkte.split(',').forEach(pStr => {
        const coords = pStr.trim().split(/\s+/).map(Number);
        if (coords.length >= 3) {
          pts.push(new THREE.Vector3(coords[0], coords[1], coords[2]));
        }
      });
    } else {
      // Oval mit sanften Kurven generieren (16 Kontrollpunkte)
      const segs = 24;
      for (let i = 0; i < segs; i++) {
        const angle = (i / segs) * Math.PI * 2;
        // Leichte organische Modellbahn-Form (Oval mit leichter Einschnürung)
        const rx = d.radiusX + Math.sin(angle * 2) * 1.5;
        const rz = d.radiusZ + Math.cos(angle * 2) * 1.0;
        pts.push(new THREE.Vector3(Math.cos(angle) * rx, 0.08, Math.sin(angle) * rz));
      }
    }

    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    const totalLength = curve.getLength();

    window.EEP.gleise[d.id] = {
      curve: curve,
      length: totalLength
    };

    const group = new THREE.Group();

    // 1. Schwellen als InstancedMesh (extrem schnell auf Nvidia GPUs!)
    const numSleepers = Math.floor(totalLength / d.schwellenAbstand);
    const sleeperGeo = new THREE.BoxGeometry(1.75, 0.1, 0.24);
    const sleeperMat = new THREE.MeshStandardMaterial({
      color: 0x3e2723,
      roughness: 0.9,
      metalness: 0.05
    });
    const sleeperInst = new THREE.InstancedMesh(sleeperGeo, sleeperMat, numSleepers);
    sleeperInst.receiveShadow = true;
    sleeperInst.castShadow = true;

    // Schotterbett-Segmente als InstancedMesh darunter
    const ballastGeo = new THREE.BoxGeometry(2.3, 0.08, d.schwellenAbstand * 1.15);
    const ballastMat = new THREE.MeshStandardMaterial({
      color: 0x5c5852,
      roughness: 0.95,
      metalness: 0.0
    });
    const ballastInst = new THREE.InstancedMesh(ballastGeo, ballastMat, numSleepers);
    ballastInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < numSleepers; i++) {
      const u = i / numSleepers;
      const pos = curve.getPointAt(u);
      const tangent = curve.getTangentAt(u).normalize();

      dummy.position.copy(pos);
      dummy.lookAt(pos.clone().add(tangent));
      dummy.updateMatrix();
      sleeperInst.setMatrixAt(i, dummy.matrix);

      dummy.position.y -= 0.05;
      dummy.updateMatrix();
      ballastInst.setMatrixAt(i, dummy.matrix);
    }
    group.add(ballastInst);
    group.add(sleeperInst);

    // 2. Linke und rechte Stahlschiene entlang der Kurve
    const railSamples = Math.max(120, Math.floor(totalLength * 2));
    const leftPts = [];
    const rightPts = [];
    const up = new THREE.Vector3(0, 1, 0);
    const spurweiteHalb = 0.55;

    for (let i = 0; i < railSamples; i++) {
      const u = i / railSamples;
      const pos = curve.getPointAt(u);
      const tangent = curve.getTangentAt(u).normalize();
      const side = new THREE.Vector3().crossVectors(up, tangent).normalize();

      leftPts.push(pos.clone().addScaledVector(side, spurweiteHalb).add(new THREE.Vector3(0, 0.09, 0)));
      rightPts.push(pos.clone().addScaledVector(side, -spurweiteHalb).add(new THREE.Vector3(0, 0.09, 0)));
    }

    const leftCurve = new THREE.CatmullRomCurve3(leftPts, true);
    const rightCurve = new THREE.CatmullRomCurve3(rightPts, true);

    const railMat = new THREE.MeshStandardMaterial({
      color: 0xb0b8c0,
      metalness: 0.85,
      roughness: 0.25
    });

    const leftRailGeo = new THREE.TubeGeometry(leftCurve, railSamples, 0.045, 6, true);
    const rightRailGeo = new THREE.TubeGeometry(rightCurve, railSamples, 0.045, 6, true);

    const leftRailMesh = new THREE.Mesh(leftRailGeo, railMat);
    const rightRailMesh = new THREE.Mesh(rightRailGeo, railMat);
    leftRailMesh.castShadow = true;
    rightRailMesh.castShadow = true;

    group.add(leftRailMesh);
    group.add(rightRailMesh);

    this.el.setObject3D('mesh', group);
  }
});

// ============================================================================
// 3. ZUG-VERBAND CONTROLLER ('ki-zug')
// Bewegt alle Kind-Elemente ('ki-waggon') mit korrektem Abstand auf dem Gleis
// ============================================================================
AFRAME.registerComponent('ki-zug', {
  schema: {
    name: { type: 'string', default: 'Zug' },
    gleis: { type: 'string', default: 'innen' },
    tempo: { type: 'number', default: 8 }, // Meter pro Sekunde (positiv oder negativ)
    startPos: { type: 'number', default: 0 } // Startposition in Metern
  },

  init: function () {
    this.distanz = this.data.startPos;
    this.aktuellesTempo = this.data.tempo;
    this.letzterTschuff = 0;
    window.EEP.zuege.push(this);

    // Falls das UI schon da ist, aktualisieren
    if (window.EEP.updateUI) window.EEP.updateUI();
  },

  tick: function (time, timeDelta) {
    const gleisObj = window.EEP.gleise[this.data.gleis];
    if (!gleisObj || !timeDelta) return;

    const dt = Math.min(timeDelta / 1000, 0.1);
    this.distanz += this.aktuellesTempo * dt;

    const totalLen = gleisObj.length;
    const curve = gleisObj.curve;

    // Dampflok-Tschuff-Sound im Takt der Fahrt
    const hatDampflok = this.el.querySelector('[ki-waggon*="dampflok"]');
    if (hatDampflok && Math.abs(this.aktuellesTempo) > 0.3) {
      const intervall = Math.max(110, 1200 / Math.abs(this.aktuellesTempo));
      if (time - this.letzterTschuff > intervall) {
        this.letzterTschuff = time;
        window.EEP.dampfTschuff(0.04);
      }
    }

    // Alle Waggons hintereinander auf der Kurve ausrichten
    let offset = 0;
    const waggonEls = this.el.querySelectorAll('[ki-waggon]');

    waggonEls.forEach((wEl, idx) => {
      const wComp = wEl.components['ki-waggon'];
      const wLen = wComp ? wComp.laenge : 4.2;

      if (idx > 0) {
        offset += (wLen * 0.5) + 0.35; // Halbe eigene Länge + Kupplungsabstand
      }

      // Drehgestell vorne und hinten auf der Kurve berechnen für echte Kurvenlage!
      const centerDist = ((this.distanz - offset) % totalLen + totalLen) % totalLen;
      const bogieHalf = wLen * 0.34;
      const frontDist = ((centerDist + bogieHalf) % totalLen + totalLen) % totalLen;
      const backDist = ((centerDist - bogieHalf) % totalLen + totalLen) % totalLen;

      const uFront = frontDist / totalLen;
      const uBack = backDist / totalLen;

      const pFront = curve.getPointAt(uFront);
      const pBack = curve.getPointAt(uBack);

      const midPos = new THREE.Vector3().addVectors(pFront, pBack).multiplyScalar(0.5);
      wEl.object3D.position.copy(midPos);

      // Ausrichtung von Hinterachse zu Vorderachse
      wEl.object3D.lookAt(pFront);

      // Für den nächsten Waggon die hintere Hälfte dazurechnen
      offset += (wLen * 0.5);

      // Räder & Rauch animieren
      if (wComp && wComp.animateWaggon) {
        wComp.animateWaggon(time, dt, this.aktuellesTempo);
      }
    });
  }
});

// ============================================================================
// 4. WAGGON- & LOK-BAUKASTEN ('ki-waggon')
// Baut detaillierte Loks & Waggons ODER lädt ein echtes .glb 3D-Modell!
// ============================================================================
AFRAME.registerComponent('ki-waggon', {
  schema: {
    typ: { type: 'string', default: 'dampflok' }, // dampflok, ludmilla, personenwagen, gueterwagen, ice-kopf, ice-wagen, ice-heck
    farbe: { type: 'color', default: '#2e6b34' },
    modell: { type: 'string', default: '' },       // Pfad zu .glb
    scale: { type: 'string', default: '1 1 1' }
  },

  init: function () {
    const d = this.data;
    this.raeder = [];
    this.rauchPartikel = [];
    this.laenge = 4.4;

    const root = new THREE.Group();
    this.el.setObject3D('waggonMesh', root);

    // 1. Wenn ein echtes 3D-Modell (.glb) angegeben wurde -> laden!
    if (d.modell && d.modell.trim() !== '') {
      const gltfEl = document.createElement('a-entity');
      gltfEl.setAttribute('gltf-model', d.modell);
      gltfEl.setAttribute('scale', d.scale);
      gltfEl.setAttribute('shadow', 'cast: true; receive: true');
      this.el.appendChild(gltfEl);

      // Licht & Kamera-Anker für Züge
      if (d.typ.includes('lok') || d.typ.includes('kopf') || d.typ.includes('diesel')) {
        const spotEl = document.createElement('a-entity');
        spotEl.setAttribute('light', 'type: spot; color: #fff8e1; intensity: 3; distance: 25; angle: 40; penumbra: 0.5');
        spotEl.setAttribute('position', '0 1.2 2.2');
        spotEl.setAttribute('rotation', '-6 180 0');
        this.el.appendChild(spotEl);

        const camAnchor = document.createElement('a-entity');
        camAnchor.classList.add(d.typ.includes('dampf') ? 'dampflok-cam-anchor' : 'ice-cam-anchor');
        camAnchor.setAttribute('position', '0 2.2 -0.5');
        camAnchor.setAttribute('rotation', '-4 180 0');
        this.el.appendChild(camAnchor);
      }
      return;
    }

    // 2. Original-getreue Prozedural-Modelle (inklusive DR BR 132 Ludmilla)
    if (d.typ === 'ludmilla') {
      this.laenge = 5.8;
      this.baueLudmilla(root);
    } else if (d.typ === 'dampflok') {
      this.laenge = 4.8;
      this.baueDampflok(root);
    } else if (d.typ === 'personenwagen') {
      this.laenge = 4.6;
      this.bauePersonenwagen(root, d.farbe);
    } else if (d.typ === 'gueterwagen') {
      this.laenge = 4.0;
      this.baueGueterwagen(root, d.farbe);
    } else if (d.typ === 'ice-kopf' || d.typ === 'ice-heck') {
      this.laenge = 5.4;
      this.baueIceTriebkopf(root, d.typ === 'ice-heck');
    } else if (d.typ === 'ice-wagen') {
      this.laenge = 5.0;
      this.baueIceWagen(root);
    }
  },

  // --- DIE LEGENDE: DR BR 132 "LUDMILLA" (Bw Chemnitz-Hilbersdorf) ---
  baueLudmilla: function (root) {
    const drRotMat = new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.35, metalness: 0.2 });
    const grauDachMat = new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.6, metalness: 0.4 });
    const rahmenMat = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.7, metalness: 0.5 });
    const zierMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const glasMat = new THREE.MeshStandardMaterial({ color: 0x111927, roughness: 0.1, metalness: 0.9 });
    const lichtMat = new THREE.MeshStandardMaterial({ color: 0xfff9c4, emissive: 0xffeb3b, emissiveIntensity: 2.5 });

    // Schwerer Rahmen & Pufferbohle
    const rahmen = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.45, 5.6), rahmenMat);
    rahmen.position.set(0, 0.5, 0);
    rahmen.castShadow = true;
    root.add(rahmen);

    // Kastenaufbau (Reichsbahn-Rot)
    const kasten = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.45, 5.3), drRotMat);
    kasten.position.set(0, 1.35, 0);
    kasten.castShadow = true;
    root.add(kasten);

    // Typischer breiter weißer DR-Zierstreifen
    const zierstreifen = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.22, 5.32), zierMat);
    zierstreifen.position.set(0, 1.05, 0);
    root.add(zierstreifen);

    // Schräges graues Dach mit Lüftergittern
    const dach = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 5.25, 16, 1, false, -Math.PI / 2, Math.PI), grauDachMat);
    dach.rotation.x = Math.PI / 2;
    dach.scale.set(1.0, 0.5, 1.0);
    dach.position.set(0, 2.05, 0);
    dach.castShadow = true;
    root.add(dach);

    // Führerstände an beiden Enden mit schrägen Fenstern
    [-2.65, 2.65].forEach((zPos, idx) => {
      const fenster = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.42, 0.15), glasMat);
      fenster.position.set(0, 1.6, zPos);
      root.add(fenster);

      // Dreilicht-Spitzensignal
      const isFront = zPos > 0;
      [-0.45, 0.45].forEach(xPos => {
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), isFront ? lichtMat : new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 2 }));
        led.position.set(xPos, 0.82, zPos + (isFront ? 0.08 : -0.08));
        root.add(led);
      });
      // Oberes Spitzenlicht
      const topLed = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), isFront ? lichtMat : new THREE.MeshStandardMaterial({ color: 0x222222 }));
      topLed.position.set(0, 1.95, zPos + (isFront ? 0.06 : -0.06));
      root.add(topLed);
    });

    // 6-achsige schwere Drehgestelle (Co'Co')
    this.baueStandardAchsen(root, [-2.2, -1.5, -0.8, 0.8, 1.5, 2.2]);

    // Scheinwerfer-Lichtkegel
    const spotEl = document.createElement('a-entity');
    spotEl.setAttribute('light', 'type: spot; color: #ffe082; intensity: 3.2; distance: 28; angle: 36; penumbra: 0.5');
    spotEl.setAttribute('position', '0 1.2 2.8');
    spotEl.setAttribute('rotation', '-6 180 0');
    this.el.appendChild(spotEl);

    // Führerstands-Kamera-Anker: sitzt direkt im vorderen Führerstand mit Blick nach vorne (+Z)
    const camAnchor = document.createElement('a-entity');
    camAnchor.classList.add('ludmilla-cam-anchor');
    camAnchor.setAttribute('position', '0 2.25 2.1');
    camAnchor.setAttribute('rotation', '-2 180 0');
    this.el.appendChild(camAnchor);
  },

  // --- DAMPFLOK (BR 80 / klassische schwarz-rote Tenderlok mit Rauch & Spitzenlicht) ---
  baueDampflok: function (root) {
    const schwarzMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 });
    const rotMat = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.5, metalness: 0.3 });
    const messingMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.2, metalness: 0.9 });
    const lichtMat = new THREE.MeshStandardMaterial({ color: 0xfff8e1, emissive: 0xffd54f, emissiveIntensity: 2.5 });

    // Rotes Fahrwerk (Rahmen)
    const rahmen = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 4.4), rotMat);
    rahmen.position.set(0, 0.45, 0);
    rahmen.castShadow = true;
    root.add(rahmen);

    // Schwarzer Kessel
    const kessel = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 2.8, 20), schwarzMat);
    kessel.rotation.x = Math.PI / 2;
    kessel.position.set(0, 1.15, 0.55);
    kessel.castShadow = true;
    root.add(kessel);

    // Goldene Kesselringe
    [-0.2, 0.6, 1.4].forEach(zPos => {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.595, 0.595, 0.05, 20), messingMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 1.15, zPos);
      root.add(ring);
    });

    // Dampfdom
    const dom = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), schwarzMat);
    dom.position.set(0, 1.72, 0.5);
    root.add(dom);

    // Schornstein (Esse) vorne
    const schlot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.65, 16), schwarzMat);
    schlot.position.set(0, 1.85, 1.55);
    schlot.castShadow = true;
    root.add(schlot);

    // Führerhaus hinten
    const kabine = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.35, 1.35), schwarzMat);
    kabine.position.set(0, 1.3, -1.25);
    kabine.castShadow = true;
    root.add(kabine);

    // Dach Führerhaus
    const dach = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.1, 1.55), schwarzMat);
    dach.position.set(0, 2.0, -1.25);
    root.add(dach);

    // Fenster im Führerhaus (leicht leuchtend für warme Atmosphäre)
    const fensterMat = new THREE.MeshStandardMaterial({ color: 0xffecb3, emissive: 0xffb300, emissiveIntensity: 0.7 });
    const fensterSeiten = new THREE.Mesh(new THREE.BoxGeometry(1.47, 0.45, 0.65), fensterMat);
    fensterSeiten.position.set(0, 1.5, -1.2);
    root.add(fensterSeiten);

    // 3 Rote Speichenräder pro Seite + silberne Treibstange
    const stangeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.2 });
    [-1.2, 0, 1.2].forEach(zPos => {
      [-0.65, 0.65].forEach(xPos => {
        const radGruppe = new THREE.Group();
        radGruppe.position.set(xPos, 0.36, zPos);
        const rad = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 16), rotMat);
        rad.rotation.z = Math.PI / 2;
        radGruppe.add(rad);
        // Kurbelzapfen zur Sichtbarkeit der Drehung
        const zapfen = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.12), stangeMat);
        zapfen.position.set(xPos > 0 ? 0.05 : -0.05, 0.18, 0);
        radGruppe.add(zapfen);
        root.add(radGruppe);
        this.raeder.push(radGruppe);
      });
    });

    // Spitzenlichter (Dreilicht-Spitzensignal vorne)
    const lampPositions = [[-0.48, 0.7, 2.22], [0.48, 0.7, 2.22], [0, 1.65, 1.98]];
    lampPositions.forEach(lp => {
      const lampe = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), lichtMat);
      lampe.position.set(lp[0], lp[1], lp[2]);
      root.add(lampe);
    });

    // Echter Scheinwerfer-Lichtkegel nach vorne (+Z)
    const spotEl = document.createElement('a-entity');
    spotEl.setAttribute('light', 'type: spot; color: #ffe082; intensity: 2.5; distance: 22; angle: 38; penumbra: 0.4');
    spotEl.setAttribute('position', '0 1.2 2.2');
    spotEl.setAttribute('rotation', '-8 180 0');
    this.el.appendChild(spotEl);

    // Führerstands-Kamera-Anker (für Taste [2]) - Blick über den Kessel nach vorne (+Z = rotation 0 180 0 in A-Frame, da A-Frame Kamera nach -Z schaut!)
    const camAnchor = document.createElement('a-entity');
    camAnchor.classList.add('dampflok-cam-anchor');
    camAnchor.setAttribute('position', '0 2.35 -0.8');
    camAnchor.setAttribute('rotation', '-4 180 0');
    this.el.appendChild(camAnchor);

    // 3D-Rauchwolken-Pool aus dem Schornstein
    const rauchMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      transparent: true,
      opacity: 0.75,
      roughness: 1.0
    });
    for (let i = 0; i < 14; i++) {
      const wolke = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), rauchMat.clone());
      wolke.position.set(0, 2.2, 1.55);
      root.add(wolke);
      this.rauchPartikel.push({
        mesh: wolke,
        age: (i / 14) * 1.5,
        driftX: (Math.random() - 0.5) * 0.4
      });
    }
  },

  // --- KLASSISCHER DONNERBÜCHSEN-PERSONENWAGEN (Grün mit beleuchteten Fenstern) ---
  bauePersonenwagen: function (root, farbe) {
    const wagenMat = new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.45, metalness: 0.2 });
    const dachMat = new THREE.MeshStandardMaterial({ color: 0x424242, roughness: 0.7 });
    const rahmenMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    const fensterMat = new THREE.MeshStandardMaterial({
      color: 0xfff3e0,
      emissive: 0xffca28,
      emissiveIntensity: 0.9,
      roughness: 0.1
    });

    // Schwarzes Untergestell
    const unterbau = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.25, 4.3), rahmenMat);
    unterbau.position.set(0, 0.4, 0);
    root.add(unterbau);

    // Grüner Wagenkasten
    const kasten = new THREE.Mesh(new THREE.BoxGeometry(1.42, 1.15, 4.1), wagenMat);
    kasten.position.set(0, 1.1, 0);
    kasten.castShadow = true;
    root.add(kasten);

    // Gewölbtes Dach
    const dach = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 4.25, 16, 1, false, -Math.PI / 2, Math.PI), dachMat);
    dach.rotation.x = Math.PI / 2;
    dach.scale.set(1, 1, 0.42);
    dach.position.set(0, 1.65, 0);
    dach.castShadow = true;
    root.add(dach);

    // 4 Fenster pro Seite
    [-1.35, -0.45, 0.45, 1.35].forEach(zPos => {
      const fenster = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.42, 0.58), fensterMat);
      fenster.position.set(0, 1.22, zPos);
      root.add(fenster);
    });

    // Räder
    this.baueStandardAchsen(root, [-1.4, 1.4]);
  },

  // --- GÜTERWAGEN (Brauner/Roter offener oder gedeckter Güterwagen) ---
  baueGueterwagen: function (root, farbe) {
    const holzMat = new THREE.MeshStandardMaterial({ color: farbe || 0x795548, roughness: 0.85 });
    const rahmenMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });

    const unterbau = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.25, 3.7), rahmenMat);
    unterbau.position.set(0, 0.4, 0);
    root.add(unterbau);

    const kasten = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 3.6), holzMat);
    kasten.position.set(0, 1.0, 0);
    kasten.castShadow = true;
    root.add(kasten);

    // Ladung (Holzstämme)
    const stammMat = new THREE.MeshStandardMaterial({ color: 0xbcaaa4, roughness: 0.9 });
    [-0.35, 0, 0.35].forEach(xPos => {
      const stamm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.3, 10), stammMat);
      stamm.rotation.x = Math.PI / 2;
      stamm.position.set(xPos, 1.55, 0);
      root.add(stamm);
    });

    this.baueStandardAchsen(root, [-1.2, 1.2]);
  },

  // --- ICE TRIEBKOPF (Aerodynamisch weiß mit verkehrsrotem DB-Streifen) ---
  baueIceTriebkopf: function (root, istHeck) {
    const grp = new THREE.Group();
    if (istHeck) grp.rotation.y = Math.PI; // Heck schaut nach hinten
    root.add(grp);

    const weissMat = new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.2, metalness: 0.15 });
    const rotMat = new THREE.MeshStandardMaterial({ color: 0xe30613, roughness: 0.3, metalness: 0.1 });
    const glasMat = new THREE.MeshStandardMaterial({ color: 0x111927, roughness: 0.1, metalness: 0.8 });
    const lichtMat = new THREE.MeshStandardMaterial({
      color: istHeck ? 0xff1744 : 0xffffff,
      emissive: istHeck ? 0xff1744 : 0xe0f7fa,
      emissiveIntensity: 2.5
    });

    // Hauptkörper hinten
    const rumpf = new THREE.Mesh(new THREE.BoxGeometry(1.46, 1.32, 3.5), weissMat);
    rumpf.position.set(0, 1.08, -0.75);
    rumpf.castShadow = true;
    grp.add(rumpf);

    // Aerodynamische Nase vorne
    const nase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.72, 2.0, 20), weissMat);
    nase.rotation.x = Math.PI / 2;
    nase.scale.set(1.0, 0.88, 1);
    nase.position.set(0, 0.88, 1.85);
    nase.castShadow = true;
    grp.add(nase);

    // Cockpit-Frontscheibe
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.45, 1.1), glasMat);
    cockpit.rotation.x = 0.48;
    cockpit.position.set(0, 1.35, 1.25);
    grp.add(cockpit);

    // Verkehrsroter Streifen rundum
    const streifen = new THREE.Mesh(new THREE.BoxGeometry(1.49, 0.18, 3.55), rotMat);
    streifen.position.set(0, 0.82, -0.75);
    grp.add(streifen);

    const streifenNase = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.14, 1.5), rotMat);
    streifenNase.position.set(0, 0.72, 1.6);
    grp.add(streifenNase);

    // Schwarzes Fensterband an den Seiten
    const fensterBand = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.36, 2.6), glasMat);
    fensterBand.position.set(0, 1.25, -0.9);
    grp.add(fensterBand);

    // LED-Scheinwerfer (oder rote Rücklichter am Heck)
    [-0.38, 0.38].forEach(xPos => {
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), lichtMat);
      led.position.set(xPos, 0.75, 2.55);
      grp.add(led);
    });

    if (!istHeck) {
      // Kamera-Anker für Taste [3] (ICE-Mitfahrt)
      const camAnchor = document.createElement('a-entity');
      camAnchor.classList.add('ice-cam-anchor');
      camAnchor.setAttribute('position', '0 2.15 0.8');
      camAnchor.setAttribute('rotation', '-4 180 0');
      this.el.appendChild(camAnchor);

      const spotEl = document.createElement('a-entity');
      spotEl.setAttribute('light', 'type: spot; color: #e0f7fa; intensity: 2.8; distance: 25; angle: 35; penumbra: 0.5');
      spotEl.setAttribute('position', '0 1.0 2.6');
      spotEl.setAttribute('rotation', '-6 180 0');
      this.el.appendChild(spotEl);
    }

    this.baueStandardAchsen(root, [-1.6, 1.2]);
  },

  // --- ICE MITTELWAGEN (Mit Bordbistro-Fensterband und rotem Streifen) ---
  baueIceWagen: function (root) {
    const weissMat = new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.2, metalness: 0.15 });
    const rotMat = new THREE.MeshStandardMaterial({ color: 0xe30613, roughness: 0.3 });
    const fensterMat = new THREE.MeshStandardMaterial({
      color: 0x263238,
      emissive: 0xb3e5fc,
      emissiveIntensity: 0.45,
      roughness: 0.1
    });

    const rumpf = new THREE.Mesh(new THREE.BoxGeometry(1.46, 1.32, 4.75), weissMat);
    rumpf.position.set(0, 1.08, 0);
    rumpf.castShadow = true;
    root.add(rumpf);

    const streifen = new THREE.Mesh(new THREE.BoxGeometry(1.49, 0.18, 4.76), rotMat);
    streifen.position.set(0, 0.82, 0);
    root.add(streifen);

    const fensterBand = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.36, 4.2), fensterMat);
    fensterBand.position.set(0, 1.25, 0);
    root.add(fensterBand);

    this.baueStandardAchsen(root, [-1.6, 1.6]);
  },

  baueStandardAchsen: function (root, zPositionen) {
    const radMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.4 });
    zPositionen.forEach(zPos => {
      [-0.6, 0.6].forEach(xPos => {
        const rad = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12), radMat);
        rad.rotation.z = Math.PI / 2;
        rad.position.set(xPos, 0.28, zPos);
        root.add(rad);
        this.raeder.push(rad);
      });
    });
  },

  animateWaggon: function (time, dt, tempo) {
    // Räder drehen
    const winkel = (tempo * dt) / 0.32;
    this.raeder.forEach(r => {
      r.rotation.x += winkel;
    });

    // Dampflok-Rauch aufsteigen & verblassen lassen
    if (this.rauchPartikel.length > 0) {
      const speedFactor = Math.max(0.3, Math.abs(tempo) * 0.15);
      this.rauchPartikel.forEach(p => {
        p.age += dt * (0.9 + speedFactor);
        if (p.age > 1.5) {
          p.age = 0;
        }
        const progress = p.age / 1.5;
        p.mesh.position.y = 2.15 + progress * 2.4;
        p.mesh.position.z = 1.55 - progress * (0.6 + Math.abs(tempo) * 0.15);
        p.mesh.position.x = Math.sin(time * 0.003 + p.driftX * 10) * 0.18 * progress;
        const scale = 0.7 + progress * 2.5;
        p.mesh.scale.set(scale, scale, scale);
        p.mesh.material.opacity = (1 - progress) * 0.7;
      });
    }
  }
});

// ============================================================================
// 5. BAHNHOF "LICHTENAU HBF" ('ki-bahnhof')
// Mit Bahnsteig, Fachwerk-/Klinker-Hauptgebäude, Uhr, Schild & Bahnsteiglaternen
// ============================================================================
AFRAME.registerComponent('ki-bahnhof', {
  schema: {
    name: { type: 'string', default: 'Lichtenau Hbf' }
  },

  init: function () {
    const el = this.el;
    const d = this.data;

    // 1. Langer gepflasterter Bahnsteig
    const bahnsteig = document.createElement('a-box');
    bahnsteig.setAttribute('width', '14');
    bahnsteig.setAttribute('height', '0.45');
    bahnsteig.setAttribute('depth', '4.2');
    bahnsteig.setAttribute('position', '0 0.22 0');
    bahnsteig.setAttribute('material', 'color: #787572; roughness: 0.9');
    bahnsteig.setAttribute('shadow', 'receive: true; cast: true');
    el.appendChild(bahnsteig);

    // Weiße Sicherheitslinie an der Bahnsteigkante
    const linie = document.createElement('a-box');
    linie.setAttribute('width', '13.8');
    linie.setAttribute('height', '0.46');
    linie.setAttribute('depth', '0.15');
    linie.setAttribute('position', '0 0.225 1.85');
    linie.setAttribute('material', 'color: #eeeeee');
    el.appendChild(linie);

    // 2. Bahnhofsgebäude (Warmes Ocker/Klinker mit rotem Ziegeldach)
    const hauptHaus = document.createElement('a-box');
    hauptHaus.setAttribute('width', '7.5');
    hauptHaus.setAttribute('height', '3.6');
    hauptHaus.setAttribute('depth', '2.8');
    hauptHaus.setAttribute('position', '0 2.0 -0.4');
    hauptHaus.setAttribute('material', 'color: #f3e5ab; roughness: 0.8');
    hauptHaus.setAttribute('shadow', 'cast: true; receive: true');
    el.appendChild(hauptHaus);

    // Rotes Satteldach
    const dach = document.createElement('a-cone');
    dach.setAttribute('segments-radial', '4');
    dach.setAttribute('radius-bottom', '4.6');
    dach.setAttribute('radius-top', '0.1');
    dach.setAttribute('height', '2.2');
    dach.setAttribute('rotation', '0 45 0');
    dach.setAttribute('scale', '1.35 1 0.65');
    dach.setAttribute('position', '0 4.85 -0.4');
    dach.setAttribute('material', 'color: #b71c1c; roughness: 0.7');
    dach.setAttribute('shadow', 'cast: true');
    el.appendChild(dach);

    // Bahnsteig-Vordach zum Gleis hin
    const vordach = document.createElement('a-box');
    vordach.setAttribute('width', '9.5');
    vordach.setAttribute('height', '0.12');
    vordach.setAttribute('depth', '2.2');
    vordach.setAttribute('position', '0 2.85 1.2');
    vordach.setAttribute('rotation', '6 0 0');
    vordach.setAttribute('material', 'color: #37474f; metalness: 0.5');
    vordach.setAttribute('shadow', 'cast: true');
    el.appendChild(vordach);

    // Beleuchtete Bahnhofsfenster
    [-2.4, -1.0, 1.0, 2.4].forEach(xPos => {
      [1.3, 2.7].forEach(yPos => {
        const fenster = document.createElement('a-box');
        fenster.setAttribute('width', '0.75');
        fenster.setAttribute('height', '0.85');
        fenster.setAttribute('depth', '2.86');
        fenster.setAttribute('position', `${xPos} ${yPos} -0.4`);
        fenster.setAttribute('material', 'color: #fff8e1; emissive: #ffb300; emissiveIntensity: 0.85');
        el.appendChild(fenster);
      });
    });

    // 3. Klassisches blau-weißes Bahnhofsschild "Lichtenau Hbf"
    const schildBg = document.createElement('a-box');
    schildBg.setAttribute('width', '3.8');
    schildBg.setAttribute('height', '0.65');
    schildBg.setAttribute('depth', '0.12');
    schildBg.setAttribute('position', '0 3.25 2.25');
    schildBg.setAttribute('material', 'color: #0d47a1; roughness: 0.3');
    el.appendChild(schildBg);

    const schildText = document.createElement('a-text');
    schildText.setAttribute('value', d.name);
    schildText.setAttribute('align', 'center');
    schildText.setAttribute('color', '#ffffff');
    schildText.setAttribute('width', '7.5');
    schildText.setAttribute('position', '0 3.25 2.33');
    el.appendChild(schildText);

    // 4. Zwei Bahnsteiglaternen (links und rechts auf dem Bahnsteig)
    [-5.2, 5.2].forEach(xPos => {
      const mast = document.createElement('a-cylinder');
      mast.setAttribute('radius', '0.08');
      mast.setAttribute('height', '3.4');
      mast.setAttribute('position', `${xPos} 1.9 1.2`);
      mast.setAttribute('material', 'color: #263238; metalness: 0.7');
      mast.setAttribute('shadow', 'cast: true');
      el.appendChild(mast);

      const kugel = document.createElement('a-sphere');
      kugel.setAttribute('radius', '0.26');
      kugel.setAttribute('position', `${xPos} 3.65 1.2`);
      kugel.setAttribute('material', 'color: #fffde7; emissive: #ffd54f; emissiveIntensity: 2.0');
      el.appendChild(kugel);

      const licht = document.createElement('a-entity');
      licht.setAttribute('light', 'type: point; color: #ffe082; intensity: 1.4; distance: 14; decay: 2');
      licht.setAttribute('position', `${xPos} 3.5 1.2`);
      el.appendChild(licht);
    });

    // Bahnhofskamera-Anker (für Taste [4])
    const camAnchor = document.createElement('a-entity');
    camAnchor.classList.add('bahnhof-cam-anchor');
    camAnchor.setAttribute('position', '-4.2 1.85 1.4');
    camAnchor.setAttribute('rotation', '-4 -45 0');
    el.appendChild(camAnchor);
  }
});

// ============================================================================
// 6. EXTRA BAUKASTEN-OBJEKTE FÜR KINDERLEICHTES ERWEITERN ('ki-signal', 'ki-haus', 'ki-tunnel')
// ============================================================================
AFRAME.registerComponent('ki-signal', {
  schema: {
    stellung: { type: 'string', default: 'gruen' } // gruen oder rot
  },
  init: function () {
    const el = this.el;
    const mast = document.createElement('a-cylinder');
    mast.setAttribute('radius', '0.06');
    mast.setAttribute('height', '3.6');
    mast.setAttribute('position', '0 1.8 0');
    mast.setAttribute('material', 'color: #455a64; metalness: 0.6');
    el.appendChild(mast);

    const schirm = document.createElement('a-box');
    schirm.setAttribute('width', '0.45');
    schirm.setAttribute('height', '0.9');
    schirm.setAttribute('depth', '0.1');
    schirm.setAttribute('position', '0 3.4 0');
    schirm.setAttribute('material', 'color: #111111');
    el.appendChild(schirm);

    const istGruen = this.data.stellung === 'gruen';
    const lampe = document.createElement('a-sphere');
    lampe.setAttribute('radius', '0.13');
    lampe.setAttribute('position', `0 ${istGruen ? 3.58 : 3.22} 0.08`);
    lampe.setAttribute('material', `color: ${istGruen ? '#00e676' : '#ff1744'}; emissive: ${istGruen ? '#00e676' : '#ff1744'}; emissiveIntensity: 2.5`);
    el.appendChild(lampe);
    this.lampeEl = lampe;
  }
});

AFRAME.registerComponent('ki-haus', {
  schema: {
    farbe: { type: 'color', default: '#f5f5f5' },
    dachFarbe: { type: 'color', default: '#c62828' },
    etagen: { type: 'number', default: 1 }
  },
  init: function () {
    const el = this.el;
    const h = 2.4 * this.data.etagen;

    const wand = document.createElement('a-box');
    wand.setAttribute('width', '3.6');
    wand.setAttribute('height', h);
    wand.setAttribute('depth', '3.2');
    wand.setAttribute('position', `0 ${h / 2} 0`);
    wand.setAttribute('material', `color: ${this.data.farbe}; roughness: 0.85`);
    wand.setAttribute('shadow', 'cast: true; receive: true');
    el.appendChild(wand);

    const dach = document.createElement('a-cone');
    dach.setAttribute('segments-radial', '4');
    dach.setAttribute('radius-bottom', '2.8');
    dach.setAttribute('radius-top', '0.05');
    dach.setAttribute('height', '1.8');
    dach.setAttribute('rotation', '0 45 0');
    dach.setAttribute('position', `0 ${h + 0.9} 0`);
    dach.setAttribute('material', `color: ${this.data.dachFarbe}; roughness: 0.7`);
    dach.setAttribute('shadow', 'cast: true');
    el.appendChild(dach);

    // Leuchtende Fenster
    const fenster = document.createElement('a-box');
    fenster.setAttribute('width', '3.66');
    fenster.setAttribute('height', '0.7');
    fenster.setAttribute('depth', '1.4');
    fenster.setAttribute('position', `0 ${h * 0.55} 0`);
    fenster.setAttribute('material', 'color: #fff8e1; emissive: #ffb300; emissiveIntensity: 0.8');
    el.appendChild(fenster);
  }
});

// ============================================================================
// 7. STEUERUNG, KAMERAS, WETTER & KINDER-STEUERPULT ('ki-steuerung')
// ============================================================================
AFRAME.registerComponent('ki-steuerung', {
  init: function () {
    this.kameraRig = document.querySelector('#kamera-rig');
    this.hauptKamera = document.querySelector('#haupt-kamera');
    this.umwelt = document.querySelector('#umwelt');

    // Tastatur-Steuerung ([1], [2], [3], [4], [L], [H])
    window.addEventListener('keydown', (e) => {
      if (e.key === '1') this.setzeKamera(1);
      if (e.key === '2') this.setzeKamera(2);
      if (e.key === '3') this.setzeKamera(3);
      if (e.key === '4') this.setzeKamera(4);
      if (e.key.toLowerCase() === 'l') this.wechselWetter();
      if (e.key.toLowerCase() === 'h' || e.key === ' ') {
        window.EEP.dampfPfeife();
      }
    });

    this.baueSteuerpultUI();
    window.EEP.updateUI = () => this.aktualisiereZugRegler();
    setTimeout(() => this.aktualisiereZugRegler(), 300);
  },

  setzeKamera: function (modus) {
    window.EEP.aktiveKamera = modus;
    document.querySelectorAll('.eep-cam-btn').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.cam) === modus);
    });

    if (modus === 1) {
      // Fußgänger-Modus: 1.65 m Augenhöhe auf dem Bahnsteig
      if (this.hauptKamera) {
        this.hauptKamera.setAttribute('wasd-controls', 'enabled: true; acceleration: 25; fly: false');
      }
      this.kameraRig.object3D.position.set(0, 1.65, 9.5);
      this.kameraRig.object3D.rotation.set(0, 0, 0);
    } else {
      // Zug-/Bahnhofs-Kamera: WASD deaktivieren, damit man nicht aus dem Führerstand wegläuft!
      if (this.hauptKamera) {
        this.hauptKamera.setAttribute('wasd-controls', 'enabled: false');
      }
    }
  },

  wechselWetter: function (zielIndex) {
    const presets = [
      {
        name: '☀️ Tag (Wald)',
        env: 'preset: forest; dressingAmount: 200; hills: true; shadow: true; lightPosition: 1 2.5 1; fog: 0.65',
        ambient: 0.75
      },
      {
        name: '🌅 Abendrot',
        env: 'preset: forest; dressingAmount: 200; hills: true; shadow: true; skyColor: #ff7043; horizonColor: #ffcc80; lightPosition: -2 0.35 -1; groundColor: #334d2b; fog: 0.7',
        ambient: 0.45
      },
      {
        name: '🌙 Nacht',
        env: 'preset: starry; dressingAmount: 180; hills: true; shadow: true; groundColor: #0d1b12; fog: 0.8',
        ambient: 0.15
      },
      {
        name: '🌌 Neon-Nacht',
        env: 'preset: tron; dressingAmount: 120; hills: true; shadow: true; fog: 0.75',
        ambient: 0.35
      },
      {
        name: '❄️ Schnee & Winter',
        env: 'preset: forest; dressingAmount: 200; hills: true; shadow: true; groundColor: #f0f4f8; groundColor2: #dce6f2; dressingColor: #e8f0f8; skyColor: #b0bec5; horizonColor: #eceff1; fog: 0.75',
        ambient: 0.85
      }
    ];

    if (typeof zielIndex === 'number') {
      window.EEP.wetterIndex = zielIndex;
    } else {
      window.EEP.wetterIndex = (window.EEP.wetterIndex + 1) % presets.length;
    }

    const p = presets[window.EEP.wetterIndex];
    if (this.umwelt) {
      this.umwelt.setAttribute('environment', p.env);
    }

    const wetterBtn = document.getElementById('eep-wetter-btn');
    if (wetterBtn) {
      wetterBtn.textContent = `${p.name} [L]`;
    }
  },

  tick: function () {
    const modus = window.EEP.aktiveKamera;
    if (modus === 1) return; // Freie Kamera

    let targetSelector = null;
    if (modus === 2) targetSelector = '.ludmilla-cam-anchor, .dampflok-cam-anchor';
    if (modus === 3) targetSelector = '.ice-cam-anchor';
    if (modus === 4) targetSelector = '.bahnhof-cam-anchor';

    const anchor = targetSelector ? document.querySelector(targetSelector) : null;
    if (anchor && this.kameraRig) {
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      anchor.object3D.getWorldPosition(worldPos);
      anchor.object3D.getWorldQuaternion(worldQuat);

      this.kameraRig.object3D.position.copy(worldPos);
      this.kameraRig.object3D.quaternion.copy(worldQuat);
    }
  },

  baueSteuerpultUI: function () {
    const style = document.createElement('style');
    style.textContent = `
      #eep-cockpit {
        position: fixed;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        background: rgba(18, 24, 34, 0.88);
        backdrop-filter: blur(10px);
        border: 2px solid rgba(255, 255, 255, 0.18);
        border-radius: 16px;
        padding: 12px 18px;
        color: #fff;
        font-family: 'Segoe UI', system-ui, sans-serif;
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        align-items: center;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        max-width: 96vw;
      }
      .eep-section {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .eep-title {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #90caf9;
        font-weight: 700;
      }
      .eep-btn-row {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .eep-btn {
        background: #263238;
        color: #fff;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 8px;
        padding: 7px 11px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .eep-btn:hover {
        background: #37474f;
        transform: translateY(-1px);
      }
      .eep-btn.active {
        background: #1e88e5;
        border-color: #64b5f6;
        box-shadow: 0 0 12px rgba(30, 136, 229, 0.6);
      }
      .eep-btn.sound-btn {
        background: #d84315;
        border-color: #ff8a65;
      }
      .eep-btn.sound-btn:hover {
        background: #f4511e;
      }
      .eep-train-ctrl {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(255,255,255,0.06);
        padding: 5px 10px;
        border-radius: 8px;
      }
      .eep-train-ctrl label {
        font-size: 13px;
        font-weight: 600;
        min-width: 90px;
      }
      .eep-train-ctrl input[type=range] {
        width: 110px;
        accent-color: #4caf50;
        cursor: pointer;
      }
      .eep-speed-val {
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        min-width: 44px;
        text-align: right;
        color: #a5d6a7;
      }
    `;
    document.head.appendChild(style);

    const ui = document.createElement('div');
    ui.id = 'eep-cockpit';
    ui.innerHTML = `
      <div class="eep-section">
        <div class="eep-title">🎥 Kamera-Ansicht</div>
        <div class="eep-btn-row">
          <button class="eep-btn eep-cam-btn active" data-cam="1">🚶 Zu Fuß [1]</button>
          <button class="eep-btn eep-cam-btn" data-cam="2">🚂 Lok-Führerstand [2]</button>
          <button class="eep-btn eep-cam-btn" data-cam="3">🚄 Express-Blick [3]</button>
          <button class="eep-btn eep-cam-btn" data-cam="4">🚉 Bahnsteig [4]</button>
        </div>
      </div>

      <div class="eep-section">
        <div class="eep-title">🎛️ Fahrregler (Zug-Tempo)</div>
        <div id="eep-zug-liste" class="eep-btn-row"></div>
      </div>

      <div class="eep-section">
        <div class="eep-title">🔊 Sound & Wetter</div>
        <div class="eep-btn-row">
          <button class="eep-btn sound-btn" id="eep-pfeife-btn">🚂 Pfeife [H]</button>
          <button class="eep-btn sound-btn" id="eep-horn-btn">🚄 ICE-Horn</button>
          <button class="eep-btn" id="eep-wetter-btn">☀️ Tag (Wald) [L]</button>
        </div>
      </div>
    `;
    document.body.appendChild(ui);

    // Event-Listener für Kamera-Buttons
    ui.querySelectorAll('.eep-cam-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setzeKamera(Number(btn.dataset.cam)));
    });

    document.getElementById('eep-pfeife-btn').addEventListener('click', () => window.EEP.dampfPfeife());
    document.getElementById('eep-horn-btn').addEventListener('click', () => window.EEP.iceHorn());
    document.getElementById('eep-wetter-btn').addEventListener('click', () => this.wechselWetter());
  },

  aktualisiereZugRegler: function () {
    const container = document.getElementById('eep-zug-liste');
    if (!container) return;
    container.innerHTML = '';

    window.EEP.zuege.forEach((zugComp, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'eep-train-ctrl';

      const name = zugComp.data.name || `Zug ${i + 1}`;
      const startSpeed = zugComp.aktuellesTempo;

      wrap.innerHTML = `
        <label>${name}</label>
        <input type="range" min="-20" max="25" step="0.5" value="${startSpeed}">
        <span class="eep-speed-val">${startSpeed.toFixed(1)}</span>
        <button class="eep-btn" style="padding:3px 7px; font-size:11px;" title="Notbremse / Stopp">⏹</button>
      `;

      const slider = wrap.querySelector('input');
      const valSpan = wrap.querySelector('.eep-speed-val');
      const stopBtn = wrap.querySelector('button');

      slider.addEventListener('input', () => {
        window.EEP.initAudio();
        zugComp.aktuellesTempo = parseFloat(slider.value);
        valSpan.textContent = zugComp.aktuellesTempo.toFixed(1);
      });

      stopBtn.addEventListener('click', () => {
        zugComp.aktuellesTempo = 0;
        slider.value = 0;
        valSpan.textContent = '0.0';
      });

      container.appendChild(wrap);
    });
  }
});
