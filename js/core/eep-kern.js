/* ============================================================================
 * js/core/eep-kern.js – Paket 0: Entkoppelter Simulations-Kern, Event-Bus & Körper-Registry
 * WICHTIG: A-Frame-frei, DOM-frei, THREE-frei (reines JavaScript).
 * ============================================================================ */
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.kern = '1.0.0';

  // --------------------------------------------------------------------------
  // 1. Zentraler Event-Bus (EEP.bus)
  // --------------------------------------------------------------------------
  var listeners = {};

  EEP.bus = {
    on: function (name, fn) {
      if (!name || typeof fn !== 'function') return;
      if (!listeners[name]) listeners[name] = [];
      if (listeners[name].indexOf(fn) === -1) {
        listeners[name].push(fn);
      }
    },

    off: function (name, fn) {
      if (!name || !listeners[name]) return;
      if (!fn) {
        delete listeners[name];
        return;
      }
      var arr = listeners[name];
      var idx = arr.indexOf(fn);
      if (idx !== -1) arr.splice(idx, 1);
    },

    emit: function (name, daten) {
      var arr = listeners[name];
      if (!arr || arr.length === 0) return;
      var copy = arr.slice();
      for (var i = 0; i < copy.length; i++) {
        try {
          copy[i](daten);
        } catch (err) {
          console.error('EEP.bus Listener-Fehler in "' + name + '":', err);
        }
      }
    }
  };

  // --------------------------------------------------------------------------
  // 2. Körper-Registry (EEP.sim)
  // --------------------------------------------------------------------------
  var koerperMap = {};
  var nextIdNum = 1;

  function standardSchaden(typ) {
    if (EEP.schaden && typeof EEP.schaden.erzeugeStandard === 'function') {
      return EEP.schaden.erzeugeStandard(typ);
    }
    var basis = {
      zustand: 100,
      karosserie: 100,
      motor: 100,
      elektronik: 100,
      totalschaden: false,
      versunken: false,
      wasserImInnenraum: 0,
      wasserZustand: 'trocken'
    };
    if (typ === 'auto') {
      basis.reifen = { vl: 'ok', vr: 'ok', hl: 'ok', hr: 'ok' };
      basis.reifenStress = { vl: 0, vr: 0, hl: 0, hr: 0 };
    } else if (typ === 'flugzeug') {
      basis.reifen = { bug: 'ok', links: 'ok', rechts: 'ok' };
    } else if (typ === 'schiff') {
      basis.rumpf = 100;
    }
    return basis;
  }

  EEP.sim = {
    registriere: function (koerper) {
      if (!koerper) return null;
      var typ = koerper.typ || 'auto';
      var id = koerper.id || (typ + '-' + (nextIdNum++));
      koerper.id = id;
      koerper.typ = typ;
      koerper.x = typeof koerper.x === 'number' ? koerper.x : 0;
      koerper.y = typeof koerper.y === 'number' ? koerper.y : 0;
      koerper.z = typeof koerper.z === 'number' ? koerper.z : 0;
      koerper.yaw = typeof koerper.yaw === 'number' ? koerper.yaw : 0;
      koerper.pitch = typeof koerper.pitch === 'number' ? koerper.pitch : 0;
      koerper.roll = typeof koerper.roll === 'number' ? koerper.roll : 0;
      koerper.v = typeof koerper.v === 'number' ? koerper.v : 0;
      koerper.halbBreite = typeof koerper.halbBreite === 'number' ? koerper.halbBreite : 0.95;
      koerper.halbLaenge = typeof koerper.halbLaenge === 'number' ? koerper.halbLaenge : 2.35;
      koerper.hoehe = typeof koerper.hoehe === 'number' ? koerper.hoehe : 1.95;
      koerper.profil = koerper.profil || (typ === 'auto' ? 'gelaende' : typ);
      koerper.untersetzung = Boolean(koerper.untersetzung);
      if (!koerper.schaden) {
        koerper.schaden = standardSchaden(typ);
      }
      koerperMap[id] = koerper;
      if (EEP.schaden && typeof EEP.schaden.initialisiereKoerper === 'function') {
        EEP.schaden.initialisiereKoerper(koerper);
      }
      return id;
    },

    koerper: function (id) {
      return koerperMap[id] || null;
    },

    alle: function (typ) {
      var liste = [];
      for (var k in koerperMap) {
        if (Object.prototype.hasOwnProperty.call(koerperMap, k)) {
          var item = koerperMap[k];
          if (!typ || item.typ === typ) {
            liste.push(item);
          }
        }
      }
      return liste;
    },

    entferne: function (id) {
      if (koerperMap[id]) {
        delete koerperMap[id];
        return true;
      }
      return false;
    },

    leereAlle: function () {
      koerperMap = {};
      nextIdNum = 1;
    }
  };
})();
