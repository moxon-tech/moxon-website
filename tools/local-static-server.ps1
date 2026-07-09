param(
  [int]$Port = 5500,
  [string]$Root = (Get-Location).Path
)

try {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
  $listener.Start()
  Write-Host "Server đang chạy tại http://localhost:$Port" -ForegroundColor Green
  Write-Host "Nhấn Ctrl+C để dừng server." -ForegroundColor Yellow
} catch {
  Write-Host "LỖI: Không thể khởi chạy server tại cổng $Port." -ForegroundColor Red
  Write-Host "Cổng $Port có thể đã bị chiếm dụng bởi một ứng dụng khác (như Live Server của VS Code hoặc một cửa sổ PowerShell khác đang chạy script này)." -ForegroundColor Yellow
  Write-Host "Hãy đóng ứng dụng đang dùng cổng $Port hoặc chạy lại lệnh với cổng khác (Ví dụ: -Port 5501)." -ForegroundColor Green
  exit
}

$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".svg" = "image/svg+xml"
  ".ico" = "image/x-icon"
}

function Send-Response($stream, [int]$statusCode, [string]$statusText, [byte[]]$body, [string]$contentType) {
  $header = "HTTP/1.1 $statusCode $statusText`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($body.Length -gt 0) {
    $stream.Write($body, 0, $body.Length)
  }
}

while ($true) {
  $client = $null
  try {
    $client = $listener.AcceptTcpClient()
  } catch {
    Write-Host "Server dừng kết nối." -ForegroundColor Red
    break
  }
  try {
    $stream = $client.GetStream()
    $buffer = New-Object byte[] 8192
    $read = $stream.Read($buffer, 0, $buffer.Length)
    if ($read -le 0) {
      $client.Close()
      continue
    }

    $request = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $read)
    $firstLine = ($request -split "`r?`n")[0]
    $parts = $firstLine -split " "
    if ($parts.Length -lt 2 -or $parts[0] -ne "GET") {
      Send-Response $stream 405 "Method Not Allowed" ([System.Text.Encoding]::UTF8.GetBytes("Method Not Allowed")) "text/plain; charset=utf-8"
      $client.Close()
      continue
    }

    $pathOnly = ($parts[1] -split "\?")[0].TrimStart("/")
    $requestPath = [Uri]::UnescapeDataString($pathOnly)
    if ([string]::IsNullOrWhiteSpace($requestPath)) {
      $requestPath = "index.html"
    }

    $target = [System.IO.Path]::GetFullPath((Join-Path $Root $requestPath))
    $rootFull = [System.IO.Path]::GetFullPath($Root)
    if (-not $target.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
      Send-Response $stream 403 "Forbidden" ([System.Text.Encoding]::UTF8.GetBytes("Forbidden")) "text/plain; charset=utf-8"
      $client.Close()
      continue
    }

    if ([System.IO.Directory]::Exists($target)) {
      $target = Join-Path $target "index.html"
    }

    if (-not [System.IO.File]::Exists($target)) {
      Send-Response $stream 404 "Not Found" ([System.Text.Encoding]::UTF8.GetBytes("Not found")) "text/plain; charset=utf-8"
      $client.Close()
      continue
    }

    $ext = [System.IO.Path]::GetExtension($target).ToLowerInvariant()
    $contentType = if ($contentTypes.ContainsKey($ext)) { $contentTypes[$ext] } else { "application/octet-stream" }
    Send-Response $stream 200 "OK" ([System.IO.File]::ReadAllBytes($target)) $contentType
  } catch {
    try {
      Send-Response $stream 500 "Internal Server Error" ([System.Text.Encoding]::UTF8.GetBytes("Internal Server Error")) "text/plain; charset=utf-8"
    } catch {}
  } finally {
    $client.Close()
  }
}
