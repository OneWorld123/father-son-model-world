/* ============================================================================
 * js/physik/fahrzeug-physik.js – Paket A: Fahrzeug-Untergrundphysik, Geländegängigkeit,
 * Kollisions-Teilschritte, Schiffs-Tiefgang & Lara-Wasser-/Hangphysik
 * WICHTIG: A-Frame-frei, DOM-frei, THREE-frei (reines JavaScript).
 * ============================================================================ */
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.fahrzeugPhysik = '1.0.0';

  // --------------------------------------------------------------------------
  // 1. Höchstgeschwindigkeit je Untergrund und Fahrzeugprofil (d-world-collisions-003)
  // --------------------------------------------------------------------------
  var VMAX_TABELLE = {
    strassenpkw: {
      strasse:   41.7, // 150 km/h
      bordstein: 41.7,
      schiene:    8.3, // 30 km/h
      gras:      13.9, // 50 km/h
      waldboden:  8.3, // 30 km/h
      sand:       6.9, // 25 km/h
      fels:       4.2, // 15 km/h
      wasser:     2.8, // 10 km/h (Watttiefe)
      riff:       2.8
    },
    gelaende: {
      strasse:   42.0, // 150 km/h (Gang S)
      bordstein: 42.0,
      schiene:   13.9, // 50 km/h
      gras:      22.2, // 80 km/h
      waldboden: 16.7, // 60 km/h
      sand:      19.4, // 70 km/h
      fels:      11.1, // 40 km/h
      wasser:     2.8, // 10 km/h (Watttiefe)
      riff:       2.8
    }
  };

  var STEIGFAEHIGKEIT = {
    strassenpkw: 18.0, // 18 %
    gelaende:    32.0, // 32 % ohne LOW
    gelaendeLow: 45.0  // 45 % mit LOW-Untersetzung [U]
  };

  var WATTTIEFE = {
    strassenpkw: 0.30,
    gelaende:    0.70
  };

  var RESTITUTION = {
    auto:     0.15,
    schiff:   0.05,
    lara:     0.00,
    flugzeug: 0.10
  };

  // Radstand 2.89 m, Spur 1.64 m gemäß s-world-collisions-005
  var HALB_RADSTAND = 2.89 / 2;
  var HALB_SPUR = 1.64 / 2;

  function berechneRadPositionen(x, z, yaw) {
    var fwdX = -Math.sin(yaw);
    var fwdZ = -Math.cos(yaw);
    var rightX = Math.cos(yaw);
    var rightZ = -Math.sin(yaw);

    return {
      vl: { x: x + fwdX * HALB_RADSTAND - rightX * HALB_SPUR, z: z + fwdZ * HALB_RADSTAND - rightZ * HALB_SPUR },
      vr: { x: x + fwdX * HALB_RADSTAND + rightX * HALB_SPUR, z: z + fwdZ * HALB_RADSTAND + rightZ * HALB_SPUR },
      hl: { x: x - fwdX * HALB_RADSTAND - rightX * HALB_SPUR, z: z - fwdZ * HALB_RADSTAND - rightZ * HALB_SPUR },
      hr: { x: x - fwdX * HALB_RADSTAND + rightX * HALB_SPUR, z: z - fwdZ * HALB_RADSTAND + rightZ * HALB_SPUR }
    };
  }

  function aufloesenKollision(koerper) {
    if (!EEP.kollision) return null;
    var treffer = EEP.kollision.pruefe(koerper);
    if (!treffer) return null;

    var nx = treffer.normalX;
    var nz = treffer.normalZ;
    var schub = (treffer.eindringtiefe || 0) + 0.02;
    koerper.x += nx * schub;
    koerper.z += nz * schub;

    var yaw = koerper.yaw || 0;
    var fwdX = -Math.sin(yaw);
    var fwdZ = -Math.cos(yaw);
    var v = koerper.v || 0;
    var vx = fwdX * v;
    var vz = fwdZ * v;

    var vNorm = vx * nx + vz * nz;
    var tx = -nz;
    var tz = nx;
    var vTang = vx * tx + vz * tz;

    var e = RESTITUTION[koerper.typ] !== undefined ? RESTITUTION[koerper.typ] : 0.10;
    var neuVNorm = vNorm < 0 ? (-vNorm * e) : vNorm;
    var neuVTang = vTang * 0.7;

    var neuVx = nx * neuVNorm + tx * neuVTang;
    var neuVz = nz * neuVNorm + tz * neuVTang;

    // Projektion zurück auf Fahrzeug-Längsachse
    koerper.v = neuVx * fwdX + neuVz * fwdZ;
    if (Math.abs(koerper.v) < 0.08) koerper.v = 0;

    // Aufprall-Event ab vImpact >= 2.0 m/s (s-world-collisions-004)
    if (treffer.vImpact >= 2.0 && EEP.bus) {
      // vorneTreffer = Winkel zwischen Fahrtrichtung und Gegen-Normale < 45° (cos > 0.7071)
      var richtungVorzeichen = v >= 0 ? 1 : -1;
      var cosWinkel = (fwdX * richtungVorzeichen) * (-nx) + (fwdZ * richtungVorzeichen) * (-nz);
      var vorneTreffer = cosWinkel > 0.7071;

      EEP.bus.emit('aufprall', {
        koerperId: koerper.id,
        hindernisId: treffer.hindernisId,
        art: treffer.art,
        vImpact: treffer.vImpact,
        normalX: nx,
        normalZ: nz,
        vorneTreffer: vorneTreffer
      });
    }

    return treffer;
  }

  // --------------------------------------------------------------------------
  // 2. Auto-Physikschritt (s-world-collisions-004 & s-world-collisions-005)
  // --------------------------------------------------------------------------
  function schrittAuto(koerper, dt) {
    var deltaSec = Math.min(Math.max(dt || 0.016, 0.001), 0.05);
    var profil = (EEP.welt && EEP.welt.testProfil) ? EEP.welt.testProfil : (koerper.profil || 'gelaende');
    var vMaxMap = VMAX_TABELLE[profil] || VMAX_TABELLE.gelaende;

    // Wenn Fahrzeug Totalschaden oder versunken ist -> keine Eigenbewegung
    if (koerper.schaden && (koerper.schaden.totalschaden || koerper.schaden.versunken)) {
      koerper.v = 0;
      if (EEP.schaden && typeof EEP.schaden.tickWasser === 'function') {
        EEP.schaden.tickWasser(koerper, deltaSec);
      }
      return koerper;
    }

    var abf = EEP.welt ? EEP.welt.abfrage(koerper.x, koerper.z) : {
      untergrund: 'gras', hoehe: 0.25, steigungX: 0, steigungZ: 0, steigung: 0, tiefe: 0, spitz: false
    };

    // 1. Steigung in Fahrtrichtung s (%) = (steigungX * (-sin(yaw)) + steigungZ * (-cos(yaw))) * 100
    // Beachte: Lokale Vorwärtsrichtung ist (-sin(yaw), -cos(yaw))
    var yaw = koerper.yaw || 0;
    var fwdX = -Math.sin(yaw);
    var fwdZ = -Math.cos(yaw);
    var sProzent = (abf.steigungX * fwdX + abf.steigungZ * fwdZ) * 100;
    var sAbs = Math.max(0, sProzent);

    var sMax = profil === 'strassenpkw' ? STEIGFAEHIGKEIT.strassenpkw : (koerper.untersetzung ? STEIGFAEHIGKEIT.gelaendeLow : STEIGFAEHIGKEIT.gelaende);

    // 2. Untergrund-Höchstgeschwindigkeit + LOW-Untersetzung + Schaden/Reifen
    var vMaxBasis = vMaxMap[abf.untergrund] !== undefined ? vMaxMap[abf.untergrund] : 13.9;
    if (koerper.untersetzung && profil === 'gelaende') {
      vMaxBasis = Math.min(vMaxBasis, 8.3); // 30 km/h in LOW
    }
    if (EEP.schaden && typeof EEP.schaden.effektivesVMax === 'function') {
      vMaxBasis = EEP.schaden.effektivesVMax(koerper, vMaxBasis);
    }

    // Sand-Festfahren für strassenpkw nach > 2 s Stillstand (d-world-collisions-003)
    if (profil === 'strassenpkw' && abf.untergrund === 'sand') {
      if (Math.abs(koerper.v) < 0.2) {
        koerper.sandStillstandSek = (koerper.sandStillstandSek || 0) + deltaSec;
      } else {
        koerper.sandStillstandSek = 0;
      }
      if (koerper.sandStillstandSek > 2.0) {
        vMaxBasis = 0;
        koerper.v = 0;
      }
    } else {
      koerper.sandStillstandSek = 0;
    }

    // 3. Wasserdurchfahrt & Übergabe an Paket B (Einsinken)
    var wattMax = WATTTIEFE[profil] || 0.70;
    if (abf.tiefe > 0.05) {
      if (abf.tiefe <= wattMax) {
        vMaxBasis = Math.min(vMaxBasis, 2.8); // max 10 km/h beim Waten
      } else if (EEP.schaden && typeof EEP.schaden.tickWasser === 'function') {
        EEP.schaden.tickWasser(koerper, deltaSec, abf, wattMax);
      }
    } else if (EEP.schaden && typeof EEP.schaden.tickWasser === 'function') {
      EEP.schaden.tickWasser(koerper, deltaSec, abf, wattMax);
    }

    // 4. Steigungseinfluss auf Geschwindigkeit (s-world-collisions-005)
    var vMaxEffektiv = vMaxBasis;
    if (sProzent > 0) {
      if (sAbs <= sMax) {
        // Linear auf 40 % bei s = sMax
        var faktor = 1.0 - 0.60 * (sAbs / sMax);
        vMaxEffektiv = vMaxBasis * faktor;
      } else {
        // Oberhalb sMax: Traktionsverlust -> Verzögerung a = -(9.81 * sin(atan(s)) + 3.0) m/s²
        var steigungRad = Math.atan(sAbs / 100);
        var verz = 9.81 * Math.sin(steigungRad) + 3.0;
        koerper.v -= verz * deltaSec;
        koerper.traktionsverlust = true;
      }
    } else {
      koerper.traktionsverlust = false;
    }

    // Sanftes Abbremsen auf neues Untergrund-Limit (nur wenn kein Traktionsverlust)
    if (!koerper.traktionsverlust && koerper.v > vMaxEffektiv) {
      koerper.v = Math.max(vMaxEffektiv, koerper.v - 12.0 * deltaSec);
    }

    // 5. Teilschritte gegen Durchtunneln (max 0.5 m pro Teilschritt)
    var wegGesamt = Math.abs(koerper.v) * deltaSec;
    var nSchritte = Math.max(1, Math.ceil(wegGesamt / 0.5));
    var subDt = deltaSec / nSchritte;

    // Falls Komponente Position bereits vorintegriert hat, von startX/startZ ausgehen
    var curX = typeof koerper.vorherX === 'number' ? koerper.vorherX : koerper.x;
    var curZ = typeof koerper.vorherZ === 'number' ? koerper.vorherZ : koerper.z;
    var curYaw = koerper.yaw || 0;
    var lenkWinkel = koerper.lenkWinkel || 0;
    var radstand = koerper.radstand || 2.89;

    for (var s = 0; s < nSchritte; s++) {
      // Spurziehen bei plattem Reifen (Paket B)
      if (EEP.schaden && typeof EEP.schaden.berechneReifenGierRate === 'function') {
        curYaw += EEP.schaden.berechneReifenGierRate(koerper) * subDt;
      }
      if (Math.abs(koerper.v) > 0.01 && Math.abs(lenkWinkel) > 0.001) {
        var omega = (koerper.v / radstand) * Math.tan(lenkWinkel);
        curYaw += omega * subDt;
      }
      var fx = -Math.sin(curYaw);
      var fz = -Math.cos(curYaw);
      curX += fx * koerper.v * subDt;
      curZ += fz * koerper.v * subDt;

      curX = Math.max(-430, Math.min(450, curX));
      curZ = Math.max(-1400, Math.min(450, curZ));
      koerper.x = curX;
      koerper.z = curZ;
      koerper.yaw = curYaw;

      var vVorKollision = koerper.v;
      var koll = aufloesenKollision(koerper);
      curX = Math.max(-430, Math.min(450, koerper.x));
      curZ = Math.max(-1400, Math.min(450, koerper.z));
      koerper.x = curX;
      koerper.z = curZ;
      if (koll && Math.abs(koerper.v) < 0.1) {
        if (!koerper.letzterVImpact || koll.vImpact > koerper.letzterVImpact) {
          koerper.letzterVImpact = koll.vImpact || Math.abs(vVorKollision);
        }
        break;
      }
    }

    // 6. 4-Rad-Aufstandspunkte für Höhe, Pitch, Roll & Reifenplatzer-Check
    var raeder = berechneRadPositionen(koerper.x, koerper.z, koerper.yaw);
    if (EEP.welt) {
      var hVL = EEP.welt.hoeheBei(raeder.vl.x, raeder.vl.z);
      var hVR = EEP.welt.hoeheBei(raeder.vr.x, raeder.vr.z);
      var hHL = EEP.welt.hoeheBei(raeder.hl.x, raeder.hl.z);
      var hHR = EEP.welt.hoeheBei(raeder.hr.x, raeder.hr.z);

      var hVorne = (hVL + hVR) * 0.5;
      var hHinten = (hHL + hHR) * 0.5;
      var hLinks = (hVL + hHL) * 0.5;
      var hRechts = (hVR + hHR) * 0.5;

      if (!koerper.schaden || koerper.schaden.wasserZustand === 'trocken' || koerper.schaden.wasserZustand === 'watend') {
        var bodenY = Math.max(0.21, (hVorne + hHinten) * 0.5);
        koerper.y = bodenY + 0.03;
        koerper.pitch = Math.atan2(hVorne - hHinten, 2.89);
        koerper.roll = Math.atan2(hLinks - hRechts, 1.64);
      }

      if (EEP.schaden && typeof EEP.schaden.pruefeReifenUntergrund === 'function') {
        EEP.schaden.pruefeReifenUntergrund(koerper, raeder, deltaSec);
      }
    }

    koerper.untergrund = abf.untergrund;
    koerper.steigung = sProzent;
    koerper.vorherX = koerper.x;
    koerper.vorherZ = koerper.z;
    return koerper;
  }

  // --------------------------------------------------------------------------
  // 3. Schiffs-Physikschritt (s-world-collisions-006)
  // --------------------------------------------------------------------------
  function schrittSchiff(koerper, dt) {
    var deltaSec = Math.min(Math.max(dt || 0.016, 0.001), 0.05);
    var tiefgang = koerper.tiefgang || 2.5; // Hauptschiff 2.5 m
    var halbL = koerper.halbLaenge || 14.0;
    var yaw = koerper.yaw || 0;
    var fwdX = -Math.sin(yaw);
    var fwdZ = -Math.cos(yaw);

    var curX = typeof koerper.vorherX === 'number' ? koerper.vorherX : koerper.x;
    var curZ = typeof koerper.vorherZ === 'number' ? koerper.vorherZ : koerper.z;

    // Wenn bereits auf Grund gelaufen: nur Rückwärtsfahrt erlaubt, wenn Heck genug Tiefe hat
    if (koerper.aufGrund && koerper.v > 0) {
      koerper.v = 0;
    }

    var weg = Math.abs(koerper.v) * deltaSec;
    var nSchritte = Math.max(1, Math.ceil(weg / 0.5));
    var subDt = deltaSec / nSchritte;

    for (var i = 0; i < nSchritte; i++) {
      curX += fwdX * koerper.v * subDt;
      curZ += fwdZ * koerper.v * subDt;
      koerper.x = curX;
      koerper.z = curZ;

      // Kai-Mauer / Hindernis-Kollision
      aufloesenKollision(koerper);
      curX = koerper.x;
      curZ = koerper.z;

      if (EEP.welt) {
        var bug = EEP.welt.abfrage(curX + fwdX * halbL, curZ + fwdZ * halbL);
        var mitte = EEP.welt.abfrage(curX, curZ);
        var heck = EEP.welt.abfrage(curX - fwdX * halbL, curZ - fwdZ * halbL);

        var minTiefe = Math.min(bug.tiefe, mitte.tiefe, heck.tiefe);
        var keinWasser = (bug.untergrund !== 'wasser' && bug.untergrund !== 'riff') ||
                         (mitte.untergrund !== 'wasser' && mitte.untergrund !== 'riff') ||
                         (heck.untergrund !== 'wasser' && heck.untergrund !== 'riff');

        if (keinWasser || minTiefe < tiefgang + 0.2) {
          // Prüfen, ob wir rückwärts wieder freikommen
          var heckFrei = (heck.untergrund === 'wasser' || heck.untergrund === 'riff') && (heck.tiefe >= tiefgang + 0.2);
          if (koerper.v < 0 && heckFrei && bug.tiefe >= heck.tiefe) {
            koerper.aufGrund = false;
            koerper.roll = 0;
          } else {
            var vVorAuflaufen = Math.abs(koerper.v);
            if (!koerper.aufGrund && vVorAuflaufen >= 2.0 && EEP.bus) {
              EEP.bus.emit('aufprall', {
                koerperId: koerper.id,
                hindernisId: mitte.untergrund === 'riff' ? 'rotes-meer-riff' : 'untiefe',
                art: 'grund',
                vImpact: vVorAuflaufen,
                normalX: -fwdX,
                normalZ: -fwdZ,
                vorneTreffer: koerper.v >= 0
              });
            }
            koerper.aufGrund = true;
            // Mit 8 m/s² auf 0 abbremsen (bzw. sofort bei starker Untiefe)
            if (koerper.v > 0) {
              koerper.v = Math.max(0, koerper.v - 8.0 * subDt);
              if (minTiefe < tiefgang) koerper.v = 0;
            } else if (!heckFrei) {
              koerper.v = 0;
            }
            koerper.roll = (3.0 * Math.PI) / 180; // 3° Krängung auf Grund
          }
        } else {
          koerper.aufGrund = false;
          koerper.roll = 0;
        }
      }
    }

    koerper.vorherX = koerper.x;
    koerper.vorherZ = koerper.z;
    return koerper;
  }

  // --------------------------------------------------------------------------
  // 4. Lara-Physikschritt (s-world-collisions-007)
  // --------------------------------------------------------------------------
  function schrittLara(koerper, dt) {
    var deltaSec = Math.min(Math.max(dt || 0.016, 0.001), 0.05);
    var curX = typeof koerper.vorherX === 'number' ? koerper.vorherX : koerper.x;
    var curZ = typeof koerper.vorherZ === 'number' ? koerper.vorherZ : koerper.z;
    var yaw = koerper.yaw || 0;
    var fwdX = -Math.sin(yaw);
    var fwdZ = -Math.cos(yaw);

    var abfStart = EEP.welt ? EEP.welt.abfrage(curX, curZ) : { hoehe: 0.25, tiefe: 0, steigung: 0, steigungX: 0, steigungZ: 0 };

    // Wasser-Modi für Lara: Waten (0.30-1.20 m) und Schwimmen (> 1.20 m)
    koerper.watet = (abfStart.tiefe >= 0.30 && abfStart.tiefe <= 1.20);
    koerper.schwimmt = (abfStart.tiefe > 1.20);

    if (koerper.watet) {
      koerper.v = Math.min(koerper.v || 0, 2.1); // 50 % Laufgeschwindigkeit
    } else if (koerper.schwimmt) {
      koerper.v = Math.min(koerper.v || 0, 1.2); // 1.2 m/s Schwimmtempo
    }

    var weg = Math.abs(koerper.v || 0) * deltaSec;
    var nSchritte = Math.max(1, Math.ceil(weg / 0.4));
    var subDt = deltaSec / nSchritte;

    for (var s = 0; s < nSchritte; s++) {
      var nextX = curX + fwdX * (koerper.v || 0) * subDt;
      var nextZ = curZ + fwdZ * (koerper.v || 0) * subDt;

      if (EEP.welt) {
        var abfNeu = EEP.welt.abfrage(nextX, nextZ);
        // Steigung > 60 % -> Lara kann nicht hinauflaufen und rutscht mit 2 m/s zurück
        var steigInRichtung = (abfNeu.steigungX * fwdX + abfNeu.steigungZ * fwdZ) * 100;
        if (abfNeu.steigung > 60 && steigInRichtung > 10 && !koerper.springt) {
          var gradLen = Math.sqrt(abfNeu.steigungX * abfNeu.steigungX + abfNeu.steigungZ * abfNeu.steigungZ) || 1;
          nextX = curX - (abfNeu.steigungX / gradLen) * 2.0 * subDt;
          nextZ = curZ - (abfNeu.steigungZ / gradLen) * 2.0 * subDt;
          koerper.rutscht = true;
        } else {
          koerper.rutscht = false;
        }
      }

      koerper.x = nextX;
      koerper.z = nextZ;
      aufloesenKollision(koerper);
      curX = koerper.x;
      curZ = koerper.z;
    }

    if (EEP.welt) {
      var abfEnde = EEP.welt.abfrage(koerper.x, koerper.z);
      koerper.watet = (abfEnde.tiefe >= 0.30 && abfEnde.tiefe <= 1.20);
      koerper.schwimmt = (abfEnde.tiefe > 1.20);
      if (koerper.schwimmt) {
        // Kopf über Wasser (y = 0.05 - 1.35 m für die Füße)
        koerper.y = 0.05 - 1.35;
        koerper.pitch = (70 * Math.PI) / 180;
      } else {
        koerper.y = abfEnde.hoehe;
        koerper.pitch = 0;
      }
    }

    koerper.vorherX = koerper.x;
    koerper.vorherZ = koerper.z;
    return koerper;
  }

  // --------------------------------------------------------------------------
  // 5. Öffentliche API (EEP.fahrzeugPhysik)
  // --------------------------------------------------------------------------
  EEP.fahrzeugPhysik = {
    vmaxTabelle: VMAX_TABELLE,
    steigfaehigkeit: STEIGFAEHIGKEIT,
    watttiefe: WATTTIEFE,
    berechneRadPositionen: berechneRadPositionen,

    schritt: function (koerper, deltaSec) {
      if (!koerper) return null;
      if (koerper.typ === 'auto') return schrittAuto(koerper, deltaSec);
      if (koerper.typ === 'schiff') return schrittSchiff(koerper, deltaSec);
      if (koerper.typ === 'lara') return schrittLara(koerper, deltaSec);
      return koerper;
    },

    pruefeSchiffsRouten: function (schiffe) {
      if (!EEP.welt || !schiffe) return [];
      var warnungen = [];
      for (var i = 0; i < schiffe.length; i++) {
        var s = schiffe[i];
        var von = s.von, nach = s.nach;
        if (!von || !nach) continue;
        var tiefgang = s.tiefgang || 1.5;
        var dx = nach.x - von.x;
        var dz = nach.z - von.z;
        var dist = Math.sqrt(dx * dx + dz * dz);
        var steps = Math.max(1, Math.ceil(dist / 2.0));
        for (var k = 0; k <= steps; k++) {
          var u = k / steps;
          var px = von.x + dx * u;
          var pz = von.z + dz * u;
          var abf = EEP.welt.abfrage(px, pz);
          if ((abf.untergrund !== 'wasser' && abf.untergrund !== 'riff') || abf.tiefe < tiefgang) {
            var msg = 'ROUTE_UNGUELTIG ' + (s.id || ('schiff-' + i)) + ' ' + px.toFixed(1) + ' ' + pz.toFixed(1) + ' ' + abf.tiefe.toFixed(2);
            warnungen.push(msg);
            break;
          }
        }
      }
      return warnungen;
    }
  };
})();
