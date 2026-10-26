/* ============================================================================
 * js/welt/pyramiden-kammer.js – Geheime Tomb-Raider-Pyramidenwelt (Simulationskern)
 * WICHTIG: Reine Simulationslogik ohne Browser-DOM oder 3D-Engine-Referenzen.
 * ============================================================================ */
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.pyramide = '1.0.0';

  // Weltkoordinaten der großen Cheops-Pyramide (Zentrum: X=146, Z=212)
  var ZENTRUM = { x: 146.0, y: 0.26, z: 212.0 };
  // Etwas versteckter goldener Skarabäus-Schalter an der rechten Tempelsäule (Vorder-/ Außenseite)
  var GEHEIM_KNOPF = { x: 148.45, y: 1.45, z: 198.62, aktivierungsRadius: 6.5 };
  // Position des schweren Hieroglyphen-Steintors im Nordportal
  var STEIN_TOR = { x: 146.0, y: 2.40, z: 200.20 };

  var FEUERSCHALEN_DEFAULTS = [
    { id: 'schale-nw', x: 141.2, y: 1.15, z: 207.2, brennt: false },
    { id: 'schale-no', x: 150.8, y: 1.15, z: 207.2, brennt: false },
    { id: 'schale-sw', x: 141.2, y: 1.15, z: 216.8, brennt: false },
    { id: 'schale-so', x: 150.8, y: 1.15, z: 216.8, brennt: false }
  ];

  var zustand = {
    initialisiert: false,
    knopfGedrueckt: false,
    torOffen: false,
    torFortschritt: 0.0, // 0.0 = geschlossen, 1.0 = vollständig geöffnet
    fackelAktiv: false,
    flackerIntensitaet: 2.6,
    inKammer: false,
    naheAmKnopf: false,
    entzuendeteSchalen: 0,
    diamantenAnzahl: 0,
    vasenAnzahl: 0,
    sarkophagOk: false,
    musikVideoId: 'Lgqv6LGtCvA',
    musikUrl: 'https://youtu.be/Lgqv6LGtCvA?si=7Br81LFOcjYZKAP2',
    musikSpielt: false,
    musikLautstaerke: 0.0,
    musikPositionSek: 0.0,
    schalen: []
  };

  function kopiereSchalen() {
    zustand.schalen = [];
    for (var i = 0; i < FEUERSCHALEN_DEFAULTS.length; i++) {
      var s = FEUERSCHALEN_DEFAULTS[i];
      zustand.schalen.push({ id: s.id, x: s.x, y: s.y, z: s.z, brennt: s.brennt });
    }
  }
  kopiereSchalen();

  function richteHohlraumKollisionEin() {
    if (!EEP.kollision) return;
    // Vollblock der Cheops-Pyramide entfernen und durch 5 hohle Außenwände ersetzen
    EEP.kollision.entferneHindernis('pyramide-cheops');

    var waende = [
      { id: 'cheops-wand-west',   art: 'pyramide', form: 'box', x: 136.5, z: 212.0, halbBreite: 1.4, halbTiefe: 10.9, halbLaenge: 10.9, hoehe: 21.5, yaw: 0 },
      { id: 'cheops-wand-ost',    art: 'pyramide', form: 'box', x: 155.5, z: 212.0, halbBreite: 1.4, halbTiefe: 10.9, halbLaenge: 10.9, hoehe: 21.5, yaw: 0 },
      { id: 'cheops-wand-sued',   art: 'pyramide', form: 'box', x: 146.0, z: 221.5, halbBreite: 10.9, halbTiefe: 1.4, halbLaenge: 1.4, hoehe: 21.5, yaw: 0 },
      { id: 'cheops-wand-nord-l', art: 'pyramide', form: 'box', x: 140.2, z: 202.2, halbBreite: 3.8, halbTiefe: 1.6, halbLaenge: 1.6, hoehe: 16.0, yaw: 0 },
      { id: 'cheops-wand-nord-r', art: 'pyramide', form: 'box', x: 151.8, z: 202.2, halbBreite: 3.8, halbTiefe: 1.6, halbLaenge: 1.6, hoehe: 16.0, yaw: 0 }
    ];
    for (var i = 0; i < waende.length; i++) {
      EEP.kollision.registriereHindernis(waende[i]);
    }

    aktualisiereTorKollision();

    if (EEP.welt && typeof EEP.welt.registriereZone === 'function') {
      EEP.welt.registriereZone({
        id: 'pyramide-innen-boden',
        form: 'rechteck',
        prioritaet: 45,
        untergrund: 'fels',
        kontinent: 'afrika',
        hoehe: 0.26,
        minX: 137.5,
        maxX: 154.5,
        minZ: 198.0,
        maxZ: 221.0
      });
    }
    zustand.initialisiert = true;
  }

  function aktualisiereTorKollision() {
    if (!EEP.kollision) return;
    if (zustand.torOffen && zustand.torFortschritt >= 0.70) {
      EEP.kollision.entferneHindernis('cheops-steintor');
    } else {
      EEP.kollision.registriereHindernis({
        id: 'cheops-steintor',
        art: 'tempel',
        form: 'box',
        x: STEIN_TOR.x,
        z: STEIN_TOR.z,
        halbBreite: 1.55,
        halbTiefe: 0.65,
        halbLaenge: 0.65,
        hoehe: 4.8,
        yaw: 0
      });
    }
  }

  EEP.pyramide = {
    ZENTRUM: ZENTRUM,
    GEHEIM_KNOPF: GEHEIM_KNOPF,
    STEIN_TOR: STEIN_TOR,
    zustand: zustand,

    initialisiere: function () {
      richteHohlraumKollisionEin();
      return zustand;
    },

    reset: function () {
      zustand.knopfGedrueckt = false;
      zustand.torOffen = false;
      zustand.torFortschritt = 0.0;
      zustand.fackelAktiv = false;
      zustand.inKammer = false;
      zustand.entzuendeteSchalen = 0;
      zustand.musikSpielt = false;
      zustand.musikLautstaerke = 0.0;
      zustand.musikPositionSek = 0.0;
      kopiereSchalen();
      richteHohlraumKollisionEin();
      return zustand;
    },

    drueckeGeheimKnopf: function (offenOptional) {
      if (!zustand.initialisiert) richteHohlraumKollisionEin();
      var zielOffen = typeof offenOptional === 'boolean' ? offenOptional : !zustand.torOffen;
      zustand.knopfGedrueckt = zielOffen;
      zustand.torOffen = zielOffen;
      if (zielOffen && !zustand.fackelAktiv) {
        // Sobald Lara das geheime Tor öffnet, zündet sie ihre Abenteuer-Fackel an!
        zustand.fackelAktiv = true;
      }
      if (EEP.bus) {
        EEP.bus.emit('pyramide-tor', {
          knopfGedrueckt: zustand.knopfGedrueckt,
          torOffen: zustand.torOffen,
          fackelAktiv: zustand.fackelAktiv
        });
      }
      return zustand;
    },

    setzeFackel: function (aktiv) {
      zustand.fackelAktiv = typeof aktiv === 'boolean' ? aktiv : !zustand.fackelAktiv;
      if (EEP.bus) {
        EEP.bus.emit('pyramide-fackel', { fackelAktiv: zustand.fackelAktiv });
      }
      return zustand.fackelAktiv;
    },

    istImInneren: function (x, z) {
      return x >= 137.8 && x <= 154.2 && z >= 200.3 && z <= 220.2;
    },

    schritt: function (dt, laraPos, zeitSek) {
      if (!zustand.initialisiert) richteHohlraumKollisionEin();
      var d = Math.min(dt || 0.016, 0.1);
      var t = typeof zeitSek === 'number' ? zeitSek : 0;

      // 1. Schweres Steintor gleitet mit 0.65 / s auf bzw. zu
      var zielFortschritt = zustand.torOffen ? 1.0 : 0.0;
      if (Math.abs(zielFortschritt - zustand.torFortschritt) > 0.001) {
        var richtung = zielFortschritt > zustand.torFortschritt ? 1 : -1;
        zustand.torFortschritt = Math.max(0.0, Math.min(1.0, zustand.torFortschritt + richtung * 0.75 * d));
        aktualisiereTorKollision();
      }

      // 2. Natürliches Fackel-Flackern berechnen
      zustand.flackerIntensitaet = zustand.fackelAktiv
        ? (2.75 + Math.sin(t * 13.0) * 0.32 + Math.cos(t * 23.0) * 0.18)
        : 0.0;

      // 3. Lara-Interaktionen prüfen (Geheimknopf-Nähe, Betreten der Kammer, Feuerschalen entzünden)
      if (laraPos && typeof laraPos.x === 'number' && typeof laraPos.z === 'number') {
        var dxK = laraPos.x - GEHEIM_KNOPF.x;
        var dzK = laraPos.z - GEHEIM_KNOPF.z;
        var distKnopf = Math.sqrt(dxK * dxK + dzK * dzK);
        zustand.naheAmKnopf = distKnopf <= GEHEIM_KNOPF.aktivierungsRadius;

        // Läuft Lara direkt an den Skarabäus-Schalter an der rechten Säule heran (<= 1.75 m), betätigt sie ihn automatisch!
        if (distKnopf <= 1.75 && !zustand.torOffen) {
          EEP.pyramide.drueckeGeheimKnopf(true);
        }

        var drinnen = EEP.pyramide.istImInneren(laraPos.x, laraPos.z);
        if (drinnen && !zustand.inKammer) {
          zustand.inKammer = true;
          if (!zustand.fackelAktiv) zustand.fackelAktiv = true;
          if (EEP.bus) {
            EEP.bus.emit('pyramide-betreten', {
              x: laraPos.x,
              z: laraPos.z,
              musikPositionSek: zustand.musikPositionSek,
              videoId: zustand.musikVideoId
            });
          }
        } else if (!drinnen && zustand.inKammer) {
          zustand.inKammer = false;
          if (EEP.bus) {
            EEP.bus.emit('pyramide-verlassen', {
              x: laraPos.x,
              z: laraPos.z,
              musikPositionSek: zustand.musikPositionSek
            });
          }
        }

        // 4. Pyramiden-Musik (Lgqv6LGtCvA): Sanftes Fade-In beim Betreten, langsames Fade-Out beim Hinausgehen & Resume
        if (zustand.inKammer) {
          zustand.musikSpielt = true;
          zustand.musikLautstaerke = Math.min(1.0, zustand.musikLautstaerke + 0.55 * d);
          zustand.musikPositionSek = Math.round((zustand.musikPositionSek + d) * 1000) / 1000;
        } else if (zustand.musikLautstaerke > 0.0) {
          zustand.musikLautstaerke = Math.max(0.0, zustand.musikLautstaerke - 0.35 * d);
          if (zustand.musikLautstaerke > 0.001) {
            zustand.musikSpielt = true;
            zustand.musikPositionSek = Math.round((zustand.musikPositionSek + d) * 1000) / 1000;
          } else {
            zustand.musikLautstaerke = 0.0;
            zustand.musikSpielt = false;
          }
        } else {
          zustand.musikSpielt = false;
        }

        // Wenn Lara mit brennender Fackel an einer Feuerschale vorbeiläuft -> entzünden!
        if (zustand.fackelAktiv) {
          var anzahlBrennend = 0;
          for (var i = 0; i < zustand.schalen.length; i++) {
            var schale = zustand.schalen[i];
            if (!schale.brennt) {
              var dxS = laraPos.x - schale.x;
              var dzS = laraPos.z - schale.z;
              if (Math.sqrt(dxS * dxS + dzS * dzS) <= 4.6) {
                schale.brennt = true;
                if (EEP.bus) EEP.bus.emit('pyramide-feuerschale', { id: schale.id });
              }
            }
            if (schale.brennt) anzahlBrennend++;
          }
          zustand.entzuendeteSchalen = anzahlBrennend;
        }
      }

      return zustand;
    }
  };
})();
