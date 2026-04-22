<#
.SYNOPSIS
    Admin 단독 빌드 + Client dist에 병합
.DESCRIPTION
    Admin만 재빌드하여 기존 client/dist/seedream_admin_portal/에 병합합니다.
    Client를 재빌드하지 않으므로 Admin만 수정했을 때 빠르게 배포 가능.
    주의: client/dist/가 이미 존재해야 합니다 (먼저 client 빌드 필요).
#>

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$rootDir = Split-Path -Parent $PSScriptRoot
$clientDir = "$rootDir\client"
$adminDir = "$rootDir\admin"
$deployDir = "$rootDir\deploy"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Admin Only Build (merge into client/dist)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check client dist exists
if (-not (Test-Path "$clientDir\dist\index.html")) {
    Write-Host "[FAIL] client/dist/ not found. Run client build first:" -ForegroundColor Red
    Write-Host "  pnpm --filter client build" -ForegroundColor Yellow
    exit 1
}

# 1. Admin Build
Write-Host "[1/3] Building admin..." -ForegroundColor Yellow
Set-Location $adminDir
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Admin build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Admin built" -ForegroundColor Green

# 2. Merge
Write-Host "[2/3] Merging into client/dist/seedream_admin_portal/..." -ForegroundColor Yellow
$adminTarget = "$clientDir\dist\seedream_admin_portal"
if (Test-Path $adminTarget) { Remove-Item $adminTarget -Recurse -Force }
Copy-Item -Path "$adminDir\dist" -Destination $adminTarget -Recurse -Force
Write-Host "[OK] Merged" -ForegroundColor Green

# 3. Re-package
Write-Host "[3/3] Re-packaging..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $deployDir | Out-Null
$zipName = "client-$timestamp.zip"
$zipPath = "$deployDir\$zipName"
Compress-Archive -Path "$clientDir\dist\*" -DestinationPath $zipPath -Force
$size = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "[OK] Package: $zipName ($size MB)" -ForegroundColor Green

Set-Location $rootDir
Write-Host ""
Write-Host "  Deploy: Expand-Archive client-*.zip -Dest C:\deploy-server\seedream-gift\client -Force" -ForegroundColor DarkGray
Write-Host "  Admin URL: https://seedreamgift.com/seedream_admin_portal/" -ForegroundColor White
Write-Host ""
