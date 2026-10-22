# Selbsttest: laedt welt.html im Headless-Edge und prueft auf JS-Fehler + Steuerpult.
# Aufruf: powershell -ExecutionPolicy Bypass -File test_welt.ps1  (Server muss auf :8080 laufen)
$edge = @("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe","C:\Program Files\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$out = "$env:TEMP\eep_dom.html"; $err = "$env:TEMP\eep_err.txt"
$p = Start-Process -FilePath $edge -ArgumentList "--headless=new","--disable-gpu","--enable-logging=stderr","--v=0","--virtual-time-budget=8000","--user-data-dir=$env:TEMP\eep_profile","--dump-dom","http://localhost:8080/welt.html" -RedirectStandardOutput $out -RedirectStandardError $err -PassThru -WindowStyle Hidden
$p.WaitForExit(40000) | Out-Null
$cockpit = Select-String -Path $out -Pattern 'id="eep-cockpit"' -Quiet
$fehler = Select-String -Path $err -Pattern "Uncaught|SyntaxError|ReferenceError|TypeError" | Where-Object { $_.Line -match "localhost" }
if ($cockpit -and -not $fehler) { Write-Host "OK: Steuerpult geladen, keine JS-Fehler." }
else { Write-Host "FEHLER!"; if (-not $cockpit) { Write-Host "- Steuerpult fehlt" }; $fehler | ForEach-Object { Write-Host $_.Line } ; exit 1 }
