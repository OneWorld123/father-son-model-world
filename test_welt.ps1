# Startet Edge mit echtem WebGL, schiesst einen Screenshot von welt.html und liest alle Console/JS-Logs aus.
$edge = @("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe","C:\Program Files\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$shot = "C:\Users\Markus\.gemini\antigravity\brain\1c19476e-1808-4bdf-b72c-9116af9b0e6c\screenshot_welt.png"
$err  = "C:\Users\Markus\.gemini\antigravity\brain\1c19476e-1808-4bdf-b72c-9116af9b0e6c\scratch\console.log"
$prof = "$env:TEMP\eep_shot_$([guid]::NewGuid().ToString('N').Substring(0,8))"

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
  "http://localhost:8080/welt.html"
)

$p = Start-Process -FilePath $edge -ArgumentList $args -RedirectStandardError $err -PassThru -WindowStyle Hidden
$p.WaitForExit(35000) | Out-Null
Remove-Item -Recurse -Force $prof -ErrorAction SilentlyContinue

if (Test-Path $shot) {
  Write-Host "SCREENSHOT_OK: $shot ($((Get-Item $shot).Length) bytes)"
} else {
  Write-Host "SCREENSHOT_FAILED"
}

Write-Host "=== CONSOLE LOGS ==="
if (Test-Path $err) {
  Get-Content $err | Select-String -Pattern "CONSOLE|Uncaught|Error|WARN" | Where-Object { $_.Line -notmatch "fallback_task_provider|external_registry_loader|edge_elevation" } | ForEach-Object { $_.Line }
}
