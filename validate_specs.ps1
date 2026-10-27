# Form- und Semantikprüfung für specs/*.yaml gemäß Abschnitt 11 (docs/specs-decisions-tests.md, Stand 27.10.2026)
$ErrorActionPreference = "Stop"
$specsDir = Join-Path $PSScriptRoot "specs"
$files = Get-ChildItem -Path $specsDir -Filter "*.yaml"
$errors = @()
$warnings = @()
$allSpecIds = @{}
$allDecisionIds = @{}
$allTestIds = @{}
$specRefsToCheck = @()
$supersededRefsToCheck = @()

foreach ($f in $files) {
  $stem = $f.BaseName
  $lines = Get-Content $f.FullName
  $text = $lines -join "`n"

  # 11.1 Pflichtfelder im Dateikopf & verbotene Bereichsnamen
  if ($stem -eq "cross-cutting") { $errors += "$($f.Name): Dateiname 'cross-cutting.yaml' ist verboten; verwende 'global.yaml'." }
  if ($text -notmatch "(?m)^schema_version:\s*1\s*$") { $errors += "$($f.Name): Pflichtfeld 'schema_version: 1' fehlt." }
  if ($text -notmatch "(?m)^area:\s*$([regex]::Escape($stem))\s*$") { $errors += "$($f.Name): 'area' muss exakt dem Dateistamm '$stem' entsprechen." }
  if ($text -notmatch "(?m)^title:\s*\S+") { $errors += "$($f.Name): Pflichtfeld 'title' fehlt." }
  if ($text -notmatch "(?m)^specs:") { $errors += "$($f.Name): Pflichtfeld 'specs' fehlt." }
  if ($text -notmatch "(?m)^decisions:") { $errors += "$($f.Name): Pflichtfeld 'decisions' fehlt." }
  if ($text -notmatch "(?m)^tests:") { $errors += "$($f.Name): Pflichtfeld 'tests' fehlt." }

  # Abschnitt 10: Keine Prüfnachweise (passed / timestamp) in Bereichsdateien
  if ($text -match "(?m)^\s*passed\s*:") { $errors += "$($f.Name): Laufzeit-Ergebnis 'passed' darf nicht in Bereichs-YAML stehen." }

  # 11.2 IDs und Typ-Präfixe prüfen
  [regex]::Matches($text, "(?m)^\s*-\s*id:\s*(\S+)") | ForEach-Object {
    $id = $_.Groups[1].Value
    if ($id -match "^s-([a-z0-9-]+)-\d{3,}$") {
      if ($allSpecIds.ContainsKey($id)) { $errors += "$($f.Name): Doppelte Spec-ID '$id'." }
      $allSpecIds[$id] = $f.Name
    } elseif ($id -match "^d-([a-z0-9-]+)-\d{3,}$") {
      if ($allDecisionIds.ContainsKey($id)) { $errors += "$($f.Name): Doppelte Decision-ID '$id'." }
      $allDecisionIds[$id] = $f.Name
    } elseif ($id -match "^t-([a-z0-9-]+)-\d{3,}$") {
      if ($allTestIds.ContainsKey($id)) { $errors += "$($f.Name): Doppelte Test-ID '$id'." }
      $allTestIds[$id] = $f.Name
    } else {
      $errors += "$($f.Name): Ungültiges ID-Format '$id' (erwartet <s|d|t>-<area>-<NNN>)."
    }
  }

  # 11.3 & 11.4 Status, Risk, Suites, Superseded_by und Automation-Pfade prüfen
  [regex]::Matches($text, "(?m)^\s*status:\s*(\S+)") | ForEach-Object {
    $st = $_.Groups[1].Value
    if ($st -notin @("proposed", "accepted", "superseded")) { $errors += "$($f.Name): Ungültiger Decision-Status '$st'." }
  }
  [regex]::Matches($text, "(?m)^\s*superseded_by:\s*(\S+)") | ForEach-Object {
    $sb = $_.Groups[1].Value.Trim()
    if ($sb) { $supersededRefsToCheck += [PSCustomObject]@{ File = $f.Name; Ref = $sb } }
  }
  [regex]::Matches($text, "(?m)^\s*risk:\s*(\S+)") | ForEach-Object {
    $rk = $_.Groups[1].Value
    if ($rk -notin @("low", "medium", "high")) { $errors += "$($f.Name): Ungültiger Risk-Wert '$rk'." }
  }
  [regex]::Matches($text, "(?m)^\s*suites:\s*\[([^\]]*)\]") | ForEach-Object {
    $suites = $_.Groups[1].Value -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
    if ($suites.Count -eq 0) { $errors += "$($f.Name): 'suites' darf nicht leer sein." }
    foreach ($su in $suites) {
      if ($su -notin @("smoke", "regression")) { $errors += "$($f.Name): Unbekannter Suite-Wert '$su' (erlaubt: smoke, regression)." }
    }
  }
  [regex]::Matches($text, "(?m)^\s*path:\s*(\S+)") | ForEach-Object {
    $p = $_.Groups[1].Value
    $fullP = Join-Path $PSScriptRoot $p
    if (-not (Test-Path $fullP)) { $errors += "$($f.Name): Automation-Pfad '$p' existiert nicht." }
  }
  [regex]::Matches($text, "(?m)^\s*specs:\s*\[([^\]]+)\]") | ForEach-Object {
    $refs = $_.Groups[1].Value -split "," | ForEach-Object { $_.Trim() }
    foreach ($r in $refs) {
      if ($r) { $specRefsToCheck += [PSCustomObject]@{ File = $f.Name; Ref = $r } }
    }
  }

  # 11.5 Fehlende Aktionen oder leere Ergebniserwartungen in Testschritten
  if ($text -match "(?m)^\s*-\s*action:\s*$") { $errors += "$($f.Name): Leeres 'action:'-Feld in einem Testschritt." }
  if ($text -match "(?m)^\s*expected:\s*\[\s*\]") { $errors += "$($f.Name): Leere 'expected: []'-Liste in einem Testschritt." }

  # Inhaltlicher Lint (Abschnitt 5.2 & 11): Keine Three.js-Geometrien / Dateikommentare in specs-Sektion
  $specsBlock = ($text -split "(?m)^decisions:")[0]
  if ($specsBlock -match "PlaneGeometry|InstancedMesh|ConeGeometry|DoubleSide|BackSide") {
    $warnings += "$($f.Name): [Semantik 5.2] 'specs' enthält konkrete 3D-Geometrie-/Materialklassen (gehört in 'decisions/how')."
  }
  $testsBlock = ($text -split "(?m)^tests:")[1]
  if ($testsBlock -match "Ok=true") {
    $warnings += "$($f.Name): [Semantik 5.4] 'tests' referenziert interne '...Ok=true'-Flags statt fachlicher Beobachtungen."
  }
}

foreach ($item in $specRefsToCheck) {
  if (-not $allSpecIds.ContainsKey($item.Ref)) {
    $errors += "$($item.File): Nicht auflösbarer Spec-Verweis '$($item.Ref)'."
  }
}
foreach ($item in $supersededRefsToCheck) {
  if (-not $allDecisionIds.ContainsKey($item.Ref)) {
    $errors += "$($item.File): Nicht auflösbarer superseded_by-Verweis '$($item.Ref)'."
  }
}

if ($warnings.Count -gt 0) {
  Write-Host "YAML_SEMANTIC_WARNINGS ($($warnings.Count)):"
  $warnings | ForEach-Object { Write-Host " ! $_" }
}

if ($errors.Count -gt 0) {
  Write-Host "YAML_VALIDATION_FAILED:"
  $errors | ForEach-Object { Write-Host " - $_" }
  exit 1
} else {
  Write-Host "YAML_VALIDATION_OK: $($files.Count) Bereichsdatei(en), $($allSpecIds.Count) Specs, $($allDecisionIds.Count) Decisions, $($allTestIds.Count) Tests erfolgreich geprüft."
}
