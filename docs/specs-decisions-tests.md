# Anweisung an die Entwicklungsleitung: Specs, Decisions und Testfälle

Stand: 27.10.2026 · Auftraggeber: MM · Erstellt durch MCP - Berater

Überarbeitung vom 27.10.2026: Schreibregeln, Gegenbeispiele und semantische Reviewfragen anhand der Flutter-Anleitung präzisiert. Diese Regeln richten sich an alle Autoren und Reviewer, unabhängig von Werkzeug, Modell oder Umgebung (unter anderem Antigravity, Codex und Claude Code).

Ablage am 27.10.2026 in das Berater-Repository übernommen. Status: Übergabeentwurf, noch nicht als neue Arbeitsanweisung versandt. Die anschließende Diskussion einer Paketordnerstruktur ist in [working-state.md](../docs/working-state.md) vermerkt und hier noch nicht als verbindlicher Prozess ergänzt.

## 1. Auftrag und Geltung

Bitte die nachfolgenden Vereinbarungen für den MailCollector-Piloten in den dauerhaften Entwicklungsprozess übernehmen, über die einschlägigen `AGENTS.md` auffindbar machen und den beteiligten Fachchats sowie unabhängigen Reviewern vermitteln. Die Arbeitsanweisung soll in GitLab versioniert zugänglich sein; ein lokaler Link allein genügt für andere Entwicklungsumgebungen nicht.

Dieses Dokument konkretisiert die mit MM vereinbarte Organisation des Produktwissens. Die Felddefinitionen und Beispiele unten beschreiben das dafür vorgesehene Ausgangsformat. Die Beispiele sind keine freigegebenen MailCollector-Anforderungen und kein Auftrag zur Implementierung ihrer Funktionen. Anpassungsbedarf am Format bitte begründet melden, statt stillschweigend mehrere Varianten einzuführen.

Der bestehende [Entwicklungs- und Übergabeprozess](D:/Codex/MCPs/mcp-management/docs/DEVELOPMENT-PILOT.md) bleibt maßgeblich für Freigaben, unabhängige Reviews, Abnahme, QMA und Betriebsübernahme. Dieses Dokument erweitert weder Produktfreigaben noch Zugriffsrechte oder Betriebsbefugnisse.

**Keine historische Nachdokumentation vorerst.** Wir beginnen mit künftig freigegebenen Änderungen. Für deren Verständnis und Prüfung benötigte bestehende Regeln dürfen gezielt aufgenommen werden; daraus entsteht kein Auftrag, den gesamten Bestand rückwirkend zu spezifizieren, frühere Entscheidungen zu rekonstruieren oder alle vorhandenen Tests zu katalogisieren. Fehlende historische Abdeckung bleibt als solche erkennbar.

## 2. Ziel und führende Quellen

Die Sammlung soll langfristig für Menschen und KI verständlich, durchsuchbar und pflegbar sein. Sie soll fachliches Wissen auch bei Personalwechsel, neuen Chats und einer späteren Neuimplementierung erhalten.

| Inhalt | Aufgabe |
| --- | --- |
| Spec | Beschreibt das beabsichtigte, überprüfbare Verhalten. |
| Decision | Dokumentiert eine bewusste Entscheidung, ihre Begründung und gegebenenfalls Umsetzungshinweise. |
| Testfall | Beschreibt einen konkreten reproduzierbaren Prüfablauf und die erwarteten Ergebnisse. |
| GitLab-Wiki | Bietet verständlichen Überblick, Bedienhinweise, Orientierung und Links zu den maßgeblichen Quellen. |
| GitLab-Issue | Beauftragt und verfolgt eine Änderung; verweist auf betroffene Einträge. |
| Testcode | Implementiert die automatisierte Ausführung eines oder mehrerer Testfälle. |
| Prüfnachweis | Dokumentiert, was an welchem Stand tatsächlich ausgeführt und beobachtet wurde. |

Die Bereichs-YAMLs liegen im Produktrepository und werden zusammen mit Codeänderungen über GitLab versioniert. Sie sind die führende Quelle für das darin bereits erfasste Verhalten, Entscheidungen und Testfalldefinitionen. Issues, Wiki und Pläne verlinken diese Einträge, statt unabhängig gepflegte Kopien anzulegen. Die noch unvollständige Sammlung ersetzt keine nicht erfassten Anforderungen und keine übergeordneten QMA- oder Schutzvorgaben.

**Abgleich mit bestehendem Prozess:** Die aktuelle Pilotbeschreibung nennt noch das Projektwiki als Ort dauerhafter Regeln/Specs. Bei Übernahme dieser Vereinbarung ist das für produktbezogene Specs/Decisions/Testfälle auf die versionierten Bereichsdateien zu präzisieren. Übergeordnete Prozessregeln können in der bestehenden Prozessdokumentation bleiben. Keine zweite konkurrierende Spec-Sammlung im Wiki beginnen und vorhandene Inhalte nicht pauschal migrieren.

### 2.1 Das Wiki bleibt der verständliche Einstieg

Das GitLab-Wiki wird mit begrenzter Aufgabe weitergeführt. Es erklärt das Produkt, seine Bedienung und die Orientierung im Projekt. Es verweist direkt auf maßgebliche Bereichsdateien, Prozessregeln und relevante Vorgänge. Neue produktbezogene Specs, Decisions und Testfalldefinitionen werden ausschließlich im Repository gepflegt.

Die Aufteilung lautet nicht „Wiki für Menschen, YAML für KI“. Auch die Bereichsdateien müssen für Menschen verständlich sein; Menschen und KI nutzen dieselbe fachliche Grundlage. Das Wiki erleichtert den Zugang, ohne eine zweite unabhängig gepflegte Beschreibung desselben Soll-Verhaltens anzulegen. Kurze Erklärungen und Bedienhinweise sind sinnvoll, abgeschriebene Spec-Kataloge nicht.

Entwicklungsnahe Regeln gehören in eine versionierte, für die ausführende Umgebung zugängliche Repository-Dokumentation. Das Wiki darf darauf verweisen. Übergeordnete QMA- und Prozessquellen behalten ihre bestehende Zuständigkeit; sie werden durch diese Ablagevereinbarung nicht pauschal verlagert.

Später kann aus den YAML-Dateien automatisch eine bequem lesbare Übersicht erzeugt werden. Eine solche Ansicht muss ihren zugrunde liegenden Stand erkennen lassen und wird nicht unabhängig bearbeitet. Die Einführung einer Generierung ist eine mögliche spätere Verbesserung, kein zusätzlicher Implementierungsauftrag dieses Dokuments.

Bestehende Wiki-Inhalte bleiben vorerst erhalten. Erst wenn ein Thema im Rahmen einer beauftragten Änderung konkret bearbeitet wird, wird für dieses Thema die maßgebliche Quelle geklärt. Bei einer Überführung den bestehenden Wiki-Einstieg mit einem eindeutigen Verweis versehen, sodass keine konkurrierenden aktuellen Fassungen entstehen. Widersprüche nicht stillschweigend durch eine beliebige Quellenwahl auflösen; die zuständige Entwicklungsleitung klärt sie innerhalb ihres Auftrags. Keine rückwirkende Gesamtinventur, Aufräumaktion oder Massenmigration starten.

## 3. Ablage: eine Datei pro Bereich

```text
specs/
  search.yaml
  mail-import.yaml
  rebuild.yaml
  global.yaml
```

- Dateinamen, Feldnamen und Bereichskennungen sind Englisch, klein geschrieben; Dateinamen verwenden bei Bedarf Bindestriche.
- Fachliche Titel, Beschreibungen und Begründungen dürfen Deutsch sein.
- Jede Bereichsdatei enthält gemeinsam `specs`, `decisions` und `tests`.
- Keine zusätzliche Datei pro Spec, Decision oder Test-ID.
- `global.yaml` enthält tatsächlich übergreifende Regeln, Entscheidungen und Abläufe. Es heißt ausdrücklich **nicht** `cross-cutting.yaml`.
- Jeder Eintrag hat genau einen Heimatbereich. Andere Bereiche referenzieren seine ID; keine Kopien.
- Ein Suchtest bleibt bei Suche, auch wenn er gespeicherte Mails voraussetzt. Ein Test des gesamten Ablaufs Import → Speicherung → Suche kann in `global.yaml` liegen.
- Testcode, synthetische Fixtures und einzelne Ausführungsergebnisse bleiben außerhalb der Bereichsdateien. Sie werden referenziert, nicht hineinkopiert.

Die Bereichsgrenzen orientieren sich am fachlichen Verhalten, nicht an einzelnen Klassen oder technischen Schichten. Große Dateien nicht vorsorglich in Kleinstdateien zerlegen; bei tatsächlichen Lese- oder Pflegeproblemen einen fachlich sinnvollen Zuschnitt vorschlagen.

## 4. Stabile IDs

Schema: `<type>-<area>-<number>`.

| Art | Beispiel in `search.yaml` | Beispiel in `global.yaml` |
| --- | --- | --- |
| Spec | `s-search-001` | `s-global-001` |
| Decision | `d-search-001` | `d-global-001` |
| Testfall | `t-search-001` | `t-global-001` |

Für `mail-import.yaml` heißt die Bereichskennung `mail-import`, also beispielsweise `s-mail-import-001`. Dateistamm und `area` stimmen überein. Vollständige englische Bereichskennungen vermeiden unnötige Abkürzungsübersetzungen.

Nummern werden pro Typ und Bereich fortlaufend vergeben, mindestens dreistellig. Bestehende IDs niemals neu vergeben oder nachträglich durchnummerieren. Referenzen gelten projektweit; projektübergreifend kommt eine eindeutige Repository-/Projektzuordnung hinzu.

Bei einer späteren Verschiebung bleibt die ID erhalten. Dann beschreibt die Bereichskomponente die Herkunft; sie ist keine dynamische Pfadangabe. Das ist eine ausdrücklich zulässige Ausnahme von der anfänglichen Dateizuordnung. IDs dürfen deshalb nicht ausschließlich durch Zusammenbauen eines Dateipfads aufgelöst werden.

## 5. Erwartetes Dateiformat

YAML ohne ausführbare Ausdrücke, benutzerdefinierte Tags oder versteckte Includes verwenden. Für einen einfachen Einstieg auf YAML-Anker und Aliase verzichten. Listen bleiben Listen, auch bei nur einem Eintrag; leere Sammlungen werden als `[]` geschrieben. Zahlenartige IDs und Beschreibungstexte als Zeichenketten behandeln.

### 5.1 Dateikopf

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `schema_version` | Ja | Zu Beginn `1`; Version des gemeinsamen Dateiformats. |
| `area` | Ja | Englische Bereichskennung, gleich dem Dateistamm. |
| `title` | Ja | Verständlicher Bereichstitel. |
| `specs` | Ja | Liste der Specs. |
| `decisions` | Ja | Liste der Decisions. |
| `tests` | Ja | Liste der Testfälle. |

### 5.2 Spec

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `id` | Ja | Stabile `s-…`-Kennung. |
| `title` | Ja | Kurzer fachlicher Titel. |
| `given` | Ja | Liste eindeutiger Ausgangsbedingungen. |
| `when` | Ja | Einzelner Auslöser als Text. |
| `then` | Ja | Liste beobachtbarer, überprüfbarer Ergebnisse. |
| `why` | Nein | Fachlicher Zweck, wenn er nicht offensichtlich ist. |
| `sources` | Nein | Liste belegter Links auf Anforderung/Issue oder andere Ursprungsquellen. |

Eine Spec beschreibt zusammengehöriges Verhalten. Technische Implementierungsdetails gehören grundsätzlich in die Decision. Statt „funktioniert schnell“ konkrete, abgestimmte Kriterien angeben; fehlende Anforderungen nicht erfinden. Specs dürfen nicht nachträglich abgeschwächt werden, nur damit fehlerhafter Code einen Test besteht.

#### Bedeutung von `given`, `when` und `then`

Eine Spec ist ein dauerhaft geltendes Versprechen des Produkts, kein Vorher/Nachher-Bericht über die Entwicklung. Sie muss auch nach Abschluss des ursprünglichen Issues verständlich und prüfbar bleiben.

- **`given` – Ausgangslage des Szenarios:** Welche fachlichen Zustände gelten unmittelbar vor dem Auslöser? Alle Listeneinträge müssen gemeinsam gelten. Die Ausgangslage muss für eine Prüfung herstellbar sein. Keine Projektgeschichte wie „bisher fehlt der Tunnel“, keine Dateiliste, keine Implementierungsaufträge. Ein leerer Datenbestand kann dagegen eine gültige Ausgangslage sein: Er lässt sich auch im fertigen Produkt herstellen.
- **`when` – ein Auslöser:** Genau eine Benutzeraktion oder ein fachliches Ereignis, etwa eine Antwort des Servers. Nicht mehrere unabhängige Aktionen in einen Satz packen. „Der Entwickler baut …“ oder „Datei X wird geändert“ ist kein Produktverhalten.
- **`then` – überprüfbares Ergebnis:** Was können Anwender oder angebundene Systeme anschließend beobachten? Zusammengehörige Ergebnisse dürfen eine Liste bilden. Keine Klassen, Widgets, Mesh-Typen oder internen Hilfsfunktionen vorschreiben, sofern diese nicht selbst Bestandteil eines ausdrücklich vereinbarten externen Vertrags sind.
- **`why` – Zweck und Ursprung:** Warum ist dieses Verhalten nötig? Bekannte Anforderungskennungen nennen und belegte Links unter `sources` ergänzen. Keine plausible, aber unbelegte Kundenaussage erfinden.

Eine Spec beschreibt ein Verhalten, nicht ein ganzes Arbeitspaket. Laden, Leerzustand, Fehler, erneuter Versuch, Abbruch und Rückkehr getrennt betrachten, soweit sie für die Änderung relevant sind. Ein Screenshot, eine technische Bestandsbeschreibung oder ein Nutzerwunsch ist Ausgangsmaterial; daraus wird nicht durch bloßes Einsetzen der Feldnamen eine fertige Spec.

**Bewusste Formatabweichung:** Die Flutter-Vorlage erlaubt Szenarien ohne `when`, Text oder Liste sowie `any`-Bedingungen. Unser bisheriges Format behält `given` und `when` als Pflichtfelder sowie Textlisten bei. Für eine reine Anzeigeanforderung einen echten Beobachtungsauslöser wählen, etwa das Öffnen der Ansicht; kein künstliches Ereignis erfinden. Unterschiedliche Ausgangslagen mit unterschiedlichem Ergebnis als getrennte Specs formulieren. `any` nicht ohne abgestimmte Schemaerweiterung übernehmen.

#### Schreibregeln mit Gegenbeispielen

| Vermeiden | Stattdessen |
| --- | --- |
| `given: Nördlich von Europa ist bisher Ozean.` | Projektgeschichte im Issue/Plan belassen. In der Spec etwa den Standort des Fahrzeugs vor dem Portal als Ausgangslage nennen. |
| `when: Entwickle das Vorland und baue den Tunnel ein.` | Eine Fahrt, ein Laden der Szene oder einen anderen realen Produktauslöser beschreiben. |
| `then: Ein PlaneGeometry mit 140 Segmenten wird angelegt.` | Sichtbares bzw. messbares Verhalten spezifizieren; Geometriewahl und Begründung in `decision`/`how`. |
| `then: Alles funktioniert schnell und korrekt.` | Das konkrete Ergebnis und vereinbarte messbare Kriterien nennen. Fehlende Grenzwerte als offene Frage klären, keine Zahlen erfinden. |
| `then: Eine passende Fehlermeldung erscheint.` | Vereinbarten UI-Text exakt zitieren; noch nicht festgelegten Wortlaut zuerst klären. |
| Ein Szenario mit Anmeldung, Suche, Export und Abmeldung | Einzelne Verhaltensregeln formulieren; den durchgängigen Ablauf gegebenenfalls als übergreifenden Test prüfen. |

**Portierungsfrage:** Würde dieses fachliche Versprechen bei einer Neuimplementierung mit anderer Sprache oder UI-Technik weiter gelten? Wenn nein, prüfen, ob es eine technische Decision oder ein einmaliger Umsetzungsschritt ist. Ein ausdrücklich vereinbarter API-Vertrag oder eine notwendige Plattformbedingung darf trotzdem Bestandteil einer Spec sein.

#### Zusammenhängende Beispiele aus der Worklist abgeleitet

Die folgenden Beispiele adaptieren die fachlichen Muster `wl-19`, `wl-22`, `wl-4`, `wl-6` und `wl-23` aus dem von MM bereitgestellten Flutter-Projekt. Sie illustrieren unser Format und sind keine neuen Anforderungen an MailCollector oder andere Produkte. Die 200 ms stammen aus diesem Beispielprojekt und sind kein allgemeiner Standard.

```yaml
specs:
  - id: s-worklist-001
    title: Gespeicherte Worklist beim Öffnen anzeigen
    given:
      - Eine gültige Worklist ist lokal gespeichert.
    when: Der Anwender öffnet die Worklist.
    then:
      - Die gespeicherten Einträge werden angezeigt.
      - Eine Aktualisierung wird beim Server angefordert.

  - id: s-worklist-002
    title: Gespeicherte Worklist bei ungültiger Serverantwort erhalten
    given:
      - Die gespeicherte Worklist wird angezeigt.
      - Eine Aktualisierungsanfrage ist ausstehend.
    when: Der Server antwortet mit einer ungültigen Worklist-Nachricht.
    then:
      - Die bisher gespeicherten Einträge bleiben angezeigt und gespeichert.
      - 'Die Meldung "Aktualisierung fehlgeschlagen" wird angezeigt.'
    why: Bereits verfügbare Daten dürfen durch eine ungültige Antwort nicht verloren gehen.

  - id: s-worklist-003
    title: Scanner ohne verfügbares Barcode-Modul ausblenden
    given:
      - Das Barcode-Modul ist nicht verfügbar.
    when: Der Anwender öffnet die Worklist.
    then:
      - Der Barcodescanner-Button wird nicht angezeigt.

  - id: s-worklist-004
    title: Lokale Suche nach einer Eingabepause starten
    given:
      - Die Worklist wird angezeigt.
      - Der Anwender hat einen Suchbegriff eingegeben.
    when: Seit der letzten Änderung des Suchbegriffs sind 200 ms vergangen.
    then:
      - Die gespeicherte Worklist wird nach dem Suchbegriff durchsucht.
      - Für diese Suche wird keine Serveranfrage gesendet.
```

Diese Beispiele zeigen normale Anzeige, Fehlerfall, Nichtverfügbarkeit und ein Zeitereignis. Für „keine Treffer“, eine leere empfangene Liste oder einen erneuten Versuch sind bei Bedarf eigene Szenarien nötig. Die Beispiele behaupten keine vollständige Produktabdeckung. Eine Anzeigedauer der Fehlermeldung ist hier bewusst nicht festgelegt; falls sie abnahmerelevant ist, muss sie geklärt werden, statt „einige Sekunden“ zu schreiben.

### 5.3 Decision

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `id` | Ja | Stabile `d-…`-Kennung. |
| `title` | Ja | Kurzer Entscheidungstitel. |
| `status` | Ja | `proposed`, `accepted` oder `superseded`. |
| `decision` | Ja | Was wurde vorgeschlagen bzw. entschieden? |
| `why` | Ja | Begründung und wesentliche Abwägung. |
| `how` | Nein | Liste relevanter Umsetzungshinweise. |
| `specs` | Nein | Liste betroffener Spec-IDs; bei konkretem Bezug ausfüllen. |
| `sources` | Nein | Belegte Entscheidungs-/Issue-Links. |
| `superseded_by` | Bei Ablösung | ID der nachfolgenden Decision. |

Ein Vorschlag wird erst durch die zuständige Entscheidung zu `accepted`. Bei einer grundlegenden Ablösung eine neue Decision anlegen und die bisherige mit `superseded_by` verknüpfen; die alte Begründung erhalten. Kleine Klarstellungen benötigen keine neue ID. Keine erfundenen historischen Begründungen nachtragen.

Eine Decision hält eine dauerhafte technische, gestalterische oder prozessuale Wahl fest. `decision` benennt die Wahl, `why` ihren Grund und wesentliche Abwägungen, `how` die dafür relevanten technischen Mittel. Nicht jede Codezeile braucht eine Decision. Einmalige Anweisungen wie „Datei nach Script X einbinden“ oder „diese drei Dateien ändern“ gehören in den Arbeitsplan. Dauerhaft notwendige Ladeabhängigkeiten können dagegen eine begründete Architekturentscheidung sein.

Beispiel, angelehnt an die Worklist-Speicherung; als Vorschlag gekennzeichnet, nicht als Freigabe übernommen:

```yaml
decisions:
  - id: d-worklist-001
    title: Letzte gültige Worklist verschlüsselt lokal halten
    status: proposed
    specs: [s-worklist-001, s-worklist-002]
    decision: Die letzte gültige Worklist wird verschlüsselt im privaten App-Speicher abgelegt und von Betriebssystem-Cloud-Backups ausgeschlossen.
    why: Die Daten sollen offline verfügbar bleiben; der sensible Inhalt erfordert Schutz bei lokaler Speicherung und Sicherung.
    how:
      - Eine mit AES-GCM verschlüsselte Datei verwenden.
      - Den Schlüssel über iOS Keychain beziehungsweise Android Keystore verwalten.
```

Die konkrete Bibliothekswahl kann unter `how` ergänzt werden, wenn sie tatsächlich entschieden wurde. Die Begründung muss zum jeweiligen Produkt und Auftrag passen; dieses Beispiel ersetzt keine Sicherheitsprüfung.

### 5.4 Testfall

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `id` | Ja | Stabile `t-…`-Kennung. |
| `title` | Ja | Konkretes Prüfziel; verständlich ohne den Issue-Chat. |
| `specs` | Ja | Liste der geprüften Spec-IDs, auch bereichsübergreifend. |
| `suites` | Ja | Auswahlgruppen: `smoke` und/oder `regression`. |
| `areas` | Ja | Betroffene fachliche Bereiche zur Testauswahl. |
| `risk` | Ja | `low`, `medium`, `high`: Bedeutung eines Fehlers für diese Prüfung. |
| `requires` | Ja | Liste benötigter Testressourcen, etwa `synthetic-mail-source`; `[]` ist erlaubt. |
| `preconditions` | Ja | Ausgangslage einschließlich Testdaten und relevanter Konfiguration. |
| `steps` | Ja | Geordnete Liste mit jeweils `action` und einer Liste `expected`. |
| `cleanup` | Ja | Liste erlaubter Nachbereitungsschritte; `[]` ist erlaubt. |
| `automation` | Nein | Verknüpfung mit tatsächlich vorhandenem Testcode: `path` und `selector`. |
| `sources` | Nein | Beispielsweise der belegte Link auf den auslösenden Bug. |

`automation` weglassen, solange keine passende Automatisierung existiert; keine erfundenen Pfade eintragen. Ein manueller oder durch KI ausgeführter Test braucht ebenso konkrete Voraussetzungen und überprüfbare Ergebnisse. Eine verständliche YAML-Datei allein ist noch keine zuverlässige Testautomatisierung.

Komplexe Testdaten können über versionierte synthetische Fixtures bereitgestellt werden. Dann in den Voraussetzungen den tatsächlichen Fixture-Pfad und seine Bedeutung nennen. Keine produktiven Nachrichten, Zugangsdaten oder Kontokonfigurationen einbetten.

Ein Test konkretisiert ein fachliches Versprechen durch Daten, Aktionen und Beobachtungen. Er soll nicht lediglich interne Erfolgsmeldungen der Implementierung übernehmen. Ein `...Ok=true` ist nur dann ein belastbarer Nachweis, wenn die zugrunde liegenden Prüfungen bekannt sind und das geforderte Verhalten tatsächlich messen. Eine verlinkte Spec-ID behauptet für sich allein keine vollständige Abdeckung aller Ergebnisse.

Beispiel zur obigen Fehlerspec, manuell oder mit geeignetem Testadapter ausführbar:

```yaml
tests:
  - id: t-worklist-001
    title: Ungültige Aktualisierung bewahrt vorhandene Einträge
    specs: [s-worklist-002]
    suites: [regression]
    areas: [worklist]
    risk: high
    requires: [isolated-test-instance, controllable-test-server]
    preconditions:
      - Eine isolierte Testinstanz ohne Produktivzugänge ist gestartet.
      - Die gültige synthetische Worklist mit genau den Einträgen A und B ist gespeichert und wird angezeigt.
      - Der Testserver kann seine nächste Antwort bis zur ausdrücklichen Freigabe zurückhalten.
      - Die vereinbarte Testnachricht ist syntaktisch ungültig; sie ist keine gültige leere Worklist.
    steps:
      - action: Die manuelle Aktualisierung auslösen und die Antwort am Testserver zurückhalten.
        expected:
          - Am Testserver ist die Aktualisierungsanfrage angekommen und noch unbeantwortet.
      - action: Die vorbereitete ungültige Nachricht als Antwort freigeben.
        expected:
          - 'Die Meldung "Aktualisierung fehlgeschlagen" wird angezeigt.'
          - Weiterhin werden genau A und B mit unveränderten Daten angezeigt.
      - action: Die App schließen, den Testserver unerreichbar schalten und die App mit derselben lokalen Speicherung wieder öffnen.
        expected:
          - Die Worklist zeigt weiterhin genau A und B mit unveränderten Daten an.
    cleanup:
      - Nur die isolierte Testinstanz und den eigens angelegten synthetischen Testbestand entfernen.
```

Hier prüft der letzte Schritt auch, ob die Daten gespeichert geblieben sind. Ein Timeout, eine gültige leere Liste und eine erfolgreiche Antwort sind andere Fälle; sie werden durch diesen Test nicht automatisch mitgeprüft. Konkrete Fixture-Dateien, Zeitlimits und technische Beobachtungswege werden bei der Umsetzung des Tests festgelegt. `automation` fehlt absichtlich, solange kein tatsächlicher Testcode benannt ist.

## 6. Vollständiges Beispiel: `search.yaml`

Dieses Beispiel zeigt das komplette Dateiformat. Die gewünschte Suchlogik ist illustrativ; sie wird dadurch nicht zur Produktanforderung. Die Decision bleibt entsprechend `proposed`.

```yaml
schema_version: 1
area: search
title: Suche

specs:
  - id: s-search-001
    title: Suche nach einem eindeutigen Begriff
    given:
      - Mail A enthält im Betreff den Begriff Polarlicht.
      - Mail B enthält Polarlicht weder im Betreff noch im Nachrichtentext.
      - Der vollständig aufgebaute Testindex enthält nur A und B.
    when: Nach Polarlicht suchen.
    then:
      - Die Trefferliste enthält genau Mail A.
      - Mail B wird nicht als Treffer angezeigt.
    why: Anwender sollen eine bestimmte Nachricht zuverlässig finden.

decisions:
  - id: d-search-001
    title: Suche arbeitet auf einem lokalen Index
    status: proposed
    specs: [s-search-001]
    decision: Suchanfragen werden gegen einen lokalen Index ausgeführt.
    why: Die Suche soll keine erneute Abfrage des Mailservers benötigen.
    how:
      - Importierte Inhalte werden für die Suche indexiert.
      - Suchanfragen verändern keine Quellnachrichten.

tests:
  - id: t-search-001
    title: Eindeutigen Suchtreffer finden
    specs: [s-search-001]
    suites: [smoke, regression]
    areas: [search]
    risk: high
    requires: [isolated-test-instance]
    preconditions:
      - Eine isolierte Testinstanz ohne Produktivzugänge ist gestartet.
      - Der automatische Import ist deaktiviert.
      - Der Testbestand enthält genau zwei synthetische Mails.
      - "Mail A: ID A, Betreff Polarlicht, Nachrichtentext Termin morgen."
      - "Mail B: ID B, Betreff Rechnung, Nachrichtentext Betrag offen."
      - Der Index ist vollständig aufgebaut; keine Filter sind aktiv.
    steps:
      - action: Die Suche öffnen und Polarlicht als Suchbegriff absenden.
        expected:
          - Die Suche meldet ihren Abschluss ohne Fehler.
          - Die Trefferliste enthält genau einen Eintrag mit ID A.
          - Kein Eintrag mit ID B wird angezeigt.
    cleanup:
      - Nur den eigens angelegten lokalen Testbestand entfernen.
```

Weitere Specs, Decisions und Testfälle werden als weitere Listeneinträge in derselben Datei ergänzt. Ein Testfall kann mehrere Spec-IDs enthalten. Dass ein Smoke-Test auch zur Regression gehört, führt zu einem Eintrag mit beiden Gruppenzuordnungen, nicht zu zwei Kopien.

## 7. Vollständiges Beispiel: `global.yaml`

Das folgende Beispiel zeigt einen Ablauf über Import und Suche hinweg. Die Referenz auf `s-search-001` verweist auf das vorangehende Beispiel. Die synthetische Mailquelle ist eine Voraussetzung, keine Behauptung über bereits vorhandene Infrastruktur.

```yaml
schema_version: 1
area: global
title: Bereichsübergreifendes Verhalten

specs:
  - id: s-global-001
    title: Importierte Nachricht wird auffindbar
    given:
      - Eine synthetische Mailquelle enthält genau Mail A mit Betreff Polarlicht.
      - Lokaler Testbestand und Suchindex sind leer.
    when: Der Anwender den Import aus der synthetischen Mailquelle auslöst.
    then:
      - Nach erfolgreichem Abschluss des Imports und der anschließenden Indexierung liefert die Suche nach Polarlicht genau Mail A.
      - Mail A ist in der synthetischen Quelle unverändert vorhanden.

decisions:
  - id: d-global-001
    title: Durchgängigen Ablauf separat prüfen
    status: proposed
    specs: [s-global-001, s-search-001]
    decision: Ein übergreifender Test verbindet Import, Indexierung und Suche.
    why: Einzelprüfungen der Bereiche erkennen nicht jeden Übergabefehler.
    how:
      - Eine isolierte Instanz und eine synthetische Mailquelle verwenden.
      - Die Nachricht vor und nach dem Ablauf anhand derselben ID prüfen.

tests:
  - id: t-global-001
    title: Nachricht importieren und anschließend finden
    specs: [s-global-001]
    suites: [regression]
    areas: [mail-import, search]
    risk: high
    requires: [isolated-test-instance, synthetic-mail-source]
    preconditions:
      - Isolierte Testinstanz und synthetische Mailquelle sind eingerichtet.
      - Beide enthalten keine Produktivzugänge oder Produktivdaten.
      - Der automatische Import ist deaktiviert.
      - "Die Testquelle enthält genau Mail A: ID A, Betreff Polarlicht."
      - Lokaler Testbestand und Suchindex sind leer.
    steps:
      - action: Den Import aus der synthetischen Quelle auslösen.
        expected:
          - Der Import wird erfolgreich abgeschlossen.
          - Der lokale Testbestand enthält genau Mail A.
      - action: Den Abschluss der anschließenden Indexierung abwarten.
        expected:
          - Die Indexierung meldet einen erfolgreichen Abschluss.
      - action: Nach Polarlicht suchen.
        expected:
          - Die abgeschlossene Suche liefert genau einen Treffer mit ID A.
      - action: Mail A in der synthetischen Quelle mit dem Ausgangsstand vergleichen.
        expected:
          - Inhalt und vorhandene Metadaten sind unverändert.
    cleanup:
      - Nur den eigens angelegten lokalen Testbestand und Testindex entfernen.
      - Die Quellnachricht erhalten.
```

Für einen tatsächlich ausgeführten Test werden Auslöseweg, Fixture, Beobachtungsmethode und angemessenes Zeitlimit im Testplan bzw. Testadapter konkret festgelegt. „Abwarten“ bedeutet keine unbegrenzte Schleife. Ein fehlender oder fehlerhafter Versuchsaufbau ist kein bestandener Test. Beobachtbare Produktfehler sind von einem blockierten Testaufbau zu unterscheiden.

## 8. Pflegeprozess und Zuständigkeiten

| Schritt | Verantwortlich | Erwartetes Ergebnis |
| --- | --- | --- |
| Anforderungen klären | Entwicklungsleiter mit MM im bestehenden Auftragsrahmen | Nutzen, Umfang und Akzeptanzkriterien; betroffene Bereiche und vorhandene IDs benennen. |
| Änderung planen | Fachchat | Vorschlag für neue/geänderte Specs, Decisions und Tests zusammen mit Implementierungs- und Testplan. |
| Plan entscheiden | Entwicklungsleiter | Fachlichen Nutzen und Testumfang prüfen; normale Entscheidungen im Auftrag treffen, Grundsatzfragen an MM geben. |
| Implementieren und pflegen | Fachchat | Code, Testcode und betroffene YAML-Einträge im selben Änderungspaket aktualisieren; tatsächliche Prüfungen nachweisen. |
| Unabhängig reviewen | Reviewer in frischem Kontext | Anforderungen, YAML-Änderungen, Umsetzung und Testnachweise vergleichen; Abdeckungslücken und Widersprüche melden. |
| Abnehmen | Entwicklungsleiter | Nutzen, Reviewbefunde, ausgewählte und ausgelassene Tests sowie Nachweise für denselben Stand bewerten. |
| Betrieb übernehmen | Betriebsleiter | Nur abgenommenen, identifizierten Stand im bestehenden Betriebsrahmen übernehmen. |

Bei einem Bug zuerst klären: verletzt die Implementierung eine bestehende Spec, ist die Spec falsch oder fehlt eine Anforderung? Eine passende Regressionsprüfung ergänzen, soweit sie den Fehler wirksam abdeckt. Keine Spec-Änderung ausschließlich zur Rechtfertigung eines Fehlers.

Ein Refactoring ohne Verhaltensänderung braucht keine künstliche neue Spec. Es kann eine Decision betreffen oder mit bestehenden Tests abgedeckt werden. Der Fachchat hält kurz fest, warum keine Änderung der Sammlung nötig war.

Fachchats dürfen innerhalb ihres freigegebenen Auftrags pflegen und verbessern. Grundsätzliche Prozessprobleme und Verbesserungen an den Berater melden. Der Berater sammelt sie für MM; die Meldung ersetzt keine erforderliche Entscheidung. Relevante Erläuterungen und Rückfragen werden für die Beratung nachvollziehbar gesammelt.

## 9. Tests gezielt auswählen

Die Dateiorganisation allein entscheidet nicht über die Ausführung. Auswahl erfolgt nach Spec-IDs, Bereichen, Gruppen, Risiko und benötigter Umgebung. Ein Test in `global.yaml` muss bei Änderungen an einem seiner Bereiche ebenfalls gefunden werden.

### Smoke und Regression

- **Smoke:** kleine, regelmäßig überprüfte Auswahl schneller Tests der wesentlichen Funktionen. Sie zeigt grundlegende Nutzbarkeit, nicht vollständige Fehlerfreiheit.
- **Regression:** prüft gezielt, ob bestehendes Verhalten nach einer Änderung weiterhin erfüllt ist. Sie kann kurze und aufwendige Tests enthalten.
- Suites sind keine getrennten Ablagen. Derselbe Test kann beiden Gruppen angehören.
- `risk` beschreibt die Bedeutung eines unentdeckten Fehlers, nicht die Laufzeit und keine Freigabe für gefährliche Aktionen.

| Anlass | Auswahlprinzip |
| --- | --- |
| Schnelle Rückmeldung während der Arbeit | Direkt betroffene Tests; bei Bedarf relevante Smoke-Prüfungen. |
| Abnahme eines Änderungspakets | Passende Smoke-Auswahl sowie Regression zu betroffenen Specs, Bereichen und angrenzenden Abläufen. |
| Konkreter Fehler | Reproduzierender Test und fachlich verwandte Randfälle. |
| Übergreifende Infrastruktur-/Datenänderung | Auswirkungen über mehrere Bereiche bewerten; Auswahl entsprechend verbreitern. |
| Release Candidate | Produktbezogene Prüfung gemäß bestehendem Pilot-/QMA-Prozess; erfolgreiche Einzeltests ersetzen diese nicht. |

Der Fachchat schlägt die Auswahl vor; der Entwicklungsleiter verantwortet ihre Angemessenheit im Auftrag. Im Testplan stehen ausgewählte IDs, die kurze Begründung und relevante Auslassungen. Bei unklaren Auswirkungen nicht stillschweigend nur Smoke ausführen.

Kosten berücksichtigen: Laufzeit, externe Ressourcen und bei KI-Ausführung auch den erfassten Aufwand. Tatsächlich gemessene Laufzeiten gehören in die Ergebnisse und können für spätere Auswahlen zusammengefasst werden. Fehlende Messwerte als unbekannt behandeln; Schätzungen ausdrücklich kennzeichnen. Notwendige Prüfungen nicht allein zur Budgeteinhaltung streichen: Umfang, Ansatz oder Budget mit dem zuständigen Entscheider klären.

Ein menschen- und KI-lesbarer Katalog kann später aus den YAML-Dateien automatisch erzeugt werden. Er enthält beispielsweise ID, Titel, Specs, Bereiche, Suites, Ressourcenbedarf, Automatisierungszuordnung und zuletzt gemessene Laufzeit. Kein zusätzliches manuell gepflegtes Register. Eine neue Such-/Katalogsoftware ist durch dieses Dokument nicht beauftragt; zunächst reicht die einfachste zuverlässige gezielte Suche.

## 10. Prüfnachweise getrennt halten

Bereichsdateien enthalten dauerhaftes Soll-Wissen. Nicht bei jedem Testlauf ein `passed: true` oder einen wechselnden Zeitstempel hineinschreiben.

Ein Ausführungsnachweis enthält mindestens:

- Test-ID sowie Commit/Build, einschließlich des Stands der Testdefinition.
- Tatsächliche Testumgebung und verwendeten synthetischen Datensatz bzw. Fixture-Version.
- Zeitpunkt, Laufzeit und tatsächlichen Ausführenden: Mensch, KI oder Testwerkzeug.
- Ergebnis: bestanden, fehlgeschlagen, blockiert oder nicht ausgeführt.
- Beobachtungen und belegte Artefakt-/Logreferenzen; keine Geheimnisse oder Produktivnachrichten.
- Bekannte Einschränkungen und gegebenenfalls verknüpftes Issue.

Vorhandene CI-/GitLab-Nachweise nutzen und über IDs zuordnen. Kein zweites Ergebnisverwaltungssystem erfinden. Ein älterer grüner Lauf beweist nicht den aktuellen Build. Eine Testbeschreibung, ein gestarteter Test und ein abgeschlossener erfolgreicher Test sind unterschiedliche Zustände.

Das produktive IMAP-Konto darf laut bestehendem Pilotprozess nicht für Entwicklungs-, Regressions-, Diagnose- oder Wiederherstellungstests verwendet oder kontaktiert werden. Fehlende Testkonfiguration darf niemals auf Produktivkonfiguration zurückfallen. Quellen bleiben erhalten; Nachbereitung ist auf ausdrücklich dafür angelegte lokale Testdaten begrenzt. Betrieb und Entwicklungsprüfungen bleiben getrennte Zuständigkeiten.

## 11. Review und Formprüfung

Bei der Übernahme im normalen freigegebenen Arbeitsrahmen eine einfache maschinelle Formprüfung vorsehen; sie ist hier beschrieben, aber noch nicht implementiert. Sie soll mindestens erkennen:

1. Ungültiges YAML, doppelte YAML-Schlüssel, fehlende Pflichtfelder oder falsche Feldtypen.
2. Doppelte IDs im Projekt sowie falsche Typ-Präfixe.
3. Nicht auflösbare Spec-Verweise und `superseded_by`-Verweise.
4. Unbekannte Werte für Status, Suites und Risiko.
5. Fehlende Aktionen oder leere Ergebniserwartungen in Testschritten.
6. Nicht vorhandene Automatisierungspfade, sofern angegeben; Selector-Auflösung durch das jeweilige Testwerkzeug prüfen.

Das Schema gilt für neu aufgenommene Einträge. Unbearbeitete historische Bestände lösen keine automatische Nachpflege aus. Der Reviewer prüft zusätzlich die Bedeutung: Ist das Verhalten richtig, der Test aussagekräftig und die Entscheidung nachvollziehbar? Formgültigkeit beweist keine fachliche Qualität oder vollständige Abdeckung.

### Inhaltlicher Review für alle Autoren und Reviewer

Vor Übergabe selbst prüfen, im unabhängigen Review erneut anhand von Anforderung und Änderung prüfen:

1. Beschreibt jede Spec ein dauerhaftes Produktverhalten statt Projektgeschichte oder einen Entwicklungsauftrag?
2. Sind sämtliche `given`-Bedingungen gemeinsam herstellbar, und beschreibt `when` genau einen realen Auslöser?
3. Sind die `then`-Ergebnisse fachlich zusammengehörig und von außen beobachtbar? Sind UI-Texte und erforderliche Grenzwerte konkret und belegt?
4. Sind Implementierungsdetails in Decisions und einmalige Umbauanweisungen im Plan aufgehoben? Bleibt das fachliche Versprechen bei einer Portierung verständlich?
5. Sind für die Änderung relevante Leer-, Fehler-, Wiederholungs-, Abbruch- und Rückkehrfälle berücksichtigt oder als offene Lücke benannt?
6. Erklärt jede Decision die Wahl und ihren Grund; entspricht ihr Status einer tatsächlichen Entscheidung?
7. Prüfen die Testschritte die behaupteten Ergebnisse tatsächlich? Welche Ergebnisse einer referenzierten Spec bleiben ungeprüft? Ein Sammeltest darf keine Vollabdeckung nur durch Auflisten vieler IDs vortäuschen.
8. Lassen sich Tests für das betroffene Verhalten gezielt auswählen? Unabhängige Prüfziele bei Bedarf als mehrere Testeinträge in derselben Bereichsdatei führen; lange Sammeltests nicht pauschal als Smoke deklarieren.

Befunde mit betroffenen IDs und konkretem Widerspruch melden. Ein maschinell gültiges YAML oder ein grüner Selbsttest ersetzt diese Bedeutungsprüfung nicht.

Nicht jeder Spec braucht einen eigenen Kompletttest: Ein Test darf mehrere Specs abdecken, und vorhandene geeignete Tests dürfen genutzt werden. Für den aktuellen Änderungsumfang muss die Abdeckung nachvollziehbar sein; nicht vorhandene historische Einträge dürfen keine Vollständigkeit vortäuschen.

## 12. Einführung und erwartete Rückmeldung

Bitte bei Übernahme:

1. Die dauerhafte Prozessquelle in GitLab benennen und die widersprechende Wiki-Ablageformulierung im Pilotprozess gezielt berichtigen: Bereichs-YAMLs führen das produktbezogene Soll-Wissen; das Wiki bleibt verständlicher Einstieg mit Übersicht, Bedienhinweisen und direkten Links. Bestehende Inhalte nur bei konkreter Bearbeitung einordnen, ohne historische Migration.
2. In den einschlägigen `AGENTS.md` auf die Regel verweisen; in entfernten Umgebungen einen tatsächlich zugänglichen versionierten Einstieg sicherstellen.
3. Fachchats und Reviewer über Dateistruktur, IDs, Pflegepflicht, Testauswahl, die begrenzte Wiki-Rolle und ausdrücklich fehlenden historischen Nachpflegeauftrag informieren. Die gemeinsame Lesbarkeit für Menschen und KI sowie das Vermeiden unabhängig gepflegter Kopien gehören dazu.
4. Die erste Anwendung mit einer ohnehin freigegebenen Änderung verbinden, ohne rückwirkende Inventur oder zusätzliche Produktimplementierung zu starten.
5. Dem Berater kurz zurückmelden, wo die Regel steht, wer sie erhalten hat und welche praktischen Unklarheiten oder Verbesserungen aufgetreten sind. Keine unbelegten Erfolge oder Tokenersparnisse melden.

## 13. Grundlage und Abweichung von Here2BuildApps

Forschungsgrundlage ist das von MM bereitgestellte [Repo-Archiv](D:/Inbox/dicom-camera-flutter-app-develop.zip), insbesondere `docs/specs.md`, `specs/schema.yaml`, `.claude/agents/test-planner.md` und `.claude/agents/test-writer.md`.

Für die Überarbeitung vom 27.10.2026 wurden die [Flutter-Schreibanleitung](<D:/Inbox/dicom-camera-flutter-app-develop(1)/dicom-camera-flutter-app-develop/docs/specs.md>), das [Flutter-Schema](<D:/Inbox/dicom-camera-flutter-app-develop(1)/dicom-camera-flutter-app-develop/specs/schema.yaml>) und die von MM bereitgestellte Worklist-YAML mit den IDs `wl-2` bis `wl-23` herangezogen. Übernommen wurden die in diesem Dokument vollständig erläuterten Schreibprinzipien, nicht das fremde Schema. Die lokalen Quellenlinks dienen der Nachprüfung; die Anleitung ist auch ohne Zugriff auf Markus' Laufwerk verständlich. Andere Agenten müssen diese Anleitung tatsächlich lesen können; ein Link allein lädt sie nicht automatisch.

Here2BuildApps bündelt Szenarien und Entscheidungen in Feature-YAMLs. Tests werden dort im Abschnitt `# tests` einer laufbezogenen `plan.md` geplant und als Dart-Tests unter `test/integration/` umgesetzt. Eine entsprechende dauerhafte dritte YAML-Testfallsammlung wurde in der bisherigen Sichtung nicht gefunden.

Unsere bewusste Erweiterung ist die gemeinsame Bereichsdatei mit getrennten Listen `specs`, `decisions`, `tests`, eindeutigen Typ-Präfixen und dauerhaft verständlichen Testfalldefinitionen für Menschen und KI. Das ist ein eigenes Format; das Here2BuildApps-Schema kann dafür nicht unverändert verwendet werden.

Die Testfallstruktur orientiert sich an [klassischen Testfallvorlagen mit Voraussetzungen, Schritten und erwarteten Ergebnissen](https://support.testrail.com/hc/en-us/articles/14927678348052-Test-case-templates). Die Szenariostruktur nutzt die bekannte [Given/When/Then-Idee](https://cucumber.io/docs/gherkin/reference/). Unser YAML ist weder Gherkin-Syntax noch ein behaupteter Industriestandard.

---

Vom Chat „MCP - Berater“ im Auftrag von MM erstellt. Dieses Übergabedokument wurde noch nicht als neue Arbeitsanweisung an die Entwicklungsleitung versandt und ändert selbst keine Regeln in Fachrepositories.
