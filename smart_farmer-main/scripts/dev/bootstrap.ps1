$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example"
}

if (-not (Test-Path "apps/mobile/.env")) {
    Copy-Item "apps/mobile/.env.example" "apps/mobile/.env"
    Write-Host "Created apps/mobile/.env from apps/mobile/.env.example"
}

npm install --workspaces --include-workspace-root

Write-Host "Bootstrap complete. Next steps:"
Write-Host "1. Make sure MongoDB is running on mongodb://127.0.0.1:27017"
Write-Host "2. Start API, web, and mobile terminals"
