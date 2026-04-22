<#
.SYNOPSIS
    Client + Admin + Partner 통합 빌드 + 배포 패키지 생성
.DESCRIPTION
    Client Vite 빌드 → Admin Vite 빌드 → Partner Vite 빌드
    → Admin을 client/dist/wow_admin_portal/에 병합
    → Partner를 client/dist/wow_partner_portal/에 병합
    → ZIP 패키징. Server A에 단일 ZIP으로 배포
#>

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$rootDir = Split-Path -Parent $PSScriptRoot
$clientDir = "$rootDir\client"
$adminDir = "$rootDir\admin"
$partnerDir = "$rootDir\partner"
$deployDir = "$rootDir\deploy"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Frontend Deploy Package Builder (Client + Admin + Partner)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Client Build
Write-Host "[1/5] Building client..." -ForegroundColor Yellow
Set-Location $clientDir
if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Client build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Client built" -ForegroundColor Green

# 2. Admin Build
Write-Host "[2/5] Building admin..." -ForegroundColor Yellow
Set-Location $adminDir
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Admin build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Admin built" -ForegroundColor Green

# 3. Partner Build
Write-Host "[3/5] Building partner..." -ForegroundColor Yellow
Set-Location $partnerDir
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Partner build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Partner built" -ForegroundColor Green

# 4. Merge admin + partner into client
Write-Host "[4/5] Merging admin + partner into client/dist/..." -ForegroundColor Yellow

$adminTarget = "$clientDir\dist\wow_admin_portal"
if (Test-Path $adminTarget) { Remove-Item $adminTarget -Recurse -Force }
Copy-Item -Path "$adminDir\dist" -Destination $adminTarget -Recurse -Force
Write-Host "  Admin  → client/dist/wow_admin_portal/" -ForegroundColor DarkGray

$partnerTarget = "$clientDir\dist\wow_partner_portal"
if (Test-Path $partnerTarget) { Remove-Item $partnerTarget -Recurse -Force }
Copy-Item -Path "$partnerDir\dist" -Destination $partnerTarget -Recurse -Force
Write-Host "  Partner → client/dist/wow_partner_portal/" -ForegroundColor DarkGray

Write-Host "[OK] All merged" -ForegroundColor Green

# 5. Package
Write-Host "[5/5] Creating package..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $deployDir | Out-Null
$zipName = "client-$timestamp.zip"
$zipPath = "$deployDir\$zipName"

Compress-Archive -Path "$clientDir\dist\*" -DestinationPath $zipPath -Force
$size = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "[OK] Package: $zipName ($size MB)" -ForegroundColor Green

# Cleanup old packages (keep last 3)
$oldPackages = Get-ChildItem "$deployDir\client-*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 3
foreach ($old in $oldPackages) {
    Remove-Item $old.FullName -Force
    Write-Host "  Deleted: $($old.Name)" -ForegroundColor DarkGray
}

Set-Location $rootDir
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Frontend Package Ready! (Client + Admin + Partner)" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Package: deploy\$zipName" -ForegroundColor White
Write-Host "  Size:    $size MB" -ForegroundColor White
Write-Host ""
Write-Host "  Deploy to Server A (103.97.209.205):" -ForegroundColor Yellow
Write-Host "  1. Copy $zipName to Server A" -ForegroundColor White
Write-Host "  2. Expand-Archive client-*.zip -Dest C:\deploy-server\wow-gift\client -Force" -ForegroundColor White
Write-Host "  (nginx 재시작 불필요)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  URLs:" -ForegroundColor Yellow
Write-Host "    Client:  https://wowgift.co.kr" -ForegroundColor White
Write-Host "    Admin:   https://wowgift.co.kr/wow_admin_portal/" -ForegroundColor White
Write-Host "    Partner: https://wowgift.co.kr/wow_partner_portal/" -ForegroundColor White
Write-Host ""
