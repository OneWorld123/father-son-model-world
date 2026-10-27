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

## 4. Produktwissen: Specs, Decisions und Testfälle (specs/*.yaml)
Maßgebliche Referenz im Repository ist **[docs/specs-decisions-tests.md](file:///m:/Develop/Trains/docs/specs-decisions-tests.md)** (Stand 27.10.2026). Für alle neuen oder geänderten Anforderungen, Architekturentscheidungen und Fehlerbehebungen gelten verbindlich folgende Schreib- und Reviewregeln:

1. **Ablageort & Zuschnitt (specs/<area>.yaml & specs/global.yaml):**
   - Bereichsdateien liegen versioniert unter specs/ (englische Dateinamen in Kleinbuchstaben mit Bindestrich; rea entspricht exakt dem Dateistamm). Übergreifende Abläufe liegen in specs/global.yaml (niemals cross-cutting.yaml).
   - **Keine historische Nachdokumentation:** Bestehende oder unbearbeitete Dateien werden nicht pauschal rückwirkend inventarisiert oder umgeschrieben, sondern erst dann nachgeschärft, wenn ihr Bereich im Rahmen einer beauftragten Änderung oder Fehlerbehebung konkret bearbeitet wird.
   - **Keine einmaligen Bau-/Integrationsanweisungen in YAML:** Hinweise wie *„Neue Dateien: …“*, *„Nach Script X in welt.html einbinden“* oder *„Suche nach clamp in baukasten.js“* gehören in den Arbeitsplan, **niemals** als Kommentar, Spec oder Decision in specs/*.yaml.
2. **Stabile IDs (<type>-<area>-<number>, mind. dreistellig):**
   - s-<area>-001, d-<area>-001, 	-<area>-001. Bestehende IDs dürfen **niemals** neu vergeben oder nachträglich umnummeriert werden.
3. **Schreibregeln für specs (Dauerhaftes Produktversprechen statt Projektgeschichte):**
   - **Ein Verhalten pro Spec:** Eine Spec beschreibt genau **ein** zusammengehöriges fachliches Verhalten (nicht ein ganzes Arbeitspaket). Eintritt, Austritt/Fade-Out, Wiedereintritt/Resume, Fehler-/Fallbackfälle werden als getrennte s-...-Einträge formuliert.
   - **given (Herstellbare Ausgangslage):** Nur fachliche Zustände, die unmittelbar vor dem Auslöser gemeinsam gelten und im fertigen Produkt herstellbar sind. **Verboten in given:** Projektgeschichte (*„Nördlich von Europa ist bisher Ozean“*, *„Paket K stellt bereit…“*), Dateinamen oder Implementierungsaufträge.
   - **when (Einzelner realer Auslöser):** Genau **eine** Benutzeraktion oder ein fachliches Ereignis (nicht mehrere Oder-Auslöser in einem Satz, kein *„Der Entwickler baut…“*).
   - **	hen (Von außen beobachtbares Ergebnis & Portierungsfrage):** Was können Anwender oder angebundene Systeme beobachten/messen? **Verboten in 	hen:** Interne Klassen, Three.js-/A-Frame-Geometrien (PlaneGeometry, InstancedMesh, ConeGeometry, DoubleSide), Modul-/Dateinamen oder unbestimmte Aussagen (*„funktioniert schnell“*). *Portierungsfrage:* Das fachliche Versprechen in 	hen muss auch bei einer Neuimplementierung mit anderer Engine/Sprache unverändert gelten!
4. **Schreibregeln für decisions (Dauerhafte technische/gestalterische Wahl):**
   - Technische Mittel, Formeln, Datenstrukturen, Mesh-/LOD-Strategien und Event-Verträge gehören in decisions (decision, why, how) mit Verweis auf specs: [...].
   - Bei Ablösung einer Entscheidung bleibt die alte erhalten (status: superseded, superseded_by: d-...).
5. **Schreibregeln für 	ests (Konkreter, reproduzierbarer Prüfablauf):**
   - Jeder Testfall beschreibt konkrete preconditions, geordnete steps (ction + Liste beobachtbarer expected) und cleanup.
   - **Keine bloßen internen Flag-Kopien:** In expected darf nicht lediglich stehen *„TEST_RESULT meldet ...Ok=true“*, sondern es müssen die konkret geprüften Daten, Aktionen und beobachteten Ergebnisse benannt werden.
   - **Gezielte Testauswahl statt Sammel-Smoke-Test:** Unabhängige Prüfziele werden als getrennte 	-...-Einträge geführt; umfangreiche Sammelprüfungen dürfen nicht pauschal als smoke deklariert werden.
   - **Prüfnachweise getrennt halten:** Keine Laufzeit-Ergebnisse (passed: true oder Zeitstempel) in specs/*.yaml schreiben.
6. **Verbindlicher 8-Punkte-Selbstreview vor jedem Commit einer YAML-Datei (Abschnitt 11 aus docs/specs-decisions-tests.md):**
   1. Beschreibt jede Spec dauerhaftes Produktverhalten statt Projektgeschichte oder Bauauftrag?
   2. Sind alle given-Bedingungen gemeinsam herstellbar und nennt when genau einen realen Auslöser?
   3. Sind alle 	hen-Ergebnisse von außen beobachtbar (keine Mesh-/Klassennamen) und sind UI-Texte/Grenzwerte konkret?
   4. Liegen Implementierungsdetails in decisions und einmalige Umbauanweisungen im Plan (Portierungsfrage bestanden)?
   5. Sind relevante Leer-, Fehler-, Abbruch- und Rückkehrfälle (z. B. Verlassen & Wiedereintritt) als eigene Szenarien berücksichtigt?
   6. Erklärt jede Decision die Wahl (decision) und ihren Grund (why)?
   7. Prüfen die Testschritte die behaupteten Ergebnisse konkret, statt nur ...Ok=true-Flags aufzulisten?
   8. Sind unabhängige Prüfziele sauber in eigene 	-...-Einträge getrennt (smoke vs. egression)?
## 5. Modulare JS-Architektur (`js/*` statt Monolith)
- **`baukasten.js` einfrieren / entlasten:** Neue Features, Physik-, Welt- und Spielsysteme werden **nicht** mehr als große Blöcke in die ~7.250 Zeilen lange `baukasten.js` geschrieben, sondern als eigenständige, kleine Module unter `js/` (`< 800` Zeilen pro Datei, gemäß `s-architecture-lod-001`) angelegt und in `welt.html` eingebunden:
  - `js/core/eep-kern.js` (`EEP.bus`, `EEP.sim`, `EEP.zustand`, `EEP.zeit`)
  - `js/core/perf-lod.js` (`EEP.perf`, `EEP.lod` – niemals `el.object3D` direkt in `THREE.LOD.addLevel` hängen, sondern Proxy nutzen!)
  - `js/core/flug-transport-ui.js` (View-/3D-Mesh- & HUD-Brücke für Paket E & Paket I; wird nach `baukasten.js` geladen und koppelt `ki-flugzeug`, `ki-faehre` und `ki-auto` per Prototyp-Wrapper an, sodass `baukasten.js` unverändert bleibt)
  - `js/core/pyramiden-ui.js` (3D-High-Poly-Schatzkammer, versteckter Skarabäus-Schalter, Steintor, Laras 3D-Fackel mit `THREE.PointLight` sowie YouTube-Audio-Integration `Lgqv6LGtCvA` mit Fade-In/Out & Resume)
  - `js/core/alpenvorland-ui.js` (Paket K: 3D-Alpenvorland-Hügellandschaft, 8,5m-Zweispurenstraße, Hochalpen-Massiv & befahrbarer Tauern-Autobahntunnel mit Deckenleuchten, durchgehenden Seiten-LED-Streifen und rotierenden X-Belüftungsturbinen)
  - `js/core/schneewelt-ui.js` (Paket L: Magische Schneewelt hinter dem Tauern-Tunnel mit Blackscreen-Level-Transition, YouTube-Musik `5w3rRFWzjcM` mit Fade-Out/Resume, dynamischem Winterwetter, 3D-Schneefall-/Wind-Partikeln und Hochtal-Erlebnisstraße)
  - `js/welt/welt-karte.js` (`EEP.welt.abfrage`, unterstützt kontinuierliche `zone.hoeheFn(x, z)`-Höhenfunktionen)
  - `js/welt/fahrzeug-transport.js` (`EEP.transport` – Paket I: begehbarer Fahrzeug-Innenraum für Lara Croft & G-Klassen-Verladung über Rampen auf Schiff/Frachtflugzeug)
  - `js/welt/pyramiden-kammer.js` (`EEP.pyramide` – Tomb-Raider-Pyramidenwelt: Hohlraum-Kollisionen, Geheimknopf, Tor-Steuerung, Feuerschalen & Musik-Fade/Resume-Zustand)
  - `js/welt/alpenvorland.js` (`EEP.alpenvorland` – Paket K: Domänenlogik für Alpenvorland-Topographie, Straßenpfad, Hochalpen & Tauern-Tunnel-Geometrie/Kollisionen)
  - `js/welt/schneewelt.js` (`EEP.schneewelt` – Paket L: Domänenlogik für Schneetal-Topographie, Talkessel-Kollisionen, Tunnel-Schwarzblende, Winter-Wetterzustände & Musik-Fade/Resume)
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

## 7. Git-Workflow & Selbstständige Pflege dieser Regeldatei (`.agents/rules/eep.md`)
- **Immer sofort auf Remote pushen:** Nach **jedem** `git commit` (oder Merge) wird unmittelbar ein `git push` auf das Remote-Repository (`origin`) ausgeführt.
- Der Agent hält `.agents/rules/eep.md` **proaktiv und ungefragt** aktuell, sobald:
- ein neues Modul unter `js/` oder eine neue Spezifikationsdatei unter `specs/` hinzukommt,
- der User Arbeitsweise, Modell-/Subagenten-Strategie, Qualitätskriterien oder Projektregeln anpasst oder korrigiert,
- eine wichtige technische Erkenntnis / Fallstrick (wie der `THREE.LOD`-Szenengraph-Bug) gefunden wird, die künftig nie wieder passieren darf.
