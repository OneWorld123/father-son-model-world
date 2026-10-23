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

// Zweiklang-Autohupe (415 Hz + 523 Hz)
window.EEP.autoHupe = function () {
  this.initAudio();
  const ctx = this.audioCtx;
  const now = ctx.currentTime;
  [415.3, 523.25].forEach(freq => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.02);
    gain.gain.setValueAtTime(0.14, now + 0.32);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.44);
  });
};

// Mechanisches Einrasten des Gangwahlhebels
window.EEP.schaltKlick = function () {
  if (!this.soundAktiv) return;
  this.initAudio();
  const ctx = this.audioCtx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(190, now);
  osc.frequency.exponentialRampToValueAtTime(75, now + 0.055);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.065);
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

      // Kamera-Anker für Züge (Vor der Frontscheibe bei z=+2.45, damit near=0.05 nicht ins 3D-Modell schaut!)
      if (d.typ.includes('lok') || d.typ.includes('kopf') || d.typ.includes('diesel')) {
        const camAnchor = document.createElement('a-entity');
        camAnchor.classList.add(d.typ.includes('dampf') ? 'dampflok-cam-anchor' : 'ice-cam-anchor');
        camAnchor.setAttribute('position', '0 2.05 2.45');
        camAnchor.setAttribute('rotation', '-7 180 0');
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
  // Kein simpler Kasten, sondern echtes 3D-Profil mit abgeschrägter Front, 
  // Sicken-Seitenwand, Bullaugen, Dachlüftern, Dieseltank, Puffern & Co'Co'-Drehgestellen!
  baueLudmilla: function (root) {
    const bordeauxMat = new THREE.MeshStandardMaterial({ color: 0x8e1b1b, roughness: 0.32, metalness: 0.25 });
    const sickenMat = new THREE.MeshStandardMaterial({ color: 0x781414, roughness: 0.4, metalness: 0.28 });
    const elfenbeinMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e1, roughness: 0.3, metalness: 0.1 });
    const dachMat = new THREE.MeshStandardMaterial({ color: 0x4a525a, roughness: 0.55, metalness: 0.45 });
    const rahmenMat = new THREE.MeshStandardMaterial({ color: 0x1e2022, roughness: 0.65, metalness: 0.6 });
    const stahlMat = new THREE.MeshStandardMaterial({ color: 0xb0b8c0, roughness: 0.25, metalness: 0.85 });
    const gitterMat = new THREE.MeshStandardMaterial({ color: 0x2b3035, roughness: 0.75, metalness: 0.5 });
    const glasMat = new THREE.MeshStandardMaterial({ color: 0x0d1b2a, roughness: 0.08, metalness: 0.92 });
    const innenGlasMat = new THREE.MeshStandardMaterial({ color: 0xffe082, emissive: 0xffb300, emissiveIntensity: 0.45, roughness: 0.15 });
    const lichtWeissMat = new THREE.MeshStandardMaterial({ color: 0xfffde7, emissive: 0xffea00, emissiveIntensity: 3.0 });
    const lichtRotMat = new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 2.2 });

    // 1. Geformter Hauptkasten mit abgeschrägter Front/Heck (ExtrudeGeometry entlang X)
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-2.65, 0.62);
    bodyShape.lineTo(2.65, 0.62);
    bodyShape.lineTo(2.74, 1.22); // Untere Stirnschräge (Knick)
    bodyShape.lineTo(2.50, 1.92); // Schräge Frontscheiben-Ebene
    bodyShape.lineTo(2.34, 2.08); // Dachkante vorne
    bodyShape.lineTo(-2.34, 2.08); // Dachkante hinten
    bodyShape.lineTo(-2.50, 1.92);
    bodyShape.lineTo(-2.74, 1.22);
    bodyShape.closePath();

    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
      depth: 1.44,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.04,
      bevelSegments: 3
    });
    // Von X-Y-Extrusion (Z=0..1.44) drehen, sodass Länge auf Z liegt und Breite (-0.72..+0.72) auf X
    bodyGeo.translate(0, 0, -0.72);
    bodyGeo.rotateY(Math.PI / 2);
    const bodyMesh = new THREE.Mesh(bodyGeo, bordeauxMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    root.add(bodyMesh);

    // 2. Gerundetes graues Dach mit Überhang über den Stirnseiten
    const dachShape = new THREE.Shape();
    dachShape.moveTo(-2.46, 2.04);
    dachShape.lineTo(2.46, 2.04);
    dachShape.lineTo(2.32, 2.24);
    dachShape.lineTo(-2.32, 2.24);
    dachShape.closePath();
    const dachGeo = new THREE.ExtrudeGeometry(dachShape, {
      depth: 1.38,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 4
    });
    dachGeo.translate(0, 0, -0.69);
    dachGeo.rotateY(Math.PI / 2);
    const dachMesh = new THREE.Mesh(dachGeo, dachMat);
    dachMesh.castShadow = true;
    root.add(dachMesh);

    // 3. Dachdetails: 2 große runde Kühlerlüfter, Widerstandsbremse-Aufbau & Abgashutze
    [-1.05, 1.05].forEach(zPos => {
      const luefterRing = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.08, 20), gitterMat);
      luefterRing.position.set(0, 2.28, zPos);
      root.add(luefterRing);

      const luefterNabe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 12), rahmenMat);
      luefterNabe.position.set(0, 2.29, zPos);
      root.add(luefterNabe);
    });

    // Abgasschacht (Mitte) mit feiner Rußkante
    const auspuff = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.65), rahmenMat);
    auspuff.position.set(0, 2.30, 0);
    root.add(auspuff);

    // 4. Charakteristischer elfenbeinfarbener DR-Zierstreifen + Lätzchen an der Front
    const seitenStreifen = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.14, 4.95), elfenbeinMat);
    seitenStreifen.position.set(0, 1.18, 0);
    root.add(seitenStreifen);

    [-2.74, 2.74].forEach(zPos => {
      const laetzchen = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.22, 0.06), elfenbeinMat);
      laetzchen.position.set(0, 1.16, zPos);
      root.add(laetzchen);

      // DR-Nummernschild "132 146-2" an der Front
      const schild = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.11, 0.08), rahmenMat);
      schild.position.set(0, 1.16, zPos + (zPos > 0 ? 0.02 : -0.02));
      root.add(schild);
    });

    // 5. Seitenwand-Struktur: Horizontale Sicken, Lüftungsgitter & 4 Maschinenraum-Bullaugen
    [0.85, 0.98, 1.38, 1.50].forEach(yPos => {
      const sicke = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.03, 3.5), sickenMat);
      sicke.position.set(0, yPos, 0);
      root.add(sicke);
    });

    // 4 Maschinenraum-Fenster + obere Lüftergitterbänder
    [-1.25, -0.42, 0.42, 1.25].forEach(zPos => {
      const mFensterRahmen = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.30, 0.44), rahmenMat);
      mFensterRahmen.position.set(0, 1.70, zPos);
      root.add(mFensterRahmen);

      const mFensterGlas = new THREE.Mesh(new THREE.BoxGeometry(1.57, 0.22, 0.36), innenGlasMat);
      mFensterGlas.position.set(0, 1.70, zPos);
      root.add(mFensterGlas);
    });

    // Große schräge Dachschrägen-Lüftergitter
    [-1.4, 1.4].forEach(zPos => {
      const gitter = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.18, 0.85), gitterMat);
      gitter.position.set(0, 1.98, zPos);
      root.add(gitter);
    });

    // Führerstandstüren (je 2 pro Seite mit Trittstufen & silbernen Griffstangen)
    [-2.05, 2.05].forEach(zPos => {
      const tuer = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.12, 0.38), sickenMat);
      tuer.position.set(0, 1.28, zPos);
      root.add(tuer);

      const tuerFenster = new THREE.Mesh(new THREE.BoxGeometry(1.57, 0.32, 0.24), glasMat);
      tuerFenster.position.set(0, 1.62, zPos);
      root.add(tuerFenster);

      // Silberne Griffstangen links/rechts der Tür
      [-0.78, 0.78].forEach(xPos => {
        const griff = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.95, 6), stahlMat);
        griff.position.set(xPos, 1.25, zPos + (zPos > 0 ? -0.22 : 0.22));
        root.add(griff);
      });
    });

    // 6. Führerstände vorne & hinten: Zweiteilige schräge Frontscheiben, Sonnenblenden & Scheibenwischer
    [1, -1].forEach(dir => {
      const isFront = dir > 0;
      const zFront = dir * 2.58;

      // Linke & rechte Frontscheibe (geneigt passend zur Stirnschräge)
      [-0.34, 0.34].forEach(xPos => {
        const scheibe = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.44, 0.08), glasMat);
        scheibe.position.set(xPos, 1.62, zFront);
        scheibe.rotation.x = dir * 0.32;
        root.add(scheibe);

        // Scheibenwischer
        const wischer = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.32, 0.10), stahlMat);
        wischer.position.set(xPos + 0.08, 1.62, zFront + dir * 0.02);
        wischer.rotation.x = dir * 0.32;
        wischer.rotation.z = 0.25;
        root.add(wischer);
      });

      // Seitenfenster des Führerstands
      const cabSideGlass = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.40, 0.46), glasMat);
      cabSideGlass.position.set(0, 1.64, dir * 2.38);
      root.add(cabSideGlass);

      // Dreilicht-Spitzensignal (unten 2 Doppellampen im Chromring, oben 1 Stirnlampe)
      [-0.48, 0.48].forEach(xPos => {
        const fassung = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), stahlMat);
        fassung.rotation.x = Math.PI / 2;
        fassung.position.set(xPos, 0.92, dir * 2.72);
        root.add(fassung);

        const lampe = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), isFront ? lichtWeissMat : lichtRotMat);
        lampe.position.set(xPos, 0.92, dir * 2.75);
        root.add(lampe);
      });

      const topFassung = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.10, 12), stahlMat);
      topFassung.rotation.x = Math.PI / 2;
      topFassung.position.set(0, 2.00, dir * 2.45);
      root.add(topFassung);

      const topLampe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), isFront ? lichtWeissMat : rahmenMat);
      topLampe.position.set(0, 2.00, dir * 2.49);
      root.add(topLampe);

      // 7. Schwere Pufferbohle, 2 runde Hochleistungspuffer, Schraubenkupplung & Bahnräumer (Schneepflug)
      const bohle = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.28, 0.18), rahmenMat);
      bohle.position.set(0, 0.52, dir * 2.76);
      root.add(bohle);

      [-0.52, 0.52].forEach(xPos => {
        const pufferHuelse = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.26, 12), rahmenMat);
        pufferHuelse.rotation.x = Math.PI / 2;
        pufferHuelse.position.set(xPos, 0.52, dir * 2.90);
        root.add(pufferHuelse);

        const pufferTeller = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16), stahlMat);
        pufferTeller.rotation.x = Math.PI / 2;
        pufferTeller.position.set(xPos, 0.52, dir * 3.03);
        root.add(pufferTeller);
      });

      // Angedeuteter roter Bahnräumer / Schienenräumer unter der Pufferbohle
      const pflug = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.22, 0.12), bordeauxMat);
      pflug.position.set(0, 0.30, dir * 2.68);
      pflug.rotation.x = dir * -0.25;
      root.add(pflug);
    });

    // 8. Fahrwerk: 2 wuchtige 3-achsige Drehgestellrahmen (Co'Co') + großer Dieseltank & Batteriekasten in der Mitte
    const tank = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.42, 1.45), rahmenMat);
    tank.position.set(0, 0.36, 0);
    tank.castShadow = true;
    root.add(tank);

    [-1.65, 1.65].forEach(zBogie => {
      // Drehgestell-Außenwangen mit Federpaketen
      const bogieFrame = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.28, 1.82), rahmenMat);
      bogieFrame.position.set(0, 0.34, zBogie);
      bogieFrame.castShadow = true;
      root.add(bogieFrame);

      // 3 Bremszylinder / Achslager-Deckel pro Drehgestellseite
      [-0.65, 0, 0.65].forEach(zOff => {
        const lager = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.14, 0.18), gitterMat);
        lager.position.set(0, 0.28, zBogie + zOff);
        root.add(lager);
      });
    });

    // 6 Achsen mit Stahl-Laufflächen
    this.baueStandardAchsen(root, [-2.3, -1.65, -1.0, 1.0, 1.65, 2.3]);

    // 9. Führerstands-Kamera (Direkt an der Frontscheibe bei z=+2.82 mit Blick voraus auf die Strecke)
    const camAnchor = document.createElement('a-entity');
    camAnchor.classList.add('ludmilla-cam-anchor');
    camAnchor.setAttribute('position', '0 2.28 2.82');
    camAnchor.setAttribute('rotation', '-7 180 0');
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
      // Kamera-Anker für Taste [3] (ICE-Mitfahrt an der Frontscheibe)
      const camAnchor = document.createElement('a-entity');
      camAnchor.classList.add('ice-cam-anchor');
      camAnchor.setAttribute('position', '0 1.95 2.35');
      camAnchor.setAttribute('rotation', '-7 180 0');
      this.el.appendChild(camAnchor);
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
      kugel.setAttribute('material', 'color: #fffde7; emissive: #ffd54f; emissiveIntensity: 2.2');
      el.appendChild(kugel);
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
// 7. STEUERUNG, FLUGZEUG, SCHIFF, KAMERAS & KINDER-STEUERPULT ('ki-steuerung')
// ============================================================================
// ============================================================================
// GRAND CANYON GENERATOR ('ki-canyon')
// Prozedurale Tafelberge (Mesas), Terrassen & Felsnadeln mit durchgehenden
// Gesteinsschichten + gewundene Schlucht mit Fluss. Alles pro Farbe zu einem
// Mesh zusammengefasst (wenige Draw-Calls = schnell).
// Benutzung: <a-entity ki-canyon="breite: 44; tiefe: 50; hoehe: 18; seed: 7" position="..."></a-entity>
// ============================================================================
AFRAME.registerComponent('ki-canyon', {
  schema: {
    breite: { type: 'number', default: 44 },  // Ausdehnung in X
    tiefe: { type: 'number', default: 50 },   // Ausdehnung in Z
    hoehe: { type: 'number', default: 18 },   // max. Höhe der Canyonwände
    seed: { type: 'number', default: 7 },
    fluss: { type: 'boolean', default: true }
  },

  init: function () {
    const d = this.data;
    const group = new THREE.Group();

    // Deterministischer Zufall (gleicher Seed = gleicher Canyon)
    let s = d.seed >>> 0;
    const rnd = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // Gesteinsschichten von unten nach oben (Maximale Polygonanzahl + echte 3D-Schichtstufen,
    // komplett in 1 einzigen Hardware-VBO mit Vertex-Colors auf der GPU gebündelt!)
    const palette = [
      new THREE.Color('#6e3220'), new THREE.Color('#8f4127'), new THREE.Color('#a9532f'),
      new THREE.Color('#c0693d'), new THREE.Color('#9a4a2c'), new THREE.Color('#cf8752'),
      new THREE.Color('#dfa86f'), new THREE.Color('#b8603a'), new THREE.Color('#e9c79a'),
      new THREE.Color('#c47a4a')
    ];
    const bandH = 1.3;
    const buckets = palette.map(() => []); // gesammelte 3D-Schichtgeometrien je Farbe

    // Verlauf der Schlucht (Fluss) in lokalen Koordinaten
    const gorgeX = (z) => Math.sin(z * 0.09) * 5 + Math.sin(z * 0.23) * 1.5;
    const gorgeHalf = 3.2;

    // Eine Formation = gestapelte Terrassen, jede Terrasse in echte 3D-Farbbänder zerlegt (Hohe Polygonanzahl!)
    const baueFormation = (cx, cz, radius, height) => {
      const nPts = 24; // Maximale Polygon-Detailstufe für feingliedrige Felswände
      const phase = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
      const footprint = (scale) => {
        const shape = new THREE.Shape();
        for (let i = 0; i < nPts; i++) {
          const a = (i / nPts) * Math.PI * 2;
          const r = radius * scale * (0.78 + 0.14 * Math.sin(a * 2 + phase[0]) + 0.1 * Math.sin(a * 3 + phase[1]) + 0.06 * Math.sin(a * 5 + phase[2]));
          const px = cx + Math.cos(a) * r;
          const pz = cz + Math.sin(a) * r;
          if (i === 0) shape.moveTo(px, -pz); else shape.lineTo(px, -pz);
        }
        shape.closePath();
        return shape;
      };

      // Terrassen: breiter Sockel, schmalere Stufen nach oben
      const tiers = height > 9 ? [[1.0, 0.55], [0.74, 0.3], [0.5, 0.15]] : [[1.0, 0.7], [0.68, 0.3]];
      let y = 0;
      tiers.forEach(([scale, anteil]) => {
        const tierTop = y + height * anteil;
        const shape = footprint(scale);
        while (y < tierTop - 0.01) {
          const bandIdx = Math.floor(y / bandH + 0.001);
          const yEnd = Math.min((bandIdx + 1) * bandH, tierTop);
          const geo = new THREE.ExtrudeGeometry(shape, { depth: yEnd - y, bevelEnabled: false, curveSegments: 1 });
          geo.rotateX(-Math.PI / 2);       // Extrusion zeigt jetzt nach oben (+Y)
          geo.translate(0, y, 0);
          buckets[bandIdx % palette.length].push(geo.index ? geo.toNonIndexed() : geo);
          y = yEnd;
        }
      });
    };

    // Raster über die Fläche: nahe der Schlucht hohe Wände, außen niedrigere Tafelberge
    const cell = 5.5;
    for (let gx = -d.breite / 2 + cell / 2; gx < d.breite / 2; gx += cell) {
      for (let gz = -d.tiefe / 2 + cell / 2; gz < d.tiefe / 2; gz += cell) {
        const x = gx + (rnd() - 0.5) * 2.2;
        const z = gz + (rnd() - 0.5) * 2.2;
        const dist = Math.abs(x - gorgeX(z));
        if (dist < gorgeHalf + 2.2) continue;   // Schlucht frei lassen
        if (rnd() < 0.12) continue;            // Lücken -> einzelne Buttes
        const h = Math.max(4, Math.min(d.hoehe, d.hoehe - dist * 0.32 + rnd() * 3));
        baueFormation(x, z, 3.3 + rnd() * 1.4, h);
      }
    }

    // Schlanke Felsnadeln (Hoodoos) in der Nähe der Schlucht
    for (let i = 0; i < 9; i++) {
      const z = (rnd() - 0.5) * d.tiefe * 0.9;
      const side = rnd() < 0.5 ? -1 : 1;
      const x = gorgeX(z) + side * (gorgeHalf + 1.2 + rnd() * 1.5);
      baueFormation(x, z, 0.7 + rnd() * 0.5, 5 + rnd() * 6);
    }

    // Felsen verwittern & ALLE Schichten in 1 einzigen GPU-Vertex-Buffer (VBO) mit Hardware-VertexColors packen!
    const noise = (x, y, z) => Math.sin(x * 1.7 + z * 0.9 + y * 0.3) * 0.5 + Math.sin(z * 2.3 - y * 0.7 + x * 0.4) * 0.3 + Math.sin(y * 3.1 + x * 1.1) * 0.2;

    let totalVerts = 0;
    buckets.forEach(geos => geos.forEach(g => { totalVerts += g.attributes.position.count; }));

    if (totalVerts > 0) {
      const pos = new Float32Array(totalVerts * 3);
      const col = new Float32Array(totalVerts * 3);
      let off = 0;

      buckets.forEach((geos, idx) => {
        const c = palette[idx];
        const cr = c.r, cg = c.g, cb = c.b;
        geos.forEach(g => {
          const arr = g.attributes.position.array;
          const len = arr.length;
          pos.set(arr, off);
          for (let k = off; k < off + len; k += 3) {
            const x = pos[k], y = pos[k + 1], z = pos[k + 2];
            pos[k] += noise(x, y, z) * 0.45;
            pos[k + 2] += noise(z + 13.1, y, x) * 0.45;
            col[k] = cr;
            col[k + 1] = cg;
            col[k + 2] = cb;
          }
          off += len;
          g.dispose();
        });
      });

      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
      merged.computeVertexNormals();
      merged.computeBoundingSphere();

      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
        metalness: 0.0,
        flatShading: true
      });
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      group.add(mesh);
    }

    // Wüstenboden (rötlicher Sand) über dem grünen Gras
    const boden = new THREE.Mesh(
      new THREE.PlaneGeometry(d.breite + 8, d.tiefe + 4),
      new THREE.MeshStandardMaterial({ color: '#b9774b', roughness: 1.0 })
    );
    boden.rotation.x = -Math.PI / 2;
    boden.position.y = 0.03;
    boden.receiveShadow = true;
    group.add(boden);

    // Colorado River: gewundenes Band durch die Schlucht
    if (d.fluss) {
      const shape = new THREE.Shape();
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const z = -d.tiefe / 2 - 2 + (i / steps) * (d.tiefe + 4);
        const x = gorgeX(z) - 1.8;
        if (i === 0) shape.moveTo(x, -z); else shape.lineTo(x, -z);
      }
      for (let i = steps; i >= 0; i--) {
        const z = -d.tiefe / 2 - 2 + (i / steps) * (d.tiefe + 4);
        shape.lineTo(gorgeX(z) + 1.8, -z);
      }
      const flussGeo = new THREE.ShapeGeometry(shape);
      flussGeo.rotateX(-Math.PI / 2);
      const fluss = new THREE.Mesh(flussGeo, new THREE.MeshStandardMaterial({ color: '#2e7d6b', roughness: 0.15, metalness: 0.6 }));
      fluss.position.y = 0.07;
      group.add(fluss);
    }

    this.el.setObject3D('mesh', group);
  },

  remove: function () {
    this.el.removeObject3D('mesh');
  }
});

// ============================================================================
// 8. NEUE WELT-BAUSTEINE FÜR DEUTSCHLAND ⇄ OZEAN ⇄ AMERIKA
// ('ki-strasse', 'ki-alpen', 'ki-wolkenkratzer', 'ki-flughafen', 'ki-schiff')
// ============================================================================
AFRAME.registerComponent('ki-strasse', {
  schema: {
    punkte: { type: 'string', default: '' },
    breite: { type: 'number', default: 3.4 }
  },
  init: function () {
    const d = this.data;
    const pts = [];
    d.punkte.split(',').forEach(pStr => {
      const c = pStr.trim().split(/\s+/).map(Number);
      if (c.length >= 3) pts.push(new THREE.Vector3(c[0], c[1], c[2]));
    });
    if (pts.length < 2) return;

    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    const totalLen = curve.getLength();
    const samples = Math.max(80, Math.floor(totalLen * 1.5));

    const group = new THREE.Group();
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2b3036, roughness: 0.9, metalness: 0.05 });
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.5 });

    // Straßen-Segmente entlang der Kurve
    const segLen = totalLen / samples;
    const roadGeo = new THREE.BoxGeometry(d.breite, 0.08, segLen * 1.15);
    const roadInst = new THREE.InstancedMesh(roadGeo, roadMat, samples);
    roadInst.receiveShadow = true;

    const numDashes = Math.floor(samples / 2);
    const dashGeo = new THREE.BoxGeometry(0.18, 0.095, segLen * 0.9);
    const dashInst = new THREE.InstancedMesh(dashGeo, lineMat, numDashes);

    const dummy = new THREE.Object3D();
    let dashIdx = 0;
    for (let i = 0; i < samples; i++) {
      const u = i / (samples - 1);
      const pos = curve.getPointAt(u);
      const tangent = curve.getTangentAt(u).normalize();
      dummy.position.copy(pos);
      dummy.lookAt(pos.clone().add(tangent));
      dummy.updateMatrix();
      roadInst.setMatrixAt(i, dummy.matrix);

      if (i % 2 === 0 && dashIdx < numDashes) {
        dashInst.setMatrixAt(dashIdx++, dummy.matrix);
      }
    }
    group.add(roadInst);
    group.add(dashInst);
    this.el.setObject3D('mesh', group);
  }
});

AFRAME.registerComponent('ki-alpen', {
  schema: {
    breite: { type: 'number', default: 58 },
    tiefe: { type: 'number', default: 24 },
    hoehe: { type: 'number', default: 28 }
  },
  init: function () {
    const d = this.data;
    const group = new THREE.Group();
    const felsMat = new THREE.MeshStandardMaterial({ color: 0x5c6670, roughness: 0.9, flatShading: true });
    const schneeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5, flatShading: true });

    const peaks = [
      { x: -20, z: -2, r: 12, h: d.hoehe * 0.85 },
      { x: -8,  z: -4, r: 15, h: d.hoehe * 1.05 },
      { x: 6,   z: -3, r: 14, h: d.hoehe * 0.95 },
      { x: 18,  z: -1, r: 11, h: d.hoehe * 0.78 },
      { x: -14, z: 4,  r: 9,  h: d.hoehe * 0.62 },
      { x: 0,   z: 5,  r: 10, h: d.hoehe * 0.68 },
      { x: 12,  z: 4,  r: 9,  h: d.hoehe * 0.60 }
    ];

    peaks.forEach((p, idx) => {
      // Fels-Hauptkegel
      const coneGeo = new THREE.ConeGeometry(p.r, p.h, 7);
      const cone = new THREE.Mesh(coneGeo, felsMat);
      cone.position.set(p.x, p.h * 0.5, p.z);
      cone.rotation.y = idx * 0.9;
      cone.castShadow = true;
      cone.receiveShadow = true;
      group.add(cone);

      // Schneekappe auf den oberen 38 %
      const snowH = p.h * 0.38;
      const snowR = p.r * 0.39;
      const snowGeo = new THREE.ConeGeometry(snowR, snowH, 7);
      const snow = new THREE.Mesh(snowGeo, schneeMat);
      snow.position.set(p.x, p.h - snowH * 0.48, p.z);
      snow.rotation.y = idx * 0.9;
      group.add(snow);
    });

    this.el.setObject3D('mesh', group);
  }
});

AFRAME.registerComponent('ki-wolkenkratzer', {
  schema: {
    breite: { type: 'number', default: 5.5 },
    tiefe: { type: 'number', default: 5.5 },
    hoehe: { type: 'number', default: 24 },
    farbe: { type: 'color', default: '#334155' },
    spitze: { type: 'boolean', default: false }
  },
  init: function () {
    const d = this.data;
    const el = this.el;

    const turm = document.createElement('a-box');
    turm.setAttribute('width', d.breite);
    turm.setAttribute('height', d.hoehe);
    turm.setAttribute('depth', d.tiefe);
    turm.setAttribute('position', `0 ${d.hoehe / 2} 0`);
    turm.setAttribute('material', `color: ${d.farbe}; roughness: 0.25; metalness: 0.7`);
    turm.setAttribute('shadow', 'cast: true; receive: true');
    el.appendChild(turm);

    // Leuchtende Fensterbänder
    const etagen = Math.floor(d.hoehe / 2.2);
    for (let i = 1; i < etagen; i++) {
      const fensterBand = document.createElement('a-box');
      fensterBand.setAttribute('width', d.breite + 0.08);
      fensterBand.setAttribute('height', '0.75');
      fensterBand.setAttribute('depth', d.tiefe + 0.08);
      fensterBand.setAttribute('position', `0 ${i * 2.2} 0`);
      fensterBand.setAttribute('material', 'color: #e0f2fe; emissive: #7dd3fc; emissiveIntensity: 0.65; roughness: 0.1; metalness: 0.9');
      el.appendChild(fensterBand);
    }

    if (d.spitze) {
      const krone = document.createElement('a-box');
      krone.setAttribute('width', d.breite * 0.65);
      krone.setAttribute('height', '3.5');
      krone.setAttribute('depth', d.tiefe * 0.65);
      krone.setAttribute('position', `0 ${d.hoehe + 1.75} 0`);
      krone.setAttribute('material', `color: ${d.farbe}; metalness: 0.8`);
      el.appendChild(krone);

      const antenne = document.createElement('a-cylinder');
      antenne.setAttribute('radius', '0.12');
      antenne.setAttribute('height', '6.0');
      antenne.setAttribute('position', `0 ${d.hoehe + 6.0} 0`);
      antenne.setAttribute('material', 'color: #cbd5e1; metalness: 0.9');
      el.appendChild(antenne);
    }
  }
});

AFRAME.registerComponent('ki-flughafen', {
  schema: {
    name: { type: 'string', default: 'Airport' },
    laenge: { type: 'number', default: 50 },
    terminalSeite: { type: 'string', default: 'links' } // links (DE) oder rechts (US)
  },
  init: function () {
    const d = this.data;
    const el = this.el;
    const side = d.terminalSeite === 'links' ? -1 : 1;

    // 1. Start- & Landebahn (Asphalt + Mittelstreifen + Schwellenmarkierung)
    const piste = document.createElement('a-box');
    piste.setAttribute('width', '11');
    piste.setAttribute('height', '0.08');
    piste.setAttribute('depth', d.laenge);
    piste.setAttribute('position', '0 0.06 0');
    piste.setAttribute('material', 'color: #1e293b; roughness: 0.85');
    piste.setAttribute('shadow', 'receive: true');
    el.appendChild(piste);

    const streifen = document.createElement('a-box');
    streifen.setAttribute('width', '0.45');
    streifen.setAttribute('height', '0.10');
    streifen.setAttribute('depth', d.laenge - 6);
    streifen.setAttribute('position', '0 0.07 0');
    streifen.setAttribute('material', 'color: #f8fafc');
    el.appendChild(streifen);

    // 2. Rollfeld (Vorfeld zwischen Startbahn und Terminal)
    const rollfeld = document.createElement('a-box');
    rollfeld.setAttribute('width', '10');
    rollfeld.setAttribute('height', '0.07');
    rollfeld.setAttribute('depth', d.laenge * 0.65);
    rollfeld.setAttribute('position', `${side * 10} 0.055 2`);
    rollfeld.setAttribute('material', 'color: #475569; roughness: 0.9');
    el.appendChild(rollfeld);

    // 3. Terminal-Gebäude mit Glasfassade & Namensschild
    const terminal = document.createElement('a-box');
    terminal.setAttribute('width', '7.5');
    terminal.setAttribute('height', '4.6');
    terminal.setAttribute('depth', d.laenge * 0.55);
    terminal.setAttribute('position', `${side * 16.5} 2.3 -1`);
    terminal.setAttribute('material', 'color: #cbd5e1; roughness: 0.4; metalness: 0.3');
    terminal.setAttribute('shadow', 'cast: true; receive: true');
    el.appendChild(terminal);

    const glas = document.createElement('a-box');
    glas.setAttribute('width', '7.65');
    glas.setAttribute('height', '2.4');
    glas.setAttribute('depth', d.laenge * 0.50);
    glas.setAttribute('position', `${side * 16.5} 2.4 -1`);
    glas.setAttribute('material', 'color: #0284c7; emissive: #38bdf8; emissiveIntensity: 0.45; roughness: 0.1; metalness: 0.85');
    el.appendChild(glas);

    const schild = document.createElement('a-text');
    schild.setAttribute('value', d.name);
    schild.setAttribute('align', 'center');
    schild.setAttribute('color', '#ffffff');
    schild.setAttribute('width', '22');
    schild.setAttribute('position', `${side * 12.6} 5.4 -1`);
    schild.setAttribute('rotation', `0 ${side > 0 ? -90 : 90} 0`);
    el.appendChild(schild);

    // 4. Tower (Kontrollturm: in DE nördlich/oben, in US südlich/unten wie gezeichnet)
    const towerZ = side < 0 ? (-d.laenge * 0.44) : (d.laenge * 0.44);
    const towerSchaft = document.createElement('a-cylinder');
    towerSchaft.setAttribute('radius', '1.4');
    towerSchaft.setAttribute('height', '11');
    towerSchaft.setAttribute('position', `${side * 14} 5.5 ${towerZ}`);
    towerSchaft.setAttribute('material', 'color: #e2e8f0; roughness: 0.5');
    towerSchaft.setAttribute('shadow', 'cast: true');
    el.appendChild(towerSchaft);

    const kanzel = document.createElement('a-cylinder');
    kanzel.setAttribute('radius', '2.3');
    kanzel.setAttribute('height', '2.0');
    kanzel.setAttribute('position', `${side * 14} 11.2 ${towerZ}`);
    kanzel.setAttribute('material', 'color: #0284c7; emissive: #38bdf8; emissiveIntensity: 0.6; roughness: 0.1; metalness: 0.9');
    el.appendChild(kanzel);

    const dach = document.createElement('a-cone');
    dach.setAttribute('radius-bottom', '2.5');
    dach.setAttribute('radius-top', '0.2');
    dach.setAttribute('height', '1.4');
    dach.setAttribute('position', `${side * 14} 12.9 ${towerZ}`);
    dach.setAttribute('material', 'color: #dc2626');
    el.appendChild(dach);
  }
});

AFRAME.registerComponent('ki-flugzeug', {
  schema: {
    schub: { type: 'number', default: 1.0 } // 0 = Stopp, bis 3.0 = Turbo
  },
  init: function () {
    window.EEP.flugzeugComp = this;
    this.schub = this.data.schub;
    this.progress = 0;

    // Transatlantik-Rundflug: Start Flughafen DE (-162, Z=0) -> Alpen -> Über den Ozean & Inseln ->
    // Touch-and-Go auf dem US-Flughafen (+156, Z=+15) -> Kurve über den Grand Canyon (+118, Z=+58) ->
    // Über die Ostsee zurück zur Landung auf dem Flughafen DE!
    const points = [
      new THREE.Vector3(-162, 0.9, 18),   // 0: Start Flughafen DE (Südende Piste)
      new THREE.Vector3(-162, 0.9, -12),  // 1: Beschleunigen auf Piste DE
      new THREE.Vector3(-145, 16, -42),   // 2: Abheben vor den Alpen
      new THREE.Vector3(-45,  34, -35),   // 3: Steigflug über den nördlichen Ozean
      new THREE.Vector3(65,   32, -15),   // 4: Anflug über die 4 Inseln auf Amerika
      new THREE.Vector3(156,  10, -12),   // 5: Endanflug Piste USA (Nord)
      new THREE.Vector3(156,  1.2, 16),   // 6: Touch-and-Go auf der US-Startbahn!
      new THREE.Vector3(156,  12,  42),   // 7: Durchstarten Richtung Süden
      new THREE.Vector3(118,  28,  58),   // 8: Panorama-Kurve direkt über den Grand Canyon!
      new THREE.Vector3(10,   35,  48),   // 9: Rückflug über den südlichen Ozean
      new THREE.Vector3(-115, 22,  55),   // 10: Überflug Ostsee & Mein Schiff
      new THREE.Vector3(-162, 7,   36)    // 11: Landeanflug Flughafen DE
    ];
    this.curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.45);
    this.totalLen = this.curve.getLength();
  },
  tick: function (time, dt) {
    if (!dt || this.schub <= 0) return;
    const deltaSec = Math.min(dt / 1000, 0.1);
    const distDelta = (24.0 * this.schub) * deltaSec;
    this.progress = (this.progress + (distDelta / this.totalLen)) % 1.0;

    const currentPos = this.curve.getPointAt(this.progress);
    const lookAheadProgress = (this.progress + 0.012) % 1.0;
    const nextPos = this.curve.getPointAt(lookAheadProgress);

    this.el.object3D.position.copy(currentPos);
    this.el.object3D.lookAt(nextPos);
    this.el.object3D.rotateY(Math.PI);
  }
});

AFRAME.registerComponent('ki-faehre', {
  schema: {
    tempo: { type: 'number', default: 1.0 },
    von: { type: 'vec3', default: { x: -45, y: 0.35, z: -25 } },
    nach: { type: 'vec3', default: { x: 45, y: 0.35, z: -25 } },
    hauptschiff: { type: 'boolean', default: false }
  },
  init: function () {
    if (this.data.hauptschiff || !window.EEP.faehreComp) {
      window.EEP.faehreComp = this;
    }
    if (!window.EEP.alleSchiffe) window.EEP.alleSchiffe = [];
    window.EEP.alleSchiffe.push(this);

    this.tempo = this.data.tempo;
    this.progress = Math.random() * 0.3;
    this.richtung = 1;
    this.pStart = new THREE.Vector3(this.data.von.x, this.data.von.y, this.data.von.z);
    this.pEnd = new THREE.Vector3(this.data.nach.x, this.data.nach.y, this.data.nach.z);
    this.distanz = Math.max(1, this.pStart.distanceTo(this.pEnd));
  },
  tick: function (time, dt) {
    const globalFactor = window.EEP.faehreComp ? window.EEP.faehreComp.tempo : this.tempo;
    if (!dt || globalFactor <= 0) return;
    const deltaSec = Math.min(dt / 1000, 0.1);
    const speed = 6.5 * globalFactor;
    this.progress += this.richtung * (speed * deltaSec) / this.distanz;

    if (this.progress >= 1.0) {
      this.progress = 1.0;
      this.richtung = -1;
    } else if (this.progress <= 0.0) {
      this.progress = 0.0;
      this.richtung = 1;
    }

    const pos = new THREE.Vector3().lerpVectors(this.pStart, this.pEnd, this.progress);
    this.el.object3D.position.copy(pos);
    const ziel = this.richtung > 0 ? this.pEnd : this.pStart;
    this.el.object3D.lookAt(ziel);
    this.el.object3D.rotateY(-Math.PI / 2);
  }
});

// ============================================================================
// 9. STEUERBARES AUTO MIT VOLLWERTIGEM 3D-COCKPIT ('ki-auto')
// 3D-Sportlenkrad, 3D-Gangwahlhebel (P-R-N-D-S), Kombiinstrument (Tacho + RPM),
// GPS-Navi, Gas-/Bremspedale, Rückspiegel, Motorhaube & Ackermann-Fahrphysik
// ============================================================================
AFRAME.registerComponent('ki-auto', {
  schema: {
    farbe: { type: 'color', default: '#dc2626' }
  },

  init: function () {
    window.EEP.autoComp = this;

    // Physik-Zustand (Vorwärtsrichtung im lokalen Raum ist -Z!)
    this.geschwindigkeit = 0;      // m/s (positiv = vorwärts, negativ = rückwärts)
    this.lenkWinkel = 0;           // Radiant (+ = links, - = rechts, max +-0.58 rad = 33°)
    this.radstand = 2.65;          // Meter zwischen Vorder- und Hinterachse
    this.gang = 'D';               // 'P', 'R', 'N', 'D', 'S'
    this.autoStufe = 1;            // 1..5 in 'D'/'S'
    this.rpm = 850;                // Leerlaufdrehzahl
    this.gasStellung = 0;          // 0..1
    this.bremsStellung = 0;        // 0..1
    this.stillstandTimer = 0;      // Für sanftes Auto-Umschalten D <-> R

    // Gedrückte Pfeiltasten
    this.tasten = { hoch: false, runter: false, links: false, rechts: false };

    window.addEventListener('keydown', (e) => {
      if (window.EEP.aktiveKamera !== 8) return;
      if (e.key === 'ArrowUp') { this.tasten.hoch = true; e.preventDefault(); }
      if (e.key === 'ArrowDown') { this.tasten.runter = true; e.preventDefault(); }
      if (e.key === 'ArrowLeft') { this.tasten.links = true; e.preventDefault(); }
      if (e.key === 'ArrowRight') { this.tasten.rechts = true; e.preventDefault(); }
      if (e.key.toLowerCase() === 'g') {
        this.naechsterGang();
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowUp') this.tasten.hoch = false;
      if (e.key === 'ArrowDown') this.tasten.runter = false;
      if (e.key === 'ArrowLeft') this.tasten.links = false;
      if (e.key === 'ArrowRight') this.tasten.rechts = false;
    });

    this.baueAutoUndCockpit3D();
    this.zeichneKombiinstrument();
    this.zeichneSchaltkulisse();
    this.zeichneNaviDisplay();
  },

  setzeGang: function (neuerGang) {
    const gaenge = ['P', 'R', 'N', 'D', 'S'];
    if (!gaenge.includes(neuerGang) || this.gang === neuerGang) return;
    this.gang = neuerGang;
    if (neuerGang === 'P') this.geschwindigkeit = 0;
    window.EEP.schaltKlick();
    this.zeichneSchaltkulisse();
    this.zeichneKombiinstrument();
    if (window.EEP.aktualisiereAutoHUD) window.EEP.aktualisiereAutoHUD();
  },

  naechsterGang: function () {
    const gaenge = ['P', 'R', 'N', 'D', 'S'];
    const idx = (gaenge.indexOf(this.gang) + 1) % gaenge.length;
    this.setzeGang(gaenge[idx]);
  },

  teleportiereZu: function (x, y, z, rotYGrad) {
    this.geschwindigkeit = 0;
    this.lenkWinkel = 0;
    this.gang = 'D';
    this.el.object3D.position.set(x, y, z);
    this.el.object3D.rotation.set(0, THREE.MathUtils.degToRad(rotYGrad), 0);
    this.el.object3D.updateMatrixWorld(true);
    this.zeichneSchaltkulisse();
    this.zeichneKombiinstrument();
    this.zeichneNaviDisplay();
    if (window.EEP.aktualisiereAutoHUD) window.EEP.aktualisiereAutoHUD();
  },

  baueAutoUndCockpit3D: function () {
    const root = new THREE.Group();
    this.el.setObject3D('mesh', root);

    const lackMat = new THREE.MeshStandardMaterial({ color: this.data.farbe, roughness: 0.22, metalness: 0.55 });
    const streifenMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.2 });
    const dunkelLederMat = new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.7, metalness: 0.1 });
    const konsoleMat = new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.5, metalness: 0.25 });
    const aluMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.85 });
    const chromMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.12, metalness: 0.95 });
    const rotAkzentMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.2 });

    // ========================================================================
    // 1. KAROSSERIE AUSSEN & KONTURIERTE MOTORHAUBE (Sichtbar aus Cockpit!)
    // ========================================================================
    // Unterboden / Chassis-Wanne
    const boden = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.20, 4.35), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 }));
    boden.position.set(0, 0.32, 0);
    boden.castShadow = true;
    root.add(boden);

    // Seitenschweller & Türen links/rechts (damit das Cockpit seitlich geschlossen ist)
    [-0.89, 0.89].forEach(xSide => {
      const tuer = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.58, 2.25), lackMat);
      tuer.position.set(xSide, 0.68, 0.05);
      tuer.castShadow = true;
      root.add(tuer);

      const innenVerkleidung = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 1.95), dunkelLederMat);
      innenVerkleidung.position.set(xSide * 0.92, 0.68, 0.05);
      root.add(innenVerkleidung);

      // Armlehne + Chrom-Türgriff innen
      const armlehne = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.65), aluMat);
      armlehne.position.set(xSide * 0.89, 0.78, -0.05);
      root.add(armlehne);
    });

    // Lange Sport-Motorhaube vorne (z: -0.68 bis -2.16)
    const haube = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.16, 1.48), lackMat);
    haube.position.set(0, 0.91, -1.42);
    haube.rotation.x = THREE.MathUtils.degToRad(-2.5); // Sanft abfallend, damit man Haube + Streifen aus dem Cockpit sieht!
    haube.castShadow = true;
    haube.receiveShadow = true;
    root.add(haube);

    // Ausgeformte Kotflügel-Kanten links & rechts auf der Motorhaube (Fahrzeugbreiten-Peilung!)
    [-0.78, 0.78].forEach(xFender => {
      const kotfluegel = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.19, 1.44), lackMat);
      kotfluegel.position.set(xFender, 0.94, -1.40);
      kotfluegel.rotation.x = THREE.MathUtils.degToRad(-2.5);
      root.add(kotfluegel);
    });

    // Zwei weiße Sport-Rallyestreifen auf der Motorhaube (machen jede Lenkbewegung sofort spürbar!)
    [-0.24, 0.24].forEach(xStripe => {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.018, 1.44), streifenMat);
      stripe.position.set(xStripe, 0.995, -1.42);
      stripe.rotation.x = THREE.MathUtils.degToRad(-2.5);
      root.add(stripe);
    });

    // Edle Chrom-Kühlerfigur vorne auf der Haubenspitze (als Zielvisier für die Straße)
    const sockel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.03, 16), chromMat);
    sockel.position.set(0, 0.96, -2.06);
    root.add(sockel);
    const sternRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.009, 12, 24), chromMat);
    sternRing.position.set(0, 1.03, -2.06);
    root.add(sternRing);

    // Frontschürze & Kühlergrill
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.44, 0.25), lackMat);
    front.position.set(0, 0.56, -2.08);
    root.add(front);

    // Heckpartie / Kofferraum
    const heck = new THREE.Mesh(new THREE.BoxGeometry(1.80, 0.56, 1.05), lackMat);
    heck.position.set(0, 0.68, 1.62);
    heck.castShadow = true;
    root.add(heck);

    // Scheinwerfer vorne & Brems-/Rückfahrlichter hinten
    const scheinwerferMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe0f2fe, emissiveIntensity: 2.5 });
    this.bremsLichtMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, emissive: 0xff1744, emissiveIntensity: 0.4 });
    this.rueckfahrLichtMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, emissive: 0xffffff, emissiveIntensity: 0.0 });

    [-0.64, 0.64].forEach(xL => {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.08), scheinwerferMat);
      sw.position.set(xL, 0.72, -2.19);
      root.add(sw);

      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), this.bremsLichtMat);
      bl.position.set(xL, 0.76, 2.16);
      root.add(bl);

      const rl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.08), this.rueckfahrLichtMat);
      rl.position.set(xL * 0.72, 0.64, 2.16);
      root.add(rl);
    });

    // ========================================================================
    // 2. WINDSCHUTZSCHEIBEN-RAHMEN, A-SÄULEN, INNENSPIEGEL & AUSSENSPIEGEL
    // ========================================================================
    [-0.84, 0.84].forEach(xPillar => {
      // Schräge A-Säule
      const aSaeule = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.74, 0.09), dunkelLederMat);
      aSaeule.position.set(xPillar, 1.24, -0.52);
      aSaeule.rotation.x = THREE.MathUtils.degToRad(34);
      aSaeule.rotation.z = xPillar < 0 ? THREE.MathUtils.degToRad(-8) : THREE.MathUtils.degToRad(8);
      root.add(aSaeule);

      // Außenspiegel (Links & Rechts)
      const spiegelArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.05), lackMat);
      spiegelArm.position.set(xPillar * 1.12, 0.99, -0.62);
      root.add(spiegelArm);

      const spiegelGehaeuse = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.08), lackMat);
      spiegelGehaeuse.position.set(xPillar * 1.22, 1.02, -0.62);
      spiegelGehaeuse.rotation.y = xPillar < 0 ? 0.22 : -0.22;
      root.add(spiegelGehaeuse);

      const spiegelGlas = new THREE.Mesh(
        new THREE.PlaneGeometry(0.19, 0.10),
        new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.05, metalness: 0.95 })
      );
      spiegelGlas.position.set(xPillar * 1.22, 1.02, -0.578);
      spiegelGlas.rotation.y = xPillar < 0 ? 0.22 : -0.22;
      root.add(spiegelGlas);
    });

    // Oberer Dachrahmen (Sonnenblenden-Leiste) + Innenspiegel
    const dachLeiste = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.07, 0.18), dunkelLederMat);
    dachLeiste.position.set(0, 1.54, -0.32);
    root.add(dachLeiste);

    const spiegelHalter = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.10, 8), konsoleMat);
    spiegelHalter.position.set(0, 1.47, -0.38);
    root.add(spiegelHalter);

    const innenSpiegel = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.075, 0.03), konsoleMat);
    innenSpiegel.position.set(0, 1.42, -0.40);
    innenSpiegel.rotation.y = 0.18; // Leicht zum Fahrer geneigt
    root.add(innenSpiegel);

    const innenSpiegelGlas = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.08, metalness: 0.92 })
    );
    innenSpiegelGlas.position.set(0, 1.42, -0.383);
    innenSpiegelGlas.rotation.y = 0.18;
    root.add(innenSpiegelGlas);

    // ========================================================================
    // 3. ARMATURENBRETT (DASHBOARD), LÜFTUNGSDÜSEN & KOMBIINSTRUMENT
    // ========================================================================
    // Haupt-Armaturenträger
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.34, 0.42), dunkelLederMat);
    dash.position.set(0, 0.84, -0.62);
    root.add(dash);

    // Durchgehende Aluminium-Zierleiste über das Cockpit
    const zierleiste = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.035, 0.43), aluMat);
    zierleiste.position.set(0, 0.92, -0.615);
    root.add(zierleiste);

    // Tachohaube (Rückwand hinter dem Kombiinstrument + schlanke Blende oben, verdeckt niemals das Display!)
    const tachoRueckwand = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.22, 0.08), konsoleMat);
    tachoRueckwand.position.set(-0.38, 1.03, -0.56);
    root.add(tachoRueckwand);

    const tachoSchirm = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.022, 0.14), konsoleMat);
    tachoSchirm.position.set(-0.38, 1.14, -0.53);
    root.add(tachoSchirm);

    // Dynamisches Canvas für Kombiinstrument (RPM-Messer + Digital-Tacho + Gang + Speedometer)
    this.kombiCanvas = document.createElement('canvas');
    this.kombiCanvas.width = 512;
    this.kombiCanvas.height = 220;
    this.kombiTex = new THREE.CanvasTexture(this.kombiCanvas);
    const kombiScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.53, 0.20),
      new THREE.MeshBasicMaterial({ map: this.kombiTex })
    );
    kombiScreen.position.set(-0.38, 1.03, -0.515);
    root.add(kombiScreen);

    // ========================================================================
    // 4. ECHTES 3D-SPORTLENKRAD (Vor dem Fahrer bei x = -0.38, y = 0.95, z = -0.35)
    // ========================================================================
    const lenkSaeule = new THREE.Group();
    lenkSaeule.position.set(-0.38, 0.95, -0.35);
    lenkSaeule.rotation.x = THREE.MathUtils.degToRad(-20); // Ergonomischer Lenksäulen-Winkel
    root.add(lenkSaeule);

    // Feste Lenksäulen-Verkleidung + Blinkerhebel (links) & Wischerhebel (rechts)
    const saeulenMantel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.22, 16), konsoleMat);
    saeulenMantel.rotation.x = Math.PI / 2;
    saeulenMantel.position.set(0, 0, -0.11);
    lenkSaeule.add(saeulenMantel);

    [-1, 1].forEach(side => {
      const hebel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.14, 10), konsoleMat);
      hebel.rotation.z = Math.PI / 2;
      hebel.position.set(side * 0.09, 0.01, -0.06);
      lenkSaeule.add(hebel);
    });

    // Drehbare Lenkrad-Gruppe (rotiert um lokale Z-Achse beim Lenken!)
    this.lenkradDrehGruppe = new THREE.Group();
    lenkSaeule.add(this.lenkradDrehGruppe);

    // Griffiger Leder-Lenkradkranz (Torus)
    const kranz = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.023, 18, 48), dunkelLederMat);
    this.lenkradDrehGruppe.add(kranz);

    // Rote 12-Uhr-Motorsport-Markierung oben am Lenkradkranz
    const markierung12Uhr = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.045, 16), rotAkzentMat);
    markierung12Uhr.rotation.z = Math.PI / 2;
    markierung12Uhr.position.set(0, 0.175, 0);
    this.lenkradDrehGruppe.add(markierung12Uhr);

    // 3 Aluminium-Lenkradspeichen (Links, Rechts, Unten)
    const speicheLinks = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.018), aluMat);
    speicheLinks.position.set(-0.09, -0.015, 0);
    speicheLinks.rotation.z = 0.15;
    this.lenkradDrehGruppe.add(speicheLinks);

    const speicheRechts = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.018), aluMat);
    speicheRechts.position.set(0.09, -0.015, 0);
    speicheRechts.rotation.z = -0.15;
    this.lenkradDrehGruppe.add(speicheRechts);

    const speicheUnten = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.13, 0.018), aluMat);
    speicheUnten.position.set(0, -0.095, 0);
    this.lenkradDrehGruppe.add(speicheUnten);

    // Multifunktions-Tasten auf den linken & rechten Speichen
    [-0.085, 0.085].forEach(xBtn => {
      const btnBlock = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.022, 0.024), konsoleMat);
      btnBlock.position.set(xBtn, -0.012, 0.005);
      this.lenkradDrehGruppe.add(btnBlock);
    });

    // Pralltopf (Airbag-Nabe) in der Mitte + Chromring & rotes Sport-Emblem
    const pralltopf = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.064, 0.038, 24), dunkelLederMat);
    pralltopf.rotation.x = Math.PI / 2;
    pralltopf.position.set(0, 0, 0.01);
    this.lenkradDrehGruppe.add(pralltopf);

    const nabenRing = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.004, 10, 24), chromMat);
    nabenRing.position.set(0, 0, 0.03);
    this.lenkradDrehGruppe.add(nabenRing);

    const nabenLogo = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.006, 16), rotAkzentMat);
    nabenLogo.rotation.x = Math.PI / 2;
    nabenLogo.position.set(0, 0, 0.03);
    this.lenkradDrehGruppe.add(nabenLogo);

    // ========================================================================
    // 5. MITTELKONSOLE, NAVI-BILDSCHIRM & ANIMIERTER 3D-GANGWAHLHEBEL (P-R-N-D-S)
    // ========================================================================
    // Mittelkonsolen-Tunnel zwischen Fahrer und Beifahrer
    const mittelTunnel = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.36, 0.95), konsoleMat);
    mittelTunnel.position.set(0.0, 0.62, -0.25);
    root.add(mittelTunnel);

    // Silberne Seitenwangen der Mittelkonsole
    [-0.152, 0.152].forEach(xTrim => {
      const wange = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.82), aluMat);
      wange.position.set(xTrim, 0.79, -0.28);
      root.add(wange);
    });

    // Großes 3D-Infotainment / GPS-Navi-Display oben auf der Mittelkonsole (zum Fahrer geneigt!)
    const naviRahmen = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.19, 0.03), aluMat);
    naviRahmen.position.set(0.14, 1.02, -0.53);
    naviRahmen.rotation.y = THREE.MathUtils.degToRad(16);
    naviRahmen.rotation.x = THREE.MathUtils.degToRad(-6);
    root.add(naviRahmen);

    this.naviCanvas = document.createElement('canvas');
    this.naviCanvas.width = 400;
    this.naviCanvas.height = 220;
    this.naviTex = new THREE.CanvasTexture(this.naviCanvas);
    const naviScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.17),
      new THREE.MeshBasicMaterial({ map: this.naviTex })
    );
    naviScreen.position.set(0.135, 1.02, -0.512);
    naviScreen.rotation.y = THREE.MathUtils.degToRad(16);
    naviScreen.rotation.x = THREE.MathUtils.degToRad(-6);
    root.add(naviScreen);

    // Beleuchtete Schaltkulisse (P - R - N - D - S) auf der Mittelkonsole
    const kulissenRahmen = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.28), aluMat);
    kulissenRahmen.position.set(-0.03, 0.81, -0.38);
    root.add(kulissenRahmen);

    this.kulisseCanvas = document.createElement('canvas');
    this.kulisseCanvas.width = 180;
    this.kulisseCanvas.height = 320;
    this.kulisseTex = new THREE.CanvasTexture(this.kulisseCanvas);
    const kulissePlatte = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 0.25),
      new THREE.MeshBasicMaterial({ map: this.kulisseTex })
    );
    kulissePlatte.rotation.x = -Math.PI / 2;
    kulissePlatte.position.set(-0.03, 0.824, -0.38);
    root.add(kulissePlatte);

    // Roter START/STOP-Engine-Knopf neben der Schaltkulisse
    const startKnopfRing = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16), chromMat);
    startKnopfRing.position.set(0.08, 0.81, -0.46);
    root.add(startKnopfRing);
    const startKnopf = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.017, 0.016, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.8 })
    );
    startKnopf.position.set(0.08, 0.812, -0.46);
    root.add(startKnopf);

    // Beweglicher 3D-Gangwahlhebel (gleitet physisch zwischen P, R, N, D, S!)
    this.gangHebelGroup = new THREE.Group();
    this.gangHebelGroup.position.set(-0.01, 0.82, -0.345); // Position für 'D'
    root.add(this.gangHebelGroup);

    // Ledermanschette / Schaltsack unten
    const manschette = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.05, 12), dunkelLederMat);
    manschette.position.set(0, 0.025, 0);
    this.gangHebelGroup.add(manschette);

    // Verchromter Schalthebel-Schaft
    const hebelSchaft = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.013, 0.12, 12), chromMat);
    hebelSchaft.position.set(0, 0.07, 0);
    this.gangHebelGroup.add(hebelSchaft);

    // Ergonomischer Automatik-Schaltknauf (T-Griff mit Leder, Alu-Spange & rotem Entriegelungsknopf)
    const knaufKopf = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.038, 0.048), dunkelLederMat);
    knaufKopf.position.set(0, 0.135, 0);
    this.gangHebelGroup.add(knaufKopf);

    const knaufAlu = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.041, 0.050), aluMat);
    knaufAlu.position.set(0, 0.135, 0);
    this.gangHebelGroup.add(knaufAlu);

    const knaufTaste = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 12), rotAkzentMat);
    knaufTaste.rotation.z = Math.PI / 2;
    knaufTaste.position.set(-0.04, 0.135, 0);
    this.gangHebelGroup.add(knaufTaste);

    // ========================================================================
    // 6. FUSSRAUM MIT ANIMIERTEM GAS- & BREMSPEDAL + FAHRERSITZ
    // ========================================================================
    // Bremspedal (links im Fußraum des Fahrers)
    this.bremsPedal = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.12, 0.018), aluMat);
    this.bremsPedal.position.set(-0.42, 0.52, -0.60);
    this.bremsPedal.rotation.x = THREE.MathUtils.degToRad(-28);
    root.add(this.bremsPedal);

    // Gaspedal (rechts im Fußraum des Fahrers)
    this.gasPedal = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.16, 0.018), aluMat);
    this.gasPedal.position.set(-0.27, 0.52, -0.61);
    this.gasPedal.rotation.x = THREE.MathUtils.degToRad(-28);
    root.add(this.gasPedal);

    // Sportsitze für Fahrer & Beifahrer
    [-0.38, 0.38].forEach(xSeat => {
      const sitzFlaeche = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.50), dunkelLederMat);
      sitzFlaeche.position.set(xSeat, 0.54, 0.15);
      root.add(sitzFlaeche);

      const lehne = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.10), dunkelLederMat);
      lehne.position.set(xSeat, 0.88, 0.38);
      lehne.rotation.x = THREE.MathUtils.degToRad(-10);
      root.add(lehne);
    });

    // ========================================================================
    // 7. 4 RÄDER (Vorderräder lenkbar + alle 4 drehend)
    // ========================================================================
    const reifenMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
    this.vorderRaederLenk = [];
    this.alleRaederDreh = [];

    const radPos = [
      { x: -0.92, z: -1.32, vorne: true },
      { x:  0.92, z: -1.32, vorne: true },
      { x: -0.92, z:  1.32, vorne: false },
      { x:  0.92, z:  1.32, vorne: false }
    ];

    radPos.forEach(rp => {
      const lenkPivot = new THREE.Group();
      lenkPivot.position.set(rp.x, 0.36, rp.z);
      root.add(lenkPivot);
      if (rp.vorne) this.vorderRaederLenk.push(lenkPivot);

      const drehGruppe = new THREE.Group();
      lenkPivot.add(drehGruppe);
      this.alleRaederDreh.push(drehGruppe);

      const reifen = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 20), reifenMat);
      reifen.rotation.z = Math.PI / 2;
      reifen.castShadow = true;
      drehGruppe.add(reifen);

      const felge = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 12), aluMat);
      felge.rotation.z = Math.PI / 2;
      drehGruppe.add(felge);

      // Speichenkreuz auf der Felge, damit man die Raddrehung von außen sieht
      const speiche = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.40, 0.05), chromMat);
      drehGruppe.add(speiche);
    });

    // ========================================================================
    // 8. KAMERA-ANKER FÜR DEN FAHRERSITZ (Taste [8])
    // Perfekte Ergonomie: Man sieht Lenkrad, Kombiinstrument, Gangwahlhebel,
    // Navi, Außenspiegel, Innenspiegel UND die Motorhaube auf der Straße!
    // ========================================================================
    const camAnchor = document.createElement('a-entity');
    camAnchor.classList.add('auto-cam-anchor');
    camAnchor.setAttribute('position', '-0.38 1.29 0.18');
    camAnchor.setAttribute('rotation', '-9 0 0');
    this.el.appendChild(camAnchor);
    this.camAnchorEl = camAnchor;
  },

  // Zeichnet das hochauflösende Kombiinstrument (Drehzahlmesser, Tacho, Gang & Blinker)
  zeichneKombiinstrument: function () {
    if (!this.kombiCanvas) return;
    const ctx = this.kombiCanvas.getContext('2d');
    const w = this.kombiCanvas.width;
    const h = this.kombiCanvas.height;

    // Dunkler Cockpit-Hintergrund
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Dezenter blauer Sport-Rahmen
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    const kmh = Math.round(Math.abs(this.geschwindigkeit) * 3.6);

    // --- 1. LINKS: DREHZAHLMESSER (0..7 x1000 RPM) ---
    const cxL = 110, cy = 118, r = 82;
    ctx.beginPath();
    ctx.arc(cxL, cy, r, 0.75 * Math.PI, 2.25 * Math.PI);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Roter Bereich ab 5.500 RPM
    ctx.beginPath();
    ctx.arc(cxL, cy, r, 1.92 * Math.PI, 2.25 * Math.PI);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 13px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 7; i++) {
      const ang = (0.75 + (i / 7) * 1.5) * Math.PI;
      const tx = cxL + Math.cos(ang) * (r - 22);
      const ty = cy + Math.sin(ang) * (r - 22) + 4;
      ctx.fillStyle = i >= 6 ? '#f87171' : '#e2e8f0';
      ctx.fillText(String(i), tx, ty);
    }
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    ctx.fillText('x1000 RPM', cxL, cy + 42);

    // Animierte RPM-Nadel
    const rpmFrac = Math.min(1, Math.max(0, this.rpm / 7000));
    const rpmAng = (0.75 + rpmFrac * 1.5) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cxL, cy);
    ctx.lineTo(cxL + Math.cos(rpmAng) * (r - 8), cy + Math.sin(rpmAng) * (r - 8));
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.stroke();

    // --- 2. MITTE: DIGITAL-TACHO & GROSSER GANGWAHL-INDIKATOR ---
    // Blinker-Pfeile oben
    ctx.font = 'bold 20px Segoe UI, sans-serif';
    ctx.fillStyle = this.lenkWinkel > 0.08 ? '#22c55e' : '#1e293b';
    ctx.fillText('◀', w / 2 - 48, 34);
    ctx.fillStyle = this.lenkWinkel < -0.08 ? '#22c55e' : '#1e293b';
    ctx.fillText('▶', w / 2 + 48, 34);

    // Digital km/h
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px Segoe UI, sans-serif';
    ctx.fillText(String(kmh), w / 2, 86);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px Segoe UI, sans-serif';
    ctx.fillText('km/h', w / 2, 106);

    // Aktueller Gang-Kasten (P / R / N / D1..D5 / S)
    ctx.fillStyle = this.gang === 'R' ? '#7f1d1d' : (this.gang === 'P' ? '#334155' : '#065f46');
    ctx.fillRect(w / 2 - 42, 122, 84, 46);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    ctx.strokeRect(w / 2 - 42, 122, 84, 46);

    const gangText = (this.gang === 'D' || this.gang === 'S') ? (this.gang + this.autoStufe) : this.gang;
    ctx.fillStyle = this.gang === 'R' ? '#fca5a5' : '#fde047';
    ctx.font = 'bold 30px Segoe UI, sans-serif';
    ctx.fillText(gangText, w / 2, 156);

    // --- 3. RECHTS: ANALOG-TACHO (0..160 km/h) ---
    const cxR = w - 110;
    ctx.beginPath();
    ctx.arc(cxR, cy, r, 0.75 * Math.PI, 2.25 * Math.PI);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.font = 'bold 11px Segoe UI, sans-serif';
    for (let v = 0; v <= 160; v += 20) {
      const ang = (0.75 + (v / 160) * 1.5) * Math.PI;
      const tx = cxR + Math.cos(ang) * (r - 22);
      const ty = cy + Math.sin(ang) * (r - 22) + 4;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(String(v), tx, ty);
    }
    ctx.fillStyle = '#64748b';
    ctx.fillText('TACHO', cxR, cy + 42);

    const vFrac = Math.min(1, kmh / 160);
    const vAng = (0.75 + vFrac * 1.5) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cxR, cy);
    ctx.lineTo(cxR + Math.cos(vAng) * (r - 8), cy + Math.sin(vAng) * (r - 8));
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.stroke();

    this.kombiTex.needsUpdate = true;
  },

  // Zeichnet die beleuchtete Schaltkulisse (P - R - N - D - S) auf der Mittelkonsole
  zeichneSchaltkulisse: function () {
    if (!this.kulisseCanvas) return;
    const ctx = this.kulisseCanvas.getContext('2d');
    const w = this.kulisseCanvas.width;
    const h = this.kulisseCanvas.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Schaltschacht-Schlitz links
    ctx.fillStyle = '#020617';
    ctx.fillRect(28, 24, 34, h - 48);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 24, 34, h - 48);

    const gaenge = ['P', 'R', 'N', 'D', 'S'];
    gaenge.forEach((g, idx) => {
      const y = 52 + idx * 54;
      const aktiv = this.gang === g;

      if (aktiv) {
        ctx.fillStyle = g === 'R' ? '#ef4444' : '#22c55e';
        ctx.fillRect(76, y - 22, 82, 36);
      }

      ctx.fillStyle = aktiv ? '#020617' : '#94a3b8';
      ctx.font = 'bold 26px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(g, 117, y + 6);

      // Leuchtpunkt neben dem Schaltschacht
      ctx.beginPath();
      ctx.arc(45, y - 3, 7, 0, Math.PI * 2);
      ctx.fillStyle = aktiv ? '#fde047' : '#1e293b';
      ctx.fill();
    });

    this.kulisseTex.needsUpdate = true;
  },

  // Zeichnet das 3D-Navi-Display in der Mittelkonsole
  zeichneNaviDisplay: function () {
    if (!this.naviCanvas) return;
    const ctx = this.naviCanvas.getContext('2d');
    const w = this.naviCanvas.width;
    const h = this.naviCanvas.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const pos = this.el.object3D.position;
    let ortName = '🌊 Ozean-Küstenstraße';
    if (pos.x < -50) {
      ortName = pos.z > 20 ? '🇩🇪 Ostsee-Hafen & Strand' : '🇩🇪 Deutschland – Straße am Fluss';
    } else if (pos.x > 50) {
      ortName = pos.z > 15 ? '🇺🇸 Grand Canyon Nationalpark' : '🇺🇸 New York City & Airport';
    }

    // Header
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, 40);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 17px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🛰️ GPS NAVI: ' + ortName, 12, 26);

    // Mini-Karte (Deutschland links, Ozean Mitte, USA rechts)
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(14, 50, w - 28, 115);
    // DE Land
    ctx.fillStyle = '#15803d';
    ctx.fillRect(22, 56, 105, 92);
    // US Land
    ctx.fillStyle = '#166534';
    ctx.fillRect(w - 127, 56, 105, 102);

    // Auto-Punkt auf dem Navi-Radar
    const mapX = THREE.MathUtils.clamp(((pos.x + 190) / 380) * (w - 40) + 20, 22, w - 22);
    const mapY = THREE.MathUtils.clamp(((pos.z + 85) / 170) * 105 + 54, 56, 158);
    ctx.beginPath();
    ctx.arc(mapX, mapY, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Statuszeile unten
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 14px Segoe UI, sans-serif';
    ctx.fillText(`Gang: ${this.gang}  |  Lenkung: ${Math.round(THREE.MathUtils.radToDeg(this.lenkWinkel))}°  |  ⬆️⬇️⬅️➡️ Pfeiltasten`, 14, 196);

    this.naviTex.needsUpdate = true;
  },

  tick: function (time, dt) {
    if (!dt) return;
    const deltaSec = Math.min(dt / 1000, 0.08);

    // ------------------------------------------------------------------------
    // 1. LENKUNG (Geschwindigkeitsabhängig + automatische Rückstellung / Caster)
    // ------------------------------------------------------------------------
    const speedAbs = Math.abs(this.geschwindigkeit);
    const maxLenk = Math.max(0.22, 0.58 - speedAbs * 0.008); // Bei hohem Tempo ruhigerer Geradeauslauf
    const lenkRate = 1.65; // rad/s beim Einlenken

    if (this.tasten.links) {
      this.lenkWinkel = Math.min(maxLenk, this.lenkWinkel + lenkRate * deltaSec);
    } else if (this.tasten.rechts) {
      this.lenkWinkel = Math.max(-maxLenk, this.lenkWinkel - lenkRate * deltaSec);
    } else {
      // Sanfte Selbstzentrierung des Lenkrads (schneller, wenn das Auto rollt)
      const rueckstellRate = (1.8 + speedAbs * 0.25) * deltaSec;
      if (Math.abs(this.lenkWinkel) <= rueckstellRate) {
        this.lenkWinkel = 0;
      } else {
        this.lenkWinkel -= Math.sign(this.lenkWinkel) * rueckstellRate;
      }
    }

    // ------------------------------------------------------------------------
    // 2. GASPEDAL, BREMSE & AUTOMATISCHE / MANUELLE GANGWAHL (P - R - N - D - S)
    // ------------------------------------------------------------------------
    this.gasStellung = 0;
    this.bremsStellung = 0;

    if (this.gang === 'P') {
      this.geschwindigkeit = 0;
      if (this.tasten.hoch) this.setzeGang('D');
      if (this.tasten.runter) this.setzeGang('R');
    } else if (this.gang === 'N') {
      // Im Leerlauf nur ausrollen
      this.geschwindigkeit *= Math.max(0, 1 - 1.5 * deltaSec);
      if (this.tasten.hoch && speedAbs < 0.5) this.setzeGang('D');
      if (this.tasten.runter && speedAbs < 0.5) this.setzeGang('R');
    } else if (this.gang === 'D' || this.gang === 'S') {
      const maxSpeed = this.gang === 'S' ? 42.0 : 32.0; // m/s (ca. 150 bzw. 115 km/h)
      const accel = this.gang === 'S' ? 14.5 : 10.5;

      if (this.tasten.hoch) {
        this.gasStellung = 1;
        this.geschwindigkeit = Math.min(maxSpeed, this.geschwindigkeit + accel * deltaSec);
        this.stillstandTimer = 0;
      } else if (this.tasten.runter) {
        this.bremsStellung = 1;
        if (this.geschwindigkeit > 0.25) {
          // Kräftig bremsen
          this.geschwindigkeit = Math.max(0, this.geschwindigkeit - 22.0 * deltaSec);
          this.stillstandTimer = 0;
        } else {
          // Im Stand kurz Pfeil-Runter halten -> Schaltet den Gangwahlhebel auf 'R'!
          this.geschwindigkeit = 0;
          this.stillstandTimer += deltaSec;
          if (this.stillstandTimer > 0.22) {
            this.setzeGang('R');
            this.stillstandTimer = 0;
          }
        }
      } else {
        // Motorbremse / Ausrollen
        const drag = 3.2 * deltaSec;
        if (this.geschwindigkeit > drag) this.geschwindigkeit -= drag;
        else this.geschwindigkeit = 0;
        this.stillstandTimer = 0;
      }
    } else if (this.gang === 'R') {
      const maxRev = -11.0; // ca. 40 km/h rückwärts
      if (this.tasten.runter) {
        // Pfeil runter im Rückwärtsgang = Rückwärts Gas geben!
        this.gasStellung = 1;
        this.geschwindigkeit = Math.max(maxRev, this.geschwindigkeit - 8.5 * deltaSec);
        this.stillstandTimer = 0;
      } else if (this.tasten.hoch) {
        // Pfeil hoch im Rückwärtsgang = Bremsen und im Stand zurück in 'D' schalten!
        this.bremsStellung = 1;
        if (this.geschwindigkeit < -0.25) {
          this.geschwindigkeit = Math.min(0, this.geschwindigkeit + 20.0 * deltaSec);
          this.stillstandTimer = 0;
        } else {
          this.geschwindigkeit = 0;
          this.stillstandTimer += deltaSec;
          if (this.stillstandTimer > 0.18) {
            this.setzeGang('D');
            this.stillstandTimer = 0;
          }
        }
      } else {
        const drag = 3.8 * deltaSec;
        if (this.geschwindigkeit < -drag) this.geschwindigkeit += drag;
        else this.geschwindigkeit = 0;
        this.stillstandTimer = 0;
      }
    }

    // ------------------------------------------------------------------------
    // 3. ACKERMANN-FAHRPHYSIK (Kein Drehen im Stand!)
    // ------------------------------------------------------------------------
    if (Math.abs(this.geschwindigkeit) > 0.01) {
      // Gierwinkel-Änderung dTheta = (v / Radstand) * tan(lenkWinkel) * dt
      const yawDelta = (this.geschwindigkeit / this.radstand) * Math.tan(this.lenkWinkel) * deltaSec;
      this.el.object3D.rotation.y += yawDelta;

      // Vorwärtsbewegung entlang lokaler -Z Achse
      const yaw = this.el.object3D.rotation.y;
      this.el.object3D.position.x -= Math.sin(yaw) * this.geschwindigkeit * deltaSec;
      this.el.object3D.position.z -= Math.cos(yaw) * this.geschwindigkeit * deltaSec;
    }

    // ------------------------------------------------------------------------
    // 4. ANIMATION VON 3D-LENKRAD, GANGWAHLHEBEL, PEDALEN, RÄDERN & TACHO
    // ------------------------------------------------------------------------
    // 4.1 3D-Lenkrad drehen (Übersetzung 1 : 11 -> bis +-360 Grad)
    if (this.lenkradDrehGruppe) {
      this.lenkradDrehGruppe.rotation.z = this.lenkWinkel * 11.0;
    }

    // 4.2 Vorderräder einschlagen & alle 4 Räder drehen
    this.vorderRaederLenk.forEach(pivot => {
      pivot.rotation.y = this.lenkWinkel;
    });
    const radDrehWinkel = -(this.geschwindigkeit * deltaSec) / 0.36;
    this.alleRaederDreh.forEach(rad => {
      rad.rotation.x += radDrehWinkel;
    });

    // 4.3 3D-Gangwahlhebel in der Schaltkulisse gleiten lassen
    if (this.gangHebelGroup) {
      const zielZMap = { 'P': -0.455, 'R': -0.420, 'N': -0.380, 'D': -0.342, 'S': -0.305 };
      const zielZ = zielZMap[this.gang] !== undefined ? zielZMap[this.gang] : -0.342;
      this.gangHebelGroup.position.z += (zielZ - this.gangHebelGroup.position.z) * Math.min(1, deltaSec * 16);
      this.gangHebelGroup.rotation.x = (zielZ + 0.38) * 1.8;
    }

    // 4.4 Gas- & Bremspedal im Fußraum kippen
    if (this.gasPedal) {
      this.gasPedal.rotation.x = THREE.MathUtils.degToRad(-28 - this.gasStellung * 18);
    }
    if (this.bremsPedal) {
      this.bremsPedal.rotation.x = THREE.MathUtils.degToRad(-28 - this.bremsStellung * 16);
    }

    // 4.5 Bremslichter & Rückfahrscheinwerfer
    if (this.bremsLichtMat) {
      this.bremsLichtMat.emissiveIntensity = this.bremsStellung > 0 ? 3.5 : 0.45;
    }
    if (this.rueckfahrLichtMat) {
      this.rueckfahrLichtMat.emissiveIntensity = this.gang === 'R' ? 2.5 : 0.0;
    }

    // 4.6 Automatik-Schaltstufen (D1..D5) & realistische Drehzahl (RPM) berechnen
    const kmh = Math.abs(this.geschwindigkeit) * 3.6;
    if (kmh < 18) this.autoStufe = 1;
    else if (kmh < 40) this.autoStufe = 2;
    else if (kmh < 68) this.autoStufe = 3;
    else if (kmh < 98) this.autoStufe = 4;
    else this.autoStufe = 5;

    const stufenBasis = [0, 18, 40, 68, 98, 155];
    const stufenSpanne = stufenBasis[this.autoStufe] - stufenBasis[this.autoStufe - 1];
    const inGearFrac = Math.max(0, (kmh - stufenBasis[this.autoStufe - 1]) / Math.max(10, stufenSpanne));
    const zielRpm = kmh < 0.5
      ? (850 + this.gasStellung * 2200)
      : (1400 + inGearFrac * (this.gang === 'S' ? 4800 : 3600) + this.gasStellung * 750);
    this.rpm += (zielRpm - this.rpm) * Math.min(1, deltaSec * 10);

    // Kombiinstrument & Navi NUR im Auto-Cockpit [8] und nur bei Wertänderung (max 15 Hz) auf die GPU laden!
    // Das verhindert teure CPU->GPU CanvasTexture-Stalls (glTexImage2D) in jedem Frame!
    if (window.EEP.aktiveKamera === 8) {
      const kmhInt = Math.round(kmh);
      const rpmStep = Math.round(this.rpm / 80);
      const blinkState = this.lenkWinkel > 0.08 ? 1 : (this.lenkWinkel < -0.08 ? -1 : 0);
      const kombiKey = `${kmhInt}_${this.gang}_${this.autoStufe}_${rpmStep}_${blinkState}`;
      if (this._lastKombiKey !== kombiKey && (!this._lastKombiTime || time - this._lastKombiTime > 55)) {
        this._lastKombiKey = kombiKey;
        this._lastKombiTime = time;
        this.zeichneKombiinstrument();
      }
      if (!this._lastNaviUpdate || time - this._lastNaviUpdate > 350) {
        this._lastNaviUpdate = time;
        this.zeichneNaviDisplay();
        if (window.EEP.aktualisiereAutoHUD) window.EEP.aktualisiereAutoHUD();
      }
    }

    // ------------------------------------------------------------------------
    // 5. ZERO-LAG KAMERA-SYNC (Verhindert jegliches Cockpit-Zittern!)
    // ------------------------------------------------------------------------
    if (window.EEP.aktiveKamera === 8 && this.camAnchorEl) {
      this.el.object3D.updateMatrixWorld(true);
      const rig = document.querySelector('#kamera-rig');
      const cam = document.querySelector('#haupt-kamera');
      if (rig) {
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        this.camAnchorEl.object3D.getWorldPosition(worldPos);
        this.camAnchorEl.object3D.getWorldQuaternion(worldQuat);
        rig.object3D.position.copy(worldPos);
        rig.object3D.quaternion.copy(worldQuat);
      }
      if (cam) {
        // Sicherstellen, dass wasd-controls niemals die Kamera im Auto verschiebt!
        cam.object3D.position.set(0, 0, 0);
      }
    }
  }
});

AFRAME.registerComponent('ki-steuerung', {
  init: function () {
    this.kameraRig = document.querySelector('#kamera-rig');
    this.hauptKamera = document.querySelector('#haupt-kamera');
    this.umwelt = document.querySelector('#umwelt');

    // Tastatur-Steuerung ([1] DE, [2] Ludmilla, [3] US-Zug, [4] USA/NY, [5] Flugzeug, [6] Schiff, [7] Vogelperspektive, [8] Auto-Cockpit)
    window.addEventListener('keydown', (e) => {
      if (e.key === '1') this.setzeKamera(1);
      if (e.key === '2') this.setzeKamera(2);
      if (e.key === '3') this.setzeKamera(3);
      if (e.key === '4') this.setzeKamera(4);
      if (e.key === '5') this.setzeKamera(5);
      if (e.key === '6') this.setzeKamera(6);
      if (e.key === '7') this.setzeKamera(7);
      if (e.key === '8') this.setzeKamera(8);
      if (e.key.toLowerCase() === 'l') this.wechselWetter();
      if (e.key.toLowerCase() === 'h' || e.key === ' ') {
        if (window.EEP.aktiveKamera === 8) {
          window.EEP.autoHupe();
          e.preventDefault();
        } else {
          window.EEP.dampfPfeife();
        }
      }
    });

    this.baueSteuerpultUI();
    this.aktiviereHardwareBeschleunigung();
    window.EEP.updateUI = () => this.aktualisiereZugRegler();
    setTimeout(() => {
      this.aktualisiereZugRegler();
      if (window.location.search.includes('autotest=1')) {
        this.starteAutoSelbsttest();
      }
      const camMatch = window.location.search.match(/cam=(\d)/);
      if (camMatch) {
        this.setzeKamera(Number(camMatch[1]));
      }
    }, 300);
  },

  aktiviereHardwareBeschleunigung: function () {
    this._frameCount = 0;
    this._fpsFrames = 0;
    this._fpsLastTime = performance.now();

    const applyRendererOpts = () => {
      const renderer = this.el.renderer;
      if (!renderer) return;

      // 1. Optimales HiDPI-PixelRatio für hohe FPS bei gestochen scharfer Kantenglättung
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

      // 2. Shadow-Map-Caching auf der GPU: Statische 100.000-Polygon-Berge müssen nicht mit 144 Hz
      // in die Schattenkarte neu gerendert werden -> Schatten-Update jeden 3. Frame spart 66% Vertex-Last!
      if (renderer.shadowMap) {
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.needsUpdate = true;
      }

      // 3. Aktive Grafikkarte (Nvidia dGPU) aus WebGL2 auslesen und im Cockpit anzeigen
      try {
        const gl = renderer.getContext();
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        const gpuName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        const shortGpu = String(gpuName).replace(/ANGLE \(([^,]+),\s*([^(\n]+).*\)/i, '$2').trim();
        window.EEP.gpuInfo = shortGpu;
        console.log('GPU_HARDWARE_INFO:', gpuName);
        const gpuEl = document.getElementById('eep-gpu-badge');
        if (gpuEl) gpuEl.title = 'Aktive Hardwarebeschleunigung: ' + gpuName;
      } catch (e) {}
    };

    if (this.el.hasLoaded) applyRendererOpts();
    else this.el.addEventListener('renderstart', applyRendererOpts);
  },

  starteAutoSelbsttest: function () {
    this.setzeKamera(8);
    const ac = window.EEP.autoComp;
    if (!ac) {
      console.error('AUTO_TEST_FAILED: ki-auto nicht gefunden');
      return;
    }

    // Test 1: Im Stand lenken -> Lenkrad dreht sich, aber Auto dreht sich NICHT auf der Stelle!
    const startYaw = ac.el.object3D.rotation.y;
    ac.geschwindigkeit = 0;
    ac.tasten.links = true;
    ac.tick(100, 200);
    const standYawDiff = Math.abs(ac.el.object3D.rotation.y - startYaw);
    const lenkradRotStand = ac.lenkradDrehGruppe.rotation.z;

    // Test 2: Gangwahlhebel-Positionen testen (R -> D)
    ac.setzeGang('R');
    ac.tick(200, 100);
    const hebelZ_R = ac.gangHebelGroup.position.z;
    ac.setzeGang('D');
    ac.tick(300, 100);
    const hebelZ_D = ac.gangHebelGroup.position.z;

    // Test 3: Beschleunigen auf der deutschen Straße + leichtes Einlenken für das Live-Cockpit-Foto
    const startPos = ac.el.object3D.position.clone();
    ac.tasten.hoch = true;
    ac.tasten.links = true;
    for (let i = 0; i < 18; i++) {
      ac.tick(400 + i * 50, 50);
      if (i === 5) ac.tasten.links = false; // Nur leicht in die Straßenkurve einlenken
      if (i === 14) ac.tasten.rechts = true; // Leichtes Gegenlenken für dynamische Lenkradstellung
    }
    const gefahreneDistanz = ac.el.object3D.position.distanceTo(startPos);
    const kmh = Math.round(ac.geschwindigkeit * 3.6);

    console.log('AUTO_TEST_RESULT:', JSON.stringify({
      kameraModus: window.EEP.aktiveKamera,
      keinDrehenImStand: standYawDiff < 0.0001,
      lenkradDreht: Math.abs(lenkradRotStand) > 0.5,
      schalthebelBewegtSich: Math.abs(hebelZ_D - hebelZ_R) > 0.01,
      gefahreneMeter: Number(gefahreneDistanz.toFixed(2)),
      tachoKmh: kmh,
      drehzahlRpm: Math.round(ac.rpm),
      gangAnzeige: ac.gang + ac.autoStufe
    }));
  },

  setzeKamera: function (modus) {
    window.EEP.aktiveKamera = modus;
    document.querySelectorAll('.eep-cam-btn').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.cam) === modus);
    });

    // Im Auto-Cockpit [8] das Hauptsteuerpult nach oben andocken, damit Lenkrad & Gangwahlhebel unten 100% frei sichtbar sind!
    const cockpitUI = document.getElementById('eep-cockpit');
    const autoHUD = document.getElementById('eep-auto-hud');
    if (cockpitUI) {
      cockpitUI.classList.toggle('auto-modus-oben', modus === 8);
    }
    if (autoHUD) {
      autoHUD.style.display = modus === 8 ? 'flex' : 'none';
    }

    if (modus === 1) {
      // Panorama-Blick Deutschland (bei Mein Haus mit Blick auf Ludmilla, Bahnhof, Fluss & Ostsee)
      if (this.hauptKamera) {
        this.hauptKamera.setAttribute('wasd-controls', 'enabled: true; acceleration: 35; fly: false');
      }
      this.kameraRig.object3D.position.set(-94, 7.5, -50);
      this.kameraRig.object3D.rotation.set(THREE.MathUtils.degToRad(-10), THREE.MathUtils.degToRad(142), 0);
    } else if (modus === 4) {
      // Panorama-Blick Amerika (bei New York / Mein Haus mit Blick auf US-Bahn & Grand Canyon)
      if (this.hauptKamera) {
        this.hauptKamera.setAttribute('wasd-controls', 'enabled: true; acceleration: 35; fly: false');
      }
      this.kameraRig.object3D.position.set(146, 8.5, -34);
      this.kameraRig.object3D.rotation.set(THREE.MathUtils.degToRad(-10), THREE.MathUtils.degToRad(152), 0);
    } else if (modus === 7) {
      // Freie Vogelperspektive über dem Ozean (Übersicht über alle 3 Blätter!)
      if (this.hauptKamera) {
        this.hauptKamera.setAttribute('wasd-controls', 'enabled: true; acceleration: 85; fly: true');
      }
      this.kameraRig.object3D.position.set(0, 75, 95);
      this.kameraRig.object3D.rotation.set(THREE.MathUtils.degToRad(-35), 0, 0);
    } else {
      // Zug-/Flugzeug-/Schiffs-/Auto-Cockpit: WASD deaktivieren & Kamera-Offset/Blickwinkel zentrieren!
      if (this.hauptKamera) {
        this.hauptKamera.setAttribute('wasd-controls', 'enabled: false');
        this.hauptKamera.object3D.position.set(0, 0, 0);
        this.hauptKamera.object3D.rotation.set(0, 0, 0);
        const lookCtrl = this.hauptKamera.components['look-controls'];
        if (lookCtrl) {
          if (lookCtrl.pitchObject) lookCtrl.pitchObject.rotation.x = 0;
          if (lookCtrl.yawObject) lookCtrl.yawObject.rotation.y = 0;
        }
      }
    }
  },

  wechselWetter: function (zielIndex) {
    const presets = [
      {
        name: '☀️ Tag (Sonne)',
        sky: '#38bdf8',
        fog: '#bae6fd',
        ambientColor: '#fff8e1',
        ambientInt: 0.9,
        sunColor: '#ffe0b2',
        sunInt: 2.2
      },
      {
        name: '🌅 Abendrot',
        sky: '#fb7185',
        fog: '#fdba74',
        ambientColor: '#fed7aa',
        ambientInt: 0.55,
        sunColor: '#f97316',
        sunInt: 1.6
      },
      {
        name: '🌙 Sternennacht',
        sky: '#090d16',
        fog: '#0f172a',
        ambientColor: '#38bdf8',
        ambientInt: 0.22,
        sunColor: '#64748b',
        sunInt: 0.35
      },
      {
        name: '🌌 Neon-Nacht',
        sky: '#1e1b4b',
        fog: '#311042',
        ambientColor: '#c084fc',
        ambientInt: 0.4,
        sunColor: '#38bdf8',
        sunInt: 0.8
      },
      {
        name: '❄️ Winter-Nebel',
        sky: '#cbd5e1',
        fog: '#e2e8f0',
        ambientColor: '#f8fafc',
        ambientInt: 1.0,
        sunColor: '#ffffff',
        sunInt: 1.5
      }
    ];

    if (typeof zielIndex === 'number') {
      window.EEP.wetterIndex = zielIndex;
    } else {
      window.EEP.wetterIndex = (window.EEP.wetterIndex + 1) % presets.length;
    }

    const p = presets[window.EEP.wetterIndex];
    const himmel = document.getElementById('himmel');
    if (himmel) himmel.setAttribute('color', p.sky);

    this.el.setAttribute('fog', `type: exponential; color: ${p.fog}; density: 0.0022`);

    const amb = document.getElementById('licht-ambient');
    if (amb) amb.setAttribute('light', `type: ambient; color: ${p.ambientColor}; intensity: ${p.ambientInt}`);

    const sun = document.getElementById('licht-sonne');
    if (sun) sun.setAttribute('light', `type: directional; color: ${p.sunColor}; intensity: ${p.sunInt}; castShadow: true; shadowCameraTop: 180; shadowCameraBottom: -180; shadowCameraLeft: -220; shadowCameraRight: 220`);

    const wetterBtn = document.getElementById('eep-wetter-btn');
    if (wetterBtn) {
      wetterBtn.textContent = `${p.name} [L]`;
    }
  },

  tick: function () {
    // Hardware-Shadow-Map alle 3 Frames aktualisieren (spart 66% Shadow-Pass-Last bei voller Polygonanzahl!)
    this._frameCount = (this._frameCount || 0) + 1;
    if (this._frameCount % 3 === 0 && this.el.renderer && this.el.renderer.shadowMap) {
      this.el.renderer.shadowMap.needsUpdate = true;
    }

    // Live-FPS-Anzeige aktualisieren
    this._fpsFrames = (this._fpsFrames || 0) + 1;
    const now = performance.now();
    if (now - (this._fpsLastTime || 0) >= 500) {
      const fps = Math.round((this._fpsFrames * 1000) / (now - this._fpsLastTime));
      this._fpsFrames = 0;
      this._fpsLastTime = now;
      const badge = document.getElementById('eep-gpu-badge');
      if (badge) {
        const gpuShort = (window.EEP.gpuInfo || 'GPU').replace(/Intel\(R\) HD Graphics/i, 'Intel HD').replace(/NVIDIA GeForce/i, 'NVIDIA').substring(0, 18);
        badge.textContent = `⚡ ${fps} FPS | ${gpuShort}`;
        badge.style.color = fps >= 50 ? '#4ade80' : (fps >= 30 ? '#fde047' : '#f87171');
      }
    }

    const modus = window.EEP.aktiveKamera;
    if (modus === 1 || modus === 4 || modus === 7 || modus === 8) return; // Modus 8 wird für Zero-Lag direkt in ki-auto.tick() synchronisiert!

    let targetSelector = null;
    if (modus === 2) targetSelector = '.ludmilla-cam-anchor, .dampflok-cam-anchor';
    if (modus === 3) targetSelector = '.ice-cam-anchor';
    if (modus === 5) targetSelector = '.flugzeug-cam-anchor';
    if (modus === 6) targetSelector = '.schiff-cam-anchor';

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
        transition: top 0.2s ease, bottom 0.2s ease;
      }
      #eep-cockpit.auto-modus-oben {
        bottom: auto;
        top: 8px;
        padding: 6px 12px;
        background: rgba(15, 23, 42, 0.85);
        transform: translateX(-50%) scale(0.88);
        transform-origin: top center;
      }
      #eep-cockpit.auto-modus-oben .eep-section:nth-child(2) {
        display: none;
      }
      #eep-auto-hud {
        position: fixed;
        bottom: 14px;
        left: 14px;
        z-index: 9999;
        background: rgba(15, 23, 42, 0.90);
        border: 2px solid rgba(56, 189, 248, 0.45);
        border-radius: 14px;
        padding: 9px 13px;
        color: #fff;
        font-family: 'Segoe UI', system-ui, sans-serif;
        display: none;
        flex-direction: column;
        gap: 7px;
        box-shadow: 0 10px 28px rgba(0,0,0,0.65);
        transform: scale(0.92);
        transform-origin: bottom left;
      }
      .eep-gear-btn {
        background: #1e293b;
        color: #94a3b8;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 7px;
        padding: 6px 11px;
        font-size: 15px;
        font-weight: 800;
        cursor: pointer;
      }
      .eep-gear-btn.active {
        background: #16a34a;
        color: #fff;
        border-color: #86efac;
        box-shadow: 0 0 10px rgba(34, 197, 94, 0.7);
      }
      .eep-gear-btn.active-r {
        background: #dc2626;
        color: #fff;
        border-color: #fca5a5;
        box-shadow: 0 0 10px rgba(220, 38, 38, 0.7);
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
        <div class="eep-title">🎥 Weltreise & Cockpits</div>
        <div class="eep-btn-row">
          <button class="eep-btn eep-cam-btn active" data-cam="1">🇩🇪 Deutschland [1]</button>
          <button class="eep-btn eep-cam-btn" data-cam="2">🚂 Ludmilla DE [2]</button>
          <button class="eep-btn eep-cam-btn" data-cam="3">🚄 US-Train [3]</button>
          <button class="eep-btn eep-cam-btn" data-cam="4">🇺🇸 Amerika / NY [4]</button>
          <button class="eep-btn eep-cam-btn" data-cam="5">✈️ Flugzeug [5]</button>
          <button class="eep-btn eep-cam-btn" data-cam="6">🚢 Mein Schiff [6]</button>
          <button class="eep-btn eep-cam-btn" data-cam="7">🦅 Übersicht [7]</button>
          <button class="eep-btn eep-cam-btn" data-cam="8" style="border-color:#f87171;">🚗 Auto-Cockpit [8]</button>
        </div>
      </div>

      <div class="eep-section">
        <div class="eep-title">🎛️ Fahrregler & Schubhebel</div>
        <div id="eep-zug-liste" class="eep-btn-row"></div>
      </div>

      <div class="eep-section">
        <div class="eep-title">🔊 Sound, Wetter & GPU</div>
        <div class="eep-btn-row" style="align-items:center;">
          <button class="eep-btn sound-btn" id="eep-pfeife-btn">🚂 Pfeife [H]</button>
          <button class="eep-btn sound-btn" id="eep-horn-btn">🚄 ICE-Horn</button>
          <button class="eep-btn" id="eep-wetter-btn">☀️ Tag (Wald) [L]</button>
          <span id="eep-gpu-badge" style="font-size:12px; font-weight:800; padding:6px 10px; border-radius:8px; background:rgba(0,0,0,0.45); border:1px solid rgba(74,222,128,0.4); color:#4ade80;">⚡ GPU Aktiv</span>
        </div>
      </div>
    `;
    document.body.appendChild(ui);

    // Interaktives Auto-Gangwahl- & Teleport-Panel unten rechts (nur in Kamera [8] sichtbar)
    const autoHud = document.createElement('div');
    autoHud.id = 'eep-auto-hud';
    autoHud.innerHTML = `
      <div class="eep-title">🕹️ Gangwahlhebel [G] & Pfeiltasten (⬆️ Gas | ⬇️ Bremse/R | ⬅️➡️ Lenken)</div>
      <div class="eep-btn-row" id="eep-gear-row">
        <button class="eep-gear-btn" data-gear="P">P</button>
        <button class="eep-gear-btn" data-gear="R">R</button>
        <button class="eep-gear-btn" data-gear="N">N</button>
        <button class="eep-gear-btn active" data-gear="D">D</button>
        <button class="eep-gear-btn" data-gear="S">S (Sport)</button>
        <button class="eep-btn sound-btn" id="eep-auto-hupe-btn" style="margin-left:6px;">📣 Hupe [H]</button>
      </div>
      <div class="eep-title" style="margin-top:2px;">📍 Auto umsetzen (Schnellreise)</div>
      <div class="eep-btn-row">
        <button class="eep-btn eep-car-tp" data-tp="-93,0.28,-51,138">🇩🇪 Mein Haus DE</button>
        <button class="eep-btn eep-car-tp" data-tp="-96,0.28,38,85">🇩🇪 Hafen Ostsee</button>
        <button class="eep-btn eep-car-tp" data-tp="143,0.28,-33,155">🇺🇸 New York</button>
        <button class="eep-btn eep-car-tp" data-tp="96,0.28,48,180">🇺🇸 Grand Canyon</button>
      </div>
    `;
    document.body.appendChild(autoHud);

    autoHud.querySelectorAll('.eep-gear-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.EEP.autoComp) window.EEP.autoComp.setzeGang(btn.dataset.gear);
      });
    });

    document.getElementById('eep-auto-hupe-btn').addEventListener('click', () => window.EEP.autoHupe());

    autoHud.querySelectorAll('.eep-car-tp').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!window.EEP.autoComp) return;
        const p = btn.dataset.tp.split(',').map(Number);
        window.EEP.autoComp.teleportiereZu(p[0], p[1], p[2], p[3]);
      });
    });

    window.EEP.aktualisiereAutoHUD = () => {
      if (!window.EEP.autoComp) return;
      const g = window.EEP.autoComp.gang;
      autoHud.querySelectorAll('.eep-gear-btn').forEach(b => {
        b.classList.remove('active', 'active-r');
        if (b.dataset.gear === g) {
          b.classList.add(g === 'R' ? 'active-r' : 'active');
        }
      });
    };

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

    // 1. ZUG-REGLER
    window.EEP.zuege.forEach((zugComp, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'eep-train-ctrl';

      const name = zugComp.data.name || ("Zug " + (i + 1));
      const startSpeed = zugComp.aktuellesTempo;

      wrap.innerHTML =
        '<label>' + name + '</label>' +
        '<input type="range" min="-20" max="25" step="0.5" value="' + startSpeed + '">' +
        '<span class="eep-speed-val">' + startSpeed.toFixed(1) + '</span>' +
        '<button class="eep-btn" style="padding:3px 7px; font-size:11px;" title="Notbremse / Stopp">Stopp</button>';

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

    // 2. FLUGZEUG-SCHUBHEBEL
    if (window.EEP.flugzeugComp) {
      const fc = window.EEP.flugzeugComp;
      const wrap = document.createElement('div');
      wrap.className = 'eep-train-ctrl';
      wrap.style.background = 'rgba(2, 136, 209, 0.25)';
      wrap.style.border = '1px solid rgba(2, 136, 209, 0.5)';
      wrap.innerHTML =
        '<label>✈️ Schubhebel</label>' +
        '<input type="range" min="0" max="3" step="0.1" value="' + fc.schub + '">' +
        '<span class="eep-speed-val">' + (fc.schub * 100).toFixed(0) + '%</span>' +
        '<button class="eep-btn" style="padding:3px 7px; font-size:11px;" title="Triebwerke aus">Stopp</button>';
      const slider = wrap.querySelector('input');
      const valSpan = wrap.querySelector('.eep-speed-val');
      const stopBtn = wrap.querySelector('button');

      slider.addEventListener('input', () => {
        fc.schub = parseFloat(slider.value);
        valSpan.textContent = (fc.schub * 100).toFixed(0) + '%';
      });
      stopBtn.addEventListener('click', () => {
        fc.schub = 0;
        slider.value = 0;
        valSpan.textContent = '0%';
      });
      container.appendChild(wrap);
    }

    // 3. FÄHRE-SCHIFFSMOTOR
    if (window.EEP.faehreComp) {
      const sh = window.EEP.faehreComp;
      const wrap = document.createElement('div');
      wrap.className = 'eep-train-ctrl';
      wrap.style.background = 'rgba(0, 150, 136, 0.25)';
      wrap.style.border = '1px solid rgba(0, 150, 136, 0.5)';
      wrap.innerHTML =
        '<label>🚢 Schiffsmotor</label>' +
        '<input type="range" min="0" max="2.5" step="0.1" value="' + sh.tempo + '">' +
        '<span class="eep-speed-val">' + (sh.tempo * 100).toFixed(0) + '%</span>' +
        '<button class="eep-btn" style="padding:3px 7px; font-size:11px;" title="Schiffsmotor stopp">Stopp</button>';
      const slider = wrap.querySelector('input');
      const valSpan = wrap.querySelector('.eep-speed-val');
      const stopBtn = wrap.querySelector('button');

      slider.addEventListener('input', () => {
        sh.tempo = parseFloat(slider.value);
        valSpan.textContent = (sh.tempo * 100).toFixed(0) + '%';
      });
      stopBtn.addEventListener('click', () => {
        sh.tempo = 0;
        slider.value = 0;
        valSpan.textContent = '0%';
      });
      container.appendChild(wrap);
    }
  }
});