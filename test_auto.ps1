param(
  [string]$Query = "cam=3",
  [string]$OutName = "screenshot_auto_cockpit.png"
)
# Startet Edge im Headless-WebGL-Modus, prüft die Kamera/Fahrphysik/Lara-Croft und speichert den Screenshot
$edge = @("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe","C:\Program Files\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$shot = "C:\Users\Markus\.gemini\antigravity\brain\1c19476e-1808-4bdf-b72c-9116af9b0e6c\$OutName"
$err  = "C:\Users\Markus\.gemini\antigravity\brain\1c19476e-1808-4bdf-b72c-9116af9b0e6c\scratch\console_auto.log"
$prof = "$env:TEMP\eep_auto_$([guid]::NewGuid().ToString('N').Substring(0,8))"

Remove-Item $shot -ErrorAction SilentlyContinue
Remove-Item $err -ErrorAction SilentlyContinue

$args = @(
  "--headless=new",
  "--window-size=1440,900",
  "--no-first-run",
  "--no-default-browser-check",
  "--enable-webgl",
  "--ignore-gpu-blocklist",
  "--enable-logging=stderr",
  "--v=0",
  "--virtual-time-budget=9000",
  "--user-data-dir=$prof",
  "--screenshot=$shot",
  "http://localhost:8080/welt.html?$Query"
)

$p = Start-Process -FilePath $edge -ArgumentList $args -RedirectStandardError $err -PassThru -WindowStyle Hidden
$p.WaitForExit(35000) | Out-Null
Remove-Item -Recurse -Force $prof -ErrorAction SilentlyContinue

if (Test-Path $shot) {
  Write-Host "SCREENSHOT_OK: $shot ($((Get-Item $shot).Length) bytes)"
} else {
  Write-Host "SCREENSHOT_FAILED"
}

Write-Host "=== AUTO-COCKPIT TEST & CONSOLE LOGS ==="
if (Test-Path $err) {
  Get-Content $err | Select-String -Pattern "AUTO_TEST|LARA_TEST|VEHICLE_TEST|AFRIKA_TEST|GPU_HARDWARE_INFO|Uncaught|ReferenceError|TypeError|SyntaxError" | ForEach-Object { $_.Line }
}
