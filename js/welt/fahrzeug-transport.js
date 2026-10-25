/* ============================================================================
 * js/welt/fahrzeug-transport.js – Paket I: Begehbarer Innenraum & Fahrzeug-Transport
 * WICHTIG: Reine Simulationslogik ohne Browser-DOM oder 3D-Engine-Referenzen.
 * ============================================================================ */
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.transport = '1.0.0';

  var INNENRAUM_PROFILE = {
    schiff: {
      name: 'Schiffs-Bruecke & Autodeck',
      minX: -1.75,
      maxX: 1.75,
      minZ: -11.5,
      maxZ: 11.5,
      bodenY: 1.15,
      startX: 0.0,
      startZ: -4.2,
      gehTempo: 3.4
    },
    flugzeug: {
      name: 'Airliner-Kabine & Frachtdeck',
      minX: -1.10,
      maxX: 1.10,
      minZ: -8.2,
      maxZ: 8.2,
      bodenY: 0.45,
      startX: 0.0,
      startZ: -3.0,
      gehTempo: 3.0
    },
    zug: {
      name: 'Zug-Waggon & Fuehrerstand',
      minX: -0.95,
      maxX: 0.95,
      minZ: -6.5,
      maxZ: 6.5,
      bodenY: 0.55,
      startX: 0.0,
      startZ: -2.0,
      gehTempo: 2.8
    },
    auto: {
      name: 'G-Klasse Innenraum',
      minX: -0.55,
      maxX: 0.55,
      minZ: -1.10,
      maxZ: 0.85,
      bodenY: 0.35,
      startX: -0.35,
      startZ: -0.20,
      gehTempo: 1.8
    }
  };

  var TRAEGER_RAMPEN = {
    schiff: {
      kapazitaet: 2,
      auffahrtRadius: 22.0,
      stellplaetze: [
        { lokalX: 0.0, lokalY: 0.85, lokalZ: 4.8,  lokalYaw: 0.0 },
        { lokalX: 0.0, lokalY: 0.85, lokalZ: -1.6, lokalYaw: 0.0 }
      ],
      entladeOffset: { lokalX: 0.0, lokalY: 0.0, lokalZ: 16.5, lokalYaw: 0.0 }
    },
    flugzeug: {
      kapazitaet: 2,
      auffahrtRadius: 19.0,
      stellplaetze: [
        { lokalX: 0.0, lokalY: 0.35, lokalZ: 2.4,  lokalYaw: 0.0 },
        { lokalX: 0.0, lokalY: 0.35, lokalZ: -2.8, lokalYaw: 0.0 }
      ],
      entladeOffset: { lokalX: 0.0, lokalY: 0.0, lokalZ: 13.8, lokalYaw: 0.0 }
    }
  };

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function normiereYaw(yaw) {
    while (yaw > Math.PI) yaw -= Math.PI * 2;
    while (yaw < -Math.PI) yaw += Math.PI * 2;
    return yaw;
  }

  // Transformiert lokale Träger-Koordinaten (lx, ly, lz) in Weltkoordinaten
  function lokalZuWelt(traeger, lx, ly, lz, lYaw) {
    var tx = traeger.x || 0;
    var ty = traeger.y || 0;
    var tz = traeger.z || 0;
    var yaw = traeger.yaw || 0;
    var cosY = Math.cos(yaw);
    var sinY = Math.sin(yaw);

    var wx = tx + (lx * cosY + lz * sinY);
    var wz = tz + (-lx * sinY + lz * cosY);
    var wy = ty + (ly || 0);
    var wYaw = normiereYaw(yaw + (lYaw || 0));

    return {
      x: wx,
      y: wy,
      z: wz,
      yaw: wYaw,
      pitch: traeger.pitch || 0,
      roll: traeger.roll || 0
    };
  }

  function stelleTraegerSicher(traeger) {
    if (!traeger) return null;
    if (typeof traeger.rampeOffen !== 'boolean') {
      traeger.rampeOffen = false;
    }
    if (!Array.isArray(traeger.geladeneFahrzeuge)) {
      traeger.geladeneFahrzeuge = [];
    }
    return traeger;
  }

  EEP.transport = {
    INNENRAUM_PROFILE: INNENRAUM_PROFILE,
    TRAEGER_RAMPEN: TRAEGER_RAMPEN,

    lokalZuWelt: lokalZuWelt,

    // ------------------------------------------------------------------------
    // 1. Begehbarer Innenraum für Lara Croft
    // ------------------------------------------------------------------------
    setzeInnenraumModus: function (lara, traeger, aktiv) {
      if (!lara || !traeger) return null;
      var typ = traeger.typ || 'schiff';
      var profil = INNENRAUM_PROFILE[typ] || INNENRAUM_PROFILE.schiff;

      if (!aktiv) {
        lara.innenraum = {
          aktiv: false,
          traegerId: null,
          traegerTyp: null,
          lokalX: 0,
          lokalY: 0,
          lokalZ: 0,
          lokalYaw: 0
        };
        lara.aufTraeger = false;
        return lara.innenraum;
      }

      lara.innenraum = {
        aktiv: true,
        traegerId: traeger.id || typ,
        traegerTyp: typ,
        name: profil.name,
        lokalX: profil.startX,
        lokalY: profil.bodenY,
        lokalZ: profil.startZ,
        lokalYaw: 0.0
      };
      lara.aufTraeger = true;

      var weltPos = lokalZuWelt(traeger, lara.innenraum.lokalX, lara.innenraum.lokalY, lara.innenraum.lokalZ, lara.innenraum.lokalYaw);
      lara.x = weltPos.x;
      lara.y = weltPos.y;
      lara.z = weltPos.z;
      lara.yaw = weltPos.yaw;

      if (EEP.bus) {
        EEP.bus.emit('innenraum-modus', {
          laraId: lara.id || 'lara',
          traegerId: lara.innenraum.traegerId,
          traegerTyp: typ,
          aktiv: true
        });
      }
      return lara.innenraum;
    },

    aktualisiereInnenraum: function (lara, traeger, dt, eingabe) {
      if (!lara || !traeger || !lara.innenraum || !lara.innenraum.aktiv) return null;
      var d = Math.min(dt || 0.016, 0.1);
      var ir = lara.innenraum;
      var profil = INNENRAUM_PROFILE[ir.traegerTyp || traeger.typ || 'schiff'] || INNENRAUM_PROFILE.schiff;
      var inp = eingabe || {};

      var tempo = profil.gehTempo || 3.0;
      var vx = 0;
      var vz = 0;

      if (inp.vor) vz -= tempo;
      if (inp.zurueck) vz += tempo;
      if (inp.links) vx -= tempo * 0.75;
      if (inp.rechts) vx += tempo * 0.75;

      if (inp.drehLinks) ir.lokalYaw = normiereYaw(ir.lokalYaw + 2.2 * d);
      if (inp.drehRechts) ir.lokalYaw = normiereYaw(ir.lokalYaw - 2.2 * d);

      // Bewegung in lokaler Blickrichtung des Innenraums + strikte Kabinenwand-Kollision
      var cosL = Math.cos(ir.lokalYaw);
      var sinL = Math.sin(ir.lokalYaw);
      var dx = (vx * cosL + vz * sinL) * d;
      var dz = (-vx * sinL + vz * cosL) * d;

      ir.lokalX = clamp(ir.lokalX + dx, profil.minX, profil.maxX);
      ir.lokalZ = clamp(ir.lokalZ + dz, profil.minZ, profil.maxZ);
      ir.lokalY = profil.bodenY;

      var weltPos = lokalZuWelt(traeger, ir.lokalX, ir.lokalY, ir.lokalZ, ir.lokalYaw);
      lara.x = weltPos.x;
      lara.y = weltPos.y;
      lara.z = weltPos.z;
      lara.yaw = weltPos.yaw;
      lara.aufTraeger = true;

      return weltPos;
    },

    // ------------------------------------------------------------------------
    // 2. Rampensteuerung & Fahrzeug-Verladung (G-Klassen auf Schiff / Flugzeug)
    // ------------------------------------------------------------------------
    schalteRampe: function (traeger, offen) {
      var tr = stelleTraegerSicher(traeger);
      if (!tr) return false;
      tr.rampeOffen = typeof offen === 'boolean' ? offen : !tr.rampeOffen;
      if (EEP.bus) {
        EEP.bus.emit('transport-rampe', {
          traegerId: tr.id,
          traegerTyp: tr.typ,
          rampeOffen: tr.rampeOffen
        });
      }
      return tr.rampeOffen;
    },

    verlade: function (auto, traeger) {
      if (!auto || !traeger) return { erfolg: false, grund: 'ungueltig' };
      var tr = stelleTraegerSicher(traeger);
      var rampenCfg = TRAEGER_RAMPEN[tr.typ] || TRAEGER_RAMPEN.schiff;

      if (!tr.rampeOffen) {
        return { erfolg: false, grund: 'rampe-geschlossen' };
      }

      if (auto.verladenAuf === tr.id) {
        return { erfolg: true, grund: 'bereits-verladen', traegerId: tr.id };
      }

      if (tr.geladeneFahrzeuge.length >= rampenCfg.kapazitaet) {
        return { erfolg: false, grund: 'laderaum-voll' };
      }

      // Falls das Auto noch auf einem anderen Träger stand, dort austragen
      if (auto.verladenAuf && EEP.sim) {
        var alterTr = EEP.sim.koerper(auto.verladenAuf);
        if (alterTr && Array.isArray(alterTr.geladeneFahrzeuge)) {
          var aIdx = alterTr.geladeneFahrzeuge.indexOf(auto.id);
          if (aIdx !== -1) alterTr.geladeneFahrzeuge.splice(aIdx, 1);
        }
      }

      var slotIdx = tr.geladeneFahrzeuge.length;
      var slot = rampenCfg.stellplaetze[slotIdx] || rampenCfg.stellplaetze[0];

      tr.geladeneFahrzeuge.push(auto.id);
      auto.verladenAuf = tr.id;
      auto.aufTraeger = true;
      auto.entfernt = true; // Keine Eigen-Kollision mit dem Träger-Rumpf während der Überfahrt
      auto.v = 0;
      auto.transportSlot = {
        lokalX: slot.lokalX,
        lokalY: slot.lokalY,
        lokalZ: slot.lokalZ,
        lokalYaw: slot.lokalYaw
      };

      // Etwaigen Wasserschaden auf trockenem Deck zurücksetzen
      if (auto.schaden) {
        auto.schaden.versunken = false;
        auto.schaden.wasserImInnenraum = 0;
        auto.schaden.wasserZustand = 'trocken';
      }

      var weltPos = lokalZuWelt(tr, slot.lokalX, slot.lokalY, slot.lokalZ, slot.lokalYaw);
      auto.x = weltPos.x;
      auto.y = weltPos.y;
      auto.z = weltPos.z;
      auto.yaw = weltPos.yaw;
      auto.pitch = weltPos.pitch;
      auto.roll = weltPos.roll;

      if (EEP.bus) {
        EEP.bus.emit('fahrzeug-verladen', {
          autoId: auto.id,
          traegerId: tr.id,
          traegerTyp: tr.typ,
          stellplatz: slotIdx
        });
      }

      return { erfolg: true, traegerId: tr.id, stellplatz: slotIdx };
    },

    entlade: function (auto, zielPosOptional) {
      if (!auto || !auto.verladenAuf) return { erfolg: false, grund: 'nicht-verladen' };
      var traeger = EEP.sim ? EEP.sim.koerper(auto.verladenAuf) : null;

      if (traeger && !traeger.rampeOffen) {
        return { erfolg: false, grund: 'rampe-geschlossen' };
      }

      var trId = auto.verladenAuf;
      if (traeger && Array.isArray(traeger.geladeneFahrzeuge)) {
        var idx = traeger.geladeneFahrzeuge.indexOf(auto.id);
        if (idx !== -1) traeger.geladeneFahrzeuge.splice(idx, 1);
      }

      auto.verladenAuf = null;
      auto.aufTraeger = false;
      auto.entfernt = false;
      auto.transportSlot = null;
      auto.v = 0;

      if (zielPosOptional && typeof zielPosOptional.x === 'number') {
        auto.x = zielPosOptional.x;
        auto.y = typeof zielPosOptional.y === 'number' ? zielPosOptional.y : 0.28;
        auto.z = zielPosOptional.z;
        if (typeof zielPosOptional.yaw === 'number') auto.yaw = zielPosOptional.yaw;
      } else if (traeger) {
        var rampenCfg = TRAEGER_RAMPEN[traeger.typ] || TRAEGER_RAMPEN.schiff;
        var off = rampenCfg.entladeOffset;
        var entPos = lokalZuWelt(traeger, off.lokalX, off.lokalY, off.lokalZ, off.lokalYaw);

        // Falls das Schiff vor einer Küste liegt, suche trockenes Ufer in Rampennähe
        var bodenY = 0.28;
        if (EEP.welt && typeof EEP.welt.abfrage === 'function') {
          var abf = EEP.welt.abfrage(entPos.x, entPos.z);
          if (abf && abf.tiefe > 0.35 && traeger.typ === 'schiff') {
            // Am nächsten Hafen-Kai absetzen (Europa, Amerika oder Afrika)
            if (traeger.z > 120) {
              entPos.x = 24.0; entPos.z = 162.0; // Hafen Afrika
            } else if (traeger.x > 40) {
              entPos.x = 228.0; entPos.z = 36.0; // Hafen Amerika
            } else {
              entPos.x = -244.0; entPos.z = 46.0; // Hafen Europa
            }
            abf = EEP.welt.abfrage(entPos.x, entPos.z);
          }
          if (abf) bodenY = Math.max(0.28, abf.hoehe || 0.28);
        }

        auto.x = entPos.x;
        auto.y = bodenY;
        auto.z = entPos.z;
        auto.yaw = entPos.yaw;
      }

      auto.pitch = 0;
      auto.roll = 0;

      if (EEP.bus) {
        EEP.bus.emit('fahrzeug-entladen', {
          autoId: auto.id,
          traegerId: trId,
          x: auto.x,
          y: auto.y,
          z: auto.z
        });
      }

      return { erfolg: true, traegerId: trId, x: auto.x, y: auto.y, z: auto.z };
    },

    pruefeAuffahrt: function (auto, traeger) {
      if (!auto || !traeger || auto.verladenAuf) return false;
      var tr = stelleTraegerSicher(traeger);
      if (!tr.rampeOffen) return false;

      var cfg = TRAEGER_RAMPEN[tr.typ] || TRAEGER_RAMPEN.schiff;
      var rampenPunkt = lokalZuWelt(tr, cfg.entladeOffset.lokalX, 0, cfg.entladeOffset.lokalZ * 0.75, 0);
      var dx = (auto.x || 0) - rampenPunkt.x;
      var dz = (auto.z || 0) - rampenPunkt.z;
      var distRamp = Math.sqrt(dx * dx + dz * dz);

      var dxMitte = (auto.x || 0) - (tr.x || 0);
      var dzMitte = (auto.z || 0) - (tr.z || 0);
      var distMitte = Math.sqrt(dxMitte * dxMitte + dzMitte * dzMitte);

      if (distRamp <= 8.5 || distMitte <= cfg.auffahrtRadius) {
        var res = EEP.transport.verlade(auto, tr);
        return Boolean(res && res.erfolg);
      }
      return false;
    },

    aktualisiereVerladene: function (dt) {
      if (!EEP.sim) return 0;
      var autos = EEP.sim.alle('auto');
      var anzahl = 0;
      for (var i = 0; i < autos.length; i++) {
        var auto = autos[i];
        if (auto && auto.verladenAuf) {
          var tr = EEP.sim.koerper(auto.verladenAuf);
          if (tr) {
            var slot = auto.transportSlot || { lokalX: 0, lokalY: 0.85, lokalZ: 0, lokalYaw: 0 };
            var wp = lokalZuWelt(tr, slot.lokalX, slot.lokalY, slot.lokalZ, slot.lokalYaw);
            auto.x = wp.x;
            auto.y = wp.y;
            auto.z = wp.z;
            auto.yaw = wp.yaw;
            auto.pitch = wp.pitch;
            auto.roll = wp.roll;
            auto.v = 0;
            auto.aufTraeger = true;
            auto.entfernt = true;
            if (auto.schaden) {
              auto.schaden.versunken = false;
              auto.schaden.wasserImInnenraum = 0;
              auto.schaden.wasserZustand = 'trocken';
            }
            anzahl++;
          } else {
            auto.verladenAuf = null;
            auto.aufTraeger = false;
            auto.entfernt = false;
          }
        }
      }
      return anzahl;
    }
  };
})();
