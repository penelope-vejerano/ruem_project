$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://127.0.0.1:8767/')
$listener.Start()
Write-Output "serving $root on 8767"
$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.svg' = 'image/svg+xml'
  '.json' = 'application/json'
  '.woff2' = 'font/woff2'
}
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $p = [Uri]::UnescapeDataString($ctx.Request.Url.LocalPath)
  if ($p -eq '/') { $p = '/main.html' }
  $file = Join-Path $root (($p.TrimStart('/') -replace '/', '\'))
  if ((Test-Path $file -PathType Leaf) -and $file.StartsWith($root)) {
    $bytes = [IO.File]::ReadAllBytes($file)
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $ctx.Response.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' })
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $ctx.Response.StatusCode = 404
  }
  $ctx.Response.Close()
}
