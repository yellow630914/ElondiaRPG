# ElondiaRPG local launcher (Windows).
# Serves the "game" folder at http://localhost:8473/ and opens the browser.
# Saves live in the browser and belong to this address, so the port stays fixed.
# Close this window to stop the server.

$ErrorActionPreference = 'Stop'
$port = 8473
$url = "http://localhost:$port/"
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'game')).TrimEnd('\') + '\'
if (-not (Test-Path -LiteralPath (Join-Path $root 'index.html'))) {
  Write-Host "Cannot find game\index.html next to this script. Please unzip the whole folder first."
  Read-Host 'Press Enter to close'
  exit 1
}

$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.txt' = 'text/plain; charset=utf-8'
  '.map' = 'application/json'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'
  '.gif' = 'image/gif'; '.webp' = 'image/webp'; '.ico' = 'image/x-icon'; '.woff' = 'font/woff'; '.woff2' = 'font/woff2'
  '.ttf' = 'font/ttf'; '.otf' = 'font/otf'; '.wasm' = 'application/wasm'; '.mp3' = 'audio/mpeg'; '.ogg' = 'audio/ogg'
  '.wav' = 'audio/wav'; '.mp4' = 'video/mp4'; '.webm' = 'video/webm'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)
try {
  $listener.Start()
} catch {
  # Usually the game is already running in another window: just open it.
  Write-Host "Port $port is busy (the game may already be running). Opening $url"
  Start-Process $url
  Start-Sleep -Seconds 2
  exit 0
}

Write-Host "ElondiaRPG is running at $url"
Write-Host 'Keep this window open while playing. Close it to stop the game server.'
Start-Process $url

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ($rel -eq '' -or $rel.EndsWith('/')) { $rel = $rel + 'index.html' }
      $path = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
      if (-not $path.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $path -PathType Leaf)) {
        $res.StatusCode = 404
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not found')
      } else {
        $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
        $type = $mime[$ext]
        if (-not $type) { $type = 'application/octet-stream' }
        $res.ContentType = $type
        $res.AddHeader('Cache-Control', 'no-cache')
        $bytes = [System.IO.File]::ReadAllBytes($path)
      }
      if ($ctx.Request.HttpMethod -ne 'HEAD') {
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      }
    } catch {
      # The browser closed the connection early; ignore.
    } finally {
      try { $res.Close() } catch {}
    }
  }
} finally {
  $listener.Stop()
}
