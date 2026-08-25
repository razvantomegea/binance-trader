# Requires Docker Desktop. Starts local Postgres, then the Next.js server.
param(
  [ValidateSet("dev", "start")]
  [string]$Mode = "dev"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Starting Docker Postgres..."
docker compose up -d

Write-Host "Waiting for Postgres health..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  $status = docker compose ps --format json 2>$null | ConvertFrom-Json
  if ($status.Health -eq "healthy") {
    $ready = $true
    break
  }
  Start-Sleep -Seconds 1
}

if (-not $ready) {
  Write-Warning "Postgres may still be starting; continuing anyway."
}

if (-not (Test-Path ".env.local")) {
  Write-Host "No .env.local found. Copying .env.example -> .env.local"
  Copy-Item ".env.example" ".env.local"
}

Write-Host "Ensuring web push VAPID keys..."
pnpm exec tsx scripts/ensure-vapid-keys.ts

if ($Mode -eq "dev") {
  Write-Host "Starting Next.js (pnpm dev) with in-process scheduler..."
  pnpm dev
} else {
  Write-Host "Building and starting Next.js (pnpm build && pnpm start)..."
  pnpm build
  pnpm start
}
