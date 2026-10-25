/* ============================================================================
 * js/physik/schaden.js – Paket B: Schadensmodell, Reifenplatzer, Einsinken & Totalschaden
 * WICHTIG: A-Frame-frei, DOM-frei, THREE-frei (reines JavaScript).
 * ============================================================================ */
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.schaden = '1.0.0';

  function runde(wert) {
    return Math.round(Math.max(0, Math.min(100, wert)));
  }

  function berechneGesamtZustand(s) {
    if (s.totalschaden) return 0;
    var k = typeof s.karosserie === 'number' ? s.karosserie : (typeof s.rumpf === 'number' ? s.rumpf : 100);
    var m = typeof s.motor === 'number' ? s.motor : 100;
    var e = typeof s.elektronik === 'number' ? s.elektronik : 100;
    return runde(0.45 * k + 0.30 * m + 0.25 * e);
  }

  function erzeugeStandard(typ) {
    var s = {
      zustand: 100,
      karosserie: 100,
      motor: 100,
      elektronik: 100,
      totalschaden: false,
      versunken: false,
      wasserImInnenraum: 0,
      wasserZustand: 'trocken',
      wasserZustandVerlauf: ['trocken'],
      treibTimer: 0
    };
    if (typ === 'auto') {
      s.reifen = { vl: 'ok', vr: 'ok', hl: 'ok', hr: 'ok' };
      s.reifenStress = { vl: 0, vr: 0, hl: 0, hr: 0 };
    } else if (typ === 'flugzeug') {
      s.reifen = { bug: 'ok', links: 'ok', rechts: 'ok' };
    } else if (typ === 'schiff') {
      s.rumpf = 100;
    }
    return s;
  }

  function kopiereZustand(s) {
    if (!s) return null;
    var c = {
      zustand: s.zustand,
      karosserie: s.karosserie,
      motor: s.motor,
      elektronik: s.elektronik,
      totalschaden: Boolean(s.totalschaden),
      versunken: Boolean(s.versunken),
      wasserImInnenraum: s.wasserImInnenraum || 0,
      wasserZustand: s.wasserZustand || 'trocken',
      wasserZustandVerlauf: (s.wasserZustandVerlauf || ['trocken']).slice()
    };
    if (typeof s.rumpf === 'number') c.rumpf = s.rumpf;
    if (s.reifen) {
      c.reifen = {};
      for (var k in s.reifen) {
        if (Object.prototype.hasOwnProperty.call(s.reifen, k)) c.reifen[k] = s.reifen[k];
      }
    }
    return c;
  }

  function setzeWasserZustand(s, neu) {
    if (s.wasserZustand === neu) return;
    s.wasserZustand = neu;
    if (!s.wasserZustandVerlauf) s.wasserZustandVerlauf = [];
    if (s.wasserZustandVerlauf[s.wasserZustandVerlauf.length - 1] !== neu) {
      s.wasserZustandVerlauf.push(neu);
    }
  }

  // --------------------------------------------------------------------------
  // 1. Aufprallschaden nach d-damage-sinking-001
  // --------------------------------------------------------------------------
  function wendeAufprallAn(koerper, ereignis) {
    var s = koerper.schaden;
    if (!s || s.totalschaden) return;

    var vImp = Math.max(0, Number(ereignis.vImpact || 0));
    var vorne = Boolean(ereignis.vorneTreffer);
    var typ = koerper.typ || 'auto';

    // Schiffs-Grenzen sind um Faktor 0.5 skaliert -> wir skalieren vImp intern um *2 auf die Auto-Skala
    var vSkaliert = typ === 'schiff' ? (vImp * 2.0) : vImp;

    // Flugzeug-Harte-Landung mit Sinkrate (d-damage-sinking-001)
    if (typ === 'flugzeug' && typeof ereignis.sinkrate === 'number') {
      var sr = Math.abs(ereignis.sinkrate);
      if (sr < 3.0 && !ereignis.naseUntenCrash) return;
      if (sr > 8.0 || ereignis.naseUntenCrash) {
        vSkaliert = 25.0; // Totalschaden
      } else {
        vSkaliert = 8.0 + sr;
      }
    }

    // Rempler < 2.0 m/s -> kein Schaden
    if (vSkaliert < 2.0) return;

    var karosserieVerlust = 0;
    if (vSkaliert >= 19.4) {
      // Extrem -> Totalschaden ("Blechknäuel")
      s.totalschaden = true;
      s.karosserie = 0;
      if (typ === 'schiff') s.rumpf = 0;
      s.motor = 0;
      s.elektronik = 0;
      s.zustand = 0;
      koerper.v = 0;
      return;
    } else if (vSkaliert < 8.0) {
      // Leicht: 2.0 - 8.0 m/s -> (vImpact - 2.0) * 2.5 (max 15)
      karosserieVerlust = (vSkaliert - 2.0) * 2.5;
    } else {
      // Schwer: 8.0 - 19.4 m/s -> 15 + (vImpact - 8.0) * 5.0 (max 72)
      karosserieVerlust = 15 + (vSkaliert - 8.0) * 5.0;
    }

    var motorVerlust = karosserieVerlust * (vorne ? 0.60 : 0.10);
    var elektronikVerlust = karosserieVerlust * 0.30;

    s.karosserie = Math.max(0, runde(s.karosserie - karosserieVerlust));
    if (typ === 'schiff') s.rumpf = s.karosserie;
    s.motor = Math.max(0, runde(s.motor - motorVerlust));
    s.elektronik = Math.max(0, runde(s.elektronik - elektronikVerlust));
    s.zustand = berechneGesamtZustand(s);

    if (s.zustand <= 0 || s.karosserie <= 0) {
      s.totalschaden = true;
      s.karosserie = 0;
      if (typ === 'schiff') s.rumpf = 0;
      s.motor = 0;
      s.elektronik = 0;
      s.zustand = 0;
      koerper.v = 0;
    }
  }

  // --------------------------------------------------------------------------
  // 2. Öffentliche API (EEP.schaden)
  // --------------------------------------------------------------------------
  EEP.schaden = {
    erzeugeStandard: erzeugeStandard,

    initialisiereKoerper: function (koerper) {
      if (!koerper) return;
      if (!koerper.schaden) {
        koerper.schaden = erzeugeStandard(koerper.typ || 'auto');
      }
    },

    von: function (koerperId) {
      var k = EEP.sim ? EEP.sim.koerper(koerperId) : null;
      if (!k || !k.schaden) return null;
      return kopiereZustand(k.schaden);
    },

    reparierbar: function (koerperId) {
      var k = EEP.sim ? EEP.sim.koerper(koerperId) : null;
      if (!k || !k.schaden) return false;
      return !k.schaden.totalschaden;
    },

    anwenden: function (koerperId, ereignis) {
      var k = EEP.sim ? EEP.sim.koerper(koerperId) : null;
      if (!k || !ereignis) return null;
      if (!k.schaden) k.schaden = erzeugeStandard(k.typ || 'auto');
      var s = k.schaden;

      // Irreparabler Totalschaden darf niemals zurückgesetzt werden (s-damage-sinking-003)
      if (s.totalschaden && ereignis.art === 'reparatur') {
        return kopiereZustand(s);
      }

      var vorher = kopiereZustand(s);

      if (ereignis.art === 'aufprall' || typeof ereignis.vImpact === 'number') {
        wendeAufprallAn(k, ereignis);
      } else if (ereignis.art === 'reifenplatzer' && s.reifen && ereignis.rad) {
        s.reifen[ereignis.rad] = 'platt';
      } else if (ereignis.art === 'wasserschaden') {
        s.motor = 0;
        s.elektronik = typeof ereignis.elektronik === 'number' ? runde(ereignis.elektronik) : 0;
        s.zustand = berechneGesamtZustand(s);
      } else if (ereignis.art === 'reparatur' && !s.totalschaden) {
        s.karosserie = 100;
        if (typeof s.rumpf === 'number') s.rumpf = 100;
        s.motor = 100;
        s.elektronik = 100;
        s.versunken = false;
        s.wasserImInnenraum = 0;
        setzeWasserZustand(s, 'trocken');
        if (s.reifen) {
          for (var r in s.reifen) {
            if (Object.prototype.hasOwnProperty.call(s.reifen, r)) s.reifen[r] = 'ok';
          }
        }
        s.zustand = 100;
      }

      var nachher = kopiereZustand(s);
      if (EEP.bus) {
        EEP.bus.emit('schaden', {
          koerperId: k.id,
          vorher: vorher,
          nachher: nachher,
          ursache: ereignis.art || 'aufprall',
          ereignis: ereignis
        });
      }
      return nachher;
    },

    testReset: function (koerperId) {
      var k = EEP.sim ? EEP.sim.koerper(koerperId) : null;
      if (!k) return null;
      k.schaden = erzeugeStandard(k.typ || 'auto');
      return kopiereZustand(k.schaden);
    },

    zaehlePlatteReifen: function (koerper) {
      if (!koerper || !koerper.schaden || !koerper.schaden.reifen) return 0;
      var r = koerper.schaden.reifen;
      var n = 0;
      for (var k in r) {
        if (Object.prototype.hasOwnProperty.call(r, k) && r[k] === 'platt') n++;
      }
      return n;
    },

    effektivesVMax: function (koerper, vMaxNormal) {
      if (!koerper || !koerper.schaden) return vMaxNormal;
      var s = koerper.schaden;
      if (s.totalschaden || s.versunken || s.motor <= 0) return 0;

      // Reduzierte Höchstgeschwindigkeit bei Schaden: vMaxNormal * (0.4 + 0.6 * zustand / 100)
      var vMax = vMaxNormal;
      if (s.zustand < 100) {
        vMax = vMaxNormal * (0.4 + 0.6 * (s.zustand / 100));
      }

      // Reifenplatzer-Tempolimit (1 Platten -> 60 km/h = 16.7 m/s; >=2 Platte -> 30 km/h = 8.3 m/s)
      var platte = EEP.schaden.zaehlePlatteReifen(koerper);
      if (platte >= 2) {
        vMax = Math.min(vMax, 8.3);
      } else if (platte === 1) {
        vMax = Math.min(vMax, 16.7);
      }
      return vMax;
    },

    berechneReifenGierRate: function (koerper) {
      if (!koerper || !koerper.schaden || !koerper.schaden.reifen) return 0;
      var r = koerper.schaden.reifen;
      var linksPlatt = (r.vl === 'platt' ? 1 : 0) + (r.hl === 'platt' ? 1 : 0);
      var rechtsPlatt = (r.vr === 'platt' ? 1 : 0) + (r.hr === 'platt' ? 1 : 0);
      var diff = linksPlatt - rechtsPlatt; // positiv = zieht nach links (+yaw), negativ = zieht nach rechts (-yaw)
      if (diff === 0) return 0;
      var v = koerper.v || 0;
      return diff * 0.12 * (v / 10.0);
    },

    pruefeReifenUntergrund: function (koerper, raeder, deltaSec) {
      if (!koerper || !koerper.schaden || !koerper.schaden.reifen || !EEP.welt) return;
      var s = koerper.schaden;
      if (!s.reifenStress) s.reifenStress = { vl: 0, vr: 0, hl: 0, hr: 0 };
      var vAbs = Math.abs(koerper.v || 0);
      var radNamen = ['vl', 'vr', 'hl', 'hr'];

      for (var i = 0; i < radNamen.length; i++) {
        var rn = radNamen[i];
        if (s.reifen[rn] === 'platt') continue;
        var rp = raeder[rn];
        if (!rp) continue;
        var abf = EEP.welt.abfrage(rp.x, rp.z);

        // 1. Bordstein > 8.3 m/s (30 km/h) -> sofortiger Reifenplatzer
        if (abf.untergrund === 'bordstein' && vAbs > 8.3) {
          EEP.schaden.anwenden(koerper.id, { art: 'reifenplatzer', rad: rn, grund: 'bordstein', v: vAbs });
          continue;
        }

        // 2. Spitzer Fels > 11.1 m/s (40 km/h) -> Stress aufsummieren bis >= 3.0
        if (abf.untergrund === 'fels' && abf.spitz && vAbs > 11.1) {
          s.reifenStress[rn] = (s.reifenStress[rn] || 0) + (vAbs - 11.1) * deltaSec;
          if (s.reifenStress[rn] >= 3.0) {
            EEP.schaden.anwenden(koerper.id, { art: 'reifenplatzer', rad: rn, grund: 'fels', v: vAbs });
          }
        } else {
          s.reifenStress[rn] = Math.max(0, (s.reifenStress[rn] || 0) - 0.5 * deltaSec);
        }
      }
    },

    tickWasser: function (koerper, deltaSec, abfOptional, wattMaxOptional) {
      if (!koerper || !koerper.schaden) return;
      if (koerper.verladenAuf || koerper.aufTraeger) return;
      var s = koerper.schaden;
      var abf = abfOptional || (EEP.welt ? EEP.welt.abfrage(koerper.x, koerper.z) : { tiefe: 0, hoehe: 0.25 });
      var wattMax = typeof wattMaxOptional === 'number' ? wattMaxOptional : (koerper.profil === 'strassenpkw' ? 0.30 : 0.70);

      if (abf.tiefe <= 0.05) {
        if (!s.versunken) {
          setzeWasserZustand(s, 'trocken');
          s.treibTimer = 0;
        }
        return;
      }

      if (abf.tiefe <= wattMax && koerper.typ === 'auto') {
        if (!s.versunken) {
          setzeWasserZustand(s, 'watend');
          s.treibTimer = 0;
        }
        return;
      }

      // Tiefer als Watttiefe (bzw. Flugzeug im Wasser): treibend -> sinkend -> versunken
      var treibDauerMax = koerper.typ === 'flugzeug' ? 20.0 : 1.5;
      var sinkRate = koerper.typ === 'flugzeug' ? 0.25 : (koerper.typ === 'schiff' ? 0.15 : 0.35);

      if (s.wasserZustand === 'trocken' || s.wasserZustand === 'watend') {
        setzeWasserZustand(s, 'treibend');
        s.treibTimer = 0;
      }

      // Motor fällt sofort auf 0 (Wasserschlag), Elektronik innerhalb von 2.0 s linear auf 0
      var motorVorher = s.motor;
      var elekVorher = s.elektronik;
      s.motor = 0;
      s.elektronik = Math.max(0, s.elektronik - (100 / 2.0) * deltaSec);
      s.zustand = berechneGesamtZustand(s);
      koerper.v = 0;

      if (s.wasserZustand === 'treibend') {
        s.treibTimer = (s.treibTimer || 0) + deltaSec;
        if (koerper.typ === 'auto') {
          koerper.pitch = (-15 * Math.PI) / 180; // 15° nach vorne geneigt
        }
        if (s.treibTimer >= treibDauerMax) {
          setzeWasserZustand(s, 'sinkend');
        }
      }

      if (s.wasserZustand === 'sinkend') {
        var grundY = abf.hoehe;
        koerper.y = (typeof koerper.y === 'number' ? koerper.y : 0.05) - sinkRate * deltaSec;
        s.wasserImInnenraum = Math.min(100, (s.wasserImInnenraum || 0) + 35 * deltaSec);
        if (koerper.y <= grundY || (koerper.typ === 'flugzeug' && s.wasserImInnenraum >= 100 && koerper.y <= -2.0)) {
          koerper.y = Math.max(grundY, koerper.y);
          s.versunken = true;
          s.elektronik = 0;
          s.zustand = berechneGesamtZustand(s);
          setzeWasserZustand(s, 'versunken');
          if (EEP.bus) {
            EEP.bus.emit('schaden', {
              koerperId: koerper.id,
              vorher: { versunken: false },
              nachher: kopiereZustand(s),
              ursache: 'versunken'
            });
          }
        }
      } else if ((motorVorher > 0 || elekVorher > 0) && s.elektronik === 0 && EEP.bus) {
        EEP.bus.emit('schaden', {
          koerperId: koerper.id,
          vorher: { motor: motorVorher, elektronik: elekVorher },
          nachher: kopiereZustand(s),
          ursache: 'wasserschaden'
        });
      }
    }
  };

  // Automatisch auf 'aufprall'-Events vom Kollisionssystem hören
  if (EEP.bus) {
    EEP.bus.on('aufprall', function (ev) {
      if (ev && ev.koerperId) {
        EEP.schaden.anwenden(ev.koerperId, {
          art: 'aufprall',
          vImpact: ev.vImpact,
          vorneTreffer: ev.vorneTreffer,
          hindernisId: ev.hindernisId
        });
      }
    });
  }
})();
