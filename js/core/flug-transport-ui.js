/* ============================================================================
 * js/core/flug-transport-ui.js – View-, 3D-Animations- & HUD-Brücke für Paket E & Paket I
 * Verbindet EEP.flugPhysik & EEP.transport mit den A-Frame-Komponenten & Selbsttests.
 * ============================================================================ */
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.flugTransportUI = '1.0.0';

  var uiState = {
    initialisiert: false,
    flugMeshes: null,
    schiffRampeMesh: null,
    hudEl: null,
    innenraumTasten: { vor: false, zurueck: false, links: false, rechts: false, drehLinks: false, drehRechts: false }
  };

  // --------------------------------------------------------------------------
  // 1. 3D-Klappen, Spoiler, Schubumkehr & Heckrampe am Flugzeug anbauen
  // --------------------------------------------------------------------------
  function baueFlugzeugZusatz3D(fc) {
    if (!fc || !fc.el || !fc.el.object3D || uiState.flugMeshes || typeof THREE === 'undefined') return;
    var root = fc.el.object3D;

    var gruppe = new THREE.Group();
    gruppe.name = 'eep-flug-zusatz-3d';

    var klappenMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.45 });
    var spoilerMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4, metalness: 0.3 });
    var revMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 });
    var rampeMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6, metalness: 0.4 });

    // Landeklappen (Flaps) links & rechts an der Tragflächen-Hinterkante
    var flapL = new THREE.Group();
    flapL.position.set(-4.2, 1.35, 1.15);
    var flapLMesh = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.08, 0.65), klappenMat);
    flapLMesh.position.set(0, 0, 0.32);
    flapL.add(flapLMesh);
    gruppe.add(flapL);

    var flapR = new THREE.Group();
    flapR.position.set(4.2, 1.35, 1.15);
    var flapRMesh = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.08, 0.65), klappenMat);
    flapRMesh.position.set(0, 0, 0.32);
    flapR.add(flapRMesh);
    gruppe.add(flapR);

    // Störklappen (Spoilers / Speedbrakes) auf der Tragflächen-Oberseite
    var spoilerL = new THREE.Group();
    spoilerL.position.set(-4.0, 1.48, 0.35);
    var spLMesh = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.06, 0.45), spoilerMat);
    spLMesh.position.set(0, 0, 0.22);
    spoilerL.add(spLMesh);
    gruppe.add(spoilerL);

    var spoilerR = new THREE.Group();
    spoilerR.position.set(4.0, 1.48, 0.35);
    var spRMesh = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.06, 0.45), spoilerMat);
    spRMesh.position.set(0, 0, 0.22);
    spoilerR.add(spRMesh);
    gruppe.add(spoilerR);

    // Schubumkehr-Effekt an beiden Triebwerken
    var revGruppe = new THREE.Group();
    var revL = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.85, 1.2, 14, 1, true), revMat);
    revL.rotation.x = Math.PI / 2;
    revL.position.set(-3.2, 0.95, -0.8);
    var revR = revL.clone();
    revR.position.set(3.2, 0.95, -0.8);
    revGruppe.add(revL);
    revGruppe.add(revR);
    revGruppe.visible = false;
    gruppe.add(revGruppe);

    // Klappbare Heck-Frachtrampe (Paket I)
    var rampePivot = new THREE.Group();
    rampePivot.position.set(0, 0.65, 7.8);
    var rampePlatte = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, 4.2), rampeMat);
    rampePlatte.position.set(0, 0, 2.1);
    rampePivot.add(rampePlatte);
    rampePivot.rotation.x = -0.95; // Eingeklappt
    gruppe.add(rampePivot);

    root.add(gruppe);
    uiState.flugMeshes = {
      flapL: flapL,
      flapR: flapR,
      spoilerL: spoilerL,
      spoilerR: spoilerR,
      revGruppe: revGruppe,
      rampePivot: rampePivot
    };
  }

  // --------------------------------------------------------------------------
  // 2. 3D-Auffahrrampe am Hauptschiff anbauen
  // --------------------------------------------------------------------------
  function baueSchiffRampe3D(sh) {
    if (!sh || !sh.el || !sh.el.object3D || uiState.schiffRampeMesh || typeof THREE === 'undefined') return;
    var root = sh.el.object3D;
    var rampePivot = new THREE.Group();
    rampePivot.position.set(0, 0.65, 12.2);

    var rampeMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65, metalness: 0.35 });
    var gelbMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });

    var platte = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 5.4), rampeMat);
    platte.position.set(0, 0, 2.7);
    rampePivot.add(platte);

    var randL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 5.4), gelbMat);
    randL.position.set(-1.55, 0.12, 2.7);
    rampePivot.add(randL);

    var randR = randL.clone();
    randR.position.x = 1.55;
    rampePivot.add(randR);

    rampePivot.rotation.x = -1.15; // Eingeklappt
    root.add(rampePivot);
    uiState.schiffRampeMesh = rampePivot;
  }

  // --------------------------------------------------------------------------
  // 3. Interaktives HUD-Overlay für Paket E (Flug/ILS) & Paket I (Transport/Innenraum)
  // --------------------------------------------------------------------------
  function baueHUD() {
    if (typeof document === 'undefined' || uiState.hudEl) return;
    var div = document.createElement('div');
    div.id = 'eep-paket-ei-hud';
    div.style.cssText = 'position:fixed;top:124px;left:50%;transform:translateX(-50%);z-index:10005;background:rgba(15,23,42,0.92);color:#f8fafc;padding:7px 12px;border-radius:12px;font:600 12px system-ui,sans-serif;border:1px solid #38bdf8;display:none;box-shadow:0 6px 20px rgba(0,0,0,0.45);max-width:96vw;white-space:nowrap;';
    document.body.appendChild(div);
    uiState.hudEl = div;

    div.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-aktion]');
      if (!btn) return;
      var aktion = btn.getAttribute('data-aktion');
      fuehreHudAktionAus(aktion, btn.getAttribute('data-wert'));
    });
  }

  function holeFlugKoerper() {
    var fc = EEP.flugzeugComp;
    if (!fc) return null;
    if (!fc.simKoerper && EEP.sim) {
      var kId = EEP.sim.registriere({
        id: 'airliner-haupt',
        typ: 'flugzeug',
        x: fc.el.object3D.position.x,
        y: fc.el.object3D.position.y,
        z: fc.el.object3D.position.z,
        yaw: fc.yaw || 0,
        pitch: fc.pitch || 0,
        roll: fc.roll || 0,
        v: (fc.schub || 1.0) * 24.0,
        schub: fc.schub || 1.0,
        halbBreite: 6.5,
        halbLaenge: 11.0,
        hoehe: 4.2
      });
      fc.simKoerper = EEP.sim.koerper(kId);
      if (EEP.flugPhysik) EEP.flugPhysik.initialisiere(fc.simKoerper);
    }
    return fc.simKoerper;
  }

  function holeAktivesAutoComp() {
    if (EEP.autoComp) return EEP.autoComp;
    if (EEP.autos && EEP.autos.length > 0) return EEP.autos[0];
    return null;
  }

  function fuehreHudAktionAus(aktion, wert) {
    var fk = holeFlugKoerper();
    var fc = EEP.flugzeugComp;
    var sh = EEP.faehreComp;
    var sk = sh ? sh.simKoerper : null;
    var ac = holeAktivesAutoComp();
    var ak = ac ? ac.simKoerper : null;

    if (aktion === 'klappen' && fk && EEP.flugPhysik) {
      if (fc) fc.aktiviereManuell();
      EEP.flugPhysik.zyklusKlappen(fk, 1);
    } else if (aktion === 'spoiler' && fk && EEP.flugPhysik) {
      if (fc) fc.aktiviereManuell();
      EEP.flugPhysik.zyklusSpoilers(fk);
    } else if (aktion === 'autothrottle' && fk && EEP.flugPhysik) {
      if (fc) fc.aktiviereManuell();
      EEP.flugPhysik.setzeAutothrottle(fk, !fk.flug.autothrottle);
    } else if (aktion === 'ils' && fk && EEP.flugPhysik) {
      if (fc) fc.aktiviereManuell();
      EEP.flugPhysik.setzeILS(fk, !fk.flug.ilsAktiv, wert || fk.flug.ilsFlughafen);
    } else if (aktion === 'ils-fh' && fk && EEP.flugPhysik) {
      var reihe = ['DE', 'US', 'AF'];
      var idx = (reihe.indexOf(fk.flug.ilsFlughafen) + 1) % reihe.length;
      fk.flug.ilsFlughafen = reihe[idx];
      if (fk.flug.ilsAktiv) EEP.flugPhysik.setzeILS(fk, true, reihe[idx]);
    } else if (aktion === 'rampe' && EEP.transport) {
      var tr = (EEP.aktiveKamera === 5) ? fk : (sk || fk);
      if (tr) EEP.transport.schalteRampe(tr);
    } else if (aktion === 'verlade' && EEP.transport && ak) {
      if (ak.verladenAuf) {
        var alterTr = EEP.sim ? EEP.sim.koerper(ak.verladenAuf) : null;
        if (alterTr && !alterTr.rampeOffen) EEP.transport.schalteRampe(alterTr, true);
        EEP.transport.entlade(ak);
        if (ac) {
          ac.el.object3D.position.set(ak.x, ak.y, ak.z);
          ac.el.object3D.rotation.set(0, ak.yaw, 0);
        }
      } else {
        var zielTr = (EEP.aktiveKamera === 5) ? fk : (sk || fk);
        if (zielTr) {
          if (!zielTr.rampeOffen) EEP.transport.schalteRampe(zielTr, true);
          EEP.transport.verlade(ak, zielTr);
        }
      }
    } else if (aktion === 'innenraum' && EEP.transport) {
      var laraK = (EEP.laraComp && EEP.laraComp.simKoerper) || (EEP.sim && EEP.sim.koerper('lara-haupt'));
      var trK = (EEP.aktiveKamera === 5) ? fk : ((EEP.aktiveKamera === 6) ? sk : (ak || sk || fk));
      if (laraK && trK) {
        var neuAktiv = !(laraK.innenraum && laraK.innenraum.aktiv);
        EEP.transport.setzeInnenraumModus(laraK, trK, neuAktiv);
      }
    }
    aktualisiereHudDOM();
  }

  function btnStil(aktiv, warnung) {
    var bg = warnung ? '#dc2626' : (aktiv ? '#0284c7' : '#1e293b');
    var border = warnung ? '#f87171' : (aktiv ? '#7dd3fc' : '#475569');
    return 'background:' + bg + ';color:#fff;border:1px solid ' + border + ';border-radius:6px;padding:4px 8px;cursor:pointer;font:600 11px system-ui;margin:0 3px;';
  }

  function aktualisiereHudDOM() {
    if (!uiState.hudEl) return;
    var cam = EEP.aktiveKamera;
    var fk = holeFlugKoerper();
    var sh = EEP.faehreComp;
    var sk = sh ? sh.simKoerper : null;
    var ac = holeAktivesAutoComp();
    var ak = ac ? ac.simKoerper : null;
    var laraK = (EEP.laraComp && EEP.laraComp.simKoerper) || (EEP.sim && EEP.sim.koerper('lara-haupt'));

    // HUD nur in Flugzeug [5], Schiff [6], Lara [7] oder Auto [8] einblenden
    if (cam !== 5 && cam !== 6 && cam !== 7 && cam !== 8) {
      uiState.hudEl.style.display = 'none';
      return;
    }
    if (cam === 8 && ak) {
      var istVerladen = Boolean(ak.verladenAuf);
      var irAktiv = Boolean(laraK && laraK.innenraum && laraK.innenraum.aktiv);
      var naheTransport = (Math.abs(ak.x - (-312)) < 90 && Math.abs(ak.z - (-6)) < 90) ||
                          (Math.abs(ak.x - (-244)) < 90 && Math.abs(ak.z - 46) < 90);
      if (!istVerladen && !irAktiv && !naheTransport) {
        uiState.hudEl.style.display = 'none';
        return;
      }
    }
    uiState.hudEl.style.display = 'block';

    if (cam === 5 && fk && fk.flug && EEP.flugPhysik) {
      var flug = fk.flug;
      var klInfo = EEP.flugPhysik.holeKlappenInfo(flug.klappenStufe);
      var spInfo = EEP.flugPhysik.SPOILER_TABELLE[flug.spoilerStufe];
      var ils = EEP.flugPhysik.berechneILS(fk, flug.ilsFlughafen);

      var warnTxt = '';
      if (flug.stall) {
        warnTxt = '<span style="color:#f87171;font-weight:800;margin-right:8px;">⚠️ STALL! Klappen [K] ausfahren / Nase senken!</span>';
      } else if (flug.overspeed) {
        warnTxt = '<span style="color:#fbbf24;font-weight:800;margin-right:8px;">⚠️ OVERSPEED! Störklappen [B] nutzen!</span>';
      } else if (flug.schubumkehrAktiv) {
        warnTxt = '<span style="color:#38bdf8;font-weight:800;margin-right:8px;">⏪ AUTO-SCHUBUMKEHR & GROUND-SPOILERS AKTIV</span>';
      }

      var ilsFarbe = ils.aufGleitpfad ? '#4ade80' : '#facc15';
      var verladenTxt = (ak && ak.verladenAuf === fk.id) ? '🚗 G-Klasse im Frachtraum [L=Entladen]' : '🚗 G-Klasse einladen [L]';
      var irAktiv = Boolean(laraK && laraK.innenraum && laraK.innenraum.aktiv);

      uiState.hudEl.innerHTML =
        warnTxt +
        '<button data-aktion="klappen" style="' + btnStil(flug.klappenStufe > 0, false) + '">🪽 Klappen [K]: ' + klInfo.name + '</button>' +
        '<button data-aktion="spoiler" style="' + btnStil(flug.spoilerStufe > 0 || flug.bodenSpoilerAktiv, flug.spoilerStufe === 2) + '">🛑 Störklappen [B]: ' + (flug.bodenSpoilerAktiv ? 'BODEN-VOLL' : spInfo.name) + '</button>' +
        '<button data-aktion="autothrottle" style="' + btnStil(flug.autothrottle, false) + '">🎯 A/T [T]: ' + (flug.autothrottle ? Math.round(flug.zielV * 3.6) + ' km/h' : 'AUS') + '</button>' +
        '<button data-aktion="ils" style="' + btnStil(flug.ilsAktiv, false) + '">📡 ILS [I]: ' + (flug.ilsAktiv ? 'AKTIV' : 'AUS') + '</button>' +
        '<button data-aktion="ils-fh" style="' + btnStil(false, false) + '">🛬 Ziel: ' + ils.flughafenId + ' (' + Math.round(ils.distanzM) + 'm | <span style="color:' + ilsFarbe + '">LOC ' + ils.locDeg.toFixed(1) + '° G/S ' + ils.gsDeg.toFixed(1) + '°</span>)</button>' +
        '<button data-aktion="rampe" style="' + btnStil(fk.rampeOffen, false) + '">📐 Heckrampe [R]: ' + (fk.rampeOffen ? 'OFFEN' : 'ZU') + '</button>' +
        '<button data-aktion="verlade" style="' + btnStil(ak && ak.verladenAuf === fk.id, false) + '">' + verladenTxt + '</button>' +
        '<button data-aktion="innenraum" style="' + btnStil(irAktiv, false) + '">🚶‍♀️ Kabine [V]: ' + (irAktiv ? 'RUNDGANG' : 'COCKPIT') + '</button>';
    } else {
      var tr = (cam === 6 && sk) ? sk : (sk || fk);
      var rampeOffen = Boolean(tr && tr.rampeOffen);
      var istVerladen = Boolean(ak && ak.verladenAuf);
      var irAktiv2 = Boolean(laraK && laraK.innenraum && laraK.innenraum.aktiv);
      var irPosTxt = irAktiv2 ? ' (' + laraK.innenraum.lokalX.toFixed(1) + 'm / ' + laraK.innenraum.lokalZ.toFixed(1) + 'm)' : '';

      uiState.hudEl.innerHTML =
        '<span style="color:#38bdf8;margin-right:6px;">⛴️ Fahrzeug-Transport & Innenraum:</span>' +
        '<button data-aktion="rampe" style="' + btnStil(rampeOffen, false) + '">📐 Laderampe [R]: ' + (rampeOffen ? 'OFFEN (Auffahrbereit)' : 'GESCHLOSSEN') + '</button>' +
        '<button data-aktion="verlade" style="' + btnStil(istVerladen, false) + '">' + (istVerladen ? '🚗 G-Klasse auf ' + ak.verladenAuf + ' -> Entladen [L]' : '🚗 G-Klasse auf Träger verladen [L]') + '</button>' +
        '<button data-aktion="innenraum" style="' + btnStil(irAktiv2, false) + '">🚶‍♀️ Innenraum begehen [V]: ' + (irAktiv2 ? 'AKTIV' + irPosTxt : 'AUS') + '</button>';
    }
  }

  // --------------------------------------------------------------------------
  // 4. Tastatur-Shortcuts & Frame-Tick für 3D-Meshes und Transport-Mitführung
  // --------------------------------------------------------------------------
  function registriereTasten() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      var k = e.key.toLowerCase();
      var cam = EEP.aktiveKamera;

      if (cam === 5) {
        if (k === 'k') { fuehreHudAktionAus('klappen'); e.preventDefault(); }
        else if (k === 'b') { fuehreHudAktionAus('spoiler'); e.preventDefault(); }
        else if (k === 't') { fuehreHudAktionAus('autothrottle'); e.preventDefault(); }
        else if (k === 'i') { fuehreHudAktionAus('ils'); e.preventDefault(); }
      }
      if (cam === 5 || cam === 6 || cam === 7 || cam === 8) {
        if (k === 'r' && !e.ctrlKey) { fuehreHudAktionAus('rampe'); e.preventDefault(); }
        else if (k === 'l' && e.shiftKey) { fuehreHudAktionAus('verlade'); e.preventDefault(); }
        else if (k === 'v') { fuehreHudAktionAus('innenraum'); e.preventDefault(); }
      }

      var laraK = (EEP.laraComp && EEP.laraComp.simKoerper) || (EEP.sim && EEP.sim.koerper('lara-haupt'));
      if (laraK && laraK.innenraum && laraK.innenraum.aktiv) {
        if (k === 'w' || e.key === 'ArrowUp') uiState.innenraumTasten.vor = true;
        if (k === 's' || e.key === 'ArrowDown') uiState.innenraumTasten.zurueck = true;
        if (k === 'a' || e.key === 'ArrowLeft') uiState.innenraumTasten.links = true;
        if (k === 'd' || e.key === 'ArrowRight') uiState.innenraumTasten.rechts = true;
      }
    });

    window.addEventListener('keyup', function (e) {
      var k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') uiState.innenraumTasten.vor = false;
      if (k === 's' || e.key === 'ArrowDown') uiState.innenraumTasten.zurueck = false;
      if (k === 'a' || e.key === 'ArrowLeft') uiState.innenraumTasten.links = false;
      if (k === 'd' || e.key === 'ArrowRight') uiState.innenraumTasten.rechts = false;
    });
  }

  // --------------------------------------------------------------------------
  // 5. Selbsttests für Paket E (?flugtest=1) und Paket I (?transporttest=1)
  // --------------------------------------------------------------------------
  function starteFlugSelbsttest() {
    if (!EEP.flugPhysik || !EEP.sim) return;
    var kId = EEP.sim.registriere({
      id: 'test-airliner',
      typ: 'flugzeug',
      x: -305.0,
      y: 12.0,
      z: 65.0,
      yaw: 0.0,
      pitch: 0.05,
      roll: 0.0,
      v: 10.0,
      schub: 0.45
    });
    var k = EEP.sim.koerper(kId);
    EEP.flugPhysik.initialisiere(k);

    // 1. Klappen & Stall-Test bei 10.0 m/s:
    // Mit Klappen 0 (vStall=14.5) muss Stall eintreten; mit Klappen 3 FULL (vStall=8.5) KEIN Stall!
    EEP.flugPhysik.setzeKlappen(k, 0);
    k.v = 10.0; k.y = 14.0;
    EEP.flugPhysik.schritt(k, 0.05, {});
    var stallBeiClean = Boolean(k.flug.stall);

    EEP.flugPhysik.setzeKlappen(k, 3);
    k.v = 10.0; k.y = 14.0;
    EEP.flugPhysik.schritt(k, 0.05, {});
    var keinStallBeiFull = !k.flug.stall;
    var klappenStallOk = Boolean(stallBeiClean && keinStallBeiFull);

    // 2. Overspeed & Störklappen-Verzögerungstest
    EEP.flugPhysik.setzeKlappen(k, 1); // vMax = 40.0 m/s
    EEP.flugPhysik.setzeSpoilers(k, 0); // Spoilers AUS
    k.v = 46.0; k.flug.schub = 1.0;
    EEP.flugPhysik.schritt(k, 0.2, {});
    var dvOhneSpoiler = 46.0 - k.v;

    EEP.flugPhysik.setzeSpoilers(k, 2); // Spoilers VOLL
    k.v = 46.0; k.flug.schub = 1.0;
    EEP.flugPhysik.schritt(k, 0.2, {});
    var dvMitSpoiler = 46.0 - k.v;
    var overspeedSpoilerOk = Boolean(k.flug.overspeed && dvMitSpoiler >= dvOhneSpoiler * 2.5);

    // 3. Autothrottle-Test
    EEP.flugPhysik.setzeSpoilers(k, 0);
    EEP.flugPhysik.setzeKlappen(k, 0);
    k.v = 16.0;
    EEP.flugPhysik.setzeAutothrottle(k, true, 24.0);
    for (var i = 0; i < 40; i++) {
      EEP.flugPhysik.schritt(k, 0.1, {});
    }
    var autothrottleOk = Math.abs(k.v - 24.0) < 2.5;

    // 4. ILS Localizer & Glideslope Test (Anflug auf Flughafen DE bei x=-312)
    k.x = -298.0; k.y = 9.0; k.z = 85.0; k.yaw = 0.0;
    var ilsVor = EEP.flugPhysik.berechneILS(k, 'DE');
    EEP.flugPhysik.setzeILS(k, true, 'DE');
    for (var j = 0; j < 35; j++) {
      EEP.flugPhysik.schritt(k, 0.1, {});
    }
    var ilsNach = EEP.flugPhysik.berechneILS(k, 'DE');
    var ilsOk = Boolean(Math.abs(ilsNach.locDeg) < Math.abs(ilsVor.locDeg) && Math.abs( k.x - (-312.0) ) < 14.0);

    // 5. Touchdown & Auto-Schubumkehr Test
    k.x = -312.0; k.y = 0.92; k.z = 10.0; k.v = 16.0; k.pitch = -0.12;
    k.flug.warInDerLuft = true; k.flug.amBoden = false; k.flug.autoReverse = true; k.flug.spoilerStufe = 1;
    EEP.flugPhysik.schritt(k, 0.1, { runter: true }); // Setzt auf Boden (y=0.90) auf
    var revAktivNachTouchdown = Boolean(k.flug.schubumkehrAktiv && k.flug.bodenSpoilerAktiv);
    for (var m = 0; m < 40; m++) {
      EEP.flugPhysik.schritt(k, 0.1, {});
    }
    var autoReverseOk = Boolean(revAktivNachTouchdown && k.v <= 3.5 && !k.flug.schubumkehrAktiv);

    EEP.sim.entferne(kId);

    console.log('FLUG_TEST_RESULT:', JSON.stringify({
      klappenStallOk: klappenStallOk,
      overspeedSpoilerOk: overspeedSpoilerOk,
      autothrottleOk: autothrottleOk,
      ilsOk: ilsOk,
      autoReverseOk: autoReverseOk
    }));
  }

  function starteTransportSelbsttest() {
    if (!EEP.transport || !EEP.sim) return;
    var schiff = EEP.sim.koerper('mein-schiff-haupt') || EEP.sim.koerper(EEP.sim.registriere({
      id: 'test-schiff', typ: 'schiff', x: -240, y: 0.40, z: 58, yaw: 0
    }));
    var flugzeug = holeFlugKoerper() || EEP.sim.koerper(EEP.sim.registriere({
      id: 'test-flugzeug', typ: 'flugzeug', x: -312, y: 0.90, z: 18, yaw: 0
    }));
    var auto = EEP.sim.koerper('gklasse-tuerkis') || EEP.sim.koerper(EEP.sim.registriere({
      id: 'test-auto', typ: 'auto', x: -243, y: 0.28, z: -51, yaw: 0
    }));
    var lara = EEP.sim.koerper('lara-haupt') || EEP.sim.koerper(EEP.sim.registriere({
      id: 'lara-haupt', typ: 'lara', x: -242, y: 0.25, z: -50, yaw: 0
    }));

    var origAuto = { x: auto.x, y: auto.y, z: auto.z, yaw: auto.yaw };
    var origSchiff = { x: schiff.x, y: schiff.y, z: schiff.z, yaw: schiff.yaw };

    // 1. Schutz bei geschlossener Rampe prüfen
    EEP.transport.schalteRampe(schiff, false);
    var versuchZu = EEP.transport.verlade(auto, schiff);
    var rampeSchutzOk = Boolean(!versuchZu.erfolg && versuchZu.grund === 'rampe-geschlossen');

    // 2. Schiff-Verladung, Überfahrt über Tiefwasser ohne Wasserschaden & Entladung
    EEP.transport.schalteRampe(schiff, true);
    var verlSchiff = EEP.transport.verlade(auto, schiff);
    schiff.x = 0.0; schiff.z = 58.0; schiff.yaw = Math.PI / 2; // Mitten auf dem Ozean!
    EEP.transport.aktualisiereVerladene(0.1);
    if (EEP.schaden) EEP.schaden.tickWasser(auto, 5.0);
    var mitgereistAufSee = Math.abs(auto.x - schiff.x) < 10.0 && !auto.schaden.versunken && auto.schaden.wasserImInnenraum === 0;
    var entlSchiff = EEP.transport.entlade(auto);
    var schiffVerladungOk = Boolean(verlSchiff.erfolg && mitgereistAufSee && entlSchiff.erfolg && !auto.verladenAuf);

    // 3. Flugzeug-Verladung, Mitflug nach Amerika & Entladung
    EEP.transport.schalteRampe(flugzeug, true);
    var verlFlug = EEP.transport.verlade(auto, flugzeug);
    var origFlug = { x: flugzeug.x, y: flugzeug.y, z: flugzeug.z };
    flugzeug.x = 306.0; flugzeug.y = 0.90; flugzeug.z = 14.0;
    EEP.transport.aktualisiereVerladene(0.1);
    var mitgeflogenUSA = Math.abs(auto.x - 306.0) < 10.0 && Math.abs(auto.z - 14.0) < 10.0;
    var entlFlug = EEP.transport.entlade(auto);
    var flugzeugVerladungOk = Boolean(verlFlug.erfolg && mitgeflogenUSA && entlFlug.erfolg && !auto.verladenAuf);
    flugzeug.x = origFlug.x; flugzeug.y = origFlug.y; flugzeug.z = origFlug.z;

    // 4. Begehbarer Innenraum für Lara Croft (mit Wandbegrenzung & Träger-Mitführung)
    EEP.transport.setzeInnenraumModus(lara, schiff, true);
    for (var s = 0; s < 30; s++) {
      EEP.transport.aktualisiereInnenraum(lara, schiff, 0.1, { vor: true, rechts: true });
    }
    var innerhalbGrenzen = Math.abs(lara.innenraum.lokalX) <= 1.76 && Math.abs(lara.innenraum.lokalZ) <= 11.51;
    schiff.x = -180.0; schiff.z = 58.0;
    EEP.transport.aktualisiereInnenraum(lara, schiff, 0.1, {});
    var laraMitbewegt = Math.abs(lara.x - schiff.x) < 15.0;
    EEP.transport.setzeInnenraumModus(lara, schiff, false);
    var innenraumOk = Boolean(innerhalbGrenzen && laraMitbewegt);

    // Ausgangszustand wiederherstellen
    auto.x = origAuto.x; auto.y = origAuto.y; auto.z = origAuto.z; auto.yaw = origAuto.yaw;
    schiff.x = origSchiff.x; schiff.y = origSchiff.y; schiff.z = origSchiff.z; schiff.yaw = origSchiff.yaw;

    console.log('TRANSPORT_TEST_RESULT:', JSON.stringify({
      rampeSchutzOk: rampeSchutzOk,
      schiffVerladungOk: schiffVerladungOk,
      flugzeugVerladungOk: flugzeugVerladungOk,
      innenraumOk: innenraumOk
    }));
  }

  // --------------------------------------------------------------------------
  // 6. Haupt-Tick der UI/View-Brücke
  // --------------------------------------------------------------------------
  EEP.flugTransportUI = {
    init: function () {
      if (uiState.initialisiert) return;
      uiState.initialisiert = true;
      baueHUD();
      registriereTasten();

      if (typeof window !== 'undefined' && window.location && window.location.search) {
        setTimeout(function () {
          if (window.location.search.indexOf('flugtest=1') !== -1) starteFlugSelbsttest();
          if (window.location.search.indexOf('transporttest=1') !== -1) starteTransportSelbsttest();
        }, 450);
      }
    },

    tick: function (deltaSec) {
      if (!uiState.initialisiert) this.init();

      var fc = EEP.flugzeugComp;
      var fk = holeFlugKoerper();
      if (fc && fk && fk.flug) {
        baueFlugzeugZusatz3D(fc);
        if (uiState.flugMeshes) {
          var flug = fk.flug;
          var klRad = (flug.klappenWinkel || 0) * (Math.PI / 180);
          uiState.flugMeshes.flapL.rotation.x = klRad;
          uiState.flugMeshes.flapR.rotation.x = klRad;

          var spWinkel = (flug.spoilerStufe === 2 || flug.bodenSpoilerAktiv) ? -0.85 : 0.0;
          uiState.flugMeshes.spoilerL.rotation.x += (spWinkel - uiState.flugMeshes.spoilerL.rotation.x) * Math.min(1, deltaSec * 10);
          uiState.flugMeshes.spoilerR.rotation.x = uiState.flugMeshes.spoilerL.rotation.x;

          uiState.flugMeshes.revGruppe.visible = Boolean(flug.schubumkehrAktiv);
          var zielRampeFlug = fk.rampeOffen ? 0.18 : -0.95;
          uiState.flugMeshes.rampePivot.rotation.x += (zielRampeFlug - uiState.flugMeshes.rampePivot.rotation.x) * Math.min(1, deltaSec * 6);
        }
      }

      var sh = EEP.faehreComp;
      if (sh && sh.simKoerper) {
        baueSchiffRampe3D(sh);
        if (uiState.schiffRampeMesh) {
          var zielRampeSchiff = sh.simKoerper.rampeOffen ? 0.16 : -1.15;
          uiState.schiffRampeMesh.rotation.x += (zielRampeSchiff - uiState.schiffRampeMesh.rotation.x) * Math.min(1, deltaSec * 5);
        }
      }

      // Verladene Fahrzeuge & Laras begehbaren Innenraum synchronisieren
      if (EEP.transport) {
        var verladeneAnzahl = EEP.transport.aktualisiereVerladene(deltaSec);
        if (verladeneAnzahl > 0 && EEP.autos) {
          for (var i = 0; i < EEP.autos.length; i++) {
            var ac = EEP.autos[i];
            if (ac && ac.simKoerper && ac.simKoerper.verladenAuf && ac.el && ac.el.object3D) {
              ac.el.object3D.position.set(ac.simKoerper.x, ac.simKoerper.y, ac.simKoerper.z);
              ac.el.object3D.rotation.set(ac.simKoerper.pitch || 0, ac.simKoerper.yaw || 0, ac.simKoerper.roll || 0, 'YXZ');
            }
          }
        }

        // Automatische Rampen-Auffahrt prüfen, wenn ein Auto auf eine offene Rampe zufährt
        if (EEP.autos) {
          for (var a = 0; a < EEP.autos.length; a++) {
            var autoC = EEP.autos[a];
            var ak = autoC && autoC.simKoerper;
            if (ak && !ak.verladenAuf && Math.abs(ak.v || 0) > 0.2) {
              if (sh && sh.simKoerper && sh.simKoerper.rampeOffen) {
                EEP.transport.pruefeAuffahrt(ak, sh.simKoerper);
              }
              if (fk && fk.rampeOffen) {
                EEP.transport.pruefeAuffahrt(ak, fk);
              }
            }
          }
        }

        // Lara im begehbaren Innenraum aktualisieren
        var laraK = (EEP.laraComp && EEP.laraComp.simKoerper) || (EEP.sim && EEP.sim.koerper('lara-haupt'));
        if (laraK && laraK.innenraum && laraK.innenraum.aktiv && EEP.sim) {
          var trK = EEP.sim.koerper(laraK.innenraum.traegerId);
          if (trK) {
            EEP.transport.aktualisiereInnenraum(laraK, trK, deltaSec, uiState.innenraumTasten);
            if (EEP.laraComp && EEP.laraComp.el && EEP.laraComp.el.object3D) {
              EEP.laraComp.el.object3D.position.set(laraK.x, laraK.y, laraK.z);
              EEP.laraComp.el.object3D.rotation.y = laraK.yaw;
              EEP.laraComp.el.object3D.visible = true;
            }
          }
        }
      }

      aktualisiereHudDOM();
    }
  };

  // --------------------------------------------------------------------------
  // 7. A-Frame-Komponenten (ki-flugzeug, ki-faehre, ki-auto) sauber anbinden
  // --------------------------------------------------------------------------
  function verbindeAFrameKomponenten() {
    if (typeof AFRAME === 'undefined' || !AFRAME.components) return;

    // 1. ki-flugzeug: Paket E Flugphysik im Manuell-/ILS-Modus & UI-Tick
    var flugCompDef = AFRAME.components['ki-flugzeug'];
    if (flugCompDef && flugCompDef.Component && !flugCompDef.Component.prototype._paketEGekoppelt) {
      var flugProto = flugCompDef.Component.prototype;
      var origFlugTick = flugProto.tick;
      flugProto._paketEGekoppelt = true;

      flugProto.tick = function (time, dt) {
        if (!dt) return;
        var deltaSec = Math.min(dt / 1000, 0.08);
        var fk = holeFlugKoerper();

        if (this.manuell && fk && EEP.flugPhysik) {
          fk.x = this.el.object3D.position.x;
          fk.y = this.el.object3D.position.y;
          fk.z = this.el.object3D.position.z;
          fk.yaw = this.yaw;
          fk.pitch = this.pitch;
          fk.roll = this.roll;

          EEP.flugPhysik.schritt(fk, deltaSec, this.tasten);

          this.el.object3D.position.set(fk.x, fk.y, fk.z);
          this.yaw = fk.yaw;
          this.pitch = fk.pitch;
          this.roll = fk.roll;
          this.schub = fk.schub;
          this.el.object3D.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');

          EEP.flugTransportUI.tick(deltaSec);
          if (EEP.aktiveKamera === 5) this.aktualisiereFlugHUD();
          return;
        }

        if (origFlugTick) origFlugTick.call(this, time, dt);
        if (fk) {
          fk.x = this.el.object3D.position.x;
          fk.y = this.el.object3D.position.y;
          fk.z = this.el.object3D.position.z;
          fk.yaw = this.yaw || 0;
          fk.v = (this.schub || 1.0) * 24.0;
        }
        EEP.flugTransportUI.tick(deltaSec);
      };
    }

    // 2. ki-faehre: simKoerper auch im automatischen Fährbetrieb synchron halten
    var faehreCompDef = AFRAME.components['ki-faehre'];
    if (faehreCompDef && faehreCompDef.Component && !faehreCompDef.Component.prototype._paketIGekoppelt) {
      var faehreProto = faehreCompDef.Component.prototype;
      var origFaehreTick = faehreProto.tick;
      faehreProto._paketIGekoppelt = true;

      faehreProto.tick = function (time, dt) {
        if (origFaehreTick) origFaehreTick.call(this, time, dt);
        if (this.simKoerper && !this.manuell && this.el && this.el.object3D) {
          this.simKoerper.x = this.el.object3D.position.x;
          this.simKoerper.y = this.el.object3D.position.y;
          this.simKoerper.z = this.el.object3D.position.z;
          this.simKoerper.yaw = this.yaw || 0;
        }
      };
    }

    // 3. ki-auto: Wenn Auto auf Schiff/Flugzeug verladen ist, nicht per Straßenphysik überschreiben
    var autoCompDef = AFRAME.components['ki-auto'];
    if (autoCompDef && autoCompDef.Component && !autoCompDef.Component.prototype._paketIGekoppelt) {
      var autoProto = autoCompDef.Component.prototype;
      var origAutoTick = autoProto.tick;
      autoProto._paketIGekoppelt = true;

      autoProto.tick = function (time, dt) {
        if (this.simKoerper && this.simKoerper.verladenAuf && EEP.transport) {
          // Wenn der Spieler im verladenen Auto Gas gibt und die Rampe offen ist -> Entladen & losfahren!
          if (this.tasten && (this.tasten.hoch || this.tasten.runter) && EEP.sim) {
            var tr = EEP.sim.koerper(this.simKoerper.verladenAuf);
            if (tr && tr.rampeOffen) {
              EEP.transport.entlade(this.simKoerper);
              this.el.object3D.position.set(this.simKoerper.x, this.simKoerper.y, this.simKoerper.z);
              this.el.object3D.rotation.set(0, this.simKoerper.yaw, 0);
            }
          }
          if (this.simKoerper.verladenAuf) {
            this.el.object3D.position.set(this.simKoerper.x, this.simKoerper.y, this.simKoerper.z);
            this.el.object3D.rotation.set(this.simKoerper.pitch || 0, this.simKoerper.yaw || 0, this.simKoerper.roll || 0, 'YXZ');
            return;
          }
        }
        if (origAutoTick) origAutoTick.call(this, time, dt);
      };
    }
  }

  verbindeAFrameKomponenten();
})();
