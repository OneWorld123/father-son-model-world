# Architektur- & Projektregeln: 3D-Modelleisenbahn ("EEP-Vibe")

Dieses Projekt ist ein interaktives Vater-Sohn-Modelleisenbahn-Projekt im Browser (Three.js / A-Frame) für einen Windows-PC mit Nvidia GPU.

## 1. Architektur & Dateistruktur (Token-Sparen & Übersichtlichkeit)
- **`welt.html` (Die Modellbahn-Platte):**
  Enthält NUR die Szene (`<a-scene>`), die Schienen-Strecken (`ki-gleis`), Züge (`ki-zug` + `ki-waggon`) und die platzierten Landschaftsobjekte als lesbare Einzeiler.
  Wenn der Sohn oder Vater neue Objekte, Züge, Waggons oder Streckenänderungen wünscht, wird primär nur `welt.html` editiert!
- **`baukasten.js` (Der Modellbahn-Katalog & Engine):**
  Enthält alle `AFRAME.registerComponent`-Definitionen (Gleis- & Schwellengenerator auf Basis von `THREE.CatmullRomCurve3`, Züge, Waggons, 3D-Modell-Loader, Gebäude, Natur, Sound-Synthesizer/Audio, Kamerasteuerung und das interaktive Kinder-Steuerpult).
  Nur wenn komplett neue Objekttypen oder Features gewünscht werden, wird `baukasten.js` erweitert.
- **`models/` & `sounds/` (Optionale Assets):**
  Das System unterstützt sowohl prozedurale 3D-Modelle (sofort einsatzbereit aus Geometrien gebaut) als auch echte `.glb`/`.gltf` 3D-Modelle (über das Attribut `modell: pfad/datei.glb`) und Audio-Dateien.

## 2. Grafik & Hardware-Optimierung
- `<a-scene>` nutzt immer `renderer="antialias: true; colorManagement: true; powerPreference: high-performance; physicallyCorrectLights: true"` und `shadow="type: pcfsoft"`.
- Lichtstimmungen (Tag, Abendrot, Nacht mit leuchtenden Zugfenstern/Scheinwerfern/Laternen, Schnee/Winter) sind per Knopfdruck und Taste `[L]` umschaltbar.

## 3. Interaktivität & Kinder-Cockpit (UI)
- Ein kinderfreundliches Steuerpult am Bildschirmrand (plus Tastatur-Shortcuts) ermöglicht:
  - Geschwindigkeitsregelung (Vorwärts, Stopp, Rückwärts) pro Zugverband.
  - Kamerawahl: `[1]` Freie Übersicht / Helikopter, `[2]` Führerstand Dampflok, `[3]` ICE-Mitfahrt, `[4]` Bahnsteig-Blick.
  - Sound-Effekte: Dampflok-Pfeife, ICE-Horn, Fahrgeräusche (WebAudio Synthesizer + optional MP3).
  - Licht/Wetter-Umschalter (`[L]`).
