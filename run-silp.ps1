<#
  run-silp.ps1 - runs the SILP First Communion Records app on your computer.

  Put this file in the SILP folder (the one with index.html), open PowerShell there, and run:
      .\run-silp.ps1
  Optional:
      .\run-silp.ps1 -Port 5500
      .\run-silp.ps1 -NoBrowser

  Why this is needed: the app uses JavaScript modules, which browsers block when index.html is
  opened by double-clicking. It must be opened from an address like http://localhost:8080.
  The app still needs internet (Supabase, fonts and export libraries load online).
  Press Ctrl+C to stop.
#>
param(
  [int]$Port = 8080,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

if (-not (Test-Path (Join-Path $root 'index.html'))) {
  Write-Host "index.html was not found in $root" -ForegroundColor Red
  Write-Host "Put this script inside the SILP folder and run it again." -ForegroundColor Red
  exit 1
}

$mime = @{
  '.html' = 'text/html; charset=utf-8';  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'; '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'
  '.svg'  = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.webp' = 'image/webp'
  '.xlsx' = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  '.woff' = 'font/woff'; '.woff2' = 'font/woff2'; '.txt' = 'text/plain; charset=utf-8'
}

$url = "http://localhost:$Port/"
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($url)

try {
  $listener.Start()
} catch {
  Write-Host "Could not start on port $Port. Another program may be using it." -ForegroundColor Red
  Write-Host "Try another port, for example:  .\run-silp.ps1 -Port 5500" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "SILP is running at $url" -ForegroundColor Green
Write-Host "Serving files from: $root"
Write-Host "Press Ctrl+C to stop."
Write-Host ""

if (-not $NoBrowser) { Start-Process $url }

try {
  while ($listener.IsListening) {
    # Wait in short steps so Ctrl+C can stop the script
    $task = $listener.GetContextAsync()
    while (-not $task.AsyncWaitHandle.WaitOne(300)) { }
    $ctx = $task.GetAwaiter().GetResult()
    $res = $ctx.Response

    try {
      $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }
      $path = [System.IO.Path]::GetFullPath((Join-Path $root $rel))

      # Never serve anything outside the project folder
      $inside = $path.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)
      if ($inside -and (Test-Path $path -PathType Container)) { $path = Join-Path $path 'index.html' }

      if ($inside -and (Test-Path $path -PathType Leaf)) {
        $ext = [System.IO.Path]::GetExtension($path).ToLower()
        $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $res.Headers.Add('Cache-Control', 'no-store')   # always show your latest edits
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        Write-Host ("200 " + $ctx.Request.Url.AbsolutePath)
      } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes('404 Not found')
        $res.OutputStream.Write($msg, 0, $msg.Length)
        Write-Host ("404 " + $ctx.Request.Url.AbsolutePath) -ForegroundColor Yellow
      }
    } catch {
      Write-Host ("Error: " + $_.Exception.Message) -ForegroundColor Red
    } finally {
      $res.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
  Write-Host "Stopped."
}
