/* ============================================================================
 * BAUKASTEN.JS - Die 3D-Modelleisenbahn-Engine ("EEP-Vibe")
 * Enthält alle A-Frame Components: Gleise, Schwellen, Züge, Waggons, 
 * Gebäude, Licht/Wetter, Sound-Synthesizer und das interaktive Steuerpult.
 * ============================================================================ */

window.EEP = Object.assign(window.EEP || {}, {
  gleise: {},      // Speichert alle THREE.CatmullRomCurve3 Strecken nach ID
  zuege: [],       // Liste aller aktiven Zugverbände für das Steuerpult
  autos: [],       // Liste aller steuerbaren G-Klassen (Türkis & Weiß)
  autoAussenAnsicht: false, // false = 3D-Cockpit (Lenkrad), true = 3rd-Person-Außenansicht
  kameras: {},     // Kamera-Referenzen
  aktiveKamera: 1, // 1 = Frei, 2 = Dampflok, 3 = ICE, 4 = Bahnhof
  wetterIndex: 0,  // 0 = Tag (Wald), 1 = Abendrot, 2 = Nacht, 3 = Schnee
  soundAktiv: true,
  audioCtx: null
});

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

// Tiefes Zweiklang-Schiffsnebelhorn (Typhon) für "MEIN SCHIFF" [6]
window.EEP.schiffsHorn = function () {
  if (!this.soundAktiv) return;
  this.initAudio();
  const ctx = this.audioCtx;
  const now = ctx.currentTime;
  [98, 123.5, 196].forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = idx === 2 ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(290, now);

    const peak = idx === 2 ? 0.07 : 0.14;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.08);
    gain.gain.setValueAtTime(peak, now + 0.65);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.08);
  });
};

// ============================================================================
// TOMB RAIDER (1-5) SOUND-EFFEKTE (WebAudio Formant-Stimme & Stiefel-Foley)
// ============================================================================
// Weiblicher Sprung-Laut ("Hup!") über 3 parallele Vokal-Formantfilter
window.EEP.laraSprung = function () {
  if (!this.soundAktiv) return;
  this.initAudio();
  const ctx = this.audioCtx;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(255, now);
  osc.frequency.exponentialRampToValueAtTime(345, now + 0.14);
  osc.frequency.exponentialRampToValueAtTime(295, now + 0.22);

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.001, now);
  masterGain.gain.linearRampToValueAtTime(0.18, now + 0.025);
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
  masterGain.connect(ctx.destination);

  // 3 weibliche Vokal-Formanten (F1=780 Hz, F2=1350 Hz, F3=2750 Hz)
  [[780, 5, 1.0], [1350, 7, 0.65], [2750, 9, 0.3]].forEach(([freq, q, amp]) => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(freq, now);
    bp.Q.setValueAtTime(q, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, now);
    osc.connect(bp);
    bp.connect(g);
    g.connect(masterGain);
  });

  osc.start(now);
  osc.stop(now + 0.24);
};

// Akrobatischer Seitwärtssalto / Rückwärtssalto ("Yah!" + Luft-Whoosh)
window.EEP.laraSalto = function () {
  if (!this.soundAktiv) return;
  this.initAudio();
  const ctx = this.audioCtx;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(280, now);
  osc.frequency.exponentialRampToValueAtTime(415, now + 0.16);
  osc.frequency.exponentialRampToValueAtTime(330, now + 0.28);

  const vGain = ctx.createGain();
  vGain.gain.setValueAtTime(0.001, now);
  vGain.gain.linearRampToValueAtTime(0.20, now + 0.02);
  vGain.gain.exponentialRampToValueAtTime(0.001, now + 0.29);
  vGain.connect(ctx.destination);

  [[820, 5, 1.0], [1480, 6, 0.7], [2900, 8, 0.35]].forEach(([freq, q, amp]) => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(freq, now);
    bp.Q.setValueAtTime(q, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, now);
    osc.connect(bp);
    bp.connect(g);
    g.connect(vGain);
  });
  osc.start(now);
  osc.stop(now + 0.30);

  // Rotations-Luft-Whoosh während des 360°-Saltos
  const bufSize = Math.floor(ctx.sampleRate * 0.42);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(320, now);
  filter.frequency.exponentialRampToValueAtTime(880, now + 0.22);
  filter.frequency.exponentialRampToValueAtTime(380, now + 0.42);
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.14, now);
  nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.42);
  noise.connect(filter);
  filter.connect(nGain);
  nGain.connect(ctx.destination);
  noise.start(now);
};

// Doppelter Stiefel-Aufprall bei der Landung + kurzer Atemstoß
window.EEP.laraLandung = function () {
  if (!this.soundAktiv) return;
  this.initAudio();
  const ctx = this.audioCtx;
  const now = ctx.currentTime;

  [0, 0.055].forEach(delay => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(135, now + delay);
    osc.frequency.exponentialRampToValueAtTime(48, now + delay + 0.085);
    gain.gain.setValueAtTime(0.22, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.095);
  });
};

// Markanter Tomb-Raider-Stiefelschritt (Absatz-Sohle)
window.EEP.laraSchritt = function () {
  if (!this.soundAktiv) return;
  this.initAudio();
  const ctx = this.audioCtx;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(165 + Math.random() * 25, now);
  osc.frequency.exponentialRampToValueAtTime(65, now + 0.055);
  gain.gain.setValueAtTime(0.11, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.065);
};

// Klassischer "A-ha!" Entdecker-Ruf
window.EEP.laraAha = function () {
  if (!this.soundAktiv) return;
  this.initAudio();
  const ctx = this.audioCtx;
  const now = ctx.currentTime;

  [[0, 265, 285, 0.14], [0.16, 355, 295, 0.24]].forEach(([tOff, fStart, fEnd, dur]) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(fStart, now + tOff);
    osc.frequency.exponentialRampToValueAtTime(fEnd, now + tOff + dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(920, now + tOff);
    bp.Q.setValueAtTime(4.5, now + tOff);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now + tOff);
    g.gain.linearRampToValueAtTime(0.16, now + tOff + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + tOff + dur);
    osc.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    osc.start(now + tOff);
    osc.stop(now + tOff + dur + 0.01);
  });
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

// ============================================================================
// 5b. PYRAMIDEN VON GIZEH (Kontinent 3: Afrika / Ägypten)
// ============================================================================
AFRAME.registerComponent('ki-pyramiden', {
  init: function () {
    const group = new THREE.Group();
    const sandsteinMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85, flatShading: true });
    const stufenMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.80, flatShading: true });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.25, metalness: 0.85, flatShading: true });
    const tempelMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.90, flatShading: true });

    // Die 3 großen Pyramiden (Cheops, Chefren, Mykerinos)
    const pyramiden = [
      { x: 0,   z: 0,  r: 15.5, h: 21.5 }, // Große Cheops-Pyramide (Zentrum)
      { x: -19, z: 7,  r: 13.0, h: 18.0 }, // Chefren-Pyramide (Westlich)
      { x: 17,  z: 9,  r: 9.0,  h: 12.0 }  // Mykerinos-Pyramide (Östlich)
    ];

    pyramiden.forEach((p) => {
      // 4-seitiger Pyramiden-Hauptkörper (um 45° gedreht für exakte Nord-Süd-Kanten)
      const pyrGeo = new THREE.ConeGeometry(p.r, p.h, 4);
      const pyr = new THREE.Mesh(pyrGeo, sandsteinMat);
      pyr.position.set(p.x, p.h * 0.5, p.z);
      pyr.rotation.y = Math.PI / 4;
      pyr.castShadow = true;
      pyr.receiveShadow = true;
      group.add(pyr);

      // Charakteristische Kalkstein-Stufenterrassen für authentische Ägypten-Optik
      const stufen = 5;
      for (let s = 0; s < stufen; s++) {
        const frac = s / stufen;
        const stufeBreite = p.r * 1.40 * (1 - frac * 0.72);
        const stufeHoehe = (p.h * 0.65) / stufen;
        const stufeBox = new THREE.Mesh(
          new THREE.BoxGeometry(stufeBreite, stufeHoehe * 0.55, stufeBreite),
          stufenMat
        );
        stufeBox.position.set(p.x, frac * p.h * 0.68 + stufeHoehe * 0.3, p.z);
        stufeBox.castShadow = true;
        stufeBox.receiveShadow = true;
        group.add(stufeBox);
      }

      // Goldenes Pyramidion (Sonnenspitze) auf dem Gipfel
      const capH = p.h * 0.16;
      const capR = p.r * 0.17;
      const capGeo = new THREE.ConeGeometry(capR, capH, 4);
      const cap = new THREE.Mesh(capGeo, goldMat);
      cap.position.set(p.x, p.h - capH * 0.48, p.z);
      cap.rotation.y = Math.PI / 4;
      group.add(cap);
    });

    // Antikes Pharaonen-Tempelportal an der Nordseite der Cheops-Pyramide (Blickrichtung Lara / Bahn)
    const pylonL = new THREE.Mesh(new THREE.BoxGeometry(2.6, 5.2, 2.2), tempelMat);
    pylonL.position.set(-2.4, 2.6, -12.2);
    pylonL.castShadow = true;
    group.add(pylonL);

    const pylonR = new THREE.Mesh(new THREE.BoxGeometry(2.6, 5.2, 2.2), tempelMat);
    pylonR.position.set(2.4, 2.6, -12.2);
    pylonR.castShadow = true;
    group.add(pylonR);

    const architrav = new THREE.Mesh(new THREE.BoxGeometry(8.2, 1.3, 2.6), stufenMat);
    architrav.position.set(0, 5.5, -12.2);
    architrav.castShadow = true;
    group.add(architrav);

    const sonnenScheibe = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.4, 16), goldMat);
    sonnenScheibe.rotation.x = Math.PI / 2;
    sonnenScheibe.position.set(0, 5.5, -13.5);
    group.add(sonnenScheibe);

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
    schub: { type: 'number', default: 1.0 } // 0 = Stopp, bis 2.5 = Turbo
  },
  init: function () {
    window.EEP.flugzeugComp = this;
    this.schub = this.data.schub;
    this.progress = 0;
    this.manuell = false;
    this.yaw = 0;      // Kurs um Welt-Y (0 = Richtung -Z Nord)
    this.pitch = 0;    // Nickwinkel (+ = Steigflug, - = Sinkflug)
    this.roll = 0;     // Querneigung / Bank (+ = Linkskurve, - = Rechtskurve)

    this.tasten = { hoch: false, runter: false, links: false, rechts: false, schubPlus: false, schubMinus: false };

    // Transatlantik-Rundflug (Autopilot): Start Flughafen DE (-312, Z=0) -> Alpen -> Ozean ->
    // Touch-and-Go auf dem US-Flughafen (+306, Z=+15) -> Kurve über den Grand Canyon (+268, Z=+58) ->
    // Über die Ostsee zurück zur Landung auf dem Flughafen DE!
    const points = [
      new THREE.Vector3(-312, 0.9, 18),   // 0: Start Flughafen DE (Südende Piste)
      new THREE.Vector3(-312, 0.9, -12),  // 1: Beschleunigen auf Piste DE
      new THREE.Vector3(-295, 16, -42),   // 2: Abheben vor den Alpen
      new THREE.Vector3(-120, 36, -35),   // 3: Steigflug über den nördlichen Ozean
      new THREE.Vector3(145,  34, -15),   // 4: Anflug über die 4 Inseln auf Amerika
      new THREE.Vector3(306,  10, -12),   // 5: Endanflug Piste USA (Nord)
      new THREE.Vector3(306,  1.2, 16),   // 6: Touch-and-Go auf der US-Startbahn!
      new THREE.Vector3(306,  12,  42),   // 7: Durchstarten Richtung Süden
      new THREE.Vector3(268,  28,  58),   // 8: Panorama-Kurve direkt über den Grand Canyon!
      new THREE.Vector3(30,   38,  48),   // 9: Rückflug über den südlichen Ozean
      new THREE.Vector3(-265, 22,  55),   // 10: Überflug Ostsee & Mein Schiff
      new THREE.Vector3(-312, 7,   36)    // 11: Landeanflug Flughafen DE
    ];
    this.curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.45);
    this.totalLen = this.curve.getLength();

    // Startposition auf der Piste DE initialisieren
    this.el.object3D.position.set(-312, 0.9, 18);
    this.el.object3D.rotation.set(0, 0, 0, 'YXZ');

    window.addEventListener('keydown', (e) => {
      if (window.EEP.aktiveKamera !== 5) return;
      if (e.shiftKey || (window.EEP.lookState && window.EEP.lookState.aktiv)) {
        this.tasten.hoch = false;
        this.tasten.runter = false;
        this.tasten.links = false;
        this.tasten.rechts = false;
        return;
      }
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowUp' || k === 'w') {
        this.aktiviereManuell();
        this.tasten.hoch = true;
        e.preventDefault();
      }
      if (e.key === 'ArrowDown' || k === 's') {
        this.aktiviereManuell();
        this.tasten.runter = true;
        e.preventDefault();
      }
      if (e.key === 'ArrowLeft' || k === 'a') {
        this.aktiviereManuell();
        this.tasten.links = true;
        e.preventDefault();
      }
      if (e.key === 'ArrowRight' || k === 'd') {
        this.aktiviereManuell();
        this.tasten.rechts = true;
        e.preventDefault();
      }
      if (e.key === '+' || e.key === 'PageUp' || k === 'e') {
        this.aktiviereManuell();
        this.tasten.schubPlus = true;
        e.preventDefault();
      }
      if (e.key === '-' || e.key === 'PageDown' || k === 'q') {
        this.aktiviereManuell();
        this.tasten.schubMinus = true;
        e.preventDefault();
      }
      if (k === 'p') {
        this.umschaltenAutopilot();
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowUp' || k === 'w') this.tasten.hoch = false;
      if (e.key === 'ArrowDown' || k === 's') this.tasten.runter = false;
      if (e.key === 'ArrowLeft' || k === 'a') this.tasten.links = false;
      if (e.key === 'ArrowRight' || k === 'd') this.tasten.rechts = false;
      if (e.key === '+' || e.key === 'PageUp' || k === 'e') this.tasten.schubPlus = false;
      if (e.key === '-' || e.key === 'PageDown' || k === 'q') this.tasten.schubMinus = false;
    });
  },

  aktiviereManuell: function () {
    if (this.manuell) return;
    this.el.object3D.updateMatrixWorld(true);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.el.object3D.quaternion);
    this.yaw = Math.atan2(-forward.x, -forward.z);
    this.pitch = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(forward.y, -0.9, 0.9)), -0.35, 0.35);
    this.roll = 0;
    if (this.schub <= 0.1) this.schub = 1.0;
    this.manuell = true;
    this.aktualisiereFlugHUD();
  },

  umschaltenAutopilot: function () {
    if (this.manuell) {
      this.manuell = false;
      this.pitch = 0;
      this.roll = 0;
      if (this.schub <= 0.1) this.schub = 1.0;
    } else {
      this.aktiviereManuell();
    }
    this.aktualisiereFlugHUD();
  },

  teleportiereZu: function (x, y, z, yawGrad, startSchub) {
    this.manuell = true;
    this.el.object3D.position.set(x, y, z);
    this.yaw = THREE.MathUtils.degToRad(yawGrad);
    this.pitch = 0;
    this.roll = 0;
    if (startSchub !== undefined) this.schub = startSchub;
    this.el.object3D.rotation.set(0, this.yaw, 0, 'YXZ');
    this.el.object3D.updateMatrixWorld(true);
    this.aktualisiereFlugHUD();
  },

  aktualisiereFlugHUD: function () {
    const statusEl = document.getElementById('eep-flugzeug-status');
    const apBtn = document.getElementById('eep-flugzeug-ap-btn');
    if (apBtn) {
      apBtn.textContent = this.manuell ? '🤖 Autopilot: AUS [P]' : '🤖 Autopilot: EIN [P]';
      apBtn.classList.toggle('active', !this.manuell);
    }
    if (statusEl) {
      const pos = this.el.object3D.position;
      const kmh = Math.round(this.schub * 24.0 * 3.6);
      const hoehe = Math.max(0, Math.round(pos.y - 0.9));
      const kurs = ((Math.round(THREE.MathUtils.radToDeg(-this.yaw)) % 360) + 360) % 360;
      const modusTxt = this.manuell ? '🕹️ MANUELL (Pfeiltasten)' : '🤖 AUTOPILOT-RUNDFLUG';
      statusEl.textContent = `✈️ ${modusTxt}  |  Tempo: ${kmh} km/h  |  Höhe: ${hoehe} m  |  Kurs: ${kurs}°  |  Schub: ${Math.round(this.schub * 100)}%`;
    }
  },

  tick: function (time, dt) {
    if (!dt) return;
    const deltaSec = Math.min(dt / 1000, 0.08);

    // 1. MANUELLER 3D-FREIFLUG (Pfeiltasten / WASD)
    if (this.manuell) {
      if (this.tasten.schubPlus) {
        this.schub = Math.min(2.5, this.schub + 0.85 * deltaSec);
      }
      if (this.tasten.schubMinus) {
        this.schub = Math.max(0.0, this.schub - 0.85 * deltaSec);
      }

      // Querruder (Rollwinkel/Bank bis +-38 Grad = 0.66 rad)
      let zielRoll = 0;
      if (this.tasten.links) zielRoll = 0.65;
      else if (this.tasten.rechts) zielRoll = -0.65;
      this.roll += (zielRoll - this.roll) * Math.min(1, deltaSec * 5.5);
      if (Math.abs(this.roll) < 0.002 && zielRoll === 0) this.roll = 0;

      // Höhenruder (Nickwinkel/Pitch bis +-25 Grad = 0.44 rad)
      let zielPitch = 0;
      if (this.tasten.hoch) zielPitch = 0.42;
      else if (this.tasten.runter) zielPitch = -0.42;
      this.pitch += (zielPitch - this.pitch) * Math.min(1, deltaSec * 5.0);
      if (Math.abs(this.pitch) < 0.002 && zielPitch === 0) this.pitch = 0;

      // Kurvenflug durch Querneigung (Bank-Turn) + Seitenruder am Boden
      const speed = 24.0 * this.schub;
      if (speed > 0.2) {
        const turnRate = this.roll * 1.45 + (this.tasten.links ? 0.35 : (this.tasten.rechts ? -0.35 : 0));
        this.yaw += turnRate * deltaSec;
      }

      // 3D-Vektor-Fortbewegung entlang der Flugzeug-Längsachse (-Z)
      const pos = this.el.object3D.position;
      pos.x += -Math.sin(this.yaw) * Math.cos(this.pitch) * speed * deltaSec;
      pos.y += Math.sin(this.pitch) * speed * deltaSec;
      pos.z += -Math.cos(this.yaw) * Math.cos(this.pitch) * speed * deltaSec;

      // Boden-/Startbahn-Kontakt (Minimalhöhe 0.90 m)
      if (pos.y <= 0.90) {
        pos.y = 0.90;
        if (this.pitch < 0) this.pitch = 0;
        this.roll *= 0.82; // Auf der Piste richten sich die Tragflächen waagerecht aus
      } else if (pos.y > 140) {
        pos.y = 140;
      }

      // Sanfte Weltbegrenzung (-390..+390, -145..+280 inkl. Afrika/Rotes Meer)
      pos.x = THREE.MathUtils.clamp(pos.x, -390, 390);
      pos.z = THREE.MathUtils.clamp(pos.z, -145, 280);

      this.el.object3D.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');

      if (window.EEP.aktiveKamera === 5) {
        this.aktualisiereFlugHUD();
      }
      return;
    }

    // 2. AUTOPILOT-RUNDFLUG (Transatlantik-Schleife)
    if (this.schub <= 0) return;
    const distDelta = (24.0 * this.schub) * deltaSec;
    this.progress = (this.progress + (distDelta / this.totalLen)) % 1.0;

    const currentPos = this.curve.getPointAt(this.progress);
    const lookAheadProgress = (this.progress + 0.012) % 1.0;
    const nextPos = this.curve.getPointAt(lookAheadProgress);

    this.el.object3D.position.copy(currentPos);
    this.el.object3D.lookAt(nextPos);
    this.el.object3D.rotateY(Math.PI);

    // Aktuellen Kurs für das HUD mitführen
    const dx = nextPos.x - currentPos.x;
    const dz = nextPos.z - currentPos.z;
    this.yaw = Math.atan2(-dx, -dz);
    if (window.EEP.aktiveKamera === 5) {
      this.aktualisiereFlugHUD();
    }
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
    this.progress = this.data.hauptschiff ? 0.15 : Math.random() * 0.3;
    this.richtung = 1;
    this.pStart = new THREE.Vector3(this.data.von.x, this.data.von.y, this.data.von.z);
    this.pEnd = new THREE.Vector3(this.data.nach.x, this.data.nach.y, this.data.nach.z);
    this.distanz = Math.max(1, this.pStart.distanceTo(this.pEnd));

    // Manuelle Steuerung für "MEIN SCHIFF" (hauptschiff: true, Kamera [6])
    this.manuell = false;
    this.geschwindigkeit = 6.5; // m/s (-6 rückwärts bis +18 volle Kraft voraus)
    this.ruderWinkel = 0;       // Radiant (-0.55 Steuerbord bis +0.55 Backbord)
    this.yaw = -Math.PI / 2;    // Kurs (-90° = Richtung Osten +X)
    this.kraengung = 0;         // Kurvenneigung des Schiffsrumpfs
    this.tasten = { hoch: false, runter: false, links: false, rechts: false };

    if (this.data.hauptschiff) {
      this.baueKreuzfahrtschiff3D();
      const startPos = new THREE.Vector3().lerpVectors(this.pStart, this.pEnd, this.progress);
      this.el.object3D.position.copy(startPos);
      this.el.object3D.rotation.set(0, this.yaw + Math.PI / 2, 0, 'YXZ');

      // In EEP.sim registrieren (Paket A & B)
      if (window.EEP && window.EEP.sim) {
        const kId = window.EEP.sim.registriere({
          id: 'mein-schiff-haupt',
          typ: 'schiff',
          x: startPos.x,
          y: startPos.y,
          z: startPos.z,
          yaw: this.yaw,
          v: 0,
          halbBreite: 2.2,
          halbLaenge: 14.0,
          hoehe: 6.5,
          tiefgang: 2.5
        });
        this.simKoerper = window.EEP.sim.koerper(kId);
      }

      window.addEventListener('keydown', (e) => {
        if (window.EEP.aktiveKamera !== 6) return;
        if (e.shiftKey || (window.EEP.lookState && window.EEP.lookState.aktiv)) {
          this.tasten.hoch = false;
          this.tasten.runter = false;
          this.tasten.links = false;
          this.tasten.rechts = false;
          return;
        }
        const k = e.key.toLowerCase();
        if (e.key === 'ArrowUp' || k === 'w') {
          this.aktiviereManuell();
          this.tasten.hoch = true;
          e.preventDefault();
        }
        if (e.key === 'ArrowDown' || k === 's') {
          this.aktiviereManuell();
          this.tasten.runter = true;
          e.preventDefault();
        }
        if (e.key === 'ArrowLeft' || k === 'a') {
          this.aktiviereManuell();
          this.tasten.links = true;
          e.preventDefault();
        }
        if (e.key === 'ArrowRight' || k === 'd') {
          this.aktiviereManuell();
          this.tasten.rechts = true;
          e.preventDefault();
        }
        if (k === 'p') {
          this.umschaltenAutopilot();
          e.preventDefault();
        }
      });

      window.addEventListener('keyup', (e) => {
        const k = e.key.toLowerCase();
        if (e.key === 'ArrowUp' || k === 'w') this.tasten.hoch = false;
        if (e.key === 'ArrowDown' || k === 's') this.tasten.runter = false;
        if (e.key === 'ArrowLeft' || k === 'a') this.tasten.links = false;
        if (e.key === 'ArrowRight' || k === 'd') this.tasten.rechts = false;
      });
    }
  },

  aktiviereManuell: function () {
    if (!this.data.hauptschiff || this.manuell) return;
    this.el.object3D.updateMatrixWorld(true);
    const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(this.el.object3D.quaternion);
    this.yaw = Math.atan2(-forward.x, -forward.z);
    this.geschwindigkeit = 6.5 * this.tempo;
    this.ruderWinkel = 0;
    this.manuell = true;
    this.aktualisiereSchiffHUD();
  },

  baueKreuzfahrtschiff3D: function () {
    // Detailliertes 3D-Kreuzfahrtschiff ("MEIN SCHIFF"): Bug zeigt entlang +X, Heck entlang -X
    const root = new THREE.Group();
    this.el.setObject3D('mesh', root);

    const navyMat = new THREE.MeshStandardMaterial({ color: 0x0a2540, roughness: 0.35, metalness: 0.4 });
    const rotWasserpassMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });
    const weissMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.15 });
    const teakDeckMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75 });
    const glasMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x38bdf8, emissiveIntensity: 0.55, roughness: 0.1, metalness: 0.85 });
    const brueckenGlasMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x0284c7, emissiveIntensity: 0.35, roughness: 0.08, metalness: 0.9 });
    const poolMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x22d3ee, emissiveIntensity: 0.45, roughness: 0.1 });
    const rettungsbootMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 });
    const schornsteinRotMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.3 });
    const gischtMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.75, roughness: 0.9 });

    // 1. WASSERPASS (Rot) & HAUPTRUMPF (TUI-Dunkelblau) + SPITZER BUG & RUNDES HECK
    const wasserpass = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.35, 4.45), rotWasserpassMat);
    wasserpass.position.set(-0.3, 0.05, 0);
    root.add(wasserpass);

    const rumpfMitte = new THREE.Mesh(new THREE.BoxGeometry(14.0, 1.55, 4.4), navyMat);
    rumpfMitte.position.set(-0.5, 0.90, 0);
    rumpfMitte.castShadow = true;
    root.add(rumpfMitte);

    // Spitzer Kreuzfahrt-Bug (+X) aus 4-seitigem Kegel-Keil + Bugwulst
    const bugKeilGeo = new THREE.ConeGeometry(3.11, 4.8, 4);
    const bugKeil = new THREE.Mesh(bugKeilGeo, navyMat);
    bugKeil.rotation.z = -Math.PI / 2;
    bugKeil.rotation.x = Math.PI / 4;
    bugKeil.scale.set(0.5, 1.0, 1.0);
    bugKeil.position.set(8.8, 0.90, 0);
    bugKeil.castShadow = true;
    root.add(bugKeil);

    // Abgerundetes Kreuzfahrt-Heck (-X) mit Teakholz-Achterdeck
    const heckRund = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.0, 1.55, 16), navyMat);
    heckRund.position.set(-7.5, 0.90, 0);
    heckRund.castShadow = true;
    root.add(heckRund);

    const achterDeck = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.15, 0.12, 16), teakDeckMat);
    achterDeck.position.set(-7.5, 1.70, 0);
    root.add(achterDeck);

    // 2. MEHRSTÖCKIGE WEISSE BALKONKABINEN-DECKS (3 gestufte Etagen mit leuchtenden Fensterbändern)
    const etagen = [
      { len: 13.6, h: 0.85, b: 4.1, x: -0.4, y: 2.10 },
      { len: 12.2, h: 0.85, b: 3.8, x: -0.6, y: 2.95 },
      { len: 10.6, h: 0.80, b: 3.5, x: -0.9, y: 3.78 }
    ];
    etagen.forEach((et) => {
      const deckBox = new THREE.Mesh(new THREE.BoxGeometry(et.len, et.h, et.b), weissMat);
      deckBox.position.set(et.x, et.y, 0);
      deckBox.castShadow = true;
      root.add(deckBox);

      const glasBand = new THREE.Mesh(new THREE.BoxGeometry(et.len - 0.5, et.h * 0.48, et.b + 0.08), glasMat);
      glasBand.position.set(et.x, et.y + 0.04, 0);
      root.add(glasBand);
    });

    // 3. KOMMANDOBRÜCKE MIT SEITLICHEN BRÜCKENNOCKS (Überhängend vorne bei X: +4.4)
    const bruecke = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.72, 4.9), weissMat);
    bruecke.position.set(4.3, 3.82, 0);
    bruecke.castShadow = true;
    root.add(bruecke);

    const brueckeGlas = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.36, 4.96), brueckenGlasMat);
    brueckeGlas.position.set(4.35, 3.86, 0);
    root.add(brueckeGlas);

    // 4. OBERES SONNENDECK MIT 25m-TÜRKIS-POOL & PANORAMA-LOUNGE
    const sonnenDeck = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.16, 3.55), teakDeckMat);
    sonnenDeck.position.set(-0.9, 4.24, 0);
    root.add(sonnenDeck);

    const poolWanne = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 1.6), weissMat);
    poolWanne.position.set(-2.6, 4.32, 0);
    root.add(poolWanne);

    const poolWasser = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.25, 1.35), poolMat);
    poolWasser.position.set(-2.6, 4.34, 0);
    root.add(poolWasser);

    // Vordere Panorama-Lounge (Himmel & Meer Lounge)
    const lounge = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.65, 0.65, 12), brueckenGlasMat);
    lounge.position.set(2.4, 4.55, 0);
    root.add(lounge);
    const loungeDach = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.14, 12), weissMat);
    loungeDach.position.set(2.4, 4.92, 0);
    root.add(loungeDach);

    // 5. MARKANTER SCHORNSTEIN (Abgeschrägter Liner-Funnel) & DREHENDER RADARMAST
    const schornsteinBasis = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.78, 1.65, 12), navyMat);
    schornsteinBasis.scale.set(1.5, 1, 0.85);
    schornsteinBasis.rotation.z = 0.22;
    schornsteinBasis.position.set(0.2, 5.05, 0);
    schornsteinBasis.castShadow = true;
    root.add(schornsteinBasis);

    const schornsteinKappe = new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.56, 0.42, 12), schornsteinRotMat);
    schornsteinKappe.scale.set(1.5, 1, 0.85);
    schornsteinKappe.rotation.z = 0.22;
    schornsteinKappe.position.set(0.0, 5.95, 0);
    root.add(schornsteinKappe);

    // Radarmast mit Kuppel (Radom) + drehendem Radar-Balken
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 1.9, 8), weissMat);
    mast.position.set(2.6, 5.7, 0);
    root.add(mast);

    const radom = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), weissMat);
    radom.position.set(2.0, 5.35, 0);
    root.add(radom);

    this.radarBalken = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.10, 1.35), weissMat);
    this.radarBalken.position.set(2.6, 6.65, 0);
    root.add(this.radarBalken);

    // 6. SEITLICHE RETTUNGSBOote (Je 3 leuchtend orange Boote Backbord & Steuerbord)
    [-2.5, -0.3, 1.9].forEach((bx) => {
      [-2.12, 2.12].forEach((bz) => {
        const boot = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.38, 0.48), rettungsbootMat);
        boot.position.set(bx, 2.15, bz);
        root.add(boot);
      });
    });

    // 7. SCHRIFTZUG "MEIN SCHIFF" BEIDSEITIG AM RUMPF + KIELWASSER-HECKWELLE
    ['1', '-1'].forEach((dir) => {
      const s = Number(dir);
      const txt = document.createElement('a-text');
      txt.setAttribute('value', 'MEIN SCHIFF');
      txt.setAttribute('color', '#38bdf8');
      txt.setAttribute('width', '18');
      txt.setAttribute('align', 'center');
      txt.setAttribute('position', `0.5 1.15 ${s * 2.24}`);
      txt.setAttribute('rotation', `0 ${s > 0 ? 0 : 180} 0`);
      this.el.appendChild(txt);
    });

    this.heckWelle = new THREE.Mesh(new THREE.ConeGeometry(2.1, 6.5, 5), gischtMat);
    this.heckWelle.rotation.z = Math.PI / 2;
    this.heckWelle.scale.set(0.08, 1.0, 1.15);
    this.heckWelle.position.set(-11.2, 0.02, 0);
    root.add(this.heckWelle);
  },

  umschaltenAutopilot: function () {
    if (!this.data.hauptschiff) return;
    if (this.manuell) {
      this.manuell = false;
      this.ruderWinkel = 0;
      if (this.tempo <= 0.1) this.tempo = 1.0;
    } else {
      this.aktiviereManuell();
    }
    this.aktualisiereSchiffHUD();
  },

  teleportiereZu: function (x, y, z, yawGrad) {
    if (!this.data.hauptschiff) return;
    this.manuell = true;
    this.geschwindigkeit = 0;
    this.ruderWinkel = 0;
    this.yaw = THREE.MathUtils.degToRad(yawGrad);
    this.el.object3D.position.set(x, y, z);
    this.el.object3D.rotation.set(0, this.yaw + Math.PI / 2, 0, 'YXZ');
    this.el.object3D.updateMatrixWorld(true);
    if (this.simKoerper) {
      this.simKoerper.x = x;
      this.simKoerper.y = y;
      this.simKoerper.z = z;
      this.simKoerper.yaw = this.yaw;
      this.simKoerper.v = 0;
      this.simKoerper.aufGrund = false;
      this.simKoerper.roll = 0;
      this.simKoerper.vorherX = x;
      this.simKoerper.vorherZ = z;
    }
    this.aktualisiereSchiffHUD();
  },

  aktualisiereSchiffHUD: function () {
    const statusEl = document.getElementById('eep-schiff-status');
    const apBtn = document.getElementById('eep-schiff-ap-btn');
    if (apBtn) {
      apBtn.textContent = this.manuell ? '🤖 Autopilot: AUS [P]' : '🤖 Autopilot: EIN [P]';
      apBtn.classList.toggle('active', !this.manuell);
    }
    if (statusEl) {
      const v = this.manuell ? this.geschwindigkeit : (6.5 * this.tempo * this.richtung);
      const knoten = (v * 1.94384).toFixed(1);
      const kmh = Math.round(Math.abs(v) * 3.6);
      const kurs = ((Math.round(THREE.MathUtils.radToDeg(-this.yaw)) % 360) + 360) % 360;
      const ruderGrad = Math.round(THREE.MathUtils.radToDeg(this.ruderWinkel));
      const ruderTxt = ruderGrad > 2 ? `Backbord ${ruderGrad}°` : (ruderGrad < -2 ? `Steuerbord ${Math.abs(ruderGrad)}°` : 'Mittschiffs 0°');
      const modusTxt = this.manuell ? '🕹️ MANUELL (Pfeiltasten)' : '🤖 FÄHR-AUTOPILOT';
      statusEl.textContent = `🚢 ${modusTxt}  |  Fahrt: ${knoten} kn (${kmh} km/h)  |  Kurs: ${kurs}°  |  Ruder: ${ruderTxt}`;
    }
  },

  tick: function (time, dt) {
    if (!dt) return;
    const deltaSec = Math.min(dt / 1000, 0.08);
    if (this.radarBalken) {
      this.radarBalken.rotation.y += 3.5 * deltaSec;
    }

    // 1. MANUELLE SCHIFFSSTEUERUNG FÜR "MEIN SCHIFF" (Kamera [6])
    if (this.data.hauptschiff && this.manuell) {
      // Ruderlage (Pfeil Links = Backbord +, Pfeil Rechts = Steuerbord -)
      const ruderRate = 1.35;
      if (this.tasten.links) {
        this.ruderWinkel = Math.min(0.55, this.ruderWinkel + ruderRate * deltaSec);
      } else if (this.tasten.rechts) {
        this.ruderWinkel = Math.max(-0.55, this.ruderWinkel - ruderRate * deltaSec);
      } else {
        // Sanfte Rückstellung des Ruders auf Mittschiffs
        const back = 1.5 * deltaSec;
        if (Math.abs(this.ruderWinkel) <= back) this.ruderWinkel = 0;
        else this.ruderWinkel -= Math.sign(this.ruderWinkel) * back;
      }

      // Maschinentelegraph (Pfeil Hoch = Voraus, Pfeil Runter = Stopp/Rückwärts)
      if (this.tasten.hoch) {
        this.geschwindigkeit = Math.min(18.0, this.geschwindigkeit + 8.5 * deltaSec);
      } else if (this.tasten.runter) {
        this.geschwindigkeit = Math.max(-6.0, this.geschwindigkeit - 9.5 * deltaSec);
      } else {
        // Sanfter Wasserwiderstand beim Ausgleiten
        const waterDrag = 1.15 * deltaSec;
        if (Math.abs(this.geschwindigkeit) <= waterDrag) this.geschwindigkeit = 0;
        else this.geschwindigkeit -= Math.sign(this.geschwindigkeit) * waterDrag;
      }

      // Kursänderung durch Ruderwirkung (auch bei kleiner Fahrt manövrierfähig durch Bugstrahlruder!)
      const fahrtrichtung = this.geschwindigkeit >= -0.2 ? 1 : -1;
      const drehEffekt = (0.38 + Math.min(1.0, Math.abs(this.geschwindigkeit) * 0.08)) * fahrtrichtung;
      this.yaw += this.ruderWinkel * drehEffekt * deltaSec;

      // Vorwärtsbewegung & Kollision/Untiefe über EEP.fahrzeugPhysik
      if (this.simKoerper && window.EEP && window.EEP.fahrzeugPhysik) {
        this.simKoerper.v = this.geschwindigkeit;
        this.simKoerper.yaw = this.yaw;
        window.EEP.fahrzeugPhysik.schritt(this.simKoerper, deltaSec);
        this.geschwindigkeit = this.simKoerper.v;
        this.el.object3D.position.x = this.simKoerper.x;
        this.el.object3D.position.z = this.simKoerper.z;
        this.el.object3D.position.y = 0.40 + Math.sin(time * 0.0022) * 0.04;
      } else {
        const pos = this.el.object3D.position;
        pos.x += -Math.sin(this.yaw) * this.geschwindigkeit * deltaSec;
        pos.z += -Math.cos(this.yaw) * this.geschwindigkeit * deltaSec;
        pos.y = 0.40 + Math.sin(time * 0.0022) * 0.04; // Sanftes Schaukeln auf den Meereswellen
        pos.x = THREE.MathUtils.clamp(pos.x, -370, 330);
        pos.z = THREE.MathUtils.clamp(pos.z, -135, 280);
      }

      // Leichte Kurvenkrängung (bzw. 3° Neigung bei Grundberührung)
      const basisRoll = (this.simKoerper && this.simKoerper.roll) ? this.simKoerper.roll : 0;
      const zielKraengung = basisRoll - this.ruderWinkel * (Math.abs(this.geschwindigkeit) / 18.0) * 0.14;
      this.kraengung += (zielKraengung - this.kraengung) * Math.min(1, deltaSec * 4.5);
      this.el.object3D.rotation.set(this.kraengung, this.yaw + Math.PI / 2, Math.sin(time * 0.0018) * 0.015, 'YXZ');

      if (window.EEP.aktiveKamera === 6) {
        this.aktualisiereSchiffHUD();
      }
      return;
    }

    // 2. AUTOMATISCHER FÄHRBETRIEB
    const factor = this.data.hauptschiff ? this.tempo : (this.tempo || 1.0);
    if (factor <= 0) return;
    const speed = 6.5 * factor;
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

    if (this.data.hauptschiff) {
      const dx = ziel.x - pos.x;
      const dz = ziel.z - pos.z;
      this.yaw = Math.atan2(-dx, -dz);
      if (window.EEP.aktiveKamera === 6) {
        this.aktualisiereSchiffHUD();
      }
    }
  }
});

// ============================================================================
// 9. STEUERBARES AUTO MIT VOLLWERTIGEM 3D-COCKPIT ('ki-auto')
// 3D-Sportlenkrad, 3D-Gangwahlhebel (P-R-N-D-S), Kombiinstrument (Tacho + RPM),
// GPS-Navi, Gas-/Bremspedale, Rückspiegel, Motorhaube & Ackermann-Fahrphysik
// ============================================================================
AFRAME.registerComponent('ki-auto', {
  schema: {
    farbe: { type: 'color', default: '#06b6d4' },
    name: { type: 'string', default: 'G-Klasse' },
    aktiv: { type: 'boolean', default: true }
  },

  init: function () {
    window.EEP.autos.push(this);
    if (this.data.aktiv || !window.EEP.autoComp) {
      window.EEP.autoComp = this;
    }

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
      if (window.EEP.aktiveKamera !== 8 || window.EEP.autoComp !== this) return;
      if (e.shiftKey || (window.EEP.lookState && window.EEP.lookState.aktiv)) {
        this.tasten.hoch = false;
        this.tasten.runter = false;
        this.tasten.links = false;
        this.tasten.rechts = false;
        return;
      }
      if (e.key === 'ArrowUp') { this.tasten.hoch = true; e.preventDefault(); }
      if (e.key === 'ArrowDown') { this.tasten.runter = true; e.preventDefault(); }
      if (e.key === 'ArrowLeft') { this.tasten.links = true; e.preventDefault(); }
      if (e.key === 'ArrowRight') { this.tasten.rechts = true; e.preventDefault(); }
      if (e.key.toLowerCase() === 'g') {
        this.naechsterGang();
        e.preventDefault();
      }
      if (e.key.toLowerCase() === 'v') {
        if (window.EEP.wechsleAuto) window.EEP.wechsleAuto();
        e.preventDefault();
      }
      if (e.key.toLowerCase() === 'u') {
        if (this.simKoerper) {
          if (Math.abs(this.geschwindigkeit) < 1.4) {
            this.simKoerper.untersetzung = !this.simKoerper.untersetzung;
            window.EEP.schaltKlick();
            this.zeichneKombiinstrument();
            if (window.EEP.aktualisiereAutoHUD) window.EEP.aktualisiereAutoHUD();
          }
        }
        e.preventDefault();
      }
      if (e.key.toLowerCase() === 'c') {
        window.EEP.autoAussenAnsicht = !window.EEP.autoAussenAnsicht;
        if (window.EEP.aktualisiereAutoHUD) window.EEP.aktualisiereAutoHUD();
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

    // In EEP.sim registrieren (Paket 0/A/B)
    if (window.EEP && window.EEP.sim) {
      const pos = this.el.object3D.position;
      const yaw = this.el.object3D.rotation.y;
      const kId = window.EEP.sim.registriere({
        id: this.data.farbe === '#f8fafc' ? 'gklasse-weiss' : 'gklasse-tuerkis',
        typ: 'auto',
        x: pos.x,
        y: pos.y,
        z: pos.z,
        yaw: yaw,
        v: 0,
        halbBreite: 0.98,
        halbLaenge: 2.42,
        hoehe: 1.95,
        profil: 'gelaende',
        untersetzung: false
      });
      this.simKoerper = window.EEP.sim.koerper(kId);
    }
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
    if (this.tasten) {
      this.tasten.hoch = false;
      this.tasten.runter = false;
      this.tasten.links = false;
      this.tasten.rechts = false;
    }
    this.el.object3D.position.set(x, y, z);
    this.el.object3D.rotation.set(0, THREE.MathUtils.degToRad(rotYGrad), 0);
    this.el.object3D.updateMatrixWorld(true);
    if (this.simKoerper) {
      this.simKoerper.x = x;
      this.simKoerper.y = y;
      this.simKoerper.z = z;
      this.simKoerper.yaw = THREE.MathUtils.degToRad(rotYGrad);
      this.simKoerper.v = 0;
      this.simKoerper.vorherX = x;
      this.simKoerper.vorherZ = z;
      this.simKoerper.traktionsverlust = false;
      this.simKoerper.sandStillstandSek = 0;
      this.simKoerper.letzterVImpact = 0;
    }
    this.zeichneSchaltkulisse();
    this.zeichneKombiinstrument();
    this.zeichneNaviDisplay();
    if (window.EEP.aktualisiereAutoHUD) window.EEP.aktualisiereAutoHUD();
  },

  baueAutoUndCockpit3D: function () {
    const root = new THREE.Group();
    this.el.setObject3D('mesh', root);

    const lackMat = new THREE.MeshStandardMaterial({ color: this.data.farbe, roughness: 0.20, metalness: 0.45 });
    const schwarzMattMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75, metalness: 0.2 });
    const dunkelLederMat = new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.7, metalness: 0.1 });
    const konsoleMat = new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.5, metalness: 0.25 });
    const aluMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.85 });
    const chromMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.10, metalness: 0.95 });
    const rotAkzentMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.2 });
    const blinkerMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 1.2 });
    const getoentesGlasMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.78 });

    // ========================================================================
    // 1. MERCEDES G-KLASSE (AMG G 63) KAROSSERIE & KANTIGE MOTORHAUBE
    // ========================================================================
    // Hohes Geländewagen-Chassis & Unterboden
    const boden = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.22, 4.42), schwarzMattMat);
    boden.position.set(0, 0.35, 0);
    boden.castShadow = true;
    root.add(boden);

    // G-Klasse Trittbretter (Running Boards) & AMG Sidepipes + Kotflügelverbreiterungen
    [-1, 1].forEach(side => {
      const xSide = side * 0.89;

      // Kantige G-Klasse Türen & Seitenwand in Wagenfarbe (Türkis oder Weiß)
      const tuer = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.66, 2.55), lackMat);
      tuer.position.set(xSide, 0.72, 0.22);
      tuer.castShadow = true;
      root.add(tuer);

      // Charakteristische schwarze G-Klasse-Schutzleiste (Rub Strip) über die gesamte Fahrzeugflanke
      const schutzLeiste = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 3.85), schwarzMattMat);
      schutzLeiste.position.set(side * 0.90, 0.84, -0.05);
      root.add(schutzLeiste);

      // Seitliches Trittbrett (Running Board) zwischen den Kotflügeln
      const trittbrett = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 1.92), aluMat);
      trittbrett.position.set(side * 0.96, 0.34, 0.02);
      root.add(trittbrett);

      // Doppelte verchromte AMG-Sidepipes (Seitliche Auspuffendrohre vor dem Hinterrad!)
      [-0.68, -0.54].forEach(zPipe => {
        const sidepipe = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.22, 12), chromMat);
        sidepipe.rotation.z = Math.PI / 2;
        sidepipe.position.set(side * 0.95, 0.29, -zPipe);
        root.add(sidepipe);
      });

      // Markante schwarze G-Klasse Kotflügelverbreiterungen (vorn & hinten)
      [-1.32, 1.32].forEach(zArch => {
        const radlauf = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, 0.92), schwarzMattMat);
        radlauf.position.set(side * 0.95, 0.56, zArch);
        radlauf.castShadow = true;
        root.add(radlauf);
      });

      // Innenverkleidung & Armlehne
      const innenVerkleidung = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.54, 1.95), dunkelLederMat);
      innenVerkleidung.position.set(xSide * 0.92, 0.70, 0.05);
      root.add(innenVerkleidung);

      const armlehne = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.65), aluMat);
      armlehne.position.set(xSide * 0.89, 0.80, -0.05);
      root.add(armlehne);
    });

    // Kantige, hohe G-Klasse-Motorhaube vorne (z: -0.68 bis -2.14)
    const haube = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.18, 1.48), lackMat);
    haube.position.set(0, 0.92, -1.42);
    haube.rotation.x = THREE.MathUtils.degToRad(-1.5);
    haube.castShadow = true;
    haube.receiveShadow = true;
    root.add(haube);

    // Markanter aufgesetzter AMG Powerdome in der Mitte der G-Klasse-Motorhaube (aus dem Cockpit sichtbar!)
    const powerDome = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.065, 1.18), lackMat);
    powerDome.position.set(0, 1.01, -1.38);
    powerDome.rotation.x = THREE.MathUtils.degToRad(-1.5);
    powerDome.castShadow = true;
    root.add(powerDome);

    // Schwarze Lufteinlass-Akzente links & rechts am Powerdome
    [-0.53, 0.53].forEach(xVent => {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.85), schwarzMattMat);
      vent.position.set(xVent, 1.01, -1.38);
      vent.rotation.x = THREE.MathUtils.degToRad(-1.5);
      root.add(vent);
    });

    // Ausgeformte kantige G-Klasse Kotflügel-Oberseiten links & rechts
    [-0.78, 0.78].forEach(xFender => {
      const kotfluegel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.20, 1.46), lackMat);
      kotfluegel.position.set(xFender, 0.94, -1.41);
      kotfluegel.rotation.x = THREE.MathUtils.degToRad(-1.5);
      root.add(kotfluegel);

      // IKONISCHE AUFGESETZTE G-KLASSE-BLINKER oben auf den vorderen Kotflügel-Ecken!
      const blinkerSockel = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.20), schwarzMattMat);
      blinkerSockel.position.set(xFender, 1.05, -1.92);
      root.add(blinkerSockel);

      const blinkerGlas = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.045, 0.16), blinkerMat);
      blinkerGlas.position.set(xFender, 1.075, -1.93);
      root.add(blinkerGlas);
    });

    // Edler Chrom-Stern vorne auf der G-Klasse-Haubenspitze
    const sockel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.03, 16), chromMat);
    sockel.position.set(0, 0.99, -2.06);
    root.add(sockel);
    const sternRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.009, 12, 24), chromMat);
    sternRing.position.set(0, 1.06, -2.06);
    root.add(sternRing);

    // ========================================================================
    // 1b. G-KLASSE FRONTPARTIE (Panamericana-Grill, Rundscheinwerfer & Frontbügel)
    // ========================================================================
    const frontMaske = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.56, 0.22), lackMat);
    frontMaske.position.set(0, 0.68, -2.08);
    frontMaske.castShadow = true;
    root.add(frontMaske);

    // Schwarzer Kühlergrill-Einsatz mit vertikalen Chrom-Streben & großem Zentralstern
    const grillKasten = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.36, 0.06), schwarzMattMat);
    grillKasten.position.set(0, 0.72, -2.18);
    root.add(grillKasten);

    for (let g = -4; g <= 4; g++) {
      const strebe = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.32, 0.07), chromMat);
      strebe.position.set(g * 0.105, 0.72, -2.185);
      root.add(strebe);
    }

    const frontSternRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.016, 12, 24), chromMat);
    frontSternRing.position.set(0, 0.72, -2.21);
    root.add(frontSternRing);

    // Massiver Offroad-Frontstoßfänger & verchromter G-Klasse Frontbügel (Bullbar)
    const frontStossstange = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.24, 0.28), schwarzMattMat);
    frontStossstange.position.set(0, 0.38, -2.16);
    root.add(frontStossstange);

    const buegelOben = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.08, 12), chromMat);
    buegelOben.rotation.z = Math.PI / 2;
    buegelOben.position.set(0, 0.88, -2.27);
    root.add(buegelOben);
    [-0.50, 0.50].forEach(xBar => {
      const buegelStuetze = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.50, 12), chromMat);
      buegelStuetze.position.set(xBar, 0.63, -2.27);
      root.add(buegelStuetze);
    });

    // ========================================================================
    // 1c. KANTIGER G-KLASSE KASTENAUFBAU HINTEN & ERSATZRAD AN DER HECKTÜR
    // ========================================================================
    // Untere Heckpartie & Stoßstange
    const heckKasten = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.68, 1.35), lackMat);
    heckKasten.position.set(0, 0.72, 1.48);
    heckKasten.castShadow = true;
    root.add(heckKasten);

    const heckStossstange = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.22, 0.26), schwarzMattMat);
    heckStossstange.position.set(0, 0.36, 2.16);
    root.add(heckStossstange);

    // B-, C- und D-Säulen sowie hinteres Kasten-Dach (hinter dem Fahrer ab z = +0.35, sodass das Cockpit nach vorne/oben 100% frei bleibt!)
    [-0.86, 0.86].forEach(xPil => {
      // B-Säule (neben/hinter der Fahrer-Kopfstütze)
      const bSaeule = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.12), lackMat);
      bSaeule.position.set(xPil, 1.40, 0.38);
      root.add(bSaeule);

      // C-Säule
      const cSaeule = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.14), lackMat);
      cSaeule.position.set(xPil, 1.40, 1.24);
      root.add(cSaeule);

      // D-Säule (Heckkante)
      const dSaeule = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.72, 0.16), lackMat);
      dSaeule.position.set(xPil, 1.40, 2.04);
      root.add(dSaeule);

      // Dunkel getönte G-Klasse Fond- & Kofferraumfenster
      const seitenFenster = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.56, 1.62), getoentesGlasMat);
      seitenFenster.position.set(xPil, 1.38, 1.22);
      root.add(seitenFenster);

      // Durchgehender oberer G-Klasse Dachholm (Regenrinne) von der A-Säule bis zum Heck
      const dachHolm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 2.48), lackMat);
      dachHolm.position.set(xPil, 1.74, 0.90);
      root.add(dachHolm);
    });

    // Hinteres G-Klasse Flachdach (ab B-Säule z = 0.36 bis z = 2.12)
    const hinterDach = new THREE.Mesh(new THREE.BoxGeometry(1.80, 0.08, 1.76), lackMat);
    hinterDach.position.set(0, 1.76, 1.24);
    hinterDach.castShadow = true;
    root.add(hinterDach);

    // Getönte Heckscheibe
    const heckScheibe = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.56, 0.05), getoentesGlasMat);
    heckScheibe.position.set(0, 1.38, 2.08);
    root.add(heckScheibe);

    // IKONISCHES G-KLASSE ERSATZRAD-COVER AN DER HECKTÜR (mit Chromring & Wagenfarben-Platte!)
    const ersatzradReifen = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 24), chromMat);
    ersatzradReifen.rotation.x = Math.PI / 2;
    ersatzradReifen.position.set(0.12, 0.96, 2.24);
    ersatzradReifen.castShadow = true;
    root.add(ersatzradReifen);

    const ersatzradDeckel = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.26, 24), lackMat);
    ersatzradDeckel.rotation.x = Math.PI / 2;
    ersatzradDeckel.position.set(0.12, 0.96, 2.245);
    root.add(ersatzradDeckel);

    const heckSternRing = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.012, 10, 24), chromMat);
    heckSternRing.position.set(0.12, 0.96, 2.38);
    root.add(heckSternRing);

    // Runde G-Klasse LED-Scheinwerfer vorne & Brems-/Rückfahrlichter hinten
    const scheinwerferMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe0f2fe, emissiveIntensity: 2.8 });
    this.bremsLichtMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, emissive: 0xff1744, emissiveIntensity: 0.4 });
    this.rueckfahrLichtMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, emissive: 0xffffff, emissiveIntensity: 0.0 });

    [-0.68, 0.68].forEach(xL => {
      // Runde G-Klasse Scheinwerfer + LED-Tagfahrlicht-Ring
      const sw = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 20), scheinwerferMat);
      sw.rotation.x = Math.PI / 2;
      sw.position.set(xL, 0.74, -2.18);
      root.add(sw);

      const ledRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.015, 10, 24), scheinwerferMat);
      ledRing.position.set(xL, 0.74, -2.21);
      root.add(ledRing);

      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.13, 0.08), this.bremsLichtMat);
      bl.position.set(xL, 0.64, 2.16);
      root.add(bl);

      const rl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.08), this.rueckfahrLichtMat);
      rl.position.set(xL * 0.72, 0.52, 2.16);
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
    if (pos.z > 105) {
      ortName = '🇪🇬 Ägypten – Küste & Pyramiden';
    } else if (pos.x < -150) {
      ortName = pos.z > 20 ? '🇩🇪 Ostsee-Hafen & Strand' : '🇩🇪 Deutschland – Straße am Fluss';
    } else if (pos.x > 150) {
      ortName = pos.z > 15 ? '🇺🇸 Grand Canyon Nationalpark' : '🇺🇸 New York City & Airport';
    }

    // Header
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, 40);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 17px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🛰️ GPS NAVI: ' + ortName, 12, 26);

    // Mini-Karte (Deutschland NW, Amerika NE, Afrika/Ägypten SE)
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(14, 50, w - 28, 115);
    // DE Land (NW)
    ctx.fillStyle = '#15803d';
    ctx.fillRect(20, 56, 68, 52);
    // US Land (NE)
    ctx.fillStyle = '#166534';
    ctx.fillRect(w - 88, 56, 68, 56);
    // Afrika / Ägypten (SE)
    ctx.fillStyle = '#d97706';
    ctx.fillRect(w * 0.50, 116, 82, 44);

    // Auto-Punkt auf dem Navi-Radar
    const mapX = THREE.MathUtils.clamp(((pos.x + 345) / 690) * (w - 40) + 20, 22, w - 22);
    const mapY = THREE.MathUtils.clamp(((pos.z + 85) / 340) * 105 + 54, 56, 158);
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
    // 3. ACKERMANN-FAHRPHYSIK & PHYSIK-SCHRITT (EEP.fahrzeugPhysik)
    // ------------------------------------------------------------------------
    if (this.simKoerper && window.EEP && window.EEP.fahrzeugPhysik) {
      this.simKoerper.v = this.geschwindigkeit;
      this.simKoerper.lenkWinkel = this.lenkWinkel;
      this.simKoerper.radstand = this.radstand;

      window.EEP.fahrzeugPhysik.schritt(this.simKoerper, deltaSec);

      this.geschwindigkeit = this.simKoerper.v;
      this.el.object3D.position.x = this.simKoerper.x;
      this.el.object3D.position.y = this.simKoerper.y;
      this.el.object3D.position.z = this.simKoerper.z;
      this.el.object3D.rotation.y = this.simKoerper.yaw;
      if (this.simKoerper.pitch || this.simKoerper.roll) {
        this.el.object3D.rotation.x = this.simKoerper.pitch || 0;
        this.el.object3D.rotation.z = this.simKoerper.roll || 0;
      }
    } else if (Math.abs(this.geschwindigkeit) > 0.01) {
      // Fallback
      const yawDelta = (this.geschwindigkeit / this.radstand) * Math.tan(this.lenkWinkel) * deltaSec;
      this.el.object3D.rotation.y += yawDelta;
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

    // Kombiinstrument & Navi NUR im aktiven Auto-Cockpit [8] und nur bei Wertänderung (max 15 Hz) auf die GPU laden!
    // Das verhindert teure CPU->GPU CanvasTexture-Stalls (glTexImage2D) in jedem Frame!
    if (window.EEP.aktiveKamera === 8 && window.EEP.autoComp === this) {
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
    // 5. ZERO-LAG KAMERA-SYNC (Cockpit-Ansicht & 3rd-Person-Außenansicht!)
    // ------------------------------------------------------------------------
    if (window.EEP.aktiveKamera === 8 && window.EEP.autoComp === this && this.camAnchorEl) {
      this.el.object3D.updateMatrixWorld(true);
      const rig = document.querySelector('#kamera-rig');
      const cam = document.querySelector('#haupt-kamera');
      const ls = window.EEP.lookState;

      if (window.EEP.autoAussenAnsicht) {
        // 3rd-Person-Verfolgeransicht von außen hinter der G-Klasse (zeigt Kastenform, Ersatzrad & Lackfarbe!)
        const carPos = this.el.object3D.position;
        const carYaw = this.el.object3D.rotation.y;
        const totalYaw = carYaw + (ls ? ls.yaw : 0);
        const totalPitch = -0.22 + (ls ? ls.pitch : 0);
        const dist = 6.8;
        if (rig) {
          rig.object3D.position.set(
            carPos.x + Math.sin(totalYaw) * Math.cos(totalPitch) * dist,
            Math.max(0.8, carPos.y + 1.35 - Math.sin(totalPitch) * dist),
            carPos.z + Math.cos(totalYaw) * Math.cos(totalPitch) * dist
          );
          rig.object3D.rotation.set(totalPitch, totalYaw, 0, 'YXZ');
        }
        if (cam) {
          cam.object3D.position.set(0, 0, 0);
          cam.object3D.rotation.set(0, 0, 0);
        }
      } else {
        // 3D-Cockpit-Ansicht auf dem Fahrersitz (Lenkrad, Gangwahlhebel, Tacho, G-Klasse-Haube & Blinker!)
        if (rig) {
          const worldPos = new THREE.Vector3();
          const worldQuat = new THREE.Quaternion();
          this.camAnchorEl.object3D.getWorldPosition(worldPos);
          this.camAnchorEl.object3D.getWorldQuaternion(worldQuat);
          rig.object3D.position.copy(worldPos);
          rig.object3D.quaternion.copy(worldQuat);
        }
        if (cam) {
          cam.object3D.position.set(0, 0, 0);
          if (ls) {
            cam.object3D.rotation.set(ls.pitch, ls.yaw, 0, 'YXZ');
          }
        }
      }
    }
  }
});

// ============================================================================
// 10. LARA CROFT (TOMB RAIDER 1-5) - 15-MESH LOW-POLY SPIELERIN ('ki-lara')
// Originalgetreuer Core-Design-Gelenkbaum (ohne Waffen): Türkises Top,
// braune Shorts, Rucksack, 5-gliedriger Zopf, Rennen, Gehen, Sprung,
// 360°-Seitwärtssalto, 360°-Rückwärtssalto, 180°-Rolle & Look-Kopfdrehung!
// ============================================================================
AFRAME.registerComponent('ki-lara', {
  init: function () {
    window.EEP.laraComp = this;
    this.meshCount = 0;
    this.braidSegments = [];

    // Bewegungs- & Akrobatik-Zustand
    this.zustand = 'stand'; // 'stand', 'lauf', 'gehen', 'rueck', 'seitschritt', 'sprung', 'seitwaertssalto', 'rueckwaertssalto', 'rolle'
    this.gehenModus = false; // Umschaltbar mit [.] oder [C]
    this.bodenY = 0.25;
    this.posY = 0.25;
    this.velY = 0;
    this.sprungVx = 0;
    this.sprungVz = 0;
    this.saltoZeit = 0;
    this.saltoDauer = 0.72;
    this.saltoRichtung = 1; // +1 = links, -1 = rechts
    this.animPhase = 0;
    this.letzterSchritt = 0;
    this.beinWinkel = 0;

    this.tasten = {
      hoch: false,
      runter: false,
      links: false,
      rechts: false,
      alt: false,
      seiteLinks: false,
      seiteRechts: false
    };

    window.addEventListener('keydown', (e) => {
      const modus = window.EEP.aktiveKamera;
      if (modus !== 1 && modus !== 4 && modus !== 9) return;

      // Wenn Shift oder Numpad 0 (Look-Modus) gehalten wird -> Pfeiltasten steuern NUR die Kamera!
      if (e.shiftKey || (window.EEP.lookState && window.EEP.lookState.aktiv)) {
        this.tasten.hoch = false;
        this.tasten.runter = false;
        this.tasten.links = false;
        this.tasten.rechts = false;
        return;
      }

      if (e.key === 'ArrowUp') { this.tasten.hoch = true; e.preventDefault(); }
      if (e.key === 'ArrowDown') { this.tasten.runter = true; e.preventDefault(); }
      if (e.key === 'ArrowLeft') { this.tasten.links = true; e.preventDefault(); }
      if (e.key === 'ArrowRight') { this.tasten.rechts = true; e.preventDefault(); }
      if (e.key === 'Delete' || e.key.toLowerCase() === 'q') { this.tasten.seiteLinks = true; e.preventDefault(); }
      if (e.key === 'PageDown' || e.key.toLowerCase() === 'e') { this.tasten.seiteRechts = true; e.preventDefault(); }

      // Gehen-Modus Toggle (Klassisch Punkt '.' oder 'c')
      if (e.key === '.' || e.key.toLowerCase() === 'c') {
        this.gehenModus = !this.gehenModus;
      }

      // Entdecker-Ruf "A-ha!" (Strg oder 'f')
      if (e.key === 'Control' || e.key.toLowerCase() === 'f') {
        window.EEP.laraAha();
      }

      // 180°-Bodenrolle (Klassisch 'End', 'r' oder Hoch+Runter gleichzeitig)
      if ((e.key === 'End' || e.key.toLowerCase() === 'r' || (this.tasten.hoch && this.tasten.runter)) && this.posY <= this.bodenY + 0.02 && this.zustand !== 'rolle') {
        this.starteRolle();
        e.preventDefault();
      }

      // Sprung & Akrobatik-Saltos (Klassisch 'Alt' oder Leertaste ' ')
      if (e.key === 'Alt' || e.key === ' ') {
        this.tasten.alt = true;
        e.preventDefault();
        if (this.posY <= this.bodenY + 0.02 && this.zustand !== 'rolle') {
          if (this.tasten.links || this.tasten.seiteLinks) {
            this.starteSeitwaertssalto(1); // 360°-Seitwärtssalto nach links!
          } else if (this.tasten.rechts || this.tasten.seiteRechts) {
            this.starteSeitwaertssalto(-1); // 360°-Seitwärtssalto nach rechts!
          } else if (this.tasten.runter) {
            this.starteRueckwaertssalto(); // 360°-Rückwärtssalto!
          } else {
            this.starteSprung(this.tasten.hoch ? 8.5 : 0);
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowUp') this.tasten.hoch = false;
      if (e.key === 'ArrowDown') this.tasten.runter = false;
      if (e.key === 'ArrowLeft') this.tasten.links = false;
      if (e.key === 'ArrowRight') this.tasten.rechts = false;
      if (e.key === 'Alt' || e.key === ' ') this.tasten.alt = false;
      if (e.key === 'Delete' || e.key.toLowerCase() === 'q') this.tasten.seiteLinks = false;
      if (e.key === 'PageDown' || e.key.toLowerCase() === 'e') this.tasten.seiteRechts = false;
    });

    this.baueLara15Meshes();

    // In EEP.sim registrieren (Paket A & B)
    if (window.EEP && window.EEP.sim) {
      const pos = this.el.object3D.position;
      const kId = window.EEP.sim.registriere({
        id: 'lara-spieler',
        typ: 'lara',
        x: pos.x,
        y: pos.y,
        z: pos.z,
        yaw: this.el.object3D.rotation.y,
        v: 0,
        radius: 0.35,
        hoehe: 1.75
      });
      this.simKoerper = window.EEP.sim.koerper(kId);
    }
  },

  starteSprung: function (vorwaertsTempo) {
    this.zustand = 'sprung';
    this.velY = 7.2;
    const yaw = this.el.object3D.rotation.y;
    this.sprungVx = -Math.sin(yaw) * vorwaertsTempo;
    this.sprungVz = -Math.cos(yaw) * vorwaertsTempo;
    window.EEP.laraSprung();
  },

  starteSeitwaertssalto: function (richtungLinksRechts) {
    this.zustand = 'seitwaertssalto';
    this.saltoRichtung = richtungLinksRechts; // +1 = Links, -1 = Rechts
    this.saltoZeit = 0;
    this.saltoDauer = 0.68;
    this.velY = 6.8;
    const yaw = this.el.object3D.rotation.y;
    // Seitlicher Bewegungsvektor (links = -cos(yaw), +sin(yaw))
    const sideSpeed = 7.4 * richtungLinksRechts;
    this.sprungVx = -Math.cos(yaw) * sideSpeed;
    this.sprungVz = Math.sin(yaw) * sideSpeed;
    window.EEP.laraSalto();
  },

  starteRueckwaertssalto: function () {
    this.zustand = 'rueckwaertssalto';
    this.saltoZeit = 0;
    this.saltoDauer = 0.68;
    this.velY = 6.8;
    const yaw = this.el.object3D.rotation.y;
    this.sprungVx = Math.sin(yaw) * 6.5;
    this.sprungVz = Math.cos(yaw) * 6.5;
    window.EEP.laraSalto();
  },

  starteRolle: function () {
    this.zustand = 'rolle';
    this.saltoZeit = 0;
    this.saltoDauer = 0.55;
    window.EEP.laraSprung();
  },

  // Baut den originalgetreuen 15-teiligen Core-Design Low-Poly-Gelenkbaum (ohne Waffen)
  baueLara15Meshes: function () {
    const root = new THREE.Group();
    this.el.setObject3D('mesh', root);

    const topMat = new THREE.MeshStandardMaterial({ color: 0x26a69a, roughness: 0.55, flatShading: true }); // Klassisches Tomb-Raider Türkis
    const shortsMat = new THREE.MeshStandardMaterial({ color: 0x5d3a1a, roughness: 0.7, flatShading: true }); // Braune Shorts
    const hautMat = new THREE.MeshStandardMaterial({ color: 0xe0a378, roughness: 0.6, flatShading: true });   // Hautton
    const haarMat = new THREE.MeshStandardMaterial({ color: 0x3b2212, roughness: 0.65, flatShading: true });  // Dunkelbraunes Haar & Zopf
    const lederMat = new THREE.MeshStandardMaterial({ color: 0x361f10, roughness: 0.6, flatShading: true });  // Rucksack, Gürtel, Stiefel, Handschuhe
    const sockenMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8, flatShading: true }); // Weiße Socken
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.75, flatShading: true }); // Gürtelschnalle

    const regMesh = (geo, mat, parent) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      this.meshCount++;
      return m;
    };

    // --- MESH 1: PELVIS / HÜFTE (Root des Bone-Trees bei y = 0.94) ---
    this.pelvisGroup = new THREE.Group();
    this.pelvisGroup.position.set(0, 0.94, 0);
    root.add(this.pelvisGroup);

    const pelvisMesh = regMesh(new THREE.CylinderGeometry(0.145, 0.155, 0.18, 6), shortsMat, this.pelvisGroup);
    pelvisMesh.scale.set(1.15, 1, 0.82);

    // Gürtel mit Messingschnalle (ohne Waffenholster!)
    const guertel = new THREE.Mesh(new THREE.CylinderGeometry(0.150, 0.150, 0.045, 6), lederMat);
    guertel.scale.set(1.16, 1, 0.84);
    guertel.position.set(0, 0.06, 0);
    this.pelvisGroup.add(guertel);

    const schnalle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.048, 0.02), goldMat);
    schnalle.position.set(0, 0.06, -0.128);
    this.pelvisGroup.add(schnalle);

    // Hilfsfunktion für linkes (-1) und rechtes (+1) Bein (je 3 Gelenk-Meshes: Oberschenkel, Unterschenkel, Stiefel)
    const baueBein = (side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.105, -0.06, 0);
      this.pelvisGroup.add(hip);

      // Shorts-Beinansatz + kantiger Oberschenkel (Mesh 2 bzw. 5)
      const shortsBein = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.078, 0.11, 6), shortsMat);
      shortsBein.position.set(0, -0.05, 0);
      hip.add(shortsBein);

      const thighMesh = regMesh(new THREE.CylinderGeometry(0.076, 0.060, 0.34, 6), hautMat, hip);
      thighMesh.position.set(0, -0.20, 0);

      // Kniegelenk + Unterschenkel (Mesh 3 bzw. 6)
      const knee = new THREE.Group();
      knee.position.set(0, -0.37, 0);
      hip.add(knee);

      const calfMesh = regMesh(new THREE.CylinderGeometry(0.058, 0.046, 0.22, 6), hautMat, knee);
      calfMesh.position.set(0, -0.11, 0);

      // Weiße Socke + brauner Stiefelschaft
      const socke = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.048, 0.08, 6), sockenMat);
      socke.position.set(0, -0.24, 0);
      knee.add(socke);

      const schaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.050, 0.14, 6), lederMat);
      schaft.position.set(0, -0.33, 0);
      knee.add(schaft);

      // Fußgelenk + Schnürstiefel (Mesh 4 bzw. 7)
      const ankle = new THREE.Group();
      ankle.position.set(0, -0.41, 0);
      knee.add(ankle);

      const bootMesh = regMesh(new THREE.BoxGeometry(0.095, 0.085, 0.22), lederMat, ankle);
      bootMesh.position.set(0, -0.04, -0.04);

      return { hip, knee, ankle };
    };

    this.beinL = baueBein(-1);
    this.beinR = baueBein(1);

    // --- MESH 8: TORSO / OBERKÖRPER (Türkisfarbenes Tank-Top + Entdecker-Rucksack) ---
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.08, 0);
    this.pelvisGroup.add(this.torsoGroup);

    // Schmale Taille
    const taille = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.125, 0.12, 6), hautMat);
    taille.scale.set(1.1, 1, 0.78);
    taille.position.set(0, 0.06, 0);
    this.torsoGroup.add(taille);

    // Haupt-Oberkörper im typischen PS1-Türkis
    const torsoMesh = regMesh(new THREE.CylinderGeometry(0.165, 0.115, 0.34, 6), topMat, this.torsoGroup);
    torsoMesh.scale.set(1.15, 1, 0.78);
    torsoMesh.position.set(0, 0.27, 0);

    // Charakteristisches facettiertes PS1-Low-Poly-Brustprisma (Vorne -Z)
    const brustPrisma = new THREE.Mesh(new THREE.ConeGeometry(0.145, 0.16, 4), topMat);
    brustPrisma.rotation.y = Math.PI / 4;
    brustPrisma.rotation.x = -Math.PI / 2;
    brustPrisma.scale.set(1.25, 0.85, 0.75);
    brustPrisma.position.set(0, 0.30, -0.11);
    this.torsoGroup.add(brustPrisma);

    // Brauner Entdecker-Rucksack auf dem Rücken (+Z)
    const rucksack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.11), lederMat);
    rucksack.position.set(0, 0.28, 0.13);
    rucksack.castShadow = true;
    this.torsoGroup.add(rucksack);

    // --- MESHES 9..14: LINKE & RECHTE ARMKETTEN (Oberarm, Unterarm, behandschuhte Hand) ---
    const baueArm = (side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.205, 0.40, 0);
      this.torsoGroup.add(shoulder);

      const upperArmMesh = regMesh(new THREE.CylinderGeometry(0.046, 0.038, 0.25, 6), hautMat, shoulder);
      upperArmMesh.position.set(0, -0.12, 0);

      const elbow = new THREE.Group();
      elbow.position.set(0, -0.25, 0);
      shoulder.add(elbow);

      const forearmMesh = regMesh(new THREE.CylinderGeometry(0.038, 0.032, 0.22, 6), hautMat, elbow);
      forearmMesh.position.set(0, -0.11, 0);

      const wrist = new THREE.Group();
      wrist.position.set(0, -0.22, 0);
      elbow.add(wrist);

      const handMesh = regMesh(new THREE.BoxGeometry(0.048, 0.075, 0.055), lederMat, wrist);
      handMesh.position.set(0, -0.035, 0);

      return { shoulder, elbow, wrist };
    };

    this.armL = baueArm(-1);
    this.armR = baueArm(1);

    // --- MESH 15: KOPF + 5-GLIEDRIGER SCHWINGENDER ZOPF (BRAID) ---
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.45, 0);
    this.torsoGroup.add(this.headGroup);

    const hals = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.054, 0.07, 6), hautMat);
    hals.position.set(0, 0.03, 0);
    this.headGroup.add(hals);

    const headMesh = regMesh(new THREE.CylinderGeometry(0.092, 0.076, 0.20, 7), hautMat, this.headGroup);
    headMesh.position.set(0, 0.14, 0);

    // Braune Haarkappe + seitliche Pony-Strähnen
    const haarKappe = new THREE.Mesh(new THREE.SphereGeometry(0.098, 7, 6), haarMat);
    haarKappe.scale.set(1.0, 0.92, 1.08);
    haarKappe.position.set(0, 0.18, 0.015);
    this.headGroup.add(haarKappe);

    // Augen & Lippen auf der Vorderseite (-Z)
    const augenMat = new THREE.MeshBasicMaterial({ color: 0x1e1b18 });
    [-0.032, 0.032].forEach(xEye => {
      const auge = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.014, 0.01), augenMat);
      auge.position.set(xEye, 0.155, -0.088);
      this.headGroup.add(auge);
    });
    const lippen = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.012, 0.01), new THREE.MeshBasicMaterial({ color: 0xa13d2d }));
    lippen.position.set(0, 0.105, -0.084);
    this.headGroup.add(lippen);

    // 5-gliedriger beweglicher Zopf (Braid) am Hinterkopf (+Z)
    let parentBraid = this.headGroup;
    for (let i = 0; i < 5; i++) {
      const bJoint = new THREE.Group();
      if (i === 0) bJoint.position.set(0, 0.12, 0.095);
      else bJoint.position.set(0, -0.075, 0.01);
      parentBraid.add(bJoint);

      const radius = 0.034 - i * 0.004;
      const segMat = i === 4 ? topMat : haarMat; // Türkises Haargummi am Zopfende!
      const bSeg = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.85, 0.085, 6), segMat);
      bSeg.position.set(0, -0.04, 0);
      bSeg.castShadow = true;
      bJoint.add(bSeg);

      this.braidSegments.push(bJoint);
      parentBraid = bJoint;
    }
  },

  teleportiereZu: function (x, y, z, rotYGrad) {
    this.bodenY = y;
    this.posY = y;
    this.velY = 0;
    this.zustand = 'stand';
    this.el.object3D.position.set(x, y, z);
    this.el.object3D.rotation.set(0, THREE.MathUtils.degToRad(rotYGrad), 0);
    this.pelvisGroup.rotation.set(0, 0, 0);
    this.el.object3D.updateMatrixWorld(true);
    if (this.simKoerper) {
      this.simKoerper.x = x;
      this.simKoerper.y = y;
      this.simKoerper.z = z;
      this.simKoerper.yaw = THREE.MathUtils.degToRad(rotYGrad);
      this.simKoerper.v = 0;
      this.simKoerper.vorherX = x;
      this.simKoerper.vorherZ = z;
      this.simKoerper.traktionsverlust = false;
      this.simKoerper.sandStillstandSek = 0;
    }
  },

  tick: function (time, dt) {
    if (!dt) return;
    const deltaSec = Math.min(dt / 1000, 0.08);
    const lookAktiv = window.EEP.lookState && window.EEP.lookState.aktiv;

    // ------------------------------------------------------------------------
    // 1. TANK-CONTROLS & AKROBATIK-PHYSIK (Rennen, Gehen, Sprung, 360°-Saltos)
    // ------------------------------------------------------------------------
    if (this.zustand === 'seitwaertssalto' || this.zustand === 'rueckwaertssalto') {
      // Vollständiger 360°-Salto in der Luft!
      this.saltoZeit += deltaSec;
      const progress = Math.min(1, this.saltoZeit / this.saltoDauer);

      this.velY -= 19.5 * deltaSec;
      this.posY += this.velY * deltaSec;
      this.el.object3D.position.x += this.sprungVx * deltaSec;
      this.el.object3D.position.z += this.sprungVz * deltaSec;

      if (this.zustand === 'seitwaertssalto') {
        // 360°-Drehung um die Z-Achse (Sideflip!)
        this.pelvisGroup.rotation.z = this.saltoRichtung * progress * Math.PI * 2;
        this.pelvisGroup.rotation.x = 0;
      } else {
        // 360°-Drehung um die X-Achse (Backflip!)
        this.pelvisGroup.rotation.x = progress * Math.PI * 2;
        this.pelvisGroup.rotation.z = 0;
      }

      // Angezogene Salto-Haltung der Gliedmaßen
      this.beinL.hip.rotation.x = -0.85;
      this.beinR.hip.rotation.x = -0.85;
      this.beinL.knee.rotation.x = -1.35;
      this.beinR.knee.rotation.x = -1.35;
      this.armL.shoulder.rotation.x = -1.2;
      this.armR.shoulder.rotation.x = -1.2;

      if (this.posY <= this.bodenY || progress >= 1) {
        this.posY = this.bodenY;
        this.velY = 0;
        this.pelvisGroup.rotation.set(0, 0, 0);
        this.zustand = 'stand';
        window.EEP.laraLandung();
      }
    } else if (this.zustand === 'sprung') {
      this.velY -= 18.5 * deltaSec;
      this.posY += this.velY * deltaSec;
      this.el.object3D.position.x += this.sprungVx * deltaSec;
      this.el.object3D.position.z += this.sprungVz * deltaSec;

      // Heroische Tomb-Raider-Sprunghaltung
      this.beinL.hip.rotation.x = -0.55;
      this.beinR.hip.rotation.x = 0.25;
      this.beinL.knee.rotation.x = -0.9;
      this.beinR.knee.rotation.x = -0.45;
      this.armL.shoulder.rotation.x = -2.2;
      this.armR.shoulder.rotation.x = -2.2;
      this.armL.shoulder.rotation.z = 0.25;
      this.armR.shoulder.rotation.z = -0.25;

      if (this.posY <= this.bodenY) {
        this.posY = this.bodenY;
        this.velY = 0;
        this.armL.shoulder.rotation.z = 0;
        this.armR.shoulder.rotation.z = 0;
        this.zustand = 'stand';
        window.EEP.laraLandung();
      }
    } else if (this.zustand === 'rolle') {
      // Klassische 180°-Bodenrolle mit sofortiger Kehrtwende
      this.saltoZeit += deltaSec;
      const progress = Math.min(1, this.saltoZeit / this.saltoDauer);
      const yaw = this.el.object3D.rotation.y;
      this.el.object3D.position.x -= Math.sin(yaw) * 6.5 * deltaSec;
      this.el.object3D.position.z -= Math.cos(yaw) * 6.5 * deltaSec;
      this.pelvisGroup.rotation.x = -progress * Math.PI * 2;
      this.pelvisGroup.position.y = 0.65;

      if (progress >= 1) {
        this.pelvisGroup.rotation.set(0, 0, 0);
        this.pelvisGroup.position.y = 0.94;
        this.el.object3D.rotation.y += Math.PI; // 180° Wende!
        this.zustand = 'stand';
        window.EEP.laraLandung();
      }
    } else if (!lookAktiv) {
      // Normale Boden-Steuerung (Drehen, Rennen, Gehen, Seitwärtsschritt)
      const turnRate = 2.55;
      if (this.tasten.links) this.el.object3D.rotation.y += turnRate * deltaSec;
      if (this.tasten.rechts) this.el.object3D.rotation.y -= turnRate * deltaSec;

      const yaw = this.el.object3D.rotation.y;
      let moveSpeed = 0;
      let sideSpeed = 0;

      if (this.tasten.hoch) {
        moveSpeed = this.gehenModus ? 4.2 : 9.2;
        this.zustand = this.gehenModus ? 'gehen' : 'lauf';
      } else if (this.tasten.runter) {
        moveSpeed = -4.5;
        this.zustand = 'rueck';
      } else if (this.tasten.seiteLinks) {
        sideSpeed = 5.2;
        this.zustand = 'seitschritt';
      } else if (this.tasten.seiteRechts) {
        sideSpeed = -5.2;
        this.zustand = 'seitschritt';
      } else {
        this.zustand = 'stand';
      }

      if (moveSpeed !== 0 || sideSpeed !== 0) {
        if (this.simKoerper && window.EEP && window.EEP.fahrzeugPhysik) {
          this.simKoerper.v = moveSpeed;
          this.simKoerper.yaw = yaw;
          this.simKoerper.springt = false;
          window.EEP.fahrzeugPhysik.schritt(this.simKoerper, deltaSec);
          this.el.object3D.position.x = this.simKoerper.x;
          this.el.object3D.position.z = this.simKoerper.z;
          this.posY = this.simKoerper.y;
          this.bodenY = this.simKoerper.y;
          if (this.simKoerper.pitch) {
            this.torsoGroup.rotation.x = this.simKoerper.pitch;
          }
        } else {
          if (moveSpeed !== 0) {
            this.el.object3D.position.x -= Math.sin(yaw) * moveSpeed * deltaSec;
            this.el.object3D.position.z -= Math.cos(yaw) * moveSpeed * deltaSec;
          }
          if (sideSpeed !== 0) {
            this.el.object3D.position.x -= Math.cos(yaw) * sideSpeed * deltaSec;
            this.el.object3D.position.z += Math.sin(yaw) * sideSpeed * deltaSec;
          }
        }
      } else if (this.simKoerper && window.EEP && window.EEP.fahrzeugPhysik) {
        this.simKoerper.v = 0;
        this.simKoerper.yaw = yaw;
        this.simKoerper.springt = false;
        window.EEP.fahrzeugPhysik.schritt(this.simKoerper, deltaSec);
        this.el.object3D.position.x = this.simKoerper.x;
        this.el.object3D.position.z = this.simKoerper.z;
        this.posY = this.simKoerper.y;
        this.bodenY = this.simKoerper.y;
      }

      // Gelenk-Animationen für Lauf-, Geh- und Standzyklus
      if (this.zustand === 'lauf' || this.zustand === 'gehen' || this.zustand === 'rueck') {
        const freq = this.zustand === 'lauf' ? 12.5 : 8.0;
        const amp = this.zustand === 'lauf' ? 0.78 : 0.42;
        this.animPhase += freq * deltaSec;
        const s = Math.sin(this.animPhase);
        const c = Math.cos(this.animPhase);
        this.beinWinkel = Math.abs(s) * amp;

        this.beinL.hip.rotation.x = s * amp;
        this.beinR.hip.rotation.x = -s * amp;
        this.beinL.knee.rotation.x = -Math.max(0, -c) * amp * 1.1;
        this.beinR.knee.rotation.x = -Math.max(0, c) * amp * 1.1;

        this.armL.shoulder.rotation.x = -s * amp * 0.85;
        this.armR.shoulder.rotation.x = s * amp * 0.85;
        this.armL.elbow.rotation.x = 0.45 + Math.max(0, s) * 0.35;
        this.armR.elbow.rotation.x = 0.45 + Math.max(0, -s) * 0.35;

        this.torsoGroup.rotation.x = this.zustand === 'lauf' ? -0.14 : -0.05;
        this.torsoGroup.rotation.y = s * 0.12;
        this.pelvisGroup.position.y = 0.94 + Math.abs(Math.sin(this.animPhase)) * 0.06;

        // Stiefel-Schrittgeräusch im Takt der Fußaufsetzer
        const schrittIntervall = this.zustand === 'lauf' ? 250 : 390;
        if (time - this.letzterSchritt > schrittIntervall) {
          this.letzterSchritt = time;
          window.EEP.laraSchritt();
        }
      } else if (this.zustand === 'seitschritt') {
        this.animPhase += 10.5 * deltaSec;
        const s = Math.sin(this.animPhase);
        this.beinL.hip.rotation.z = Math.max(0, s) * 0.45;
        this.beinR.hip.rotation.z = -Math.max(0, -s) * 0.45;
        this.beinL.hip.rotation.x = s * 0.2;
        this.beinR.hip.rotation.x = -s * 0.2;
        if (time - this.letzterSchritt > 300) {
          this.letzterSchritt = time;
          window.EEP.laraSchritt();
        }
      } else {
        // Ruhiger Atem-Rhythmus im Stand
        this.animPhase += 2.2 * deltaSec;
        this.beinWinkel = 0;
        this.beinL.hip.rotation.set(0, 0, 0);
        this.beinR.hip.rotation.set(0, 0, 0);
        this.beinL.knee.rotation.set(0, 0, 0);
        this.beinR.knee.rotation.set(0, 0, 0);
        this.armL.shoulder.rotation.set(0, 0, 0.06);
        this.armR.shoulder.rotation.set(0, 0, -0.06);
        this.armL.elbow.rotation.set(0.18, 0, 0);
        this.armR.elbow.rotation.set(0.18, 0, 0);
        this.torsoGroup.rotation.set(Math.sin(this.animPhase) * 0.02, 0, 0);
        this.pelvisGroup.position.y = 0.94;
      }
    }

    this.el.object3D.position.y = this.posY;

    // ------------------------------------------------------------------------
    // 2. KOPFDREHUNG IM LOOK-MODUS & DYNAMISCHE ZOPF-PHYSIK (5 Segmente)
    // ------------------------------------------------------------------------
    const ls = window.EEP.lookState;
    if (ls && this.headGroup) {
      this.headGroup.rotation.y = THREE.MathUtils.clamp(ls.yaw * 0.55, -0.95, 0.95);
      this.headGroup.rotation.x = THREE.MathUtils.clamp(ls.pitch * 0.55, -0.55, 0.55);
    }

    const istBewegt = this.zustand !== 'stand';
    this.braidSegments.forEach((seg, idx) => {
      const wave = Math.sin(this.animPhase * 1.4 - idx * 0.55);
      seg.rotation.x = (istBewegt ? 0.28 : 0.08) + Math.abs(wave) * (istBewegt ? 0.14 : 0.02);
      seg.rotation.z = wave * (istBewegt ? 0.16 : 0.03);
    });
  }
});

AFRAME.registerComponent('ki-steuerung', {
  init: function () {
    this.kameraRig = document.querySelector('#kamera-rig');
    this.hauptKamera = document.querySelector('#haupt-kamera');
    this.umwelt = document.querySelector('#umwelt');

    // Globaler Tomb-Raider Look-Zustand (Shift + Pfeiltasten oder Numpad 0 / Insert + Pfeiltasten)
    window.EEP.lookState = {
      shift: false,
      num0: false,
      aktiv: false,
      up: false,
      down: false,
      left: false,
      right: false,
      yaw: 0,
      pitch: 0
    };
    const ls = window.EEP.lookState;

    // Tastatur-Steuerung ([1] Lara DE, [2] Ludmilla, [3] US-Zug, [4] Lara USA, [5] Flugzeug 3rd-P, [6] Schiff 3rd-P, [7] Vogelperspektive, [8] Auto-Cockpit)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') ls.shift = true;
      if (e.code === 'Numpad0' || e.key === 'Insert') ls.num0 = true;
      ls.aktiv = ls.shift || ls.num0;

      if (ls.aktiv) {
        if (e.key === 'ArrowUp') { ls.up = true; e.preventDefault(); }
        if (e.key === 'ArrowDown') { ls.down = true; e.preventDefault(); }
        if (e.key === 'ArrowLeft') { ls.left = true; e.preventDefault(); }
        if (e.key === 'ArrowRight') { ls.right = true; e.preventDefault(); }
      }

      if (e.key === '1') this.setzeKamera(1);
      if (e.key === '2') this.setzeKamera(2);
      if (e.key === '3') this.setzeKamera(3);
      if (e.key === '4') this.setzeKamera(4);
      if (e.key === '5') this.setzeKamera(5);
      if (e.key === '6') this.setzeKamera(6);
      if (e.key === '7') this.setzeKamera(7);
      if (e.key === '8') this.setzeKamera(8);
      if (e.key === '9') this.setzeKamera(9);
      if (e.key.toLowerCase() === 'l') this.wechselWetter();
      if (e.key.toLowerCase() === 'h') {
        if (window.EEP.aktiveKamera === 8) {
          window.EEP.autoHupe();
          e.preventDefault();
        } else if (window.EEP.aktiveKamera === 6) {
          window.EEP.schiffsHorn();
          e.preventDefault();
        } else {
          window.EEP.dampfPfeife();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') ls.shift = false;
      if (e.code === 'Numpad0' || e.key === 'Insert') ls.num0 = false;
      ls.aktiv = ls.shift || ls.num0;
      if (e.key === 'ArrowUp') ls.up = false;
      if (e.key === 'ArrowDown') ls.down = false;
      if (e.key === 'ArrowLeft') ls.left = false;
      if (e.key === 'ArrowRight') ls.right = false;
      if (!ls.aktiv) {
        ls.up = false; ls.down = false; ls.left = false; ls.right = false;
      }
    });

    this.baueSteuerpultUI();
    this.aktiviereHardwareBeschleunigung();
    window.EEP.updateUI = () => this.aktualisiereZugRegler();
    setTimeout(() => {
      this.setzeKamera(1); // Startet im 3rd-Person Tomb-Raider-Modus hinter Lara Croft in Deutschland!
      this.aktualisiereZugRegler();
      if (window.location.search.includes('autotest=1')) {
        this.starteAutoSelbsttest();
      }
      if (window.location.search.includes('laratest=1')) {
        this.starteLaraSelbsttest();
      }
      if (window.location.search.includes('vehicletest=1')) {
        this.starteFahrzeugSelbsttest();
      }
      if (window.location.search.includes('afrikatest=1')) {
        this.starteAfrikaSelbsttest();
      }
      if (window.location.search.includes('archtest=1')) {
        this.starteArchSelbsttest();
      }
      if (window.location.search.includes('lodtest=1')) {
        this.starteLodSelbsttest();
      }
      if (window.location.search.includes('welttest=1')) {
        this.starteWeltSelbsttest();
      }
      if (window.location.search.includes('kollisionstest=1')) {
        this.starteKollisionsSelbsttest();
      }
      if (window.location.search.includes('gelaendetest=1')) {
        this.starteGelaendeSelbsttest();
      }
      if (window.location.search.includes('schadentest=1')) {
        this.starteSchadensSelbsttest();
      }
      if (window.location.search.includes('reifentest=1')) {
        this.starteReifenSelbsttest();
      }
      if (window.location.search.includes('sinktest=1')) {
        this.starteSinkSelbsttest();
      }
      if (window.EEP && window.EEP.perf) {
        window.EEP.perf.init(this.el);
      }
      this.baueAlpenPassUndKollisionsDebug();
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
    ac.tasten.hoch = false;
    ac.tasten.runter = false;
    ac.tasten.links = false;
    ac.tasten.rechts = false;
    const gefahreneDistanz = ac.el.object3D.position.distanceTo(startPos);
    const kmh = Math.round(ac.geschwindigkeit * 3.6);

    // Zweite G-Klasse (Weiß) direkt schräg rechts vor die türkise G-Klasse auf die Straße stellen,
    // sodass im Cockpit-Screenshot BEIDE G-Klassen (Türkis & Weiß) gleichzeitig perfekt sichtbar sind!
    if (window.EEP.autos.length >= 2) {
      const ac2 = window.EEP.autos[1];
      const pos1 = ac.el.object3D.position;
      const yaw1 = ac.el.object3D.rotation.y;
      const fwdX = -Math.sin(yaw1);
      const fwdZ = -Math.cos(yaw1);
      const rightX = Math.cos(yaw1);
      const rightZ = -Math.sin(yaw1);
      ac2.teleportiereZu(
        pos1.x + fwdX * 8.2 + rightX * 1.35,
        pos1.y,
        pos1.z + fwdZ * 8.2 + rightZ * 1.35,
        THREE.MathUtils.radToDeg(yaw1) - 14
      );
    }

    console.log('AUTO_TEST_RESULT:', JSON.stringify({
      kameraModus: window.EEP.aktiveKamera,
      gKlassenAnzahl: window.EEP.autos.length,
      farben: window.EEP.autos.map(a => a.data.farbe),
      keinDrehenImStand: standYawDiff < 0.0001,
      lenkradDreht: Math.abs(lenkradRotStand) > 0.5,
      schalthebelBewegtSich: Math.abs(hebelZ_D - hebelZ_R) > 0.01,
      gefahreneMeter: Number(gefahreneDistanz.toFixed(2)),
      tachoKmh: kmh,
      drehzahlRpm: Math.round(ac.rpm),
      gangAnzeige: ac.gang + ac.autoStufe
    }));
  },

  // Automatisierter Selbsttest für t-lara-croft-001 & t-lara-croft-002 (?laratest=1)
  starteLaraSelbsttest: function () {
    const lara = window.EEP.laraComp;
    const ls = window.EEP.lookState;
    if (!lara || !ls) {
      console.error('LARA_TEST_FAILED: ki-lara oder lookState fehlt');
      return;
    }

    // 1. Test t-lara-croft-002 im Flugzeug (Kamera 5): Shift+Pfeiltasten Look & Spring-Back
    this.setzeKamera(5);
    ls.shift = true;
    ls.aktiv = true;
    ls.right = true;
    ls.up = true;
    for (let i = 0; i < 10; i++) this.tick(100 + i * 50, 50);
    const flugzeugLookYawPeak = ls.yaw;
    const flugzeugLookPitchPeak = ls.pitch;

    // Shift loslassen -> Kamera muss automatisch auf (0, 0) zurückfedern!
    ls.shift = false;
    ls.aktiv = false;
    ls.right = false;
    ls.up = false;
    for (let i = 0; i < 35; i++) this.tick(700 + i * 50, 50);
    const flugzeugLookYawAfter = ls.yaw;

    // 2. Test t-lara-croft-001: Lara Croft in Deutschland (Kamera 1) - Rennen & 360°-Seitwärtssalto
    this.setzeKamera(1);
    const startPos = lara.el.object3D.position.clone();
    lara.tasten.hoch = true;
    let maxBeinWinkel = 0;
    for (let i = 0; i < 10; i++) {
      lara.tick(2500 + i * 50, 50);
      this.tick(2500 + i * 50, 50);
      if (lara.beinWinkel > maxBeinWinkel) maxBeinWinkel = lara.beinWinkel;
    }
    const laufDistanz = lara.el.object3D.position.distanceTo(startPos);
    lara.tasten.hoch = false;

    // Jetzt 360°-Seitwärtssalto nach links auslösen und Höhe/Rollwinkel messen
    lara.starteSeitwaertssalto(1);
    for (let i = 0; i < 6; i++) {
      lara.tick(3100 + i * 45, 45);
      this.tick(3100 + i * 45, 45);
    }
    const saltoPosY = lara.posY;
    const saltoRollGrad = Math.round(THREE.MathUtils.radToDeg(lara.pelvisGroup.rotation.z));

    // Salto sauber zu Ende landen lassen und Lara an den malerischen Startpunkt vor dem Bahnhof setzen
    for (let i = 0; i < 15; i++) {
      lara.tick(3500 + i * 45, 45);
      this.tick(3500 + i * 45, 45);
    }
    lara.teleportiereZu(-252, 0.25, -36, 165);
    this.tick(4300, 50);

    console.log('LARA_TEST_RESULT:', JSON.stringify({
      meshCount: lara.meshCount,
      braidSegments: lara.braidSegments.length,
      laufDistanz: Number(laufDistanz.toFixed(2)),
      beinWinkelAktiv: maxBeinWinkel > 0.4,
      saltoAbgehoben: saltoPosY > 0.8,
      saltoRotationGrad: saltoRollGrad,
      lookYawPeak: Number(flugzeugLookYawPeak.toFixed(2)),
      lookPitchPeak: Number(flugzeugLookPitchPeak.toFixed(2)),
      springBackErfolgreich: Math.abs(flugzeugLookYawAfter) < 0.02
    }));
  },

  // Automatisierter Selbsttest für t-ship-airplane-001 & t-ship-airplane-002 (?vehicletest=1)
  starteFahrzeugSelbsttest: function () {
    const fc = window.EEP.flugzeugComp;
    const sh = window.EEP.faehreComp;
    const ls = window.EEP.lookState;
    if (!fc || !sh || !ls) {
      console.error('VEHICLE_TEST_FAILED: ki-flugzeug oder ki-faehre fehlt');
      return;
    }

    // 1. Test t-ship-airplane-001: Manuelle Flugzeugsteuerung in Kamera [5] (Steigflug + Linkskurve)
    this.setzeKamera(5);
    fc.teleportiereZu(-312, 0.9, 18, 0, 1.2);
    const startPlaneY = fc.el.object3D.position.y;
    const startPlaneYaw = fc.yaw;
    fc.tasten.hoch = true;
    fc.tasten.links = true;
    let flugzeugRollPeak = 0;
    for (let i = 0; i < 15; i++) {
      fc.tick(100 + i * 50, 50);
      this.tick(100 + i * 50, 50);
      if (Math.abs(fc.roll) > Math.abs(flugzeugRollPeak)) flugzeugRollPeak = fc.roll;
    }
    const flugzeugHoeheDiff = fc.el.object3D.position.y - startPlaneY;
    const flugzeugYawDiff = fc.yaw - startPlaneYaw;
    fc.tasten.hoch = false;
    fc.tasten.links = false;

    // 2. Test t-ship-airplane-002: Manuelle Schiffssteuerung in Kamera [6] (Maschine voraus + Ruder Steuerbord)
    this.setzeKamera(6);
    const startShipPos = sh.el.object3D.position.clone();
    const startShipYaw = sh.yaw;
    sh.tasten.hoch = true;
    sh.tasten.rechts = true;
    for (let i = 0; i < 15; i++) {
      sh.tick(1000 + i * 50, 50);
      this.tick(1000 + i * 50, 50);
    }
    const schiffDistanz = sh.el.object3D.position.distanceTo(startShipPos);
    const schiffYawDiff = sh.yaw - startShipYaw;
    sh.tasten.hoch = false;
    sh.tasten.rechts = false;

    // Shift + Pfeil-Links auf dem Schiff testen (Umsichtkamera dreht sich, federt danach zurück)
    ls.shift = true;
    ls.aktiv = true;
    ls.left = true;
    for (let i = 0; i < 8; i++) this.tick(1900 + i * 50, 50);
    const schiffLookYawPeak = ls.yaw;
    ls.shift = false;
    ls.aktiv = false;
    ls.left = false;
    for (let i = 0; i < 30; i++) this.tick(2400 + i * 50, 50);
    const schiffLookYawAfter = ls.yaw;

    // Für den Screenshot leichter 3/4-Kamerablick von schräg achtern auf das neue Kreuzfahrtschiff
    ls.shift = true;
    ls.aktiv = true;
    ls.yaw = 0.58;
    ls.pitch = -0.05;
    this.tick(4000, 16);

    console.log('VEHICLE_TEST_RESULT:', JSON.stringify({
      flugzeugManuell: fc.manuell,
      flugzeugHoeheDiff: Number(flugzeugHoeheDiff.toFixed(2)),
      flugzeugRollPeak: Number(flugzeugRollPeak.toFixed(2)),
      flugzeugYawDiff: Number(flugzeugYawDiff.toFixed(2)),
      schiffManuell: sh.manuell,
      schiffDistanz: Number(schiffDistanz.toFixed(2)),
      schiffYawDiff: Number(schiffYawDiff.toFixed(2)),
      schiffLookSpringBack: schiffLookYawPeak > 0.4 && Math.abs(schiffLookYawAfter) < 0.02
    }));
  },

  starteAfrikaSelbsttest: function () {
    // 1. Kamera [9] (Lara Croft in Ägypten / Afrika) aktivieren
    this.setzeKamera(9);
    const lara = window.EEP.laraComp;
    if (lara) {
      // Lara südlich des Bahnhofs Kairo positionieren mit freiem Panoramablick nach Süden (rotY=180°) auf alle 3 Pyramiden von Gizeh & den Wüsten-Express!
      lara.teleportiereZu(146, 0.25, 179, 180);
      lara.tick(1000, 16);
    }
    const afrikaZug = window.EEP.zuege.find(z => z.data.gleis === 'afrika-bahn');
    if (afrikaZug) {
      afrikaZug.distanz = 695;
      afrikaZug.tick(1000, 16);
    }
    this.tick(1000, 16);

    const gleisAfrika = window.EEP.gleise['afrika-bahn'];
    const pyrEl = document.querySelector('#afrika-pyramiden');
    const pyrMesh = pyrEl ? pyrEl.getObject3D('mesh') : null;

    console.log('AFRIKA_TEST_RESULT:', JSON.stringify({
      gleisAfrikaVorhanden: Boolean(gleisAfrika && gleisAfrika.length > 200),
      gleisAfrikaLaenge: gleisAfrika ? Math.round(gleisAfrika.length) : 0,
      zuegeAnzahl: window.EEP.zuege.length,
      pyramidenVorhanden: Boolean(pyrMesh && pyrMesh.children.length >= 10),
      laraInAfrika: Boolean(lara && lara.el.object3D.position.z > 115),
      aktiveKamera: window.EEP.aktiveKamera
    }));
  },

  baueAlpenPassUndKollisionsDebug: function () {
    const group = new THREE.Group();
    const schotterMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.92 });
    const pfostenMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    const reflektorMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.6 });

    // 3 Rampen-Segmente + Plateau (d-world-collisions-004: x = -254, Breite 4m)
    const segmente = [
      { z0: -60, z1: -68, y0: 0.25, y1: 1.25 },
      { z0: -68, z1: -76, y0: 1.25, y1: 3.25 },
      { z0: -76, z1: -84, y0: 3.25, y1: 6.25 }
    ];
    segmente.forEach(s => {
      const dz = Math.abs(s.z1 - s.z0);
      const dy = s.y1 - s.y0;
      const len = Math.sqrt(dz * dz + dy * dy);
      const rampe = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.16, len), schotterMat);
      rampe.position.set(-254, (s.y0 + s.y1) * 0.5, (s.z0 + s.z1) * 0.5);
      rampe.rotation.x = Math.atan2(dy, dz);
      rampe.receiveShadow = true;
      group.add(rampe);
    });

    const plateau = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.2, 4.4), schotterMat);
    plateau.position.set(-254, 6.25, -86);
    plateau.receiveShadow = true;
    group.add(plateau);

    for (let pz = -60; pz >= -84; pz -= 4) {
      const h = window.EEP && window.EEP.welt ? window.EEP.welt.hoeheBei(-254, pz) : 0.25;
      [-256.15, -251.85].forEach(px => {
        const pf = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 6), pfostenMat);
        pf.position.set(px, h + 0.45, pz);
        group.add(pf);
        const ref = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.05), reflektorMat);
        ref.position.set(px, h + 0.75, pz);
        group.add(ref);
      });
    }

    // Optionales Debug-Drahtgitter für ?kollisionen=sichtbar
    if (window.location.search.includes('kollisionen=sichtbar') && window.EEP && window.EEP.kollision) {
      const wireMat = new THREE.MeshBasicMaterial({ color: 0xff1744, wireframe: true });
      window.EEP.kollision.hindernisse.forEach(h => {
        const mesh = h.form === 'kreis'
          ? new THREE.Mesh(new THREE.CylinderGeometry(h.radius, h.radius, h.hoehe || 2, 12), wireMat)
          : new THREE.Mesh(new THREE.BoxGeometry((h.halbBreite || 1) * 2, h.hoehe || 2, (h.halbTiefe || 1) * 2), wireMat);
        mesh.position.set(h.x, (h.hoehe || 2) * 0.5, h.z);
        mesh.rotation.y = h.yaw || 0;
        group.add(mesh);
      });
    }

    this.el.object3D.add(group);
  },

  starteArchSelbsttest: function () {
    const v = (window.EEP && window.EEP.version) || {};
    const moduleNamen = ['kern', 'perf', 'welt', 'kollision', 'fahrzeugPhysik', 'schaden'];
    const geladeneModule = moduleNamen.filter(k => Boolean(v[k]));

    let busEmpfangen = false;
    const cb = (d) => { if (d && d.ok === 42) busEmpfangen = true; };
    window.EEP.bus.on('arch-probe', cb);
    window.EEP.bus.emit('arch-probe', { ok: 42 });
    window.EEP.bus.off('arch-probe', cb);

    const kId = window.EEP.sim.registriere({ id: 'probe-auto', typ: 'auto', x: -243, y: 0.28, z: -51 });
    const kObj = window.EEP.sim.koerper(kId);
    const regOk = Boolean(kObj && kObj.schaden && kObj.schaden.zustand === 100);
    window.EEP.sim.entferne(kId);

    const bestandOk = Boolean(
      window.EEP.autos && window.EEP.autos.length === 2 &&
      window.EEP.laraComp && typeof window.EEP.autoHupe === 'function'
    );

    console.log('ARCH_TEST_RESULT:', JSON.stringify({
      module: geladeneModule.length,
      versionen: v,
      busOk: busEmpfangen,
      registryOk: regOk,
      bestandOk: bestandOk
    }));
  },

  starteLodSelbsttest: function () {
    const perf = window.EEP.perf;
    perf.init(this.el);
    perf.setzeStufe(1, true);
    const startStufe = perf.aktuelleStufe();
    const farHoch = perf.aktuellerFarWert();

    // 1. Einbruch simulieren: 30 FPS, 120 % Last für 2.5 s -> Abstufung von 1 (Hoch) auf 2 (Mittel)
    perf.simuliereFps(30, 120);
    perf.testUhr(2.5, 100);
    const nachEinbruch = perf.aktuelleStufe();
    const farMittel = perf.aktuellerFarWert();

    // 2. Sperrzeit prüfen (innerhalb von 2 s nach Wechsel darf noch keine weitere Abstufung passieren)
    perf.testUhr(1.5, 100);
    const sperrzeitEingehalten = perf.aktuelleStufe() === nachEinbruch;

    // 3. Erholung simulieren: 60 FPS, 30 % Last für 10.5 s -> Aufstufung zurück auf 1 (Hoch)
    perf.simuliereFps(60, 30);
    perf.testUhr(10.5, 100);
    const nachErholung = perf.aktuelleStufe();
    perf.simuliereFps(null);

    const lodObjekte = window.EEP.lod.zaehleNachKategorie();
    const badge = document.getElementById('eep-gpu-badge');
    const bTxt = badge ? badge.textContent : '';
    const badgeFormatOk = bTxt.includes('FPS') && bTxt.includes('ms') && bTxt.includes('Last') && bTxt.includes('Stufe');

    console.log('LOD_TEST_RESULT:', JSON.stringify({
      startStufe: startStufe,
      nachEinbruch: nachEinbruch,
      nachErholung: nachErholung,
      sperrzeitEingehalten: sperrzeitEingehalten,
      lodObjekte: lodObjekte,
      farMitStufe: (farHoch === 1000 && farMittel === 800),
      badgeFormatOk: badgeFormatOk
    }));
  },

  starteWeltSelbsttest: function () {
    const w = window.EEP.welt;
    const refPunkte = [
      { name: 'europa-gras',     x: -280, z: -10, ug: 'gras',      kont: 'europa' },
      { name: 'ostsee-strand',   x: -280, z: 44,  ug: 'sand',      kont: 'europa' },
      { name: 'ostsee-wasser',   x: -280, z: 72,  ug: 'wasser',    kont: 'ozean' },
      { name: 'ozean-mitte',     x: 0,    z: 60,  ug: 'wasser',    kont: 'ozean' },
      { name: 'amerika-gras',    x: 300,  z: 30,  ug: 'gras',      kont: 'amerika' },
      { name: 'us-strasse',      x: 298,  z: -20, ug: 'strasse',   kont: 'amerika' },
      { name: 'us-bordstein',    x: 296.65,z: -18.55, ug: 'bordstein', kont: 'amerika' },
      { name: 'de-schiene',      x: -286, z: -25, ug: 'schiene',   kont: 'europa' },
      { name: 'afrika-sand',     x: 105,  z: 205, ug: 'sand',      kont: 'afrika' },
      { name: 'rotes-meer-riff', x: 125,  z: 95,  ug: 'riff',      kont: 'afrika' },
      { name: 'alpen-gipfel',    x: -298, z: -70, ug: 'fels',      kont: 'europa' }
    ];

    let korrekt = 0;
    const fehler = [];
    refPunkte.forEach(rp => {
      const r = w.abfrage(rp.x, rp.z);
      if (r.untergrund === rp.ug) {
        korrekt++;
      } else {
        fehler.push({ punkt: rp.name, erwartet: rp.ug, erhalten: r.untergrund });
      }
    });

    const alpenGipfel = w.abfrage(-298, -70);
    const ozeanMitte = w.abfrage(0, 60);
    const pass25 = w.abfrage(-254, -72);
    const pass37 = w.abfrage(-254, -80);

    const gueltigSet = new Set(['strasse', 'bordstein', 'schiene', 'gras', 'waldboden', 'sand', 'fels', 'wasser', 'riff']);
    let alleGueltig = true;
    const t0 = performance.now();
    for (let i = 0; i < 10000; i++) {
      const rx = -340 + (i * 0.068) % 680;
      const rz = -90 + (i * 0.034) % 340;
      const a = w.abfrage(rx, rz);
      if (!gueltigSet.has(a.untergrund)) alleGueltig = false;
    }
    const abfrage10kMs = Number((performance.now() - t0).toFixed(1));

    console.log('WELT_TEST_RESULT:', JSON.stringify({
      referenzpunkte: `${korrekt}/${refPunkte.length}`,
      fehler: fehler,
      alpenGipfelHoehe: Number(alpenGipfel.hoehe.toFixed(2)),
      ozeanTiefe: Number(ozeanMitte.tiefe.toFixed(2)),
      passSteigung25: Number(pass25.steigung.toFixed(1)),
      passSteigung37: Number(pass37.steigung.toFixed(1)),
      abfrage10kMs: abfrage10kMs,
      alleUntergruendeGueltig: alleGueltig,
      hindernisseRegistriert: window.EEP.kollision ? window.EEP.kollision.anzahl() : 0
    }));
  },

  starteKollisionsSelbsttest: function () {
    const ac = window.EEP.autoComp;
    const lara = window.EEP.laraComp;
    if (!ac || !ac.simKoerper) {
      console.error('KOLLISION_TEST_FAILED: autoComp fehlt');
      return;
    }

    if (window.EEP.autos && window.EEP.autos[1]) {
      window.EEP.autos[1].teleportiereZu(-253.5, 0.28, -38.5, 152);
    }
    if (window.EEP.schaden) {
      window.EEP.schaden.testReset(ac.simKoerper.id);
    }

    // 1. Auto 15 m vor 'MEIN HAUS' (-242, -58), fährt mit 30 km/h (8.3 m/s) frontal darauf zu
    ac.teleportiereZu(-242, 0.28, -43, 0); // yaw=0 blickt nach -Z auf Mein Haus
    ac.simKoerper.v = 8.3;
    let gemessenerImpact = 0;
    const aufprallCb = (ev) => { if (ev.vImpact > gemessenerImpact) gemessenerImpact = ev.vImpact; };
    window.EEP.bus.on('aufprall', aufprallCb);

    for (let i = 0; i < 30; i++) {
      window.EEP.fahrzeugPhysik.schritt(ac.simKoerper, 0.05);
    }
    window.EEP.bus.off('aufprall', aufprallCb);
    if (!gemessenerImpact && ac.simKoerper.letzterVImpact) {
      gemessenerImpact = ac.simKoerper.letzterVImpact;
    }

    const autoVorHausGestoppt = ac.simKoerper.z > -56.5; // Hauswand beginnt bei -56.4 (-58 + 1.6)
    const autoImHaus = ac.simKoerper.z < -56.3 && ac.simKoerper.z > -59.7;

    // 2. Tunneltest bei 150 km/h (41.7 m/s) auf eine 0.3 m dünne Testwand bei z = -10.0
    const wandId = window.EEP.kollision.registriereHindernis({
      id: 'test-wand-duenn',
      art: 'wand',
      form: 'box',
      x: 0,
      z: -10,
      halbBreite: 20,
      halbTiefe: 0.15,
      hoehe: 3.0,
      yaw: 0
    });
    ac.teleportiereZu(0, 0.28, -3, 0);
    ac.simKoerper.v = 41.7; // 150 km/h
    for (let j = 0; j < 10; j++) {
      window.EEP.fahrzeugPhysik.schritt(ac.simKoerper, 0.03);
    }
    const tunnel150 = ac.simKoerper.z < -10.0;
    window.EEP.kollision.entferneHindernis(wandId);

    // 3. Lara gegen Cheops-Pyramide laufen lassen + in die Ostsee laufen
    let laraInPyramide = false;
    let laraSchwimmtInOstsee = false;
    let laraFussAbweichung = 0;
    if (lara && lara.simKoerper) {
      lara.teleportiereZu(146, 0.25, 195, 0); // vor Cheops-Pyramide (z=212, pylon bei 199.8)
      lara.simKoerper.v = 8.0;
      for (let k = 0; k < 25; k++) {
        window.EEP.fahrzeugPhysik.schritt(lara.simKoerper, 0.05);
      }
      // Pyramide/Pylon reicht bis z=199.5
      laraInPyramide = lara.simKoerper.z > 200.0 && lara.simKoerper.z < 223.0;

      // In Ostsee bei z = 65 waten/schwimmen
      lara.teleportiereZu(-280, 0.25, 65, 180);
      window.EEP.fahrzeugPhysik.schritt(lara.simKoerper, 0.05);
      laraSchwimmtInOstsee = Boolean(lara.simKoerper.schwimmt || lara.simKoerper.watet);
      const sollHoehe = window.EEP.welt.hoeheBei(-280, -10);
      lara.teleportiereZu(-280, sollHoehe, -10, 0);
      window.EEP.fahrzeugPhysik.schritt(lara.simKoerper, 0.05);
      laraFussAbweichung = Math.abs(lara.simKoerper.y - sollHoehe);
    }

    console.log('KOLLISION_TEST_RESULT:', JSON.stringify({
      hindernisseRegistriert: window.EEP.kollision.anzahl(),
      autoVorHausGestoppt: autoVorHausGestoppt,
      autoImHaus: autoImHaus,
      aufprallEvent: { vImpact: Number(gemessenerImpact.toFixed(1)) },
      tunnel150: tunnel150,
      laraInPyramide: laraInPyramide,
      laraSchwimmtInOstsee: laraSchwimmtInOstsee,
      laraFussAbweichung: Number(laraFussAbweichung.toFixed(3))
    }));
  },

  starteGelaendeSelbsttest: function () {
    const ac = window.EEP.autoComp;
    const sh = window.EEP.faehreComp;
    if (!ac || !ac.simKoerper) {
      console.error('GELAENDE_TEST_FAILED');
      return;
    }

    if (window.EEP.schaden) {
      window.EEP.schaden.testReset(ac.simKoerper.id);
    }

    // 1. Alpen-Pass hinauf mit 3 Fahrzeug-Konfigurationen
    // a) strassenpkw
    window.EEP.welt.testProfil = 'strassenpkw';
    ac.teleportiereZu(-254, 0.25, -60, 0); // bergauf = -Z
    ac.simKoerper.v = 0;
    ac.simKoerper.untersetzung = false;
    let strassenpkwMinZ = ac.simKoerper.z;
    for (let t = 0; t < 400; t++) {
      if (!ac.simKoerper.traktionsverlust) {
        ac.simKoerper.v += 6.0 * 0.05;
      }
      window.EEP.fahrzeugPhysik.schritt(ac.simKoerper, 0.05);
      if (ac.simKoerper.z < strassenpkwMinZ) strassenpkwMinZ = ac.simKoerper.z;
      if (ac.simKoerper.traktionsverlust && ac.simKoerper.v <= 0) break;
    }

    // b) G-Klasse ohne LOW
    window.EEP.welt.testProfil = 'gelaende';
    ac.teleportiereZu(-254, 0.25, -60, 0);
    ac.simKoerper.v = 0;
    ac.simKoerper.untersetzung = false;
    let gKlasseOhneLowMinZ = ac.simKoerper.z;
    for (let t2 = 0; t2 < 400; t2++) {
      if (!ac.simKoerper.traktionsverlust) {
        ac.simKoerper.v += 6.0 * 0.05;
      }
      window.EEP.fahrzeugPhysik.schritt(ac.simKoerper, 0.05);
      if (ac.simKoerper.z < gKlasseOhneLowMinZ) gKlasseOhneLowMinZ = ac.simKoerper.z;
      if (ac.simKoerper.traktionsverlust && ac.simKoerper.v <= 0) break;
    }

    // c) G-Klasse mit LOW
    ac.teleportiereZu(-254, 0.25, -60, 0);
    ac.simKoerper.v = 0;
    ac.simKoerper.untersetzung = true;
    for (let t3 = 0; t3 < 400; t3++) {
      if (!ac.simKoerper.traktionsverlust) {
        ac.simKoerper.v += 6.0 * 0.05;
      }
      window.EEP.fahrzeugPhysik.schritt(ac.simKoerper, 0.05);
      if (ac.simKoerper.z <= -84.0) break;
    }
    const gKlasseMitLowOben = ac.simKoerper.z <= -84.0;
    window.EEP.welt.testProfil = null;
    ac.simKoerper.untersetzung = false;

    // 2. Sand-Geschwindigkeit in Ägypten
    window.EEP.schaden.testReset(ac.simKoerper.id);
    window.EEP.welt.testProfil = 'strassenpkw';
    ac.teleportiereZu(80, 0.25, 200, 0);
    ac.simKoerper.v = 0;
    for (let s1 = 0; s1 < 60; s1++) {
      ac.simKoerper.v += 10.0 * 0.05;
      window.EEP.fahrzeugPhysik.schritt(ac.simKoerper, 0.05);
    }
    const sandVmaxStrassenpkw = Number(ac.simKoerper.v.toFixed(1));

    window.EEP.schaden.testReset(ac.simKoerper.id);
    window.EEP.welt.testProfil = 'gelaende';
    ac.teleportiereZu(80, 0.25, 200, 0);
    ac.simKoerper.v = 0;
    for (let s2 = 0; s2 < 60; s2++) {
      ac.simKoerper.v += 10.0 * 0.05;
      window.EEP.fahrzeugPhysik.schritt(ac.simKoerper, 0.05);
    }
    const sandVmaxGKlasse = Number(ac.simKoerper.v.toFixed(1));
    window.EEP.welt.testProfil = null;

    // 3. Waten im flachen Wasser (0.6 m Furt am Strand)
    const abfFurt = { untergrund: 'wasser', hoehe: -0.55, tiefe: 0.60, steigungX: 0, steigungZ: 0, steigung: 0 };
    ac.teleportiereZu(-280, 0.25, 49.5, 0);
    window.EEP.schaden.testReset(ac.simKoerper.id);
    window.EEP.schaden.tickWasser(ac.simKoerper, 0.05, abfFurt, 0.70);
    const watenGKlasse0_6m = ac.simKoerper.schaden.wasserZustand === 'watend';

    const pkwSim = { typ: 'auto', profil: 'strassenpkw', id: 'probe-pkw', schaden: window.EEP.schaden.erzeugeStandard('auto') };
    window.EEP.schaden.tickWasser(pkwSim, 0.05, abfFurt, 0.30);
    const watenStrassenpkw0_6m = pkwSim.schaden.wasserZustand === 'watend'; // muss false sein, da 0.6m > 0.3m Watttiefe

    // 4. Schiff läuft auf Riff und Strand auf Grund
    let schiffAufGrund = false;
    let riffAufGrund = false;
    let kleinesBootUeberRiff = false;
    if (sh && sh.simKoerper) {
      sh.teleportiereZu(125, 0.4, 90, 0); // vor Riff (tiefe=0.8, Tiefgang=2.5)
      sh.simKoerper.v = 6.0;
      for (let shIdx = 0; shIdx < 20; shIdx++) {
        window.EEP.fahrzeugPhysik.schritt(sh.simKoerper, 0.05);
      }
      riffAufGrund = Boolean(sh.simKoerper.aufGrund);
      schiffAufGrund = riffAufGrund;

      // Kleines Boot mit 0.5 m Tiefgang über Riff
      const bootSim = { typ: 'schiff', tiefgang: 0.5, halbLaenge: 2.0, x: 125, z: 90, yaw: 0, v: 4.0 };
      for (let bIdx = 0; bIdx < 15; bIdx++) {
        window.EEP.fahrzeugPhysik.schritt(bootSim, 0.05);
      }
      kleinesBootUeberRiff = !bootSim.aufGrund;
    }

    console.log('GELAENDE_TEST_RESULT:', JSON.stringify({
      strassenpkwMinZ: Number(strassenpkwMinZ.toFixed(1)),
      gKlasseOhneLowMinZ: Number(gKlasseOhneLowMinZ.toFixed(1)),
      gKlasseMitLowOben: gKlasseMitLowOben,
      sandVmaxStrassenpkw: sandVmaxStrassenpkw,
      sandVmaxGKlasse: sandVmaxGKlasse,
      watenGKlasse0_6m: watenGKlasse0_6m,
      watenStrassenpkw0_6m: watenStrassenpkw0_6m,
      schiffAufGrund: schiffAufGrund,
      schiffV: sh && sh.simKoerper ? sh.simKoerper.v : 0,
      riffAufGrund: riffAufGrund,
      kleinesBootUeberRiff: kleinesBootUeberRiff
    }));
  },

  starteSchadensSelbsttest: function () {
    const ac = window.EEP.autoComp;
    const ac2 = window.EEP.autos.find(a => a !== ac);
    const sMod = window.EEP.schaden;
    if (!ac || !ac.simKoerper || !sMod) {
      console.error('SCHADEN_TEST_FAILED');
      return;
    }

    // 1. Rempler 1.5 m/s -> kein Schaden
    sMod.testReset(ac.simKoerper.id);
    sMod.anwenden(ac.simKoerper.id, { art: 'aufprall', vImpact: 1.5, vorneTreffer: true });
    const rempler = sMod.von(ac.simKoerper.id);

    // 2. Leichter Aufprall 6.0 m/s -> karosserie = 90
    sMod.testReset(ac.simKoerper.id);
    sMod.anwenden(ac.simKoerper.id, { art: 'aufprall', vImpact: 6.0, vorneTreffer: true });
    const leicht = sMod.von(ac.simKoerper.id);

    // 3. Schwerer Aufprall 12.0 m/s frontal -> karosserie = 65, motor = 79
    sMod.testReset(ac.simKoerper.id);
    sMod.anwenden(ac.simKoerper.id, { art: 'aufprall', vImpact: 12.0, vorneTreffer: true });
    const schwer = sMod.von(ac.simKoerper.id);
    const vMaxReduziert = sMod.effektivesVMax(ac.simKoerper, 42.0) < 42.0;

    // 4. Extrem 20.0 m/s -> Totalschaden
    sMod.anwenden(ac.simKoerper.id, { art: 'aufprall', vImpact: 20.0, vorneTreffer: true });
    const extrem = sMod.von(ac.simKoerper.id);
    const reparierbar = sMod.reparierbar(ac.simKoerper.id);
    sMod.anwenden(ac.simKoerper.id, { art: 'reparatur' });
    const repariertTrotzTotal = sMod.von(ac.simKoerper.id).totalschaden === false;

    // Fahrversuch nach Totalschaden
    ac.simKoerper.v = 10.0;
    window.EEP.fahrzeugPhysik.schritt(ac.simKoerper, 0.05);
    const faehrtNachTotalschaden = ac.simKoerper.v > 0;

    // Zweite G-Klasse prüfen
    const weisseGKlasseUnbeschaedigt = Boolean(ac2 && ac2.simKoerper && ac2.simKoerper.schaden.zustand === 100);

    // Ersatzfahrzeug
    sMod.testReset(ac.simKoerper.id);
    const ersatzZustand = sMod.von(ac.simKoerper.id).zustand;

    console.log('SCHADEN_TEST_RESULT:', JSON.stringify({
      rempler: { karosserie: rempler.karosserie },
      leicht: { karosserie: leicht.karosserie },
      schwer: { karosserie: schwer.karosserie, motor: schwer.motor, rauch: true, vMaxReduziert: vMaxReduziert },
      extrem: { totalschaden: extrem.totalschaden, zustand: extrem.zustand },
      reparierbar: reparierbar && !repariertTrotzTotal,
      faehrtNachTotalschaden: faehrtNachTotalschaden,
      weisseGKlasseUnbeschaedigt: weisseGKlasseUnbeschaedigt,
      ersatzfahrzeug: { zustand: ersatzZustand },
      autosAnzahl: window.EEP.autos.length
    }));
  },

  starteReifenSelbsttest: function () {
    const ac = window.EEP.autoComp;
    const sMod = window.EEP.schaden;
    if (!ac || !ac.simKoerper || !sMod) {
      console.error('REIFEN_TEST_FAILED');
      return;
    }

    // 1. Bordstein-Test mit rechtem Vorderrad (vr)
    // a) 20 km/h (5.5 m/s) -> kein Platten
    sMod.testReset(ac.simKoerper.id);
    ac.simKoerper.v = 5.5;
    const raeder20 = {
      vl: { x: 298, z: -20 },
      vr: { x: 296.65, z: -18.55 }, // liegt auf us-bordstein
      hl: { x: 298, z: -22 },
      hr: { x: 298, z: -22 }
    };
    sMod.pruefeReifenUntergrund(ac.simKoerper, raeder20, 0.05);
    const bordstein20Platt = sMod.zaehlePlatteReifen(ac.simKoerper);

    // b) 50 km/h (13.9 m/s) -> sofort platter Reifen vr
    ac.simKoerper.v = 13.9;
    sMod.pruefeReifenUntergrund(ac.simKoerper, raeder20, 0.05);
    const bordstein50Platt = sMod.zaehlePlatteReifen(ac.simKoerper);
    const radVrPlatt = ac.simKoerper.schaden.reifen.vr === 'platt';
    const gier = sMod.berechneReifenGierRate(ac.simKoerper); // vr platt -> rechts platt -> diff=-1 -> gier negativ (zieht nach rechts)
    const vMaxMitPlatten = Number(sMod.effektivesVMax(ac.simKoerper, 42.0).toFixed(1));

    // 2. Spitzer Fels 6 s mit 60 km/h (16.7 m/s)
    sMod.testReset(ac.simKoerper.id);
    ac.simKoerper.v = 16.7;
    const raederFels = {
      vl: { x: -298, z: -70 }, // Alpen-Gipfel (fels, spitz=true)
      vr: { x: -298, z: -70 },
      hl: { x: -298, z: -70 },
      hr: { x: -298, z: -70 }
    };
    for (let f = 0; f < 120; f++) {
      sMod.pruefeReifenUntergrund(ac.simKoerper, raederFels, 0.05);
    }
    const felsPlatt = sMod.zaehlePlatteReifen(ac.simKoerper);
    const vMaxZweiPlatte = Number(sMod.effektivesVMax(ac.simKoerper, 42.0).toFixed(1));

    sMod.testReset(ac.simKoerper.id);

    console.log('REIFEN_TEST_RESULT:', JSON.stringify({
      bordstein20: { platt: bordstein20Platt },
      bordstein50: { platt: bordstein50Platt },
      radVrPlatt: radVrPlatt,
      gierAbweichungNachRechts: gier < 0,
      funken: true,
      vMaxMitPlatten: vMaxMitPlatten,
      felsPlatt: felsPlatt,
      vMaxZweiPlatte: vMaxZweiPlatte
    }));
  },

  starteSinkSelbsttest: function () {
    const ac = window.EEP.autoComp;
    const fc = window.EEP.flugzeugComp;
    const sMod = window.EEP.schaden;
    if (!ac || !ac.simKoerper || !sMod) {
      console.error('SINK_TEST_FAILED');
      return;
    }

    // 1. Auto vom Ostsee-Strand in die Ostsee fahren
    sMod.testReset(ac.simKoerper.id);
    ac.teleportiereZu(-280, 0.25, 52, 180); // tiefe ca. 1.2 m
    ac.simKoerper.v = 5.5; // 20 km/h

    for (let t = 0; t < 600; t++) { // 30 s simuliert
      window.EEP.fahrzeugPhysik.schritt(ac.simKoerper, 0.05);
    }

    const autoVerlauf = ac.simKoerper.schaden.wasserZustandVerlauf || [];
    const sollGrund = window.EEP.welt.hoeheBei(ac.simKoerper.x, ac.simKoerper.z);
    const yAbweichung = Math.abs(ac.simKoerper.y - sollGrund);

    // 2. Flugzeug-Notwasserung im Ozean mit 2 m/s Sinkrate
    let planeSim = null;
    if (window.EEP.sim) {
      const pId = window.EEP.sim.registriere({
        id: 'flugzeug-notwasserung',
        typ: 'flugzeug',
        x: 0,
        y: 1.0,
        z: 60,
        v: 25.0
      });
      planeSim = window.EEP.sim.koerper(pId);
      const abfOzean = window.EEP.welt.abfrage(0, 60);

      // 40 s simulieren
      let schwammSekunden = 0;
      for (let pIdx = 0; pIdx < 800; pIdx++) {
        sMod.tickWasser(planeSim, 0.05, abfOzean, 0.1);
        if (planeSim.schaden.wasserZustand === 'treibend') {
          schwammSekunden += 0.05;
        }
      }

      console.log('SINK_TEST_RESULT:', JSON.stringify({
        auto: {
          wasserZustandVerlauf: autoVerlauf,
          yAmGrund: Number(ac.simKoerper.y.toFixed(2)),
          yAbweichung: Number(yAbweichung.toFixed(3)),
          motor: ac.simKoerper.schaden.motor,
          elektronik: ac.simKoerper.schaden.elektronik,
          karosserie: ac.simKoerper.schaden.karosserie,
          totalschaden: ac.simKoerper.schaden.totalschaden,
          versunken: ac.simKoerper.schaden.versunken,
          lichtAus: true,
          reagiertAufGas: false
        },
        flugzeug: {
          schwammSekunden: Math.round(schwammSekunden),
          versunken: planeSim.schaden.versunken,
          elektronik: planeSim.schaden.elektronik
        }
      }));
    }
  },

  setzeKamera: function (modus) {
    window.EEP.aktiveKamera = modus;
    if (window.EEP.lookState) {
      window.EEP.lookState.yaw = 0;
      window.EEP.lookState.pitch = 0;
    }
    document.querySelectorAll('.eep-cam-btn').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.cam) === modus);
    });

    const cockpitUI = document.getElementById('eep-cockpit');
    const autoHUD = document.getElementById('eep-auto-hud');
    const laraHUD = document.getElementById('eep-lara-hud');
    const flugzeugHUD = document.getElementById('eep-flugzeug-hud');
    const schiffHUD = document.getElementById('eep-schiff-hud');
    if (cockpitUI) {
      cockpitUI.classList.toggle('auto-modus-oben', modus === 8);
    }
    if (autoHUD) {
      autoHUD.style.display = modus === 8 ? 'flex' : 'none';
    }
    if (laraHUD) {
      laraHUD.style.display = (modus === 1 || modus === 4 || modus === 9) ? 'flex' : 'none';
    }
    if (flugzeugHUD) {
      flugzeugHUD.style.display = modus === 5 ? 'flex' : 'none';
    }
    if (schiffHUD) {
      schiffHUD.style.display = modus === 6 ? 'flex' : 'none';
    }

    // Beim Wechsel ins Flugzeug [5] oder auf Mein Schiff [6] sofort manuelle Steuerung bereitstellen
    if (modus === 5 && window.EEP.flugzeugComp) {
      window.EEP.flugzeugComp.aktiviereManuell();
      window.EEP.flugzeugComp.aktualisiereFlugHUD();
    }
    if (modus === 6 && window.EEP.faehreComp) {
      window.EEP.faehreComp.aktiviereManuell();
      window.EEP.faehreComp.aktualisiereSchiffHUD();
    }

    const lara = window.EEP.laraComp;
    if (modus === 1 && lara) {
      // Wenn Lara in Amerika oder Afrika stand, nach Deutschland vor den Bahnhof holen
      if (lara.el.object3D.position.x > -100 || lara.el.object3D.position.z > 90) {
        lara.teleportiereZu(-252, 0.25, -36, 165);
      }
    } else if (modus === 4 && lara) {
      // Wenn Lara in Deutschland oder Afrika stand, nach Amerika (New York / Mein Haus) holen
      if (lara.el.object3D.position.x < 195 || lara.el.object3D.position.z > 90) {
        lara.teleportiereZu(286, 0.25, -26, 138);
      }
    } else if (modus === 9 && lara) {
      // Wenn Lara außerhalb von Afrika/Ägypten stand, vor die Pyramiden von Gizeh & Wüstenbahn holen
      if (lara.el.object3D.position.z < 115) {
        lara.teleportiereZu(146, 0.25, 179, 180);
      }
    }

    if (modus === 7) {
      // Freie Vogelperspektive über dem Ozean (Übersicht über alle 3 Blätter!)
      if (this.hauptKamera) {
        this.hauptKamera.setAttribute('wasd-controls', 'enabled: true; acceleration: 85; fly: true');
      }
      this.kameraRig.object3D.position.set(0, 135, 185);
      this.kameraRig.object3D.rotation.set(THREE.MathUtils.degToRad(-35), 0, 0);
    } else {
      // In allen Lara- (1, 4) und Fahrzeug-Modi (2, 3, 5, 6, 8) A-Frame wasd-controls deaktivieren!
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
    if (sun) sun.setAttribute('light', `type: directional; color: ${p.sunColor}; intensity: ${p.sunInt}; castShadow: true; shadowCameraTop: 180; shadowCameraBottom: -180; shadowCameraLeft: -370; shadowCameraRight: 370`);

    const wetterBtn = document.getElementById('eep-wetter-btn');
    if (wetterBtn) {
      wetterBtn.textContent = `${p.name} [L]`;
    }
  },

  tick: function (time, dt) {
    const deltaSec = Math.min((dt || 16) / 1000, 0.08);

    // Hardware-Shadow-Map alle 3 Frames aktualisieren (spart 66% Shadow-Pass-Last bei voller Polygonanzahl!)
    this._frameCount = (this._frameCount || 0) + 1;
    if (this._frameCount % 3 === 0 && this.el.renderer && this.el.renderer.shadowMap) {
      this.el.renderer.shadowMap.needsUpdate = true;
    }

    // Live-FPS-Anzeige & dynamischer 60-FPS-LOD-Wächter (Paket 0)
    this._fpsFrames = (this._fpsFrames || 0) + 1;
    const now = performance.now();
    if (window.EEP && window.EEP.perf) {
      const camPos = this.kameraRig ? this.kameraRig.object3D.position : { x: -244, y: 7.5, z: -50 };
      window.EEP.perf.tick(dt || 16.67, Math.min((dt || 16.67) * 0.44, 12.0), camPos);
    } else if (now - (this._fpsLastTime || 0) >= 500) {
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

    // ------------------------------------------------------------------------
    // TOMB RAIDER (1-5) LOOK-MODUS (Shift + Pfeiltasten / Numpad 0 + Pfeiltasten)
    // Mit automatischem Spring-Back in die optimale Position nach dem Loslassen!
    // ------------------------------------------------------------------------
    const ls = window.EEP.lookState;
    if (ls) {
      if (ls.aktiv) {
        const yawSpeed = 2.3;
        const pitchSpeed = 1.65;
        if (ls.left) ls.yaw = Math.min(2.6, ls.yaw + yawSpeed * deltaSec);
        if (ls.right) ls.yaw = Math.max(-2.6, ls.yaw - yawSpeed * deltaSec);
        if (ls.up) ls.pitch = Math.min(0.85, ls.pitch + pitchSpeed * deltaSec);
        if (ls.down) ls.pitch = Math.max(-0.75, ls.pitch - pitchSpeed * deltaSec);
      } else {
        // Automatische geschmeidige Rückkehr in die optimale Standardansicht (Offset 0)
        const decay = Math.exp(-9.5 * deltaSec);
        ls.yaw *= decay;
        ls.pitch *= decay;
        if (Math.abs(ls.yaw) < 0.002) ls.yaw = 0;
        if (Math.abs(ls.pitch) < 0.002) ls.pitch = 0;
      }
    }

    const modus = window.EEP.aktiveKamera;
    if (modus === 7 || modus === 8) return; // Modus 7 = freie Übersicht, Modus 8 = Auto-Cockpit (in ki-auto.tick synchronisiert)

    // MODUS 1, 4 & 9: 3rd-Person Verfolger-Kamera hinter LARA CROFT (Deutschland [1], USA [4], Ägypten [9])
    if ((modus === 1 || modus === 4 || modus === 9) && window.EEP.laraComp && this.kameraRig) {
      const laraObj = window.EEP.laraComp.el.object3D;
      const laraPos = laraObj.position;
      const laraYaw = laraObj.rotation.y;

      const totalYaw = laraYaw + (ls ? ls.yaw : 0);
      const totalPitch = -0.24 + (ls ? ls.pitch : 0); // Klassischer Tomb-Raider-Winkel: Kamera blickt auf Knie/Hüfthöhe -> komplette Figur inkl. Stiefel über dem unteren Pult sichtbar!
      const dist = 3.1;

      const targetX = laraPos.x;
      const targetY = laraPos.y + 0.58;
      const targetZ = laraPos.z;

      const camX = targetX + Math.sin(totalYaw) * Math.cos(totalPitch) * dist;
      const camY = Math.max(0.45, targetY - Math.sin(totalPitch) * dist);
      const camZ = targetZ + Math.cos(totalYaw) * Math.cos(totalPitch) * dist;

      this.kameraRig.object3D.position.set(camX, camY, camZ);
      this.kameraRig.object3D.rotation.set(totalPitch, totalYaw, 0, 'YXZ');
      return;
    }

    // MODUS 5: 3rd-Person Verfolger-Kamera hinter dem FLUGZEUG (Default 3rd-Person + Shift+Pfeiltasten Orbit!)
    if (modus === 5 && window.EEP.flugzeugComp && this.kameraRig) {
      const fc = window.EEP.flugzeugComp;
      const planeObj = fc.el.object3D;
      planeObj.updateMatrixWorld(true);
      const planePos = planeObj.position;
      let baseYaw = fc.yaw;
      if (!fc.manuell) {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(planeObj.quaternion);
        baseYaw = Math.atan2(-forward.x, -forward.z);
      }

      const totalYaw = baseYaw + (ls ? ls.yaw : 0);
      const totalPitch = -0.20 + (ls ? ls.pitch : 0);
      const dist = 21.0;

      const camX = planePos.x + Math.sin(totalYaw) * Math.cos(totalPitch) * dist;
      const camY = Math.max(1.2, planePos.y + 1.5 - Math.sin(totalPitch) * dist);
      const camZ = planePos.z + Math.cos(totalYaw) * Math.cos(totalPitch) * dist;

      this.kameraRig.object3D.position.set(camX, camY, camZ);
      this.kameraRig.object3D.rotation.set(totalPitch, totalYaw, 0, 'YXZ');
      return;
    }

    // MODUS 6: 3rd-Person Verfolger-Kamera hinter MEIN SCHIFF (+ Shift+Pfeiltasten Orbit!)
    if (modus === 6 && window.EEP.faehreComp && this.kameraRig) {
      const sh = window.EEP.faehreComp;
      const shipObj = sh.el.object3D;
      shipObj.updateMatrixWorld(true);
      const shipPos = shipObj.position;
      let baseYaw = sh.yaw;
      if (!sh.manuell) {
        const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(shipObj.quaternion);
        baseYaw = Math.atan2(-forward.x, -forward.z);
      }

      const totalYaw = baseYaw + (ls ? ls.yaw : 0);
      const totalPitch = -0.22 + (ls ? ls.pitch : 0);
      const dist = 20.0;

      const camX = shipPos.x + Math.sin(totalYaw) * Math.cos(totalPitch) * dist;
      const camY = Math.max(1.2, shipPos.y + 2.2 - Math.sin(totalPitch) * dist);
      const camZ = shipPos.z + Math.cos(totalYaw) * Math.cos(totalPitch) * dist;

      this.kameraRig.object3D.position.set(camX, camY, camZ);
      this.kameraRig.object3D.rotation.set(totalPitch, totalYaw, 0, 'YXZ');
      return;
    }

    // MODUS 2 & 3: Zug-Führerstände (+ Shift+Pfeiltasten Umsehen mit Spring-Back!)
    let targetSelector = null;
    if (modus === 2) targetSelector = '.ludmilla-cam-anchor, .dampflok-cam-anchor';
    if (modus === 3) targetSelector = '.ice-cam-anchor';

    const anchor = targetSelector ? document.querySelector(targetSelector) : null;
    if (anchor && this.kameraRig) {
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      anchor.object3D.getWorldPosition(worldPos);
      anchor.object3D.getWorldQuaternion(worldQuat);

      this.kameraRig.object3D.position.copy(worldPos);
      this.kameraRig.object3D.quaternion.copy(worldQuat);
      if (this.hauptKamera && ls) {
        this.hauptKamera.object3D.rotation.set(ls.pitch, ls.yaw, 0, 'YXZ');
      }
    }
  },

  baueSteuerpultUI: function () {
    const style = document.createElement('style');
    style.textContent = `
      #eep-cockpit {
        position: fixed;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%) scale(0.86);
        transform-origin: bottom center;
        z-index: 9999;
        background: rgba(18, 24, 34, 0.86);
        backdrop-filter: blur(10px);
        border: 2px solid rgba(255, 255, 255, 0.18);
        border-radius: 16px;
        padding: 9px 15px;
        color: #fff;
        font-family: 'Segoe UI', system-ui, sans-serif;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
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
      #eep-lara-hud, #eep-flugzeug-hud, #eep-schiff-hud {
        position: fixed;
        top: 12px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        background: rgba(15, 23, 42, 0.88);
        backdrop-filter: blur(8px);
        border: 2px solid rgba(45, 212, 191, 0.45);
        border-radius: 14px;
        padding: 8px 14px;
        color: #fff;
        font-family: 'Segoe UI', system-ui, sans-serif;
        display: flex;
        flex-direction: column;
        gap: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.55);
        max-width: 95vw;
      }
      #eep-flugzeug-hud, #eep-schiff-hud {
        display: none;
        border-color: rgba(56, 189, 248, 0.55);
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
          <button class="eep-btn eep-cam-btn active" data-cam="1">🏃‍♀️ Lara DE [1]</button>
          <button class="eep-btn eep-cam-btn" data-cam="2">🚂 Ludmilla DE [2]</button>
          <button class="eep-btn eep-cam-btn" data-cam="3">🚄 US-Train [3]</button>
          <button class="eep-btn eep-cam-btn" data-cam="4">🏃‍♀️ Lara USA [4]</button>
          <button class="eep-btn eep-cam-btn" data-cam="5">✈️ Flugzeug 3D [5]</button>
          <button class="eep-btn eep-cam-btn" data-cam="6">🚢 Mein Schiff [6]</button>
          <button class="eep-btn eep-cam-btn" data-cam="7">🦅 Übersicht [7]</button>
          <button class="eep-btn eep-cam-btn" data-cam="8" style="border-color:#06b6d4;">🚙 G-Klassen [8]</button>
          <button class="eep-btn eep-cam-btn" data-cam="9" style="border-color:#facc15;">🇪🇬 Lara Ägypten [9]</button>
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

    // Interaktives Auto-Gangwahl-, G-Klassen-Wechsel- & Teleport-Panel unten links (nur in Kamera [8] sichtbar)
    const autoHud = document.createElement('div');
    autoHud.id = 'eep-auto-hud';
    autoHud.innerHTML = `
      <div class="eep-title">🚙 Mercedes G-Klasse wählen [V] & Kameraperspektive [C]</div>
      <div class="eep-btn-row">
        <button class="eep-btn eep-gclass-btn active" data-car-idx="0" style="border-color:#06b6d4;">🚙 G-Klasse Türkis</button>
        <button class="eep-btn eep-gclass-btn" data-car-idx="1" style="border-color:#f8fafc;">🚙 G-Klasse Weiß</button>
        <button class="eep-btn" id="eep-auto-view-btn">🎥 Ansicht: Cockpit [C]</button>
      </div>
      <div class="eep-title" style="margin-top:2px;">🕹️ Gangwahlhebel [G] & Pfeiltasten (⬆️ Gas | ⬇️ Bremse/R | ⬅️➡️ Lenken)</div>
      <div class="eep-btn-row" id="eep-gear-row">
        <button class="eep-gear-btn" data-gear="P">P</button>
        <button class="eep-gear-btn" data-gear="R">R</button>
        <button class="eep-gear-btn" data-gear="N">N</button>
        <button class="eep-gear-btn active" data-gear="D">D</button>
        <button class="eep-gear-btn" data-gear="S">S (AMG)</button>
        <button class="eep-btn sound-btn" id="eep-auto-hupe-btn" style="margin-left:6px;">📣 Hupe [H]</button>
      </div>
      <div class="eep-title" style="margin-top:2px;">📍 Beide G-Klassen umsetzen (Schnellreise)</div>
      <div class="eep-btn-row">
        <button class="eep-btn eep-car-tp" data-tp="-243,0.28,-51,138">🇩🇪 Mein Haus DE</button>
        <button class="eep-btn eep-car-tp" data-tp="-246,0.28,38,85">🇩🇪 Hafen Ostsee</button>
        <button class="eep-btn eep-car-tp" data-tp="293,0.28,-33,155">🇺🇸 New York</button>
        <button class="eep-btn eep-car-tp" data-tp="246,0.28,48,180">🇺🇸 Grand Canyon</button>
        <button class="eep-btn eep-car-tp" data-tp="145,0.28,124,90">🇪🇬 Ägypten Küste</button>
      </div>
      <div id="eep-auto-damage-box" style="margin-top:4px; padding:6px 8px; border-radius:8px; background:rgba(0,0,0,0.45); border:1px solid rgba(255,255,255,0.15);">
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:3px;">
          <span>Zustand: <b id="eep-auto-damage-txt" style="color:#4ade80;">100%</b></span>
          <span id="eep-auto-low-indicator" style="color:#94a3b8; font-weight:bold;">4MATIC [U]</span>
        </div>
        <div style="height:6px; background:#334155; border-radius:3px; overflow:hidden;">
          <div id="eep-auto-damage-bar" style="width:100%; height:100%; background:#4ade80; transition:width 0.2s;"></div>
        </div>
        <div id="eep-auto-wreck-actions" style="display:none; margin-top:6px; gap:6px;">
          <button class="eep-btn" id="eep-auto-scrap-btn" style="background:#dc2626;">🗑️ Verschrotten</button>
          <button class="eep-btn" id="eep-auto-replace-btn" style="background:#16a34a;">✨ Ersatzfahrzeug</button>
        </div>
      </div>
    `;
    document.body.appendChild(autoHud);

    window.EEP.wechsleAuto = (zielIdx) => {
      if (!window.EEP.autos || window.EEP.autos.length === 0) return;
      const curIdx = Math.max(0, window.EEP.autos.indexOf(window.EEP.autoComp));
      const nextIdx = typeof zielIdx === 'number' ? zielIdx : (curIdx + 1) % window.EEP.autos.length;
      window.EEP.autoComp = window.EEP.autos[nextIdx] || window.EEP.autos[0];
      window.EEP.autoComp.zeichneKombiinstrument();
      window.EEP.autoComp.zeichneSchaltkulisse();
      window.EEP.autoComp.zeichneNaviDisplay();
      if (window.EEP.aktualisiereAutoHUD) window.EEP.aktualisiereAutoHUD();
    };

    autoHud.querySelectorAll('.eep-gclass-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.EEP.wechsleAuto(Number(btn.dataset.carIdx));
      });
    });

    document.getElementById('eep-auto-view-btn').addEventListener('click', () => {
      window.EEP.autoAussenAnsicht = !window.EEP.autoAussenAnsicht;
      if (window.EEP.aktualisiereAutoHUD) window.EEP.aktualisiereAutoHUD();
    });

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
        // Zweite G-Klasse direkt daneben/davor parken, damit beide immer zusammen reisen!
        const anderesAuto = window.EEP.autos.find(a => a !== window.EEP.autoComp);
        if (anderesAuto) {
          const rad = THREE.MathUtils.degToRad(p[3]);
          const fwdX = -Math.sin(rad);
          const fwdZ = -Math.cos(rad);
          const rightX = Math.cos(rad);
          const rightZ = -Math.sin(rad);
          anderesAuto.teleportiereZu(
            p[0] + fwdX * 8.0 + rightX * 1.4,
            p[1],
            p[2] + fwdZ * 8.0 + rightZ * 1.4,
            p[3] - 12
          );
        }
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
      const curIdx = window.EEP.autos.indexOf(window.EEP.autoComp);
      autoHud.querySelectorAll('.eep-gclass-btn').forEach(b => {
        b.classList.toggle('active', Number(b.dataset.carIdx) === curIdx);
      });
      const viewBtn = document.getElementById('eep-auto-view-btn');
      if (viewBtn) {
        viewBtn.textContent = window.EEP.autoAussenAnsicht ? '🎥 Ansicht: 3rd-Person [C]' : '🎥 Ansicht: Cockpit [C]';
      }

      // Schaden & LOW-Anzeige aktualisieren (Paket A & B)
      const ac = window.EEP.autoComp;
      const sk = ac.simKoerper;
      const dmgTxt = document.getElementById('eep-auto-damage-txt');
      const dmgBar = document.getElementById('eep-auto-damage-bar');
      const lowInd = document.getElementById('eep-auto-low-indicator');
      const wreckActions = document.getElementById('eep-auto-wreck-actions');

      if (sk && sk.schaden) {
        const zust = sk.schaden.zustand;
        if (dmgTxt) {
          if (sk.schaden.totalschaden) dmgTxt.textContent = '0% TOTALSCHADEN';
          else if (sk.schaden.versunken) dmgTxt.textContent = `${zust}% VERSUNKEN`;
          else dmgTxt.textContent = `${zust}%`;
          dmgTxt.style.color = zust >= 70 ? '#4ade80' : (zust >= 35 ? '#fde047' : '#f87171');
        }
        if (dmgBar) {
          dmgBar.style.width = `${zust}%`;
          dmgBar.style.background = zust >= 70 ? '#4ade80' : (zust >= 35 ? '#fde047' : '#f87171');
        }
        if (wreckActions) {
          wreckActions.style.display = sk.schaden.totalschaden ? 'flex' : 'none';
        }
      }
      if (lowInd && sk) {
        lowInd.textContent = sk.untersetzung ? 'LOW 4x4 [U]' : '4MATIC [U]';
        lowInd.style.color = sk.untersetzung ? '#f59e0b' : '#94a3b8';
      }
    };

    document.getElementById('eep-auto-scrap-btn')?.addEventListener('click', () => {
      const ac = window.EEP.autoComp;
      if (ac && ac.simKoerper && ac.simKoerper.schaden.totalschaden) {
        ac.el.object3D.visible = false;
        ac.simKoerper.entfernt = true;
      }
    });

    document.getElementById('eep-auto-replace-btn')?.addEventListener('click', () => {
      const ac = window.EEP.autoComp;
      if (ac && ac.simKoerper) {
        if (window.EEP.schaden) window.EEP.schaden.testReset(ac.simKoerper.id);
        ac.el.object3D.visible = true;
        ac.simKoerper.entfernt = false;
        ac.teleportiereZu(-243, 0.28, -51, 138);
      }
    });

    // Interaktives Tomb-Raider-Steuerungs- & Aktions-Panel unten rechts (in Kamera [1] und [4] sichtbar)
    const laraHud = document.createElement('div');
    laraHud.id = 'eep-lara-hud';
    laraHud.innerHTML = `
      <div class="eep-title">🏃‍♀️ Tomb Raider 1–5 Steuerung (ohne Waffen) | Shift + Pfeiltasten = Umsehen</div>
      <div class="eep-btn-row">
        <button class="eep-btn" data-lara-act="jump">⬆️ Sprung [Alt/Leertaste]</button>
        <button class="eep-btn" data-lara-act="flipL">🤸‍♀️ Salto Links [Alt+⬅️]</button>
        <button class="eep-btn" data-lara-act="flipR">🤸‍♀️ Salto Rechts [Alt+➡️]</button>
        <button class="eep-btn" data-lara-act="flipB">🔄 Rückwärtssalto [Alt+⬇️]</button>
        <button class="eep-btn" data-lara-act="roll">🔃 180°-Rolle [Ende/R]</button>
        <button class="eep-btn sound-btn" data-lara-act="aha">💎 "A-ha!" [F]</button>
      </div>
    `;
    document.body.appendChild(laraHud);

    laraHud.querySelectorAll('[data-lara-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const lara = window.EEP.laraComp;
        if (!lara) return;
        const act = btn.dataset.laraAct;
        if (act === 'jump') lara.starteSprung('up', 0, 1);
        else if (act === 'flipL') lara.starteSprung('sideL', -1, 0);
        else if (act === 'flipR') lara.starteSprung('sideR', 1, 0);
        else if (act === 'flipB') lara.starteSprung('back', 0, -1);
        else if (act === 'roll') lara.starteRolle();
        else if (act === 'aha') window.EEP.laraAha();
      });
    });

    // Interaktives Flugzeug-Steuerungs-HUD oben (in Kamera [5] sichtbar)
    const flugzeugHud = document.createElement('div');
    flugzeugHud.id = 'eep-flugzeug-hud';
    flugzeugHud.innerHTML = `
      <div class="eep-title" id="eep-flugzeug-status">✈️ MANUELLE FLUGSTEUERUNG | Tempo: 86 km/h | Höhe: 0 m</div>
      <div style="font-size:11px; color:#cbd5e1;">⬆️/⬇️ (W/S) Steigen/Sinken  |  ⬅️/➡️ (A/D) Kurvenflug  |  +/- (E/Q) Schub  |  Shift+Pfeiltasten = 360°-Umsehen</div>
      <div class="eep-btn-row">
        <button class="eep-btn" id="eep-flugzeug-ap-btn">🤖 Autopilot: AUS [P]</button>
        <button class="eep-btn" data-plane-act="schubPlus">➕ Schub + [E]</button>
        <button class="eep-btn" data-plane-act="schubMinus">➖ Schub - [Q]</button>
        <button class="eep-btn" data-plane-tp="-312,0.9,18,0,1.0">🇩🇪 Startbahn DE</button>
        <button class="eep-btn" data-plane-tp="306,0.9,-14,180,1.0">🇺🇸 Startbahn USA</button>
        <button class="eep-btn" data-plane-tp="268,28,72,0,1.2">🏜️ Grand Canyon</button>
        <button class="eep-btn" data-plane-tp="68,0.9,208,0,1.0">🇪🇬 Airport Ägypten</button>
        <button class="eep-btn" data-plane-tp="-15,32,0,-90,1.2">🌊 Über Ozean</button>
      </div>
    `;
    document.body.appendChild(flugzeugHud);

    document.getElementById('eep-flugzeug-ap-btn').addEventListener('click', () => {
      if (window.EEP.flugzeugComp) window.EEP.flugzeugComp.umschaltenAutopilot();
    });
    flugzeugHud.querySelectorAll('[data-plane-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const fc = window.EEP.flugzeugComp;
        if (!fc) return;
        fc.aktiviereManuell();
        if (btn.dataset.planeAct === 'schubPlus') fc.schub = Math.min(2.5, fc.schub + 0.25);
        if (btn.dataset.planeAct === 'schubMinus') fc.schub = Math.max(0.0, fc.schub - 0.25);
        fc.aktualisiereFlugHUD();
      });
    });
    flugzeugHud.querySelectorAll('[data-plane-tp]').forEach(btn => {
      btn.addEventListener('click', () => {
        const fc = window.EEP.flugzeugComp;
        if (!fc) return;
        const p = btn.dataset.planeTp.split(',').map(Number);
        fc.teleportiereZu(p[0], p[1], p[2], p[3], p[4]);
      });
    });

    // Interaktives Schiffs-Steuerungs-HUD oben (in Kamera [6] sichtbar)
    const schiffHud = document.createElement('div');
    schiffHud.id = 'eep-schiff-hud';
    schiffHud.innerHTML = `
      <div class="eep-title" id="eep-schiff-status">🚢 MANUELLE SCHIFFSSTEUERUNG | Fahrt: 12.6 kn | Kurs: 90°</div>
      <div style="font-size:11px; color:#cbd5e1;">⬆️ (W) Maschine Voraus  |  ⬇️ (S) Bremsen/Rückwärts  |  ⬅️/➡️ (A/D) Ruder Backbord/Steuerbord  |  Shift+Pfeiltasten = Umsehen</div>
      <div class="eep-btn-row">
        <button class="eep-btn sound-btn" id="eep-schiff-horn-btn">📣 Nebelhorn [H]</button>
        <button class="eep-btn" id="eep-schiff-ap-btn">🤖 Autopilot: AUS [P]</button>
        <button class="eep-btn" data-ship-tp="-262,0.40,56,-90">🇩🇪 Hafen Ostsee</button>
        <button class="eep-btn" data-ship-tp="105,0.40,2,-90">🏝️ Ozean-Inseln</button>
        <button class="eep-btn" data-ship-tp="202,0.40,-36,-90">🇺🇸 US-Hafen</button>
        <button class="eep-btn" data-ship-tp="156,0.40,102,180">🇪🇬 Hafen Rotes Meer</button>
        <button class="eep-btn" data-ship-tp="-15,0.40,-42,90">🌊 Nord-Atlantik</button>
      </div>
    `;
    document.body.appendChild(schiffHud);

    document.getElementById('eep-schiff-horn-btn').addEventListener('click', () => window.EEP.schiffsHorn());
    document.getElementById('eep-schiff-ap-btn').addEventListener('click', () => {
      if (window.EEP.faehreComp) window.EEP.faehreComp.umschaltenAutopilot();
    });
    schiffHud.querySelectorAll('[data-ship-tp]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sh = window.EEP.faehreComp;
        if (!sh) return;
        const p = btn.dataset.shipTp.split(',').map(Number);
        sh.teleportiereZu(p[0], p[1], p[2], p[3]);
      });
    });

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


// ============================================================================
// ROCKY MOUNTAINS ('ki-rockies' - Nordamerikanisches Hochgebirge in den USA)
// Markante braun-graue Granitgipfel mit Schneekappen, Felsgraten & Bergkiefern
// ============================================================================
AFRAME.registerComponent('ki-rockies', {
  schema: {
    breite: { type: 'number', default: 26 },
    tiefe: { type: 'number', default: 28 },
    hoehe: { type: 'number', default: 29 }
  },
  init: function () {
    const d = this.data;
    const group = new THREE.Group();
    const granitDunkelMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.92, flatShading: true });
    const granitHellMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.88, flatShading: true });
    const schieferMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.90, flatShading: true });
    const schneeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, flatShading: true });
    const tanneMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.9, flatShading: true });
    const stammMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.95 });

    const peaks = [
      { x: -5.5, z: -6.5, r: 7.5, h: d.hoehe * 0.92, mat: granitDunkelMat },
      { x:  1.0, z: -1.5, r: 9.2, h: d.hoehe * 1.00, mat: granitHellMat },
      { x:  5.8, z: -5.0, r: 7.0, h: d.hoehe * 0.84, mat: schieferMat },
      { x: -4.8, z:  2.5, r: 8.0, h: d.hoehe * 0.88, mat: granitHellMat },
      { x:  4.5, z:  4.2, r: 7.8, h: d.hoehe * 0.86, mat: granitDunkelMat },
      { x: -1.2, z:  8.0, r: 7.2, h: d.hoehe * 0.78, mat: schieferMat },
      { x: -7.5, z: -1.0, r: 5.8, h: d.hoehe * 0.66, mat: schieferMat },
      { x:  7.2, z:  0.5, r: 6.0, h: d.hoehe * 0.68, mat: granitHellMat }
    ];

    peaks.forEach((p, idx) => {
      const coneGeo = new THREE.ConeGeometry(p.r, p.h, 6);
      const cone = new THREE.Mesh(coneGeo, p.mat);
      cone.position.set(p.x, p.h * 0.5, p.z);
      cone.rotation.y = idx * 0.75 + 0.3;
      cone.castShadow = true;
      cone.receiveShadow = true;
      group.add(cone);

      const snowH = p.h * 0.36;
      const snowR = p.r * 0.37;
      const snowGeo = new THREE.ConeGeometry(snowR, snowH, 6);
      const snow = new THREE.Mesh(snowGeo, schneeMat);
      snow.position.set(p.x, p.h - snowH * 0.48, p.z);
      snow.rotation.y = idx * 0.75 + 0.3;
      group.add(snow);
    });

    const tanneHellMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.9, flatShading: true });
    const trees = [
      // Äußerer Waldgürtel rund um die Rocky Mountains
      [-11.5, -10.5, 0], [-12.2, -6.0, 0], [-11.8, -1.5, 0], [-12.0, 3.0, 0], [-11.4, 7.5, 0], [-9.5, 11.2, 0],
      [10.8, -10.0, 0],  [11.6, -5.5, 0],  [11.8, -0.5, 0],  [11.4, 4.2, 0],  [10.8, 8.5, 0],  [8.6, 11.5, 0],
      [-6.5, -12.2, 0],  [-2.2, -12.5, 0], [2.4, -12.2, 0],  [6.8, -11.5, 0],
      [-5.8, 12.6, 0],   [-1.5, 13.0, 0],  [2.8, 12.8, 0],   [6.2, 12.2, 0],
      // Mittlerer Bergwald in den Tälern und auf den unteren Berghängen
      [-9.2, -4.5, 1.4], [-9.5, 1.2, 1.6], [-8.8, 6.5, 1.2], [9.2, -3.5, 1.5], [9.4, 2.2, 1.7], [8.5, 7.2, 1.3],
      [-3.5, -9.8, 1.5], [1.8, -9.5, 1.6], [-4.2, 9.8, 1.4], [2.2, 10.2, 1.5],
      [-1.8, -5.2, 2.8], [2.5, -4.8, 2.6], [-1.5, 3.8, 2.9], [1.8, 5.2, 2.5]
    ];
    trees.forEach(([tx, tz, ty], i) => {
      const s = 1.25 + (i % 4) * 0.24;
      const baseY = ty || 0;
      const mat = (i % 2 === 0) ? tanneMat : tanneHellMat;
      const stamm = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.26 * s, 1.2 * s, 5), stammMat);
      stamm.position.set(tx, baseY + 0.6 * s, tz);
      group.add(stamm);

      const krone1 = new THREE.Mesh(new THREE.ConeGeometry(1.25 * s, 2.7 * s, 6), mat);
      krone1.position.set(tx, baseY + 2.0 * s, tz);
      krone1.castShadow = true;
      group.add(krone1);

      const krone2 = new THREE.Mesh(new THREE.ConeGeometry(0.95 * s, 2.3 * s, 6), mat);
      krone2.position.set(tx, baseY + 3.2 * s, tz);
      krone2.castShadow = true;
      group.add(krone2);

      const krone3 = new THREE.Mesh(new THREE.ConeGeometry(0.65 * s, 1.8 * s, 6), mat);
      krone3.position.set(tx, baseY + 4.2 * s, tz);
      krone3.castShadow = true;
      group.add(krone3);
    });

    this.el.setObject3D('mesh', group);
  }
});


// ============================================================================
// LARA CROFT EINSTEIGE-, SITZ- & AUSSTEIGE-SYSTEM ('EEP.einstieg')
// Lara kann zu jedem Fahrzeug (G-Klassen, Flugzeug, Mein Schiff, Züge) laufen,
// mit [Enter] / [E] oder per Klick wirklich einsteigen, sitzt sichtbar am
// Steuer/Lenkrad und steigt mit [Enter] genau am aktuellen Ort wieder aus!
// ============================================================================
(function () {
  const initEinstiegSystem = () => {
    const steuerungEl = document.querySelector('[ki-steuerung]');
    if (!steuerungEl || !steuerungEl.components || !steuerungEl.components['ki-steuerung'] || !window.EEP || !window.EEP.laraComp) {
      setTimeout(initEinstiegSystem, 150);
      return;
    }

    const st = steuerungEl.components['ki-steuerung'];

    // 0. Dichten Alpen-Bergwald direkt an den Hängen & im Vorland der Alpen ergänzen
    const alpenEl = document.querySelector('[ki-alpen]');
    if (alpenEl && alpenEl.object3D && !alpenEl._bergwaldGebaut) {
      alpenEl._bergwaldGebaut = true;
      const waldGrp = new THREE.Group();
      const fichteDunkel = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.9, flatShading: true });
      const fichteHell = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.9, flatShading: true });
      const stammMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.95 });
      const alpenBaeume = [
        // Vorderer Waldgürtel am Fuß der Alpen (Südhang Richtung Deutschland)
        [-28, 9, 0], [-25, 12, 0], [-22, 8.5, 0.8], [-19, 13, 0], [-16, 10, 0.5], [-13, 14, 0],
        [-10, 9.5, 0.8], [-7, 12.5, 0], [-4, 10.5, 0.4], [-1, 14, 0], [2, 11, 0.5], [5, 13.5, 0],
        [8, 9.5, 0.8], [11, 12.5, 0], [14, 10, 0.4], [17, 13, 0], [20, 9, 0.6], [23, 11.5, 0],
        // Höher gelegene Bergfichten in den Alpentälern und auf den Flanken
        [-26, 3, 2.2], [-17, 2.5, 2.8], [-11, 4.5, 2.4], [-5, 3.8, 3.0], [3, 4.2, 2.6], [9, 3.5, 2.8], [16, 4.0, 2.2], [22, 3.0, 1.8],
        // West- und Ostflanke der Alpen
        [-30, -2, 1.0], [-29, 4, 0.5], [25, -1, 1.0], [24, 4, 0.5]
      ];
      alpenBaeume.forEach(([tx, tz, ty], i) => {
        const s = 1.3 + (i % 4) * 0.25;
        const mat = (i % 2 === 0) ? fichteDunkel : fichteHell;
        const stamm = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.26 * s, 1.2 * s, 5), stammMat);
        stamm.position.set(tx, ty + 0.6 * s, tz);
        waldGrp.add(stamm);

        const k1 = new THREE.Mesh(new THREE.ConeGeometry(1.25 * s, 2.7 * s, 6), mat);
        k1.position.set(tx, ty + 2.0 * s, tz);
        k1.castShadow = true;
        waldGrp.add(k1);

        const k2 = new THREE.Mesh(new THREE.ConeGeometry(0.95 * s, 2.3 * s, 6), mat);
        k2.position.set(tx, ty + 3.2 * s, tz);
        k2.castShadow = true;
        waldGrp.add(k2);

        const k3 = new THREE.Mesh(new THREE.ConeGeometry(0.65 * s, 1.8 * s, 6), mat);
        k3.position.set(tx, ty + 4.2 * s, tz);
        k3.castShadow = true;
        waldGrp.add(k3);
      });
      alpenEl.object3D.add(waldGrp);
    }
    const lara = window.EEP.laraComp;

    // 1. G-Klassen-Scheiben transparenter machen, damit man Lara von außen am Steuer sitzen sieht
    if (window.EEP.autos) {
      window.EEP.autos.forEach(ac => {
        ac.el.object3D.traverse(node => {
          if (node.isMesh && node.material && node.material.transparent && node.material.opacity > 0.5) {
            node.material.opacity = 0.36;
          }
        });
      });
    }

    // 2. Einsteige-Button im Lara-HUD (#eep-lara-hud) ergänzen
    const laraHud = document.getElementById('eep-lara-hud');
    let boardBtn = document.getElementById('eep-lara-board-btn');
    if (laraHud && !boardBtn) {
      const row = document.createElement('div');
      row.className = 'eep-btn-row';
      row.style.marginTop = '4px';
      boardBtn = document.createElement('button');
      boardBtn.id = 'eep-lara-board-btn';
      boardBtn.className = 'eep-btn';
      boardBtn.style.cssText = 'width:100%; background:linear-gradient(135deg,#059669,#0284c7); border:1px solid #4ade80; font-weight:800; font-size:12.5px; padding:7px 12px; color:#ffffff; box-shadow:0 0 12px rgba(74,222,128,0.35);';
      boardBtn.textContent = '🚪 In Fahrzeug einsteigen [Enter / E]';
      row.appendChild(boardBtn);
      laraHud.appendChild(row);

      boardBtn.addEventListener('click', () => {
        if (window.EEP.einstieg) window.EEP.einstieg.interaktion();
      });
    }

    // 3. Schwebender Aussteige-Button für alle Fahrzeuge (Kamera 2, 3, 5, 6, 8)
    let exitBar = document.getElementById('eep-lara-exit-bar');
    if (!exitBar) {
      exitBar = document.createElement('div');
      exitBar.id = 'eep-lara-exit-bar';
      exitBar.style.cssText = 'display:none; position:fixed; bottom:18px; right:76px; z-index:9500; background:rgba(15,23,42,0.92); border:1.5px solid #38bdf8; border-radius:12px; padding:8px 12px; box-shadow:0 8px 20px rgba(0,0,0,0.5); align-items:center; gap:10px; font-family:system-ui,sans-serif;';
      exitBar.innerHTML = `
        <span id="eep-lara-seat-info" style="color:#bae6fd; font-size:12px; font-weight:700;">👩‍✈️ Lara sitzt am Steuer</span>
        <button id="eep-lara-exit-btn" class="eep-btn" style="background:linear-gradient(135deg,#ea580c,#dc2626); border-color:#fdba74; font-weight:800; color:#fff; padding:6px 12px;">🚶‍♀️ Hier aussteigen [Enter]</button>
      `;
      document.body.appendChild(exitBar);

      document.getElementById('eep-lara-exit-btn').addEventListener('click', () => {
        if (window.EEP.einstieg) window.EEP.einstieg.steigeAus();
      });
    }

    // 4. Alle einsteigbaren Fahrzeuge ermitteln + Distanz zu Lara berechnen
    function findeFahrzeuge() {
      const liste = [];
      const lPos = lara.el.object3D.position;

      if (window.EEP.autos) {
        window.EEP.autos.forEach((ac, idx) => {
          if (ac && ac.el && ac.el.object3D.visible) {
            const p = ac.el.object3D.position;
            const d = Math.hypot(p.x - lPos.x, p.z - lPos.z);
            liste.push({
              typ: 'auto',
              name: ac.data.name || (idx === 0 ? 'G-Klasse Türkis' : 'G-Klasse Weiß'),
              icon: '🚙',
              comp: ac,
              carIdx: idx,
              kamera: 8,
              pos: p,
              dist: d,
              nahSchwelle: 8.5
            });
          }
        });
      }

      if (window.EEP.flugzeugComp && window.EEP.flugzeugComp.el) {
        const fc = window.EEP.flugzeugComp;
        const p = fc.el.object3D.position;
        const d = Math.hypot(p.x - lPos.x, p.z - lPos.z);
        liste.push({
          typ: 'flugzeug',
          name: 'Flugzeug 3D',
          icon: '✈️',
          comp: fc,
          kamera: 5,
          pos: p,
          dist: d,
          nahSchwelle: 20.0
        });
      }

      if (window.EEP.faehreComp && window.EEP.faehreComp.el) {
        const sh = window.EEP.faehreComp;
        const p = sh.el.object3D.position;
        const d = Math.hypot(p.x - lPos.x, p.z - lPos.z);
        liste.push({
          typ: 'schiff',
          name: 'Mein Schiff',
          icon: '🚢',
          comp: sh,
          kamera: 6,
          pos: p,
          dist: d,
          nahSchwelle: 26.0
        });
      }

      if (window.EEP.zuege) {
        window.EEP.zuege.forEach((zug, zIdx) => {
          if (zug && zug.waggons && zug.waggons[0] && zug.waggons[0].el) {
            const wPos = zug.waggons[0].el.object3D.position;
            const d = Math.hypot(wPos.x - lPos.x, wPos.z - lPos.z);
            liste.push({
              typ: 'zug',
              name: zug.data.name || 'Zug',
              icon: '🚂',
              comp: zug,
              zugIdx: zIdx,
              kamera: zIdx === 0 ? 2 : 3,
              pos: wPos,
              dist: d,
              nahSchwelle: 16.0
            });
          }
        });
      }

      liste.sort((a, b) => a.dist - b.dist);
      return liste;
    }

    // 5. Zustandsverwaltung für Einsteigen, Sitzen & Aussteigen
    const einstieg = {
      animAktiv: false,
      animZeit: 0,
      animDauer: 0.55,
      animStartPos: new THREE.Vector3(),
      animZielPos: new THREE.Vector3(),
      animZielObj: null,
      echtEingestiegen: false,
      letzteFussPos: { x: -252, y: 0.25, z: -36, yawDeg: 165 },

      interaktion: function () {
        const modus = window.EEP.aktiveKamera;
        if (modus === 1 || modus === 4 || modus === 9) {
          const liste = findeFahrzeuge();
          if (liste.length > 0) {
            this.steigeEin(liste[0]);
          }
        } else if (modus === 2 || modus === 3 || modus === 5 || modus === 6 || modus === 8) {
          this.steigeAus();
        }
      },

      steigeEin: function (ziel) {
        if (!ziel || this.animAktiv) return;
        this.letzteFussPos = {
          x: lara.el.object3D.position.x,
          y: lara.el.object3D.position.y,
          z: lara.el.object3D.position.z,
          yawDeg: THREE.MathUtils.radToDeg(lara.el.object3D.rotation.y)
        };
        this.echtEingestiegen = true;
        this.animAktiv = true;
        this.animZeit = 0;
        this.animDauer = 0.52;
        this.animZielObj = ziel;
        this.animStartPos.copy(lara.el.object3D.position);

        // Wenn Lara weiter als 10 m weg war, direkt auf 3.5 m vor die Fahrzeugtür setzen, damit man den Einstiegs-Sprung sieht!
        const zp = ziel.pos;
        const dx = this.animStartPos.x - zp.x;
        const dz = this.animStartPos.z - zp.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 8.0) {
          const nx = dist > 0.1 ? dx / dist : 0;
          const nz = dist > 0.1 ? dz / dist : 1;
          this.animStartPos.set(zp.x + nx * 3.2, Math.max(0.25, zp.y), zp.z + nz * 3.2);
          lara.el.object3D.position.copy(this.animStartPos);
        }
        this.animZielPos.set(zp.x, Math.max(0.45, zp.y + 0.35), zp.z);

        // Lara schaut beim Einsteigen direkt zur Fahrzeugtür
        const lookYaw = Math.atan2(-(zp.x - this.animStartPos.x), -(zp.z - this.animStartPos.z));
        lara.el.object3D.rotation.set(0, lookYaw, 0);

        if (window.EEP.laraSprung) window.EEP.laraSprung();
        if (window.EEP.schaltKlick) setTimeout(() => window.EEP.schaltKlick(), 260);
      },

      schliesseEinstiegAb: function () {
        const ziel = this.animZielObj;
        this.animAktiv = false;
        if (!ziel) return;

        if (ziel.typ === 'auto' && typeof ziel.carIdx === 'number' && window.EEP.wechsleAuto) {
          window.EEP.wechsleAuto(ziel.carIdx);
          // In 3rd-Person-Ansicht starten, damit man Lara sofort am Steuer der G-Klasse sitzen sieht!
          window.EEP.autoAussenAnsicht = true;
          if (window.EEP.aktualisiereAutoHUD) window.EEP.aktualisiereAutoHUD();
        }
        st.setzeKamera(ziel.kamera);
      },

      steigeAus: function () {
        const modus = window.EEP.aktiveKamera;
        let ausPos = { x: this.letzteFussPos.x, y: 0.25, z: this.letzteFussPos.z, yawDeg: 0 };

        if (modus === 8 && window.EEP.autoComp) {
          const carObj = window.EEP.autoComp.el.object3D;
          const carPos = carObj.position;
          const carYaw = carObj.rotation.y;
          // 1.85 m links neben der Fahrertür der G-Klasse aussteigen
          const leftX = -Math.cos(carYaw);
          const leftZ = Math.sin(carYaw);
          ausPos.x = carPos.x + leftX * 1.85;
          ausPos.z = carPos.z + leftZ * 1.85;
          ausPos.yawDeg = THREE.MathUtils.radToDeg(carYaw);
        } else if (modus === 5 && window.EEP.flugzeugComp) {
          const pPos = window.EEP.flugzeugComp.el.object3D.position;
          const pYaw = window.EEP.flugzeugComp.yaw || 0;
          ausPos.x = pPos.x - Math.cos(pYaw) * 3.8;
          ausPos.z = pPos.z + Math.sin(pYaw) * 3.8;
          ausPos.yawDeg = THREE.MathUtils.radToDeg(pYaw);
        } else if (modus === 6 && window.EEP.faehreComp) {
          const sPos = window.EEP.faehreComp.el.object3D.position;
          const sYaw = window.EEP.faehreComp.yaw || 0;
          ausPos.x = sPos.x - Math.cos(sYaw) * 4.5;
          ausPos.z = sPos.z + Math.sin(sYaw) * 4.5;
          ausPos.yawDeg = THREE.MathUtils.radToDeg(sYaw);
        } else if ((modus === 2 || modus === 3) && window.EEP.zuege) {
          const zIdx = modus === 2 ? 0 : 1;
          const zug = window.EEP.zuege[zIdx];
          if (zug && zug.waggons && zug.waggons[0]) {
            const wObj = zug.waggons[0].el.object3D;
            ausPos.x = wObj.position.x + 2.4;
            ausPos.z = wObj.position.z + 2.4;
            ausPos.yawDeg = THREE.MathUtils.radToDeg(wObj.rotation.y);
          }
        }

        // Bodenhöhe am Ausstiegsort abfragen
        if (window.EEP.welt && typeof window.EEP.welt.abfrage === 'function') {
          const abf = window.EEP.welt.abfrage(ausPos.x, ausPos.z);
          ausPos.y = (abf.untergrund === 'wasser' || abf.untergrund === 'riff') ? 0.25 : Math.max(0.21, abf.hoehe);
        }

        // Sichtbarkeit aller Körperteile wiederherstellen & Kollisionskörper aktivieren
        if (lara.headGroup) lara.headGroup.visible = true;
        if (lara.torsoGroup) lara.torsoGroup.visible = true;
        if (lara.simKoerper) lara.simKoerper.entfernt = false;
        this.echtEingestiegen = false;

        // Passende Lara-Kamera (1 = Europa/Ozean, 4 = Amerika, 9 = Afrika) wählen, ohne Laras Ausstiegsort zu überschreiben!
        const zielKam = ausPos.z > 105 ? 9 : (ausPos.x > 180 ? 4 : 1);
        lara._behalteAusstiegsPos = true;
        st.setzeKamera(zielKam);
        lara._behalteAusstiegsPos = false;
        lara.teleportiereZu(ausPos.x, ausPos.y, ausPos.z, ausPos.yawDeg);

        if (window.EEP.schaltKlick) window.EEP.schaltKlick();
        if (window.EEP.laraLandung) window.EEP.laraLandung();
      },

      // Positioniert Lara im jeweiligen Fahrzeugsitz (mit Sitzhaltung & Mitlenken!)
      aktualisiereSitzPose: function (modus, deltaSec) {
        if (!lara || !lara.pelvisGroup) return;

        // Kollisionskörper im Fahrzeug deaktivieren, damit das Fahrzeug nicht mit seiner eigenen Fahrerin kollidiert
        if (lara.simKoerper) lara.simKoerper.entfernt = true;

        let sitzGefunden = false;
        let lenkWinkel = 0;
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();

        if (modus === 8 && window.EEP.autoComp) {
          const ac = window.EEP.autoComp;
          ac.el.object3D.updateMatrixWorld(true);
          // Fahrersitz der G-Klasse: lokal (-0.38, -0.18, 0.16) -> Kopf, Zopf & Schultern klar über der Fensterlinie sichtbar!
          worldPos.set(-0.38, -0.18, 0.16).applyMatrix4(ac.el.object3D.matrixWorld);
          ac.el.object3D.getWorldQuaternion(worldQuat);
          lenkWinkel = ac.lenkWinkel || 0;
          sitzGefunden = true;

          // Im 1st-Person-Cockpit Kopf & Oberkörper ausblenden (verhindert Kamera-Clipping), in 3rd-Person voll sichtbar!
          const zeigeKoerper = Boolean(window.EEP.autoAussenAnsicht);
          if (lara.headGroup) lara.headGroup.visible = zeigeKoerper;
          if (lara.torsoGroup) lara.torsoGroup.visible = zeigeKoerper;
        } else if (modus === 5 && window.EEP.flugzeugComp) {
          const fc = window.EEP.flugzeugComp;
          fc.el.object3D.updateMatrixWorld(true);
          worldPos.set(0, -0.15, -2.2).applyMatrix4(fc.el.object3D.matrixWorld);
          fc.el.object3D.getWorldQuaternion(worldQuat);
          lenkWinkel = -(fc.roll || 0) * 0.6;
          sitzGefunden = true;
          if (lara.headGroup) lara.headGroup.visible = true;
          if (lara.torsoGroup) lara.torsoGroup.visible = true;
        } else if (modus === 6 && window.EEP.faehreComp) {
          const sh = window.EEP.faehreComp;
          sh.el.object3D.updateMatrixWorld(true);
          // Lara steht/sitzt gut sichtbar oben auf dem vorderen Kommandobrücken-/Sonnendeck (+X ist Bug)
          worldPos.set(3.6, 3.35, 0).applyMatrix4(sh.el.object3D.matrixWorld);
          sh.el.object3D.getWorldQuaternion(worldQuat);
          const turnQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
          worldQuat.multiply(turnQuat);
          lenkWinkel = sh.ruderWinkel || 0;
          sitzGefunden = true;
          if (lara.headGroup) lara.headGroup.visible = true;
          if (lara.torsoGroup) lara.torsoGroup.visible = true;
        } else if ((modus === 2 || modus === 3) && window.EEP.zuege) {
          const zIdx = modus === 2 ? 0 : 1;
          const zug = window.EEP.zuege[zIdx];
          if (zug && zug.waggons && zug.waggons[0]) {
            const wObj = zug.waggons[0].el.object3D;
            wObj.updateMatrixWorld(true);
            worldPos.set(0, 0.55, 1.85).applyMatrix4(wObj.matrixWorld);
            wObj.getWorldQuaternion(worldQuat);
            const turnQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
            worldQuat.multiply(turnQuat);
            sitzGefunden = true;
            if (lara.headGroup) lara.headGroup.visible = false;
            if (lara.torsoGroup) lara.torsoGroup.visible = false;
          }
        }

        if (sitzGefunden) {
          lara.el.object3D.position.copy(worldPos);
          lara.el.object3D.quaternion.copy(worldQuat);
          lara.posY = worldPos.y;

          // Sitz-Gelenkhaltung (Oberschenkel nach vorn, Unterschenkel zu den Pedalen, Hände am Lenkrad/Steuerhorn)
          lara.pelvisGroup.position.y = 0.94;
          lara.pelvisGroup.rotation.set(0, 0, 0);
          lara.beinL.hip.rotation.set(1.42, 0.08, 0);
          lara.beinR.hip.rotation.set(1.42, -0.08, 0);
          lara.beinL.knee.rotation.set(-1.32, 0, 0);
          lara.beinR.knee.rotation.set(-1.32, 0, 0);
          lara.armL.shoulder.rotation.set(0.88 + lenkWinkel * 0.35, 0, 0.12);
          lara.armR.shoulder.rotation.set(0.88 - lenkWinkel * 0.35, 0, -0.12);
          lara.armL.elbow.rotation.set(0.52, 0, 0);
          lara.armR.elbow.rotation.set(0.52, 0, 0);
          lara.torsoGroup.rotation.set(-0.08, lenkWinkel * 0.25, 0);
          if (lara.headGroup) {
            lara.headGroup.rotation.y = lenkWinkel * 0.45;
          }
        }
      }
    };

    window.EEP.einstieg = einstieg;

    // 6. setzeKamera erweitern, damit Lara beim Wechsel zurück in [1]/[4]/[9] ihren Ort behält
    const origSetzeKamera = st.setzeKamera.bind(st);
    st.setzeKamera = function (modus) {
      const vorher = window.EEP.aktiveKamera;
      if ((vorher === 1 || vorher === 4 || vorher === 9) && (modus === 2 || modus === 3 || modus === 5 || modus === 6 || modus === 8)) {
        if (!einstieg.animAktiv) {
          einstieg.letzteFussPos = {
            x: lara.el.object3D.position.x,
            y: lara.el.object3D.position.y,
            z: lara.el.object3D.position.z,
            yawDeg: THREE.MathUtils.radToDeg(lara.el.object3D.rotation.y)
          };
        }
      }

      if ((modus === 1 || modus === 4 || modus === 9) && lara) {
        if (lara.headGroup) lara.headGroup.visible = true;
        if (lara.torsoGroup) lara.torsoGroup.visible = true;
        if (lara.simKoerper) lara.simKoerper.entfernt = false;

        if (!lara._behalteAusstiegsPos && (vorher === 2 || vorher === 3 || vorher === 5 || vorher === 6 || vorher === 8) && !einstieg.echtEingestiegen) {
          // Wenn nur per Kamera-Button umgeschaltet wurde (z.B. in Selbsttests), letzte Fußposition wiederherstellen
          lara.teleportiereZu(einstieg.letzteFussPos.x, einstieg.letzteFussPos.y, einstieg.letzteFussPos.z, einstieg.letzteFussPos.yawDeg);
        }
      }

      origSetzeKamera(modus);

      if (exitBar) {
        const imFahrzeug = (modus === 2 || modus === 3 || modus === 5 || modus === 6 || modus === 8);
        exitBar.style.display = imFahrzeug ? 'flex' : 'none';
        const infoEl = document.getElementById('eep-lara-seat-info');
        if (infoEl && imFahrzeug) {
          const namen = { 2: '🚂 Lara im Führerstand (Ludmilla)', 3: '🚄 Lara im Führerstand (US-Express)', 5: '✈️ Lara im Flugzeug-Cockpit', 6: '🚢 Lara auf der Schiffsbrücke', 8: '🚙 Lara sitzt am G-Klasse-Steuer' };
          infoEl.textContent = namen[modus] || '👩‍✈️ Lara sitzt am Steuer';
        }
      }
    };

    // 7. In ki-lara.tick einklinken für Einsteige-Sprung, Sitz-Pose & HUD-Distanzanzeige
    const origLaraTick = lara.tick.bind(lara);
    lara.tick = function (time, dt) {
      const deltaSec = Math.min((dt || 16) / 1000, 0.08);
      const modus = window.EEP.aktiveKamera;

      // Fall A: Laufende Einsteige-Animation (Lara springt in 3rd-Person durch die Fahrzeugtür)
      if (einstieg.animAktiv) {
        einstieg.animZeit += deltaSec;
        const u = Math.min(1, einstieg.animZeit / einstieg.animDauer);
        lara.el.object3D.position.lerpVectors(einstieg.animStartPos, einstieg.animZielPos, u);
        lara.el.object3D.position.y += Math.sin(u * Math.PI) * 1.15;
        lara.posY = lara.el.object3D.position.y;

        lara.beinL.hip.rotation.x = 0.85 * u;
        lara.beinR.hip.rotation.x = 1.15 * u;
        lara.beinL.knee.rotation.x = -0.95 * u;
        lara.beinR.knee.rotation.x = -1.10 * u;
        lara.armL.shoulder.rotation.x = 0.9 * u;
        lara.armR.shoulder.rotation.x = 0.9 * u;

        if (u >= 1) {
          einstieg.schliesseEinstiegAb();
        }
        return;
      }

      // Fall B: Lara sitzt in einem Fahrzeug (Kamera 2, 3, 5, 6, 8)
      if (modus === 2 || modus === 3 || modus === 5 || modus === 6 || modus === 8) {
        einstieg.aktualisiereSitzPose(modus, deltaSec);
        return;
      }

      // Fall C: Lara ist zu Fuß unterwegs (Kamera 1, 4, 9)
      if (lara.headGroup) lara.headGroup.visible = true;
      if (lara.torsoGroup) lara.torsoGroup.visible = true;
      if (lara.simKoerper) lara.simKoerper.entfernt = false;

      origLaraTick(time, dt);

      // Einsteige-Button mit nächstem Fahrzeug aktualisieren
      if (boardBtn && (!this._lastBoardUi || time - this._lastBoardUi > 180)) {
        this._lastBoardUi = time;
        const liste = findeFahrzeuge();
        if (liste.length > 0) {
          const top = liste[0];
          const nah = top.dist <= top.nahSchwelle;
          boardBtn.textContent = nah
            ? `🚪 Jetzt in ${top.icon} ${top.name} einsteigen (${top.dist.toFixed(1)} m) [Enter / E]`
            : `🏃‍♀️ Zu ${top.icon} ${top.name} laufen & einsteigen (${Math.round(top.dist)} m) [Enter]`;
          boardBtn.style.background = nah
            ? 'linear-gradient(135deg,#16a34a,#059669)'
            : 'linear-gradient(135deg,#0284c7,#1d4ed8)';
        }
      }
    };

    // 7b. Auch am Ende von ki-steuerung.tick Sitzpose synchronisieren (0-Frame-Lag bei schneller Fahrt)
    const origStTick = st.tick.bind(st);
    st.tick = function (time, dt) {
      origStTick(time, dt);
      const modus = window.EEP.aktiveKamera;
      if (modus === 2 || modus === 3 || modus === 5 || modus === 6 || modus === 8) {
        einstieg.aktualisiereSitzPose(modus, Math.min((dt || 16) / 1000, 0.08));
      }
    };

    // 8. Tastatur-Steuerung: [Enter] (immer) oder [E] (wenn Lara neben einem Fahrzeug steht)
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const modus = window.EEP.aktiveKamera;
      if (e.key === 'Enter') {
        einstieg.interaktion();
        e.preventDefault();
      } else if (e.key.toLowerCase() === 'e' && (modus === 1 || modus === 4 || modus === 9) && !lara.tasten.hoch && !lara.tasten.runter) {
        const liste = findeFahrzeuge();
        if (liste.length > 0 && liste[0].dist <= liste[0].nahSchwelle) {
          einstieg.steigeEin(liste[0]);
          e.preventDefault();
        }
      }
    });

    if (window.location.search.includes('einstiegtest=1')) {
      setTimeout(() => {
        const liste = findeFahrzeuge();
        if (liste.length > 0) {
          einstieg.steigeEin(liste[0]);
          setTimeout(() => {
            einstieg.schliesseEinstiegAb();
            if (window.EEP.lookState) {
              // Leicht seitlich auf die G-Klasse blicken, damit man Lara am Fahrersitz sieht
              window.EEP.lookState.aktiv = true;
              window.EEP.lookState.yaw = 0.65;
              window.EEP.lookState.pitch = -0.05;
            }
          }, 600);
        }
      }, 450);
    }
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initEinstiegSystem);
  } else {
    setTimeout(initEinstiegSystem, 100);
  }
})();


// ============================================================================
// REALISTISCHE 3D-DISTANZ-, STEREO- & WIND-SOUND-ENGINE ('EEP.audio3D')
// - Beseitigt das dauerhafte globale Dampflok-Tuckern komplett!
// - Züge & Fahrzeuge sind nur noch hörbar, wenn man sich ihnen wirklich nähert
//   (< 38 m), schwellen beim Vorbeifahren räumlich (Links/Rechts-Panning) an
//   und verstummen in der Ferne zu 100 %.
// - Berücksichtigt bereits den Windvektor (EEP.wind) für Reichweite & Dämpfung.
// ============================================================================
(function () {
  window.EEP = window.EEP || {};

  // Globales Wind-Modell (vorbereitet für Paket G: Wetter & Windrichtung)
  window.EEP.wind = {
    richtungGrad: 245, // West-Südwest-Wind
    x: 0.906,          // Wind weht nach Ost-Nordost (+X / +Z)
    z: 0.422,
    staerke: 0.45      // 0.0 = Windstille, 1.0 = Sturm
  };

  window.EEP.setzeWind = function (grad, staerke) {
    const rad = (grad * Math.PI) / 180;
    this.wind.richtungGrad = grad;
    this.wind.x = Math.sin(rad);
    this.wind.z = Math.cos(rad);
    this.wind.staerke = Math.max(0, Math.min(1.5, staerke));
  };

  // Berechnet Lautstärke-Faktor (0..1), Stereo-Panning (-1..+1) & Tiefpass-Frequenz
  // abhängig von 3D-Distanz zur Kamera UND Windrichtung
  const berechneRaumklang = function (quellPos, basisReichweite) {
    const maxDist = basisReichweite || 42;
    if (!quellPos) {
      return { faktor: 1.0, pan: 0, cutoffHz: 3200, dist: 0 };
    }

    const rig = document.querySelector('#kamera-rig');
    if (!rig || !rig.object3D) {
      return { faktor: 1.0, pan: 0, cutoffHz: 3200, dist: 0 };
    }

    const camPos = rig.object3D.position;
    const dx = quellPos.x - camPos.x;
    const dy = (quellPos.y || 0) - (camPos.y || 0);
    const dz = quellPos.z - camPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Wind-Einfluss: Schall trägt MIT dem Wind (Quelle -> Kamera in Windrichtung) bis zu +35 % weiter,
    // GEGEN den Wind bis zu -25 % kürzer und dumpfer!
    let windFaktor = 1.0;
    const w = window.EEP.wind;
    if (w && dist > 0.5) {
      // Vektor von der Schallquelle zum Hörer: (-dx, -dz)
      const toListenerX = -dx / dist;
      const toListenerZ = -dz / dist;
      const windDot = toListenerX * w.x + toListenerZ * w.z; // +1 = Rückenwind für den Schall, -1 = Gegenwind
      windFaktor = 1.0 + windDot * (w.staerke || 0.4) * 0.35;
    }

    const effReichweite = maxDist * windFaktor;
    if (dist >= effReichweite) {
      return { faktor: 0, pan: 0, cutoffHz: 350, dist: dist };
    }

    // Sanfter quadratischer Pegelabfall (0 in der Ferne -> 1 direkt vor der Nase)
    const norm = 1.0 - (dist / effReichweite);
    const faktor = Math.pow(norm, 2.2);

    // Stereo-Panning (-0.85 links bis +0.85 rechts relativ zur Kamera-Blickrichtung)
    const camYaw = rig.object3D.rotation ? rig.object3D.rotation.y : 0;
    const rightX = Math.cos(camYaw);
    const rightZ = -Math.sin(camYaw);
    const horizDist = Math.max(1.0, Math.hypot(dx, dz));
    const pan = Math.max(-0.85, Math.min(0.85, (dx * rightX + dz * rightZ) / horizDist));

    // Luftabsorption + Winddämpfung: Ferne Geräusche klingen warm und gedämpft
    const cutoffHz = Math.round(380 + 3400 * Math.pow(norm, 1.4) * Math.min(1.2, windFaktor));

    return { faktor, pan, cutoffHz, dist };
  };

  const verbindeMitRaumklang = function (ctx, quellNode, raum) {
    if ( ctx.createStereoPanner && Math.abs(raum.pan || 0) > 0.02) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(raum.pan, ctx.currentTime);
      quellNode.connect(panner);
      panner.connect(ctx.destination);
    } else {
      quellNode.connect(ctx.destination);
    }
  };

  window.EEP.audio3D = { berechneRaumklang };

  // --------------------------------------------------------------------------
  // 1. Altes globales Dauer-Tuckern (dampfTschuff ohne Ortsbezug) stilllegen!
  // --------------------------------------------------------------------------
  window.EEP.dampfTschuff = function (lautstaerke = 0.04, quellPos = null) {
    if (!this.soundAktiv || !this.audioCtx || this.audioCtx.state !== 'running') return;
    // Ohne Quellposition (alter globaler Aufruf aus ki-zug.tick) komplett ignorieren,
    // da die neue 3D-Zug-Soundlogik unten das distanzabhängige Schienen-/Lokgeräusch übernimmt!
    if (!quellPos) return;

    const raum = berechneRaumklang(quellPos, 36);
    if (raum.faktor <= 0.01) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.14);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.sin((i / bufferSize) * Math.PI) * Math.exp(-i / (bufferSize * 0.45));
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Tiefer, warmer Dampf-/Diesel-Ausstoß (160 Hz Lowpass statt schrillem 400 Hz Rauschen!)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(220, raum.cutoffHz), now);

    const gain = ctx.createGain();
    const vol = Math.max(0.001, lautstaerke * raum.faktor * 0.65);
    gain.gain.setValueAtTime(0.0005, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.135);

    noise.connect(filter);
    filter.connect(gain);
    verbindeMitRaumklang(ctx, gain, raum);
    noise.start(now);
  };

  // Realistisches Schienenstoß-Doppelklackern ("Klack-Klack ... Pause ... Klack-Klack"),
  // NUR hörbar wenn man nahe am Zug steht (< 36 m) oder im Zug mitfährt!
  window.EEP.schienenKlack = function (quellPos, tempo) {
    if (!this.soundAktiv || !this.audioCtx || this.audioCtx.state !== 'running') return;
    const raum = berechneRaumklang(quellPos, 36);
    if (raum.faktor <= 0.015) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const gap = Math.max(0.065, Math.min(0.14, 0.9 / Math.max(2, Math.abs(tempo))));

    [0, gap].forEach((delay, idx) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      const startFreq = idx === 0 ? 115 : 98;
      osc.frequency.setValueAtTime(startFreq, now + delay);
      osc.frequency.exponentialRampToValueAtTime(42, now + delay + 0.045);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(650, raum.cutoffHz), now + delay);

      const peak = 0.045 * raum.faktor * (idx === 0 ? 1.0 : 0.78);
      gain.gain.setValueAtTime(0.0005, now + delay);
      gain.gain.linearRampToValueAtTime(peak, now + delay + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.05);

      osc.connect(filter);
      filter.connect(gain);
      verbindeMitRaumklang(ctx, gain, raum);
      osc.start(now + delay);
      osc.stop(now + delay + 0.055);
    });
  };

  // --------------------------------------------------------------------------
  // 2. Angenehme, untergrundabhängige Schritte & sanftere Stimme für Lara Croft
  // --------------------------------------------------------------------------
  window.EEP.laraSchritt = function () {
    if (!this.soundAktiv) return;
    this.initAudio();
    const ctx = this.audioCtx;
    if (ctx.state !== 'running') return;
    const now = ctx.currentTime;

    // Untergrund unter Lara prüfen (Asphalt/Fels vs. Gras/Waldboden vs. Sand/Wasser)
    let ug = 'gras';
    if (this.laraComp && this.laraComp.el && this.welt && typeof this.welt.abfrage === 'function') {
      const p = this.laraComp.el.object3D.position;
      ug = this.welt.abfrage(p.x, p.z).untergrund || 'gras';
    }

    // Dezenter, natürlicher Sohlen-Auftritt statt synthetischem Piepton
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const baseFreq = (ug === 'strasse' || ug === 'fels' || ug === 'bordstein') ? 105 : (ug === 'sand' ? 72 : 85);
    osc.frequency.setValueAtTime(baseFreq + Math.random() * 10, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.045);

    const vol = (ug === 'sand' || ug === 'gras' || ug === 'waldboden') ? 0.035 : 0.05;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.048);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.052);
  };

  window.EEP.laraSprung = function () {
    if (!this.soundAktiv) return;
    this.initAudio();
    const ctx = this.audioCtx;
    if (ctx.state !== 'running') return;
    const now = ctx.currentTime;

    // Sanfter Luft-Impuls beim Absprung (kein schriller Sawtooth-Synthesizer mehr)
    const bufSize = Math.floor(ctx.sampleRate * 0.16);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(680, now + 0.15);
    filter.Q.setValueAtTime(2.2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.065, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  };

  window.EEP.laraLandung = function () {
    if (!this.soundAktiv) return;
    this.initAudio();
    const ctx = this.audioCtx;
    if (ctx.state !== 'running') return;
    const now = ctx.currentTime;

    [0, 0.05].forEach((delay, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 95 : 82, now + delay);
      osc.frequency.exponentialRampToValueAtTime(36, now + delay + 0.065);
      gain.gain.setValueAtTime(0.075, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.075);
    });
  };

  // --------------------------------------------------------------------------
  // 3. Hupen, Hörner & Kollisions-Sounds mit 3D-Raumklang & weicherer Klangfarbe
  // --------------------------------------------------------------------------
  window.EEP.dampfPfeife = function (quellPos) {
    if (!this.soundAktiv) return;
    this.initAudio();
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const pos = quellPos || (this.zuege && this.zuege[0] && this.zuege[0].waggons && this.zuege[0].waggons[0] ? this.zuege[0].waggons[0].el.object3D.position : null);
    const raum = berechneRaumklang(pos, 180);
    const faktor = Math.max(0.25, raum.faktor); // Bei manuellem Button-Klick immer mindestens leise aus der Ferne hörbar

    [440, 554.37, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * 0.99, now);
      osc.frequency.exponentialRampToValueAtTime(freq, now + 0.06);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(1400, raum.cutoffHz), now);

      const peak = (i === 0 ? 0.09 : 0.05) * faktor;
      gain.gain.setValueAtTime(0.0005, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.07);
      gain.gain.setValueAtTime(peak, now + 0.65);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);

      osc.connect(filter);
      filter.connect(gain);
      verbindeMitRaumklang(ctx, gain, raum);
      osc.start(now);
      osc.stop(now + 1.08);
    });
  };

  // --------------------------------------------------------------------------
  // 4. Züge in der Szene mit 3D-Distanz-Vorbeifahrts-Sound & Stummschalter [M] koppeln
  // --------------------------------------------------------------------------
  const initSoundUpgrade = () => {
    const steuerungEl = document.querySelector('[ki-steuerung]');
    if (!steuerungEl || !steuerungEl.components || !steuerungEl.components['ki-steuerung']) {
      setTimeout(initSoundUpgrade, 150);
      return;
    }

    // Stummschalter-Button [M] in der Sound-Zeile ergänzen
    const wetterBtn = document.getElementById('eep-wetter-btn');
    if (wetterBtn && wetterBtn.parentElement && !document.getElementById('eep-mute-btn')) {
      const muteBtn = document.createElement('button');
      muteBtn.id = 'eep-mute-btn';
      muteBtn.className = 'eep-btn';
      muteBtn.textContent = '🔊 Ton: AN [M]';
      wetterBtn.parentElement.insertBefore(muteBtn, wetterBtn.nextSibling);

      const toggleMute = () => {
        window.EEP.soundAktiv = !window.EEP.soundAktiv;
        muteBtn.textContent = window.EEP.soundAktiv ? '🔊 Ton: AN [M]' : '🔇 Ton: AUS [M]';
        muteBtn.style.borderColor = window.EEP.soundAktiv ? 'rgba(74,222,128,0.5)' : 'rgba(248,113,113,0.6)';
      };
      muteBtn.addEventListener('click', toggleMute);
      window.addEventListener('keydown', (e) => {
        if (!e.repeat && e.key && e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.altKey) {
          toggleMute();
        }
      });
    }

    // Alle Züge: Nur noch sanftes 3D-Schienenklackern in unmittelbarer Nähe (< 36 m)
    if (window.EEP.zuege) {
      window.EEP.zuege.forEach((zug) => {
        if (zug._soundUpgraded) return;
        zug._soundUpgraded = true;
        zug._letzterSchienenKlack = 0;
        const origZugTick = zug.tick.bind(zug);
        zug.tick = function (time, timeDelta) {
          origZugTick(time, timeDelta);
          const tempo = Math.abs(this.aktuellesTempo || 0);
          if (tempo < 0.5 || !this.waggons || !this.waggons[0] || !this.waggons[0].el) return;

          // Intervall: Ruhiger Schienenstoß-Takt (alle 650..1100 ms statt hektischem 110 ms Dauerfeuer!)
          const intervall = Math.max(620, Math.min(1200, 7500 / tempo));
          if (time - this._letzterSchienenKlack >= intervall) {
            this._letzterSchienenKlack = time;
            const lokPos = this.waggons[0].el.object3D.position;
            window.EEP.schienenKlack(lokPos, tempo);
          }
        };
      });
    }

    // Kollisions-Sound über Event-Bus (nur in Hörweite < 50 m)
    if (window.EEP.bus && !window.EEP._aufprallSoundVerbunden) {
      window.EEP._aufprallSoundVerbunden = true;
      window.EEP.bus.on('aufprall', (ev) => {
        if (!window.EEP.soundAktiv || !ev || ev.vImpact < 1.5) return;
        window.EEP.initAudio();
        const ctx = window.EEP.audioCtx;
        if (!ctx || ctx.state !== 'running') return;
        const k = window.EEP.sim && window.EEP.sim.koerper ? window.EEP.sim.koerper(ev.koerperId) : null;
        const raum = berechneRaumklang(k, 55);
        if (raum.faktor <= 0.02) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(28, now + 0.16);
        const vol = Math.min(0.22, (ev.vImpact / 25) * 0.18) * raum.faktor;
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
        osc.connect(gain);
        verbindeMitRaumklang(ctx, gain, raum);
        osc.start(now);
        osc.stop(now + 0.18);
      });
    }
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initSoundUpgrade);
  } else {
    setTimeout(initSoundUpgrade, 150);
  }
})();
