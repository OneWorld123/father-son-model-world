/* ============================================================================
 * js/welt/alpenvorland.js – Paket K: Alpenvorland, Tauern-Tunnel & Blumenkörbchen
 * WICHTIG: Frei von Rendering-Engines und DOM-Zugriffen (reines JavaScript).
 * ============================================================================ */
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : this;
  var EEP = g.EEP = g.EEP || {};
  EEP.version = EEP.version || {};
  EEP.version.alpenvorland = '1.1.0';

  var KONTROLL_PUNKTE = [
    [-242, -53],
    [-238, -95],
    [-226, -150],
    [-248, -210],
    [-272, -262],
    [-258, -318],
    [-236, -372],
    [-240, -428],
    [-240, -470]
  ];

  function strassenHoehe(z) {
    if (z > -88) return 0.28;
    if (z < -460) return 16.0;
    return 0.28 + 15.72 * ((-88 - z) / 372);
  }

  function catmullRomCentripetal(p0, p1, p2, p3, u) {
    function knotDelta(a, b) {
      var dx = b.x - a.x;
      var dz = b.z - a.z;
      return Math.pow(Math.max(Math.sqrt(dx * dx + dz * dz), 1e-4), 0.5);
    }
    var dt0 = knotDelta(p0, p1);
    var dt1 = knotDelta(p1, p2);
    var dt2 = knotDelta(p2, p3);
    function interp(k0, k1, k2, k3) {
      var t1 = ((k1 - k0) / dt0 - (k2 - k0) / (dt0 + dt1) + (k2 - k1) / dt1) * dt1;
      var t2 = ((k2 - k1) / dt1 - (k3 - k1) / (dt1 + dt2) + (k3 - k2) / dt2) * dt1;
      var c2 = -3 * k1 + 3 * k2 - 2 * t1 - t2;
      var c3 = 2 * k1 - 2 * k2 + t1 + t2;
      return k1 + t1 * u + c2 * u * u + c3 * u * u * u;
    }
    var rx = interp(p0.x, p1.x, p2.x, p3.x);
    var rz = interp(p0.z, p1.z, p2.z, p3.z);
    return { x: rx, y: strassenHoehe(rz), z: rz };
  }

  function generiereStrassenPunkte() {
    var raw = [];
    for (var i = 0; i < KONTROLL_PUNKTE.length; i++) {
      raw.push({ x: KONTROLL_PUNKTE[i][0], z: KONTROLL_PUNKTE[i][1] });
    }
    var vorlandPunkte = [];
    var n = raw.length;
    for (var seg = 0; seg < n - 1; seg++) {
      var p1 = raw[seg];
      var p2 = raw[seg + 1];
      var p0 = seg === 0 ? { x: p1.x - (p2.x - p1.x), z: p1.z - (p2.z - p1.z) } : raw[seg - 1];
      var p3 = seg + 2 < n ? raw[seg + 2] : { x: p2.x + (p2.x - p1.x), z: p2.z + (p2.z - p1.z) };
      var segLen = Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.z - p1.z) * (p2.z - p1.z));
      var schritte = Math.max(8, Math.ceil(segLen / 2.0));
      for (var s = 0; s < schritte; s++) {
        vorlandPunkte.push(catmullRomCentripetal(p0, p1, p2, p3, s / schritte));
      }
    }
    vorlandPunkte.push({ x: raw[n - 1].x, y: strassenHoehe(raw[n - 1].z), z: raw[n - 1].z });

    var gesamtLaenge = 0;
    var maxSteig = 0;
    for (var k = 0; k < vorlandPunkte.length - 1; k++) {
      var a = vorlandPunkte[k];
      var b = vorlandPunkte[k + 1];
      var dX = b.x - a.x;
      var dZ = b.z - a.z;
      var dY = b.y - a.y;
      var dist2D = Math.sqrt(dX * dX + dZ * dZ);
      gesamtLaenge += dist2D;
      if (dist2D > 1e-4) {
        var sGrad = Math.abs(dY) / dist2D;
        if (sGrad > maxSteig) maxSteig = sGrad;
      }
    }

    var allePunkte = vorlandPunkte.slice();
    for (var tz = -472; tz >= -790; tz -= 2.0) {
      allePunkte.push({ x: -240.0, y: 16.0, z: tz });
    }

    return {
      alle: allePunkte,
      vorland: vorlandPunkte,
      laenge: gesamtLaenge,
      maxSteigung: maxSteig
    };
  }

  var strassenDaten = generiereStrassenPunkte();
  var strassenPunkte = strassenDaten.alle;
  var vorlandPunkte = strassenDaten.vorland;

  function abstandPunktSegmentQuadrat(px, pz, ax, az, bx, bz) {
    var vx = bx - ax;
    var vz = bz - az;
    var wx = px - ax;
    var wz = pz - az;
    var c1 = wx * vx + wz * vz;
    if (c1 <= 0) return wx * wx + wz * wz;
    var c2 = vx * vx + vz * vz;
    if (c2 <= c1) {
      var dx = px - bx;
      var dz = pz - bz;
      return dx * dx + dz * dz;
    }
    var b = c1 / c2;
    var ex = px - (ax + b * vx);
    var ez = pz - (az + b * vz);
    return ex * ex + ez * ez;
  }

  function abstandZurStrasse(x, z) {
    var minD2 = Infinity;
    var pts = vorlandPunkte;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i];
      var b = pts[i + 1];
      if (x < Math.min(a.x, b.x) - 30 || x > Math.max(a.x, b.x) + 30) continue;
      if (z < Math.min(a.z, b.z) - 30 || z > Math.max(a.z, b.z) + 30) continue;
      var d2 = abstandPunktSegmentQuadrat(x, z, a.x, a.z, b.x, b.z);
      if (d2 < minD2) minD2 = d2;
    }
    if (minD2 === Infinity) {
      for (var j = 0; j < pts.length - 1; j++) {
        var d2All = abstandPunktSegmentQuadrat(x, z, pts[j].x, pts[j].z, pts[j + 1].x, pts[j + 1].z);
        if (d2All < minD2) minD2 = d2All;
      }
    }
    return Math.sqrt(minD2);
  }

  function hoehe(x, z) {
    var t = Math.max(0, Math.min(1, (-88 - z) / 372));
    var grund = 0.25 + 15.75 * (t * t * (3 - 2 * t));
    var huegel = 4.0 * Math.sin(x * 0.021) * Math.sin(z * 0.017) + 2.5 * Math.sin(x * 0.047 + 1.3) * Math.cos(z * 0.039) + 1.5 * Math.sin((x + z) * 0.011);
    if (huegel < -1.0) huegel = -1.0;
    var d = abstandZurStrasse(x, z);
    var u = Math.max(0, Math.min(1, (d - 5) / 9));
    var w = u * u * (3 - 2 * u);
    return (1 - w) * strassenHoehe(z) + w * (grund + huegel);
  }

  function erstellePrng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var prng = erstellePrng(42);

  var seen = [
    { id: 'vorland-see-1', x: -330, z: -180, r: 14, tiefe: 1.8 },
    { id: 'vorland-see-2', x: -185, z: -270, r: 12, tiefe: 1.5 },
    { id: 'vorland-see-3', x: -310, z: -380, r: 15, tiefe: 2.0 }
  ];
  for (var si = 0; si < seen.length; si++) {
    seen[si].y = hoehe(seen[si].x, seen[si].z);
  }

  var huetten = [
    { id: 'almhuette-1', x: -190, z: -190, halbBreite: 4.5, halbTiefe: 3.5, hoehe: 4.0, yaw: 0.2, zaunRadius: 9.5 },
    { id: 'almhuette-2', x: -315, z: -320, halbBreite: 4.5, halbTiefe: 3.5, hoehe: 4.0, yaw: -0.3, zaunRadius: 9.5 }
  ];
  for (var hi = 0; hi < huetten.length; hi++) {
    huetten[hi].y = hoehe(huetten[hi].x, huetten[hi].z);
  }

  var baeume = [];
  var portalTannen = [
    { x: -256, z: -462, s: 1.5 },
    { x: -252, z: -458, s: 1.4 },
    { x: -258, z: -455, s: 1.55 },
    { x: -250, z: -464, s: 1.35 }
  ];
  for (var ptIdx = 0; ptIdx < portalTannen.length; ptIdx++) {
    var ptb = portalTannen[ptIdx];
    baeume.push({
      id: 'vorland-portal-tanne-' + ptIdx,
      typ: 'nadel',
      x: ptb.x,
      z: ptb.z,
      y: hoehe(ptb.x, ptb.z),
      scale: ptb.s,
      r: 0.6
    });
  }

  var versucheBaum = 0;
  while (baeume.length < 392 && versucheBaum < 3000) {
    versucheBaum++;
    var bx = -392 + prng() * (392 - 128);
    var bz = -458 + prng() * (458 - 92);
    if (abstandZurStrasse(bx, bz) < 6.5) continue;
    var inSee = false;
    for (var sIdx = 0; sIdx < seen.length; sIdx++) {
      var sn = seen[sIdx];
      var sDist = Math.sqrt((bx - sn.x) * (bx - sn.x) + (bz - sn.z) * (bz - sn.z));
      if (sDist < sn.r + 2.5) { inSee = true; break; }
    }
    if (inSee) continue;
    var inHuette = false;
    for (var hIdx = 0; hIdx < huetten.length; hIdx++) {
      var ht = huetten[hIdx];
      var hDist = Math.sqrt((bx - ht.x) * (bx - ht.x) + (bz - ht.z) * (bz - ht.z));
      if (hDist < ht.zaunRadius + 1.5) { inHuette = true; break; }
    }
    if (inHuette) continue;
    baeume.push({
      id: 'vorland-baum-' + baeume.length,
      typ: prng() > 0.45 ? 'nadel' : 'laub',
      x: bx,
      z: bz,
      y: hoehe(bx, bz),
      scale: 0.85 + prng() * 0.55,
      r: 0.6
    });
  }

  var blumen = [];
  var farbListe = ['#ef4444', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#ffffff'];
  var eingangsBlumen = [
    [-232.0, -92.8], [-231.0, -91.6], [-229.6, -93.5], [-232.2, -95.2],
    [-229.8, -96.8], [-227.4, -94.8], [-231.4, -98.8], [-228.4, -99.8],
    [-225.6, -97.8], [-230.6, -102.5], [-227.4, -103.2], [-224.2, -101.2],
    [-229.2, -106.0], [-226.0, -105.6], [-222.8, -104.0], [-228.4, -109.2],
    [-224.8, -108.8], [-221.2, -107.2], [-226.6, -112.2], [-223.2, -111.8],
    [-219.8, -110.0], [-225.2, -114.8], [-221.4, -114.2], [-218.2, -112.8]
  ];
  for (var eb = 0; eb < eingangsBlumen.length; eb++) {
    var ex = eingangsBlumen[eb][0], ez = eingangsBlumen[eb][1];
    blumen.push({
      id: 'blume-' + blumen.length,
      index: blumen.length,
      x: ex,
      z: ez,
      y: hoehe(ex, ez),
      farbe: farbListe[eb % farbListe.length],
      scale: 0.95 + (eb % 4) * 0.12,
      gepflueckt: false
    });
  }
  var versucheBlume = 0;
  while (blumen.length < 704 && versucheBlume < 4000) {
    versucheBlume++;
    var fx = -390 + prng() * (390 - 130);
    var fz = -455 + prng() * (455 - 90);
    if (abstandZurStrasse(fx, fz) < 5.5) continue;
    var seeTreffer = false;
    for (var s2 = 0; s2 < seen.length; s2++) {
      var sObj = seen[s2];
      var s2d = Math.sqrt((fx - sObj.x) * (fx - sObj.x) + (fz - sObj.z) * (fz - sObj.z));
      if (s2d < sObj.r + 1.0) { seeTreffer = true; break; }
    }
    if (seeTreffer) continue;
    blumen.push({
      id: 'blume-' + blumen.length,
      index: blumen.length,
      x: fx,
      z: fz,
      y: hoehe(fx, fz),
      farbe: farbListe[Math.floor(prng() * farbListe.length)],
      scale: 0.7 + prng() * 0.6,
      gepflueckt: false
    });
  }

  var korbStandort = {
    x: -233.5,
    y: hoehe(-233.5, -92.0),
    z: -92.0
  };

  var korbZustand = {
    aufgenommen: false,
    gesammelt: [],
    pfluecktGerade: false,
    pflueckFortschritt: 0,
    pflueckDauer: 1.35,
    pflueckPhase: 'bereit',
    aktuelleBlume: null,
    inRechterHand: false,
    zielYaw: 0,
    hinweisText: '🧺 Blumenkörbchen steht am Vorland-Eingang bereit [B].',
    naheAmStand: false,
    naechsteBlumeDist: Infinity,
    naechsteBlumeIndex: -1
  };

  function glattSchritt(a, b, x) {
    var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function nehmeKorbAuf() {
    korbZustand.aufgenommen = true;
    korbZustand.hinweisText = '🧺 Körbchen aufgenommen! Geh zu einer bunten Blume/Kristall und drücke [E].';
    if (EEP.bus && typeof EEP.bus.emit === 'function') {
      EEP.bus.emit('vorland-korb', { aktion: 'aufgenommen', anzahl: korbZustand.gesammelt.length });
    }
    return { erfolg: true, aufgenommen: true, anzahl: korbZustand.gesammelt.length };
  }

  function legeKorbAb() {
    if (korbZustand.pfluecktGerade) {
      korbZustand.pfluecktGerade = false;
      korbZustand.pflueckFortschritt = 0;
      korbZustand.pflueckPhase = 'bereit';
      korbZustand.inRechterHand = false;
      korbZustand.aktuelleBlume = null;
    }
    korbZustand.aufgenommen = false;
    korbZustand.hinweisText = '🧺 Körbchen am Vorland-Eingang abgestellt (' + korbZustand.gesammelt.length + ' im Korb).';
    if (EEP.bus && typeof EEP.bus.emit === 'function') {
      EEP.bus.emit('vorland-korb', { aktion: 'abgelegt', anzahl: korbZustand.gesammelt.length });
    }
    return { erfolg: true, aufgenommen: false, anzahl: korbZustand.gesammelt.length };
  }

  function schalteKorb() {
    return korbZustand.aufgenommen ? legeKorbAb() : nehmeKorbAuf();
  }

  function findeNaechsteBlume(x, z, maxRadius) {
    var limit = typeof maxRadius === 'number' ? maxRadius : 4.5;
    var bestDist = Infinity, bestIdx = -1;
    for (var i = 0; i < blumen.length; i++) {
      var b = blumen[i];
      if (b.gepflueckt) continue;
      var dx = b.x - x, dz = b.z - z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d <= limit && d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) return null;
    return { blume: blumen[bestIdx], index: bestIdx, dist: bestDist };
  }

  function startePfluecken(laraPos, blumenIndexOptional) {
    if (!korbZustand.aufgenommen) {
      korbZustand.hinweisText = 'Bitte zuerst das Körbchen am Eingang aufnehmen [B]!';
      return { erfolg: false, grund: 'kein-korb', hinweis: korbZustand.hinweisText };
    }
    if (korbZustand.pfluecktGerade) {
      return { erfolg: false, grund: 'bereits-aktiv', hinweis: korbZustand.hinweisText };
    }
    var lx = laraPos && typeof laraPos.x === 'number' ? laraPos.x : korbStandort.x;
    var lz = laraPos && typeof laraPos.z === 'number' ? laraPos.z : korbStandort.z;
    var zielBlume = null;
    if (typeof blumenIndexOptional === 'number' && blumen[blumenIndexOptional] && !blumen[blumenIndexOptional].gepflueckt) {
      var bOpt = blumen[blumenIndexOptional];
      var dOpt = Math.sqrt((bOpt.x - lx) * (bOpt.x - lx) + (bOpt.z - lz) * (bOpt.z - lz));
      if (dOpt <= 6.5) zielBlume = bOpt;
    }
    if (!zielBlume) {
      var treffer = findeNaechsteBlume(lx, lz, 4.5);
      if (treffer) zielBlume = treffer.blume;
    }
    if (!zielBlume) {
      korbZustand.hinweisText = 'Keine Blume in Reichweite – geh näher zu einer bunten Blume!';
      return { erfolg: false, grund: 'keine-blume', hinweis: korbZustand.hinweisText };
    }
    var dx = zielBlume.x - lx, dz = zielBlume.z - lz;
    korbZustand.pfluecktGerade = true;
    korbZustand.pflueckFortschritt = 0;
    korbZustand.pflueckPhase = 'knien';
    korbZustand.aktuelleBlume = zielBlume;
    korbZustand.inRechterHand = false;
    korbZustand.zielYaw = (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) ? Math.atan2(-dx, -dz) : 0;
    korbZustand.hinweisText = '🌸 Lara pflückt eine bunte Blume / einen Kristall...';
    if (EEP.bus && typeof EEP.bus.emit === 'function') {
      EEP.bus.emit('vorland-pfluecken-start', { index: zielBlume.index, farbe: zielBlume.farbe });
    }
    return { erfolg: true, blume: zielBlume };
  }

  function berechnePflueckPose() {
    var p = korbZustand.pfluecktGerade ? korbZustand.pflueckFortschritt : 0;
    var hocke = 0;
    if (korbZustand.pfluecktGerade) {
      if (p < 0.35) hocke = glattSchritt(0.0, 0.35, p);
      else if (p < 0.52) hocke = 1.0;
      else if (p < 0.84) hocke = 1.0 - glattSchritt(0.52, 0.84, p);
      else hocke = 0;
    }
    var greifW = korbZustand.pfluecktGerade ? (p < 0.42 ? glattSchritt(0.0, 0.38, p) : (p < 0.55 ? 1.0 : 1.0 - glattSchritt(0.55, 0.82, p))) : 0;
    var korbLegW = korbZustand.pfluecktGerade ? (p >= 0.50 && p < 0.86 ? Math.sin(glattSchritt(0.50, 0.86, p) * Math.PI) : 0) : 0;
    var zupfPuls = (korbZustand.pfluecktGerade && p >= 0.34 && p <= 0.54) ? Math.sin(((p - 0.34) / 0.20) * Math.PI * 2) : 0;
    var rumpfNeigungX = -0.52 * hocke;
    return {
      aktiv: korbZustand.pfluecktGerade,
      hatKorb: korbZustand.aufgenommen,
      phase: korbZustand.pflueckPhase,
      fortschritt: p,
      hocke: hocke,
      beckenY: 0.94 - 0.38 * hocke,
      rumpfNeigungX: rumpfNeigungX,
      rumpfDrehungY: -0.18 * greifW + 0.22 * korbLegW,
      kopfNeigungX: -0.28 * hocke - 0.22 * korbLegW,
      kopfDrehungY: -0.12 * greifW + 0.26 * korbLegW,
      huefteX_L: 0.95 * hocke,
      knieX_L: -1.42 * hocke,
      knochelX_L: 0.45 * hocke,
      huefteX_R: 0.38 * hocke,
      knieX_R: -1.55 * hocke,
      knochelX_R: 0.58 * hocke,
      armLinksSchulterX: korbZustand.aufgenommen ? (0.18 + 0.35 * hocke) : 0,
      armLinksSchulterZ: korbZustand.aufgenommen ? -0.32 : 0,
      armLinksEllbogenX: korbZustand.aufgenommen ? (0.45 - 0.10 * hocke) : 0,
      korbAusgleichX: -(rumpfNeigungX + (korbZustand.aufgenommen ? (0.63 + 0.25 * hocke) : 0)), korbAusgleichZ: korbZustand.aufgenommen ? 0.32 : 0,
      armRechtsSchulterX: 1.08 * greifW + 0.62 * korbLegW,
      armRechtsSchulterZ: -0.14 * greifW - 0.52 * korbLegW,
      armRechtsEllbogenX: 0.32 * greifW + 0.96 * korbLegW + 0.18 * zupfPuls,
      armRechtsHandX: 0.30 * zupfPuls - 0.35 * korbLegW
    };
  }

  function aktualisierePfluecken(dt, laraPos) {
    if (laraPos && typeof laraPos.x === 'number' && typeof laraPos.z === 'number') {
      var dStand = Math.sqrt((laraPos.x - korbStandort.x) * (laraPos.x - korbStandort.x) + (laraPos.z - korbStandort.z) * (laraPos.z - korbStandort.z));
      korbZustand.naheAmStand = (dStand <= 4.2);
      var nb = findeNaechsteBlume(laraPos.x, laraPos.z, 4.5);
      korbZustand.naechsteBlumeDist = nb ? nb.dist : Infinity;
      korbZustand.naechsteBlumeIndex = nb ? nb.index : -1;
    }
    if (korbZustand.pfluecktGerade) {
      var step = (typeof dt === 'number' && dt > 0) ? dt : 0.016;
      korbZustand.pflueckFortschritt = Math.min(1.0, korbZustand.pflueckFortschritt + step / korbZustand.pflueckDauer);
      var p = korbZustand.pflueckFortschritt;
      var bl = korbZustand.aktuelleBlume;

      if (p < 0.35) korbZustand.pflueckPhase = 'knien';
      else if (p < 0.55) korbZustand.pflueckPhase = 'greifen';
      else if (p < 0.84) korbZustand.pflueckPhase = 'heben';
      else korbZustand.pflueckPhase = 'einlegen';

      if (p >= 0.42 && bl && !bl.gepflueckt) {
        bl.gepflueckt = true;
        korbZustand.inRechterHand = true;
        if (EEP.bus && typeof EEP.bus.emit === 'function') {
          EEP.bus.emit('vorland-blume-gepflueckt', { index: bl.index, farbe: bl.farbe, scale: bl.scale });
        }
      }
      if (p >= 0.84 && korbZustand.inRechterHand && bl) {
        korbZustand.inRechterHand = false;
        korbZustand.gesammelt.push({
          index: bl.index,
          id: bl.id,
          farbe: bl.farbe,
          scale: bl.scale,
          x: bl.x,
          y: bl.y,
          z: bl.z
        });
        korbZustand.hinweisText = '🌸 ' + korbZustand.gesammelt.length + ' Blume(n) / Kristall(e) im Körbchen!';
        if (EEP.bus && typeof EEP.bus.emit === 'function') {
          EEP.bus.emit('vorland-blume-im-korb', {
            index: bl.index,
            farbe: bl.farbe,
            scale: bl.scale,
            gesamt: korbZustand.gesammelt.length
          });
        }
      }
      if (p >= 1.0) {
        korbZustand.pfluecktGerade = false;
        korbZustand.pflueckFortschritt = 0;
        korbZustand.pflueckPhase = 'bereit';
        korbZustand.aktuelleBlume = null;
        korbZustand.inRechterHand = false;
      }
    }
    return berechnePflueckPose();
  }

  function resetKorb() {
    for (var i = 0; i < blumen.length; i++) {
      blumen[i].gepflueckt = false;
    }
    korbZustand.aufgenommen = false;
    korbZustand.gesammelt = [];
    korbZustand.pfluecktGerade = false;
    korbZustand.pflueckFortschritt = 0;
    korbZustand.pflueckPhase = 'bereit';
    korbZustand.aktuelleBlume = null;
    korbZustand.inRechterHand = false;
    korbZustand.hinweisText = '🧺 Blumenkörbchen steht am Vorland-Eingang bereit [B].';
  }

  var hochalpenGipfel = [
    { id: 'gipfel-haupt-ost', x: -150, z: -560, hoehe: 108, radius: 52, mitFelszahn: true, segmente: 8 },
    { id: 'gipfel-2', x: -200, z: -680, hoehe: 96, radius: 48, segmente: 8 },
    { id: 'gipfel-3', x: -330, z: -540, hoehe: 88, radius: 46, segmente: 7 },
    { id: 'gipfel-4', x: -300, z: -640, hoehe: 104, radius: 50, segmente: 9 },
    { id: 'gipfel-5', x: -340, z: -740, hoehe: 92, radius: 45, segmente: 8 },
    { id: 'gipfel-6', x: -160, z: -730, hoehe: 86, radius: 44, segmente: 7 },
    { id: 'gipfel-7', x: -280, z: -490, hoehe: 68, radius: 40, segmente: 8 },
    { id: 'gipfel-8', x: -190, z: -495, hoehe: 72, radius: 42, segmente: 7 },
    { id: 'gipfel-9', x: -355, z: -610, hoehe: 78, radius: 42, segmente: 8 },
    { id: 'gipfel-10', x: -125, z: -630, hoehe: 82, radius: 40, segmente: 8 },
    { id: 'gipfel-11', x: -220, z: -780, hoehe: 90, radius: 45, segmente: 8 },
    { id: 'gipfel-12', x: -310, z: -790, hoehe: 76, radius: 38, segmente: 7 }
  ];

  var fanZentren = [-502, -566, -630, -694, -758];
  var fanPaare = [];
  for (var fzIdx = 0; fzIdx < fanZentren.length; fzIdx++) {
    var fzVal = fanZentren[fzIdx];
    fanPaare.push({
      z: fzVal,
      links: { x: -242.4, y: 20.8, z: fzVal, durchmesser: 1.2, laenge: 3.5 },
      rechts: { x: -237.6, y: 20.8, z: fzVal, durchmesser: 1.2, laenge: 3.5 }
    });
  }

  var deckenLeuchten = [];
  for (var lz = -472; lz >= -784; lz -= 6.0) {
    deckenLeuchten.push({ x: -240.0, y: 22.2, z: lz, breite: 1.8, tiefe: 0.45 });
  }

  var sosNischen = [
    { id: 'sos-1', x: -244.8, z: -550, seite: 'links' },
    { id: 'sos-2', x: -235.2, z: -650, seite: 'rechts' },
    { id: 'sos-3', x: -244.8, z: -750, seite: 'links' }
  ];

  var fluchtSchilder = [];
  for (var fsz = -495; fsz >= -765; fsz -= 50.0) {
    fluchtSchilder.push({ x: -244.75, y: 18.2, z: fsz, seite: 'links' });
    fluchtSchilder.push({ x: -235.25, y: 18.2, z: fsz, seite: 'rechts' });
  }

  var tunnel = {
    zStart: -470,
    zEnde: -790,
    xMitte: -240,
    yFahrbahn: 16.0,
    breite: 10.0,
    hoehe: 6.5,
    fanPaare: fanPaare,
    deckenLeuchten: deckenLeuchten,
    ledStreifen: {
      links: { x: -244.25, y: 17.0, zStart: -470, zEnde: -790 },
      rechts: { x: -235.75, y: 17.0, zStart: -470, zEnde: -790 }
    },
    sosNischen: sosNischen,
    fluchtSchilder: fluchtSchilder
  };

  var zustand = {
    initialisiert: false,
    uebergangGemeldet: false
  };

  function initialisiere() {
    if (zustand.initialisiert) return;

    if (EEP.welt && typeof EEP.welt.registriereZone === 'function') {
      EEP.welt.registriereZone({
        id: 'Alpenvorland',
        xMin: -400,
        xMax: -120,
        zMin: -470,
        zMax: -85,
        prioritaet: 30,
        untergrund: 'gras',
        kontinent: 'europa',
        hoeheFn: EEP.alpenvorland.hoehe
      }, true);

      EEP.welt.registriereZone({
        id: 'Alpenvorland-Strasse',
        xMin: -285,
        xMax: -215,
        zMin: -470,
        zMax: -52,
        prioritaet: 40,
        untergrund: 'strasse',
        kontinent: 'europa',
        enthaltenFn: function (x, z) {
          return EEP.alpenvorland.abstandZurStrasse(x, z) <= 4.25;
        },
        hoeheFn: function (x, z) {
          return EEP.alpenvorland.strassenHoehe(z);
        }
      }, true);

      EEP.welt.registriereZone({
        id: 'Tauern-Tunnel-Fahrbahn',
        xMin: -244.25,
        xMax: -235.75,
        zMin: -790,
        zMax: -470,
        prioritaet: 45,
        untergrund: 'strasse',
        kontinent: 'europa',
        hoehe: 16.0
      }, false);
    }

    if (EEP.kollision && typeof EEP.kollision.registriereHindernis === 'function') {
      for (var b = 0; b < baeume.length; b++) {
        var bm = baeume[b];
        EEP.kollision.registriereHindernis({
          id: bm.id,
          art: 'baum',
          form: 'kreis',
          x: bm.x,
          z: bm.z,
          radius: bm.r,
          r: bm.r,
          hoehe: 9.0 * (bm.scale || 1.0)
        });
      }

      for (var h = 0; h < huetten.length; h++) {
        var ht = huetten[h];
        EEP.kollision.registriereHindernis({
          id: ht.id,
          art: 'gebaeude',
          form: 'box',
          x: ht.x,
          z: ht.z,
          halbBreite: ht.halbBreite,
          halbTiefe: ht.halbTiefe,
          halbLaenge: ht.halbTiefe,
          hoehe: ht.hoehe,
          yaw: ht.yaw || 0
        });
      }

      EEP.kollision.registriereHindernis({
        id: 'hochalpen-massiv-west',
        art: 'gebirge',
        form: 'box',
        x: -313,
        z: -640,
        halbBreite: 67,
        halbTiefe: 170,
        halbLaenge: 170,
        hoehe: 120,
        yaw: 0
      });

      EEP.kollision.registriereHindernis({
        id: 'hochalpen-massiv-ost',
        art: 'gebirge',
        form: 'box',
        x: -167,
        z: -640,
        halbBreite: 67,
        halbTiefe: 170,
        halbLaenge: 170,
        hoehe: 120,
        yaw: 0
      });

      EEP.kollision.registriereHindernis({
        id: 'tauern-tunnel-wand-l',
        art: 'tunnel',
        form: 'box',
        x: -245.6,
        z: -630,
        halbBreite: 0.6,
        halbTiefe: 160,
        halbLaenge: 160,
        hoehe: 10,
        yaw: 0
      });

      EEP.kollision.registriereHindernis({
        id: 'tauern-tunnel-wand-r',
        art: 'tunnel',
        form: 'box',
        x: -234.4,
        z: -630,
        halbBreite: 0.6,
        halbTiefe: 160,
        halbLaenge: 160,
        hoehe: 10,
        yaw: 0
      });
    }

    zustand.initialisiert = true;
  }

  function aktualisiere(dt, spielerAutoPos, autoId) {
    if (!spielerAutoPos || typeof spielerAutoPos.z !== 'number') return;
    if (EEP.aktiveKamera === 8 && spielerAutoPos.z <= -700 && spielerAutoPos.z >= -795 && Math.abs(spielerAutoPos.x - (-240.0)) <= 5.5) {
      if (!zustand.uebergangGemeldet) {
        zustand.uebergangGemeldet = true;
        if (EEP.bus && typeof EEP.bus.emit === 'function') {
          EEP.bus.emit('tunnel-uebergang', {
            autoId: autoId || 'g-klasse',
            richtung: 'nord',
            x: spielerAutoPos.x,
            y: spielerAutoPos.y,
            z: spielerAutoPos.z
          });
        }
      }
    } else if (spielerAutoPos.z > -680) {
      zustand.uebergangGemeldet = false;
    }
  }

  EEP.alpenvorland = {
    strassenHoehe: strassenHoehe,
    strassenPunkte: strassenPunkte,
    vorlandPunkte: vorlandPunkte,
    strassenLaenge: strassenDaten.laenge,
    maxSteigung: strassenDaten.maxSteigung,
    abstandZurStrasse: abstandZurStrasse,
    hoehe: hoehe,
    seen: seen,
    huetten: huetten,
    baeume: baeume,
    blumen: blumen,
    korbStandort: korbStandort,
    korbZustand: korbZustand,
    nehmeKorbAuf: nehmeKorbAuf,
    legeKorbAb: legeKorbAb,
    schalteKorb: schalteKorb,
    findeNaechsteBlume: findeNaechsteBlume,
    startePfluecken: startePfluecken,
    aktualisierePfluecken: aktualisierePfluecken,
    berechnePflueckPose: berechnePflueckPose,
    resetKorb: resetKorb,
    hochalpenGipfel: hochalpenGipfel,
    tunnel: tunnel,
    zustand: zustand,
    initialisiere: initialisiere,
    aktualisiere: aktualisiere
  };
})();
