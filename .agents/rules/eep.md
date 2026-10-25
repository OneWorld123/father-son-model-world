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

## 5. Modulare JS-Architektur (`js/*` statt Monolith)
- **`baukasten.js` einfrieren / entlasten:** Neue Features, Physik-, Welt- und Spielsysteme werden **nicht** mehr als große Blöcke in die ~7.250 Zeilen lange `baukasten.js` geschrieben, sondern als eigenständige, kleine Module unter `js/` (`< 800` Zeilen pro Datei, gemäß `s-architecture-lod-001`) angelegt und in `welt.html` eingebunden:
  - `js/core/eep-kern.js` (`EEP.bus`, `EEP.sim`, `EEP.zustand`, `EEP.zeit`)
  - `js/core/perf-lod.js` (`EEP.perf`, `EEP.lod` – niemals `el.object3D` direkt in `THREE.LOD.addLevel` hängen, sondern Proxy nutzen!)
  - `js/core/flug-transport-ui.js` (View-/3D-Mesh- & HUD-Brücke für Paket E & Paket I; wird nach `baukasten.js` geladen und koppelt `ki-flugzeug`, `ki-faehre` und `ki-auto` per Prototyp-Wrapper an, sodass `baukasten.js` unverändert bleibt)
  - `js/welt/welt-karte.js` (`EEP.welt.abfrage`)
  - `js/welt/fahrzeug-transport.js` (`EEP.transport` – Paket I: begehbarer Fahrzeug-Innenraum für Lara Croft & G-Klassen-Verladung über Rampen auf Schiff/Frachtflugzeug)
  - `js/physik/kollision.js` (`EEP.kollision` 8m Spatial Hash)
  - `js/physik/fahrzeug-physik.js` (`EEP.fahrzeugPhysik`)
  - `js/physik/flug-physik.js` (`EEP.flugPhysik` – Paket E: Landeklappen 0/1/2/FULL, Störklappen/Spoilers, Stall/Overspeed, ILS Localizer & 3°-Gleitpfad, Autothrottle & Auto-Schubumkehr)
  - `js/physik/schaden.js` (`EEP.schaden`)
- **Reine Logik-Module DOM-/Engine-frei halten:** Reine Simulations- und Physikmodule (`eep-kern.js`, `welt-karte.js`, `kollision.js`, `fahrzeug-physik.js`, `schaden.js` usw.) dürfen keine direkten `AFRAME`-, `THREE.`- oder `document.`-Aufrufe enthalten, damit sie deterministisch und headless testbar bleiben.
- **Keine redundanten Dritt-Libraries unter `js/`:** Evaluation (10/2026) hat gezeigt, dass externe Bibliotheken wie `Yuka.js`, `SunCalc.js` oder `Tween.js` mit dem flachen Skalar-Datenmodell (`{ x, y, z, yaw, v }`), dem deterministischen `tick(dt)`-Takt und dem `< 800`-Zeilen-Check (`t-architecture-lod-001`) kollidieren. Stattdessen nutzen wir in der Simulationsschicht schlanke, allokationsfreie Skalar-Mathematik und in der View-Schicht die bereits in A-Frame 1.5.0 enthaltenen Bordmittel (`THREE.CatmullRomCurve3`, `THREE.InstancedMesh`, A-Frame `animation` / `anime.js`).
- **Kinderfreundlichkeit:** Lara Croft (`ki-lara`) und die gesamte Welt bleiben zu **100 % waffenfrei**.

## 6. Autonome Subagenten- & Token-Strategie (Budget-Schutz)
Damit der User sich nicht selbst um Modellwechsel oder Token-Sparen kümmern muss, fährt der Haupt-Agent folgende Strategie **selbstständig**:
1. **Keine direkten `.png`-Reads im Haupt-Agenten:**
   - Ein 700-KB-Screenshot im Haupt-Kontext bläht jede nachfolgende Nachricht im teuren Hauptmodell (Argon / Sonnet / Opus) dauerhaft auf.
   - Zur visuellen Qualitätskontrolle von Screenshots (`read_file` auf `.png`) startet der Haupt-Agent **immer** einen Subagenten mit `Model: "flash"` (`invoke_subagent`). Der Subagent prüft das Bild auf konkrete Kriterien (z. B. *„Sitzt das Dach bündig auf der Fassade? Sind Alpen/Rocky Mountains sichtbar? Überlappt das HUD?“*) und gibt nur eine kurze Text-Zusammenfassung zurück.
2. **Keine großen Datei-Scans (`baukasten.js`) im Haupt-Agenten:**
   - Suchanfragen oder Zeilen-Recherchen in der großen `baukasten.js` werden an einen `flash`-Subagenten delegiert, der nur den exakten 15–30-Zeilen-Ausschnitt samt Zeilennummern zurückliefert.
3. **Keine 3D-Geometrie- oder Architektur-Arbeit durch `flash`:**
   - `flash` übersieht bei 3D-Modellierung und komplexer Spiellogik räumliche Details (z. B. zu kurze Dächer über Fassaden). Deshalb schreibt und prüft der **Haupt-Agent** allen 3D-Geometrie-, Physik- und Architektur-Code selbst in den kompakten `js/*.js`-Modulen.

## 7. Selbstständige Pflege dieser Regeldatei (`.agents/rules/eep.md`)
Der Agent hält `.agents/rules/eep.md` **proaktiv und ungefragt** aktuell, sobald:
- ein neues Modul unter `js/` oder eine neue Spezifikationsdatei unter `specs/` hinzukommt,
- der User Arbeitsweise, Modell-/Subagenten-Strategie, Qualitätskriterien oder Projektregeln anpasst oder korrigiert,
- eine wichtige technische Erkenntnis / Fallstrick (wie der `THREE.LOD`-Szenengraph-Bug) gefunden wird, die künftig nie wieder passieren darf.
