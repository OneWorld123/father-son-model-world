# Formprüfung für specs/*.yaml gemäß Abschnitt 11 (2026-10-24-development-lead-specs-decisions-tests.md)
$ErrorActionPreference = "Stop"
$specsDir = Join-Path $PSScriptRoot "specs"
$files = Get-ChildItem -Path $specsDir -Filter "*.yaml"
$errors = @()
$allSpecIds = @{}
$allDecisionIds = @{}
$allTestIds = @{}
$specRefsToCheck = @()

foreach ($f in $files) {
  $stem = $f.BaseName
  $lines = Get-Content $f.FullName
  $text = $lines -join "`n"

  if ($text -notmatch "(?m)^schema_version:\s*1\s*$") { $errors += "$($f.Name): Pflichtfeld 'schema_version: 1' fehlt." }
  if ($text -notmatch "(?m)^area:\s*$([regex]::Escape($stem))\s*$") { $errors += "$($f.Name): 'area' muss exakt dem Dateistamm '$stem' entsprechen." }
  if ($text -notmatch "(?m)^title:\s*\S+") { $errors += "$($f.Name): Pflichtfeld 'title' fehlt." }
  if ($text -notmatch "(?m)^specs:") { $errors += "$($f.Name): Pflichtfeld 'specs' fehlt." }
  if ($text -notmatch "(?m)^decisions:") { $errors += "$($f.Name): Pflichtfeld 'decisions' fehlt." }
  if ($text -notmatch "(?m)^tests:") { $errors += "$($f.Name): Pflichtfeld 'tests' fehlt." }

  # Keine Prüfnachweise (passed / timestamp) in Bereichsdateien
  if ($text -match "(?m)^\s*passed\s*:") { $errors += "$($f.Name): Laufzeit-Ergebnis 'passed' darf nicht in Bereichs-YAML stehen." }

  # IDs prüfen
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

  # Status, Risk, Suites und Automation-Pfade prüfen
  [regex]::Matches($text, "(?m)^\s*status:\s*(\S+)") | ForEach-Object {
    $st = $_.Groups[1].Value
    if ($st -notin @("proposed", "accepted", "superseded")) { $errors += "$($f.Name): Ungültiger Decision-Status '$st'." }
  }
  [regex]::Matches($text, "(?m)^\s*risk:\s*(\S+)") | ForEach-Object {
    $rk = $_.Groups[1].Value
    if ($rk -notin @("low", "medium", "high")) { $errors += "$($f.Name): Ungültiger Risk-Wert '$rk'." }
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
}

foreach ($item in $specRefsToCheck) {
  if (-not $allSpecIds.ContainsKey($item.Ref)) {
    $errors += "$($item.File): Nicht auflösbarer Spec-Verweis '$($item.Ref)'."
  }
}

if ($errors.Count -gt 0) {
  Write-Host "YAML_VALIDATION_FAILED:"
  $errors | ForEach-Object { Write-Host " - $_" }
  exit 1
} else {
  Write-Host "YAML_VALIDATION_OK: $($files.Count) Bereichsdatei(en), $($allSpecIds.Count) Specs, $($allDecisionIds.Count) Decisions, $($allTestIds.Count) Tests erfolgreich geprüft."
}
