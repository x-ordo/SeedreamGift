# Users 테이블 스키마 점검 + IsDeleted 컬럼 추가
# 운영 DB (Server C / SEEDREAM_GIFT_DB) 에 .NET SqlClient 직접 연결

$server = "103.97.209.131,7335"
$db     = "SEEDREAM_GIFT_DB"
$user   = "dnflrhdwnghkdlxldsql"
$pass   = 'dnflrhdwnghkdlxld2024!@'

$cs = "Server=$server;Database=$db;User Id=$user;Password=$pass;TrustServerCertificate=true;Encrypt=true;Connection Timeout=10"

Add-Type -AssemblyName "System.Data"

Write-Host "운영 DB 연결 시도..." -ForegroundColor Cyan
$conn = New-Object System.Data.SqlClient.SqlConnection($cs)
$conn.Open()
Write-Host "[OK] 연결 성공: $($conn.DataSource) / $($conn.Database)" -ForegroundColor Green
Write-Host ""

# ── 1. 현재 Users 테이블 컬럼 조회 ──
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('Users') ORDER BY name"
$reader = $cmd.ExecuteReader()
$existingCols = New-Object System.Collections.Generic.HashSet[string]
while ($reader.Read()) { [void]$existingCols.Add([string]$reader["name"]) }
$reader.Close()

Write-Host "[현재 Users 컬럼: $($existingCols.Count)개]" -ForegroundColor Cyan

# ── 2. domain.User 모델 컬럼 목록 (user.go 에서 추출) ──
$expectedCols = @(
    "Id","Email","Password","Name","Phone",
    "ZipCode","Address","AddressDetail",
    "Role","KycStatus","KycData",
    "CustomLimitPerTx","CustomLimitPerDay","CustomLimitPerMonth","CustomLimitPerYear",
    "EmailNotification","PushNotification",
    "PartnerTier","TotalTradeInVolume","PartnerSince",
    "CommissionRate","PayoutFrequency","DailyPinLimit",
    "BankName","BankCode","AccountNumber","AccountHolder",
    "BankVerifiedAt","VerifyAttemptCount",
    "FailedLoginAttempts","LockedUntil","PasswordResetToken","PasswordResetExpiry",
    "KycVerifiedBy","KycVerifiedByAdminId",
    "MfaEnabled","TotpSecret","WebAuthnEnabled","IpWhitelistEnabled",
    "LastLoginAt","IsDeleted",
    "CreatedAt","UpdatedAt","DeletedAt"
)

# ── 3. 누락 컬럼 식별 ──
$missing = @()
foreach ($c in $expectedCols) {
    if (-not $existingCols.Contains($c)) { $missing += $c }
}

if ($missing.Count -eq 0) {
    Write-Host "[OK] 모든 컬럼 동기화됨" -ForegroundColor Green
    $conn.Close()
    return
}

Write-Host ""
Write-Host "[누락 컬럼: $($missing.Count)개]" -ForegroundColor Yellow
$missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
Write-Host ""

# ── 4. IsDeleted 만 우선 ALTER (안전) ──
if ($missing -contains "IsDeleted") {
    Write-Host "[ALTER] Users.IsDeleted 추가..." -ForegroundColor Cyan
    $alterCmd = $conn.CreateCommand()
    $alterCmd.CommandText = @"
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'IsDeleted')
BEGIN
    ALTER TABLE Users ADD IsDeleted BIT NOT NULL CONSTRAINT DF_Users_IsDeleted DEFAULT 0;
END
"@
    [void]$alterCmd.ExecuteNonQuery()
    Write-Host "[OK] IsDeleted 컬럼 추가 완료" -ForegroundColor Green

    Write-Host "[CREATE INDEX] IX_Users_IsDeleted..." -ForegroundColor Cyan
    $idxCmd = $conn.CreateCommand()
    $idxCmd.CommandText = @"
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Users_IsDeleted' AND object_id = OBJECT_ID('Users'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Users_IsDeleted ON Users(IsDeleted);
END
"@
    [void]$idxCmd.ExecuteNonQuery()
    Write-Host "[OK] 인덱스 생성 완료" -ForegroundColor Green
}

# ── 5. 검증 ──
$verifyCmd = $conn.CreateCommand()
$verifyCmd.CommandText = @"
SELECT c.name AS column_name, t.name AS type_name, c.is_nullable, c.column_id
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE object_id = OBJECT_ID('Users') AND c.name = 'IsDeleted'
"@
$verifyReader = $verifyCmd.ExecuteReader()
Write-Host ""
Write-Host "[검증]" -ForegroundColor Cyan
while ($verifyReader.Read()) {
    Write-Host "  IsDeleted: type=$($verifyReader['type_name']) nullable=$($verifyReader['is_nullable'])" -ForegroundColor Green
}
$verifyReader.Close()

# ── 6. IsDeleted 외 누락 컬럼은 보고만 ──
$stillMissing = $missing | Where-Object { $_ -ne "IsDeleted" }
if ($stillMissing.Count -gt 0) {
    Write-Host ""
    Write-Host "[추가 누락 — 자동 처리 안 함, 수동 확인 필요]" -ForegroundColor Yellow
    $stillMissing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
}

$conn.Close()
Write-Host ""
Write-Host "[완료]" -ForegroundColor Green
