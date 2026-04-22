#Requires -Version 5.1
<#
.SYNOPSIS
    W Gift Full Deploy Script (Go Architecture)
.DESCRIPTION
    Builds and packages: client, admin, Go API server
.PARAMETER Target
    all (default), client, admin, api
.PARAMETER SkipInstall
    Skip pnpm install
.EXAMPLE
    .\scripts\deploy-all.ps1
    .\scripts\deploy-all.ps1 -Target api -SkipInstall
#>

param(
    [ValidateSet("all", "client", "admin", "api")]
    [string]$Target = "all",
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$deployDir = Join-Path $ProjectRoot "deploy"

function Write-Step { param([string]$S, [string]$M); Write-Host "`n[$S] $M" -ForegroundColor Cyan; Write-Host ("=" * 60) -ForegroundColor DarkGray }
function Write-Ok { param([string]$M); Write-Host "  [OK] $M" -ForegroundColor Green }
function Write-Fail { param([string]$M); Write-Host "  [FAIL] $M" -ForegroundColor Red }
function Test-Tool { param([string]$N); return [bool](Get-Command $N -ErrorAction SilentlyContinue) }

$buildClient = $Target -eq "all" -or $Target -eq "client"
$buildAdmin  = $Target -eq "all" -or $Target -eq "admin"
$buildApi    = $Target -eq "all" -or $Target -eq "api"

Write-Host ""
Write-Host "=== Seedream Gift Deploy Build (Target: $Target) ===" -ForegroundColor Cyan
Write-Host "  Server A (103.97.209.205): client + admin (nginx static)" -ForegroundColor DarkGray
Write-Host "  Server B (103.97.209.194): Go API (NSSM: SeedreamGiftAPI)" -ForegroundColor DarkGray
Write-Host "  Server C (103.97.209.131): MSSQL (SEEDREAM_GIFT_DB)" -ForegroundColor DarkGray
Write-Host ""

# --- Preflight ---
Write-Step "1" "Preflight Check"
if (-not (Test-Tool "pnpm")) { Write-Fail "pnpm not found"; exit 1 }
Write-Ok "pnpm"
if ($buildApi -and -not (Test-Tool "go")) { Write-Fail "go not found"; exit 1 }
if ($buildApi) { Write-Ok "go" }
New-Item -ItemType Directory -Force -Path $deployDir | Out-Null

# --- Install ---
if (-not $SkipInstall) {
    Write-Step "2" "Install Dependencies"
    pnpm install --frozen-lockfile 2>$null
    if ($LASTEXITCODE -ne 0) { pnpm install }
    Write-Ok "Dependencies installed"
} else {
    Write-Step "2" "Install (Skipped)"
}

# --- Client Build ---
if ($buildClient) {
    Write-Step "3a" "Client Build (seedreamgift.com)"
    # 이전 빌드 잔여물 제거 (캐시 오염 방지)
    if (Test-Path "client\dist") { Remove-Item "client\dist" -Recurse -Force }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    pnpm --filter client build
    if ($LASTEXITCODE -ne 0) { throw "Client build failed" }
    $sw.Stop()
    Write-Host "  -> vite build: $($sw.Elapsed.TotalSeconds.ToString('F1'))s" -ForegroundColor DarkGray

    Write-Ok "client built"
}

# --- Admin Build (통합: client/dist/seedream_admin_portal/ 에 병합) ---
if ($buildAdmin) {
    Write-Step "3b" "Admin Build (seedreamgift.com/seedream_admin_portal/)"
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    pnpm --filter admin build
    if ($LASTEXITCODE -ne 0) { throw "Admin build failed" }
    $sw.Stop()
    Write-Host "  -> vite build: $($sw.Elapsed.TotalSeconds.ToString('F1'))s" -ForegroundColor DarkGray

    # Admin dist → Client dist/seedream_admin_portal/ 에 병합
    $adminTarget = "client\dist\seedream_admin_portal"
    if (Test-Path $adminTarget) { Remove-Item $adminTarget -Recurse -Force }
    Copy-Item -Path "admin\dist" -Destination $adminTarget -Recurse -Force
    Write-Ok "admin merged into client\dist\seedream_admin_portal\"
}

# --- Package client + admin (통합 ZIP) ---
if ($buildClient -or $buildAdmin) {
    Write-Step "3c" "Package Frontend (client + admin)"
    $clientZip = "client-$timestamp.zip"
    Compress-Archive -Path "client\dist\*" -DestinationPath "$deployDir\$clientZip" -Force
    $s = [math]::Round((Get-Item "$deployDir\$clientZip").Length / 1MB, 1)
    Write-Ok "frontend: $clientZip - ${s} MB (admin 포함)"
}

# --- Go API Build (Wails) ---
if ($buildApi) {
    Write-Step "4" "Go API Build via Wails (api.seedreamgift.com)"
    Set-Location "$ProjectRoot\go-server"

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $version = "2.1.0"
    wails build -platform windows/amd64 -ldflags "-s -w -X main.Version=$version"
    if ($LASTEXITCODE -ne 0) { throw "Wails build failed" }
    $sw.Stop()
    # Wails outputs to build/bin/
    $binPath = "build\bin\seedream-api.exe"
    if (-not (Test-Path $binPath)) {
        # Fallback: Wails may output with project name
        $binPath = Get-ChildItem "build\bin\*.exe" | Select-Object -First 1 -ExpandProperty FullName
    }
    $binSize = [math]::Round((Get-Item $binPath).Length / 1MB, 1)
    Write-Host "  -> wails build: $($sw.Elapsed.TotalSeconds.ToString('F1'))s (${binSize} MB)" -ForegroundColor DarkGray

    # Stage
    $stageDir = "build\stage"
    if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $stageDir | Out-Null
    New-Item -ItemType Directory -Force -Path "$stageDir\logs" | Out-Null
    Copy-Item $binPath "$stageDir\seedream-api.exe" -Force
    if (Test-Path ".env.production") { Copy-Item ".env.production" "$stageDir\.env" -Force }

    $apiZip = "api-$timestamp.zip"
    Compress-Archive -Path "$stageDir\*" -DestinationPath "$deployDir\$apiZip" -Force
    Remove-Item $stageDir -Recurse -Force
    $s = [math]::Round((Get-Item "$deployDir\$apiZip").Length / 1MB, 1)
    Write-Ok "api: $apiZip - ${s} MB"
    Set-Location $ProjectRoot
}

# --- Cleanup old packages ---
Write-Step "5" "Cleanup Old Packages"
foreach ($prefix in @("client-", "admin-", "api-")) {
    $old = Get-ChildItem "$deployDir\$prefix*.zip" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -Skip 3
    foreach ($f in $old) { Remove-Item $f.FullName -Force; Write-Host "  Deleted: $($f.Name)" -ForegroundColor DarkGray }
}
Write-Ok "Cleanup done"

# --- Summary ---
Write-Host ""
Write-Host "=== Build Complete ===" -ForegroundColor Green
Write-Host ""
if ($buildClient) { Write-Host "  deploy\$clientZip" -ForegroundColor Cyan }
if ($buildAdmin)  { Write-Host "  deploy\$adminZip" -ForegroundColor Cyan }
if ($buildApi)    { Write-Host "  deploy\$apiZip" -ForegroundColor Cyan }
Write-Host ""
Write-Host "--- Server A (103.97.209.205) ---" -ForegroundColor Yellow
if ($buildClient -or $buildAdmin) {
    Write-Host "  Expand-Archive client-*.zip -Dest C:\deploy-server\seedream-gift\client -Force" -ForegroundColor DarkGray
    Write-Host "  (client + admin 통합 ZIP, nginx 재시작 불필요)" -ForegroundColor DarkGray
    Write-Host "  Admin URL: https://seedreamgift.com/seedream_admin_portal/" -ForegroundColor DarkGray
}
Write-Host ""
if ($buildApi) {
    Write-Host "--- Server B (103.97.209.194) ---" -ForegroundColor Yellow
    Write-Host "  nssm stop SeedreamGiftAPI" -ForegroundColor DarkGray
    Write-Host "  Expand-Archive api-*.zip -Dest C:\deploy-server\seedream-api -Force" -ForegroundColor DarkGray
    Write-Host "  nssm start SeedreamGiftAPI" -ForegroundColor DarkGray
    Write-Host "  curl https://api.seedreamgift.com/health" -ForegroundColor DarkGray
}
Write-Host ""
