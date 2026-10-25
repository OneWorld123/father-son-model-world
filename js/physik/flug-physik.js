/* ============================================================================
 * js/physik/flug-physik.js – Paket E: Flugphysik, Klappen, Störklappen & ILS
 * WICHTIG: Reine Simulationslogik ohne Browser-DOM oder 3D-Engine-Referenzen.
 * ============================================================================ */
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.flugPhysik = '1.0.0';

  var KLAPPEN_TABELLE = [
    { stufe: 0, name: '0 (Clean)',    winkelGrad: 0,  cLBasis: 0.42, cD: 0.024, vStall: 14.5, vMax: 52.0, vAnflug: 19.0 },
    { stufe: 1, name: '1 (10° Start)', winkelGrad: 10, cLBasis: 0.66, cD: 0.045, vStall: 12.2, vMax: 40.0, vAnflug: 16.0 },
    { stufe: 2, name: '2 (25° Anflug)',winkelGrad: 25, cLBasis: 0.94, cD: 0.082, vStall: 10.2, vMax: 32.0, vAnflug: 13.5 },
    { stufe: 3, name: 'FULL (40°)',    winkelGrad: 40, cLBasis: 1.28, cD: 0.135, vStall: 8.5,  vMax: 26.0, vAnflug: 11.0 }
  ];

  var SPOILER_TABELLE = [
    { stufe: 0, name: 'AUS',   cDZusatz: 0.0,  auftriebFaktor: 1.0  },
    { stufe: 1, name: 'ARMED', cDZusatz: 0.0,  auftriebFaktor: 1.0  },
    { stufe: 2, name: 'VOLL',  cDZusatz: 0.24, auftriebFaktor: 0.58 }
  ];

  var FLUGHAEFEN = {
    DE: { id: 'DE', name: 'Flughafen Deutschland', x: -312.0, y: 0.90, zMitte: -6.0,  zSued: 18.0,  zNord: -30.0, laenge: 52.0 },
    US: { id: 'US', name: 'New York Airport',      x:  306.0, y: 0.90, zMitte: 14.0,  zSued: 40.0,  zNord: -12.0, laenge: 58.0 },
    AF: { id: 'AF', name: 'Flughafen Aegypten',    x:   68.0, y: 0.90, zMitte: 190.0, zSued: 212.0, zNord: 168.0, laenge: 48.0 }
  };

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function normiereYaw(yaw) {
    while (yaw > Math.PI) yaw -= Math.PI * 2;
    while (yaw < -Math.PI) yaw += Math.PI * 2;
    return yaw;
  }

  function stelleFlugZustandSicher(koerper) {
    if (!koerper) return null;
    if (!koerper.flug) {
      var amBodenStart = (typeof koerper.y === 'number' ? koerper.y : 0.9) <= 1.15;
      koerper.flug = {
        klappenStufe: 0,
        klappenWinkel: 0,
        spoilerStufe: 1, // Standard: ARMED für Landung
        bodenSpoilerAktiv: false,
        autothrottle: false,
        zielV: 24.0,
        ilsAktiv: false,
        ilsFlughafen: 'DE',
        autoReverse: true,
        schubumkehrAktiv: false,
        schub: typeof koerper.schub === 'number' ? koerper.schub : 1.0,
        stall: false,
        overspeed: false,
        amBoden: amBodenStart,
        warInDerLuft: !amBodenStart,
        sinkrate: 0,
        auftriebFaktor: 1.0,
        letzteWarnungMs: 0,
        ilsDaten: null
      };
    }
    if (typeof koerper.v !== 'number') {
      koerper.v = koerper.flug.schub * 24.0;
    }
    return koerper.flug;
  }

  function findeNaechstenFlughafen(koerper) {
    var besteId = 'DE';
    var besteDist = Infinity;
    for (var k in FLUGHAEFEN) {
      if (Object.prototype.hasOwnProperty.call(FLUGHAEFEN, k)) {
        var fh = FLUGHAEFEN[k];
        var dx = (koerper.x || 0) - fh.x;
        var dz = (koerper.z || 0) - fh.zMitte;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d < besteDist) {
          besteDist = d;
          besteId = k;
        }
      }
    }
    return besteId;
  }

  EEP.flugPhysik = {
    KLAPPEN_TABELLE: KLAPPEN_TABELLE,
    SPOILER_TABELLE: SPOILER_TABELLE,
    FLUGHAEFEN: FLUGHAEFEN,

    initialisiere: function (koerper) {
      return stelleFlugZustandSicher(koerper);
    },

    holeKlappenInfo: function (stufe) {
      var idx = clamp(Math.round(Number(stufe) || 0), 0, KLAPPEN_TABELLE.length - 1);
      return KLAPPEN_TABELLE[idx];
    },

    setzeKlappen: function (koerper, stufe) {
      var flug = stelleFlugZustandSicher(koerper);
      if (!flug) return null;
      var idx = clamp(Math.round(Number(stufe) || 0), 0, KLAPPEN_TABELLE.length - 1);
      flug.klappenStufe = idx;
      if (flug.ilsAktiv && flug.autothrottle) {
        flug.zielV = KLAPPEN_TABELLE[idx].vAnflug;
      }
      if (EEP.bus) {
        EEP.bus.emit('flug-klappen', {
          id: koerper.id,
          klappenStufe: idx,
          name: KLAPPEN_TABELLE[idx].name,
          vStall: KLAPPEN_TABELLE[idx].vStall,
          vMax: KLAPPEN_TABELLE[idx].vMax
        });
      }
      return KLAPPEN_TABELLE[idx];
    },

    zyklusKlappen: function (koerper, richtung) {
      var flug = stelleFlugZustandSicher(koerper);
      var delta = typeof richtung === 'number' ? richtung : 1;
      var neu = (flug.klappenStufe + delta);
      if (neu > 3) neu = 0;
      if (neu < 0) neu = 0;
      return EEP.flugPhysik.setzeKlappen(koerper, neu);
    },

    setzeSpoilers: function (koerper, modus) {
      var flug = stelleFlugZustandSicher(koerper);
      if (!flug) return null;
      var idx = clamp(Math.round(Number(modus) || 0), 0, SPOILER_TABELLE.length - 1);
      flug.spoilerStufe = idx;
      if (idx === 0) flug.bodenSpoilerAktiv = false;
      if (EEP.bus) {
        EEP.bus.emit('flug-spoilers', {
          id: koerper.id,
          spoilerStufe: idx,
          name: SPOILER_TABELLE[idx].name
        });
      }
      return SPOILER_TABELLE[idx];
    },

    zyklusSpoilers: function (koerper) {
      var flug = stelleFlugZustandSicher(koerper);
      var neu = (flug.spoilerStufe + 1) % SPOILER_TABELLE.length;
      return EEP.flugPhysik.setzeSpoilers(koerper, neu);
    },

    setzeAutothrottle: function (koerper, aktiv, zielV) {
      var flug = stelleFlugZustandSicher(koerper);
      if (!flug) return null;
      flug.autothrottle = Boolean(aktiv);
      if (typeof zielV === 'number' && zielV > 0) {
        flug.zielV = clamp(zielV, 8.0, 50.0);
      } else if (flug.autothrottle) {
        var kl = KLAPPEN_TABELLE[flug.klappenStufe];
        flug.zielV = flug.ilsAktiv ? kl.vAnflug : clamp(koerper.v || 24.0, kl.vStall + 2.0, kl.vMax - 2.0);
      }
      return flug;
    },

    setzeILS: function (koerper, aktiv, flughafenId) {
      var flug = stelleFlugZustandSicher(koerper);
      if (!flug) return null;
      flug.ilsAktiv = Boolean(aktiv);
      if (flughafenId && FLUGHAEFEN[flughafenId]) {
        flug.ilsFlughafen = flughafenId;
      } else if (flug.ilsAktiv) {
        flug.ilsFlughafen = findeNaechstenFlughafen(koerper);
      }
      if (flug.ilsAktiv) {
        // Im ILS-Anflug automatisch Klappen mindestens auf 2 (Approach) und Spoiler auf ARMED setzen
        if (flug.klappenStufe < 2) {
          EEP.flugPhysik.setzeKlappen(koerper, 2);
        }
        if (flug.spoilerStufe === 0) {
          flug.spoilerStufe = 1;
        }
        flug.autothrottle = true;
        flug.zielV = KLAPPEN_TABELLE[flug.klappenStufe].vAnflug;
      }
      return flug;
    },

    berechneILS: function (koerper, flughafenId) {
      var flug = stelleFlugZustandSicher(koerper);
      var fhId = (flughafenId && FLUGHAEFEN[flughafenId]) ? flughafenId : (flug && flug.ilsFlughafen) || findeNaechstenFlughafen(koerper);
      var fh = FLUGHAEFEN[fhId] || FLUGHAEFEN.DE;

      // Standard-Anflug von Süden nach Norden (Kurs 0 rad = -Z) auf die Südschwelle
      var schwelleZ = fh.zSued - 4.0;
      var dx = (koerper.x || 0) - fh.x;
      var dz = (koerper.z || 0) - schwelleZ;
      var distZ = Math.max(1.0, Math.abs(dz));
      var distanzM = Math.sqrt(dx * dx + dz * dz);

      // Seitliche Localizer-Abweichung in Grad (+ = rechts der Piste, - = links der Piste)
      var locDeg = Math.atan2(dx, Math.max(8.0, distZ)) * (180 / Math.PI);
      var locDots = clamp(locDeg / 1.25, -2.0, 2.0);

      // 3.0°-Soll-Gleitpfad zur Schwelle
      var hoeheUeberPiste = Math.max(0, (koerper.y || 0.9) - fh.y);
      var sollHoehe = fh.y + Math.tan(3.0 * Math.PI / 180) * Math.max(0, dz);
      var istGsDeg = Math.atan2(hoeheUeberPiste, Math.max(6.0, Math.max(0, dz))) * (180 / Math.PI);
      var gsDeg = istGsDeg - 3.0;
      var gsDots = clamp(gsDeg / 0.75, -2.0, 2.0);

      var aufGleitpfad = Math.abs(locDots) < 0.8 && Math.abs(gsDots) < 0.8;

      var daten = {
        flughafenId: fh.id,
        name: fh.name,
        pisteX: fh.x,
        pisteY: fh.y,
        schwelleZ: schwelleZ,
        sollHoehe: sollHoehe,
        distanzM: Math.round(distanzM * 10) / 10,
        locDeg: Math.round(locDeg * 100) / 100,
        locDots: Math.round(locDots * 100) / 100,
        gsDeg: Math.round(gsDeg * 100) / 100,
        gsDots: Math.round(gsDots * 100) / 100,
        aufGleitpfad: aufGleitpfad
      };
      if (flug) flug.ilsDaten = daten;
      return daten;
    },

    schritt: function (koerper, dt, eingabe) {
      if (!koerper || !dt || dt <= 0) return null;
      var d = Math.min(dt, 0.1);
      var flug = stelleFlugZustandSicher(koerper);
      var inp = eingabe || {};

      var klappe = KLAPPEN_TABELLE[flug.klappenStufe] || KLAPPEN_TABELLE[0];
      var spoiler = SPOILER_TABELLE[flug.spoilerStufe] || SPOILER_TABELLE[0];

      // Klappenwinkel sanft nachführen
      flug.klappenWinkel += (klappe.winkelGrad - flug.klappenWinkel) * Math.min(1, d * 6.0);

      // 1. Bodenhöhe über Welt-Abfrage bestimmen
      var bodenY = 0.90;
      var untergrund = 'strasse';
      if (EEP.welt && typeof EEP.welt.abfrage === 'function') {
        var wInfo = EEP.welt.abfrage(koerper.x || 0, koerper.z || 0);
        if (wInfo) {
          untergrund = wInfo.untergrund;
          bodenY = Math.max(0.30, (wInfo.hoehe || 0.25) + 0.60);
        }
      }

      var warAmBoden = flug.amBoden;
      var hoeheUeberGrund = (koerper.y || 0.90) - bodenY;

      // 2. Schub & Autothrottle / Schubumkehr
      if (inp.schubPlus) {
        flug.autothrottle = false;
        flug.schubumkehrAktiv = false;
        flug.schub = clamp(flug.schub + 0.85 * d, 0.0, 2.5);
      } else if (inp.schubMinus) {
        flug.autothrottle = false;
        flug.schub = clamp(flug.schub - 0.85 * d, 0.0, 2.5);
      } else if (typeof inp.schub === 'number') {
        flug.schub = clamp(inp.schub, 0.0, 2.5);
      }

      if (flug.autothrottle && !flug.schubumkehrAktiv) {
        var vFehler = flug.zielV - (koerper.v || 0);
        var BasisSchub = (flug.zielV / 24.0) * (1.0 + klappe.cD * 1.8);
        var zielSchub = clamp(BasisSchub + vFehler * 0.12, 0.05, 2.2);
        flug.schub += (zielSchub - flug.schub) * Math.min(1, d * 3.5);
      }

      // 3. Längsbeschleunigung, Luftwiderstand (Flaps + Spoilers) und Schubumkehr
      var vVorher = typeof koerper.v === 'number' ? koerper.v : (flug.schub * 24.0);
      var v = vVorher;
      var effSpoilerCD = spoiler.cDZusatz + (flug.bodenSpoilerAktiv ? 0.28 : 0.0);
      var gesamtCD = klappe.cD + effSpoilerCD;

      var antriebMps2 = 0;
      if (flug.schubumkehrAktiv && flug.amBoden) {
        // Aktive Schubumkehr + Radbremsen + Ground-Spoilers verzögern stark
        antriebMps2 = -14.5 - v * 0.45;
        flug.schub = 0;
        if (v <= 3.2) {
          v = Math.max(0, v);
          flug.schubumkehrAktiv = false;
          flug.bodenSpoilerAktiv = false;
          if (EEP.bus) {
            EEP.bus.emit('flug-schubumkehr-ende', { id: koerper.id, v: v });
          }
        }
      } else {
        // Gleichgewichts-Geschwindigkeit ohne Zusatz-Spoiler ~ 24.0 * schub (bei Clean-Flaps)
        var sollVClean = flug.schub * 24.0;
        var regierFaktor = v > sollVClean ? 0.35 : 2.2;
        var antriebKraft = (sollVClean - v) * regierFaktor;
        var klappenUndSpoilerBremsung = (gesamtCD - 0.024) * v * v * 0.14;
        var hangAbtrieb = -Math.sin(koerper.pitch || 0) * 6.5;
        antriebMps2 = antriebKraft - klappenUndSpoilerBremsung + hangAbtrieb;
      }

      v = clamp(v + antriebMps2 * d, 0.0, 68.0);
      koerper.v = v;
      koerper.schub = flug.schub;

      // 4. Overspeed- & Stall-Prüfung
      flug.overspeed = (vVorher > klappe.vMax) || (v > klappe.vMax);
      if (flug.overspeed && EEP.bus) {
        EEP.bus.emit('flug-warnung', { id: koerper.id, typ: 'overspeed', v: Math.max(vVorher, v), vMax: klappe.vMax, klappenStufe: flug.klappenStufe });
      }

      var inDerLuft = hoeheUeberGrund > 0.35;
      if (inDerLuft && v < klappe.vStall) {
        flug.stall = true;
        if (EEP.bus) {
          EEP.bus.emit('flug-warnung', { id: koerper.id, typ: 'stall', v: v, vStall: klappe.vStall, klappenStufe: flug.klappenStufe });
        }
      } else {
        flug.stall = false;
      }

      // 5. ILS-Regelung oder manuelle Ruder-Steuerung
      var ils = EEP.flugPhysik.berechneILS(koerper, flug.ilsFlughafen);
      var zielRoll = 0;
      var zielPitch = koerper.pitch || 0;

      if (flug.ilsAktiv) {
        // Localizer: Seitlichen Versatz dx zur Pisten-Mittellinie ausregeln
        var dxPiste = (koerper.x || 0) - ils.pisteX;
        var sollKurs = clamp(dxPiste * 0.045, -0.55, 0.55); // Korrekturwinkel Richtung Piste (Kurs 0 = Nord -Z)
        var yawDiff = normiereYaw(sollKurs - (koerper.yaw || 0));
        zielRoll = clamp(yawDiff * 1.8, -0.48, 0.48);
        koerper.yaw = normiereYaw((koerper.yaw || 0) + clamp(yawDiff * 2.4, -0.8, 0.8) * d);

        // Glideslope: 3°-Gleitpfad bis kurz vor der Piste, dann Flare
        if (hoeheUeberGrund <= 2.0 && Math.abs(dxPiste) < 6.0) {
          // Sanftes Ausschweben (Flare)
          zielPitch = 0.03;
          if (flug.klappenStufe < 3) EEP.flugPhysik.setzeKlappen(koerper, 3);
          if (hoeheUeberGrund <= 0.65) {
            flug.autothrottle = false;
            flug.schub = 0.0;
          }
        } else {
          var hoehenFehler = ils.sollHoehe - (koerper.y || 0.90);
          zielPitch = clamp(hoehenFehler * 0.055 - 0.052, -0.24, 0.22);
        }
      } else {
        if (inp.links) zielRoll = 0.65;
        else if (inp.rechts) zielRoll = -0.65;

        if (inp.hoch) zielPitch = 0.42;
        else if (inp.runter) zielPitch = -0.42;
        else if (typeof inp.zielPitch === 'number') zielPitch = inp.zielPitch;
        else zielPitch = 0;
      }

      // Bei Strömungsabriss (Stall) drückt die Physik die Flugzeugnase nach unten!
      if (flug.stall && inDerLuft) {
        zielPitch = Math.min(zielPitch, -0.28);
      }

      koerper.roll = (koerper.roll || 0) + (zielRoll - (koerper.roll || 0)) * Math.min(1, d * 5.5);
      koerper.pitch = (koerper.pitch || 0) + (zielPitch - (koerper.pitch || 0)) * Math.min(1, d * 5.0);

      // 6. Kurvenrate & Auftrieb / Vertikalbewegung
      if (v > 0.2) {
        var ruderLenkung = inp.links ? 0.35 : (inp.rechts ? -0.35 : 0);
        var turnRate = (koerper.roll || 0) * 1.45 + ruderLenkung;
        koerper.yaw = normiereYaw((koerper.yaw || 0) + turnRate * d);
      }

      // Auftriebsverhältnis relativ zur aktuellen Stall-Schwelle
      var auftriebVerhaeltnis = (v / Math.max(1.0, klappe.vStall)) * spoiler.auftriebFaktor;
      flug.auftriebFaktor = Math.round(auftriebVerhaeltnis * 100) / 100;

      var vy = Math.sin(koerper.pitch || 0) * v;
      if (flug.stall && inDerLuft) {
        // Im Stall sackt das Flugzeug trotz gezogenem Höhenruder durch
        vy = Math.min(vy, -4.5 - (klappe.vStall - v) * 1.2);
      } else if (!inDerLuft && v >= klappe.vStall * 1.02 && (koerper.pitch || 0) > 0.04 && !flug.schubumkehrAktiv) {
        // Abheben von der Startbahn dank Klappen-Auftrieb
        vy = Math.max(vy, (v - klappe.vStall) * 0.45);
      }
      flug.sinkrate = vy;

      koerper.x = (koerper.x || 0) + (-Math.sin(koerper.yaw || 0) * Math.cos(koerper.pitch || 0) * v * d);
      koerper.y = (koerper.y || 0.90) + vy * d;
      koerper.z = (koerper.z || 0) + (-Math.cos(koerper.yaw || 0) * Math.cos(koerper.pitch || 0) * v * d);

      // 7. Boden- & Aufsetzlogik (Touchdown -> Auto-Reverse & Ground-Spoilers)
      if (koerper.y <= bodenY) {
        koerper.y = bodenY;
        flug.amBoden = true;
        if (koerper.pitch < 0) koerper.pitch = 0;
        koerper.roll *= 0.80;

        // Touchdown nach Flugphase?
        if ((!warAmBoden || flug.warInDerLuft) && v > 5.0) {
          flug.warInDerLuft = false;
          if (flug.spoilerStufe === 1 || flug.spoilerStufe === 2) {
            flug.bodenSpoilerAktiv = true;
          }
          if (flug.autoReverse) {
            flug.schubumkehrAktiv = true;
            flug.autothrottle = false;
            flug.ilsAktiv = false;
            flug.schub = 0;
            if (EEP.bus) {
              EEP.bus.emit('flug-touchdown', {
                id: koerper.id,
                v: v,
                sinkrate: vy,
                schubumkehrAktiv: true,
                bodenSpoilerAktiv: flug.bodenSpoilerAktiv
              });
            }
          }
        }
      } else {
        flug.amBoden = false;
        if (koerper.y - bodenY > 1.2) {
          flug.warInDerLuft = true;
          flug.bodenSpoilerAktiv = false;
          flug.schubumkehrAktiv = false;
        }
        if (koerper.y > 140) koerper.y = 140;
      }

      koerper.x = clamp(koerper.x, -390, 390);
      koerper.z = clamp(koerper.z, -145, 280);

      return flug;
    }
  };
})();
