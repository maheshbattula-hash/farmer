$ErrorActionPreference = "Stop"

$connections = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $connections) {
  try {
    Stop-Process -Id $processId -Force -ErrorAction Stop
  } catch {
    Write-Host ("Skipping PID {0}: {1}" -f $processId, $_.Exception.Message)
  }
}

npm --workspace apps/mobile run start:tunnel
