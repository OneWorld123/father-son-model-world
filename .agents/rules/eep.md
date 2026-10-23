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

## 4. Produktwissen: Specs, Decisions und Testfälle (`specs/*.yaml`)
Ab dem 24.10.2026 gilt für alle neuen oder geänderten Anforderungen, Architekturentscheidungen und Fehlerbehebungen das strukturierte Vorgehen nach `2026-10-24-development-lead-specs-decisions-tests.md`:

1. **Ablageort & Zuschnitt (`specs/<area>.yaml` & `specs/global.yaml`):**
   - Bereichsdateien liegen versioniert im Repository unter `specs/` (englische Dateinamen in Kleinbuchstaben mit Bindestrich, z. B. `specs/car-cockpit.yaml`, `specs/world-rendering.yaml`, `specs/global.yaml`).
   - **Keine historische Nachdokumentation:** Bestehende Features werden nicht pauschal rückwirkend inventarisiert, sondern erst dann aufgenommen, wenn sie im Rahmen einer beauftragten Änderung oder Fehlerbehebung konkret bearbeitet werden.
2. **Stabile IDs (`<type>-<area>-<number>`, mind. dreistellig):**
   - `s-<area>-001` (Spec: `id`, `title`, `given`, `when`, `then`, optional `why`, `sources`)
   - `d-<area>-001` (Decision: `id`, `title`, `status` [`proposed` | `accepted` | `superseded`], `decision`, `why`, optional `how`, `specs`, `sources`, `superseded_by`)
   - `t-<area>-001` (Testfall: `id`, `title`, `specs`, `suites` [`smoke` | `regression`], `areas`, `risk` [`low` | `medium` | `high`], `requires`, `preconditions`, `steps` [`action` + `expected`], `cleanup`, optional `automation` [`path` + `selector`])
3. **Vorgehen bei Änderungen & Bugs:**
   - **Vor/Mit der Umsetzung:** Betroffene `specs`, `decisions` und `tests` in der jeweiligen `specs/<area>.yaml` anlegen oder aktualisieren.
   - **Bei Bugs:** Zuerst prüfen, ob eine bestehende Spec verletzt ist, die Spec unvollständig war oder ein Regressionstest (`t-...`) ergänzt werden muss. Niemals Specs abschwächen, um fehlerhaften Code zu rechtfertigen.
   - **Prüfnachweise getrennt halten:** Keine Laufzeit-Ergebnisse (`passed: true` oder Zeitstempel) in `specs/*.yaml` schreiben. Prüfnachweise werden nach der Ausführung separat mit Test-ID, Commit-Stand, Umgebung/GPU, Laufzeit, Ergebnis (`bestanden` / `fehlgeschlagen` / `blockiert`) und Beobachtungen/Screenshot-Artefakten berichtet.
