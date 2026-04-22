<#
.SYNOPSIS
    Go Server 빌드 + 배포 패키지 생성
.DESCRIPTION
    Wails 빌드로 단일 exe 생성 (HEADLESS 환경변수로 모드 전환)
    - 프로덕션: HEADLESS=true → API 서버만 실행
    - 로컬 관리: HEADLESS 미설정 → GUI 관리 콘솔 + API 서버
.EXAMPLE
    .\scripts\deploy-go-server.ps1
#>

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$rootDir = Split-Path -Parent $PSScriptRoot
$goDir = "$rootDir\go-server"
$deployDir = "$rootDir\deploy"

$version = "2.1.0"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Go Server Deploy Package Builder (Wails)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $goDir

# ── 1. Wails 빌드 ──
Write-Host "[1/4] Wails build..." -ForegroundColor Yellow
$sw = [System.Diagnostics.Stopwatch]::StartNew()
wails build -platform windows/amd64 -ldflags "-s -w -X main.Version=$version"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] Wails build failed!" -ForegroundColor Red
    exit 1
}
$sw.Stop()

$binPath = "build\bin\wgift-api.exe"
if (-not (Test-Path $binPath)) {
    $binPath = Get-ChildItem "build\bin\*.exe" | Select-Object -First 1 -ExpandProperty FullName
}
$binSize = [math]::Round((Get-Item $binPath).Length / 1MB, 1)
Write-Host "[OK] wgift-api.exe: ${binSize} MB ($($sw.Elapsed.TotalSeconds.ToString('F1'))s)" -ForegroundColor Green

# ── 2. 패키지 구성 ──
Write-Host "[2/4] Preparing package..." -ForegroundColor Yellow
$stageDir = "$goDir\build\stage"
if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null
New-Item -ItemType Directory -Force -Path "$stageDir\logs" | Out-Null

Copy-Item $binPath "$stageDir\wgift-api.exe" -Force
if (Test-Path ".env.production") { Copy-Item ".env.production" "$stageDir\.env" -Force }
Write-Host "[OK] Package contents ready" -ForegroundColor Green

# ── 3. ZIP 생성 ──
Write-Host "[3/4] Creating ZIP..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $deployDir | Out-Null
$zipName = "api-$timestamp.zip"
$zipPath = "$deployDir\$zipName"

Compress-Archive -Path "$stageDir\*" -DestinationPath $zipPath -Force
$zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Remove-Item $stageDir -Recurse -Force
Write-Host "[OK] Package: $zipName (${zipSize} MB)" -ForegroundColor Green

# ── 4. 이전 패키지 정리 ──
Write-Host "[4/4] Cleanup..." -ForegroundColor Yellow
$old = Get-ChildItem "$deployDir\api-*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 3
foreach ($f in $old) { Remove-Item $f.FullName -Force; Write-Host "  Deleted: $($f.Name)" -ForegroundColor DarkGray }

# 이전 빌드 잔여물 정리 (build/ 루트의 exe 파일)
Get-ChildItem "$goDir\build\*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item $_.FullName -Force
    Write-Host "  Cleaned: $($_.Name)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Go Server Package Ready!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Package: deploy\$zipName" -ForegroundColor White
Write-Host "  Size:    ${zipSize} MB" -ForegroundColor White
Write-Host ""
Write-Host "  ZIP contains:" -ForegroundColor Yellow
Write-Host "    wgift-api.exe  <- 단일 exe (HEADLESS=true 로 서버 모드)" -ForegroundColor DarkGray
Write-Host "    .env           <- Production config" -ForegroundColor DarkGray
Write-Host "    logs/          <- Empty log directory" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Deploy (Server B):" -ForegroundColor Yellow
Write-Host "    nssm stop WowGiftAPI" -ForegroundColor DarkGray
Write-Host "    Expand-Archive api-*.zip -Dest C:\deploy-server\wgift-api -Force" -ForegroundColor DarkGray
Write-Host "    nssm start WowGiftAPI" -ForegroundColor DarkGray
Write-Host ""

Set-Location $rootDir
