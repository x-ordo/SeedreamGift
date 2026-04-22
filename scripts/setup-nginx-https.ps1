<#
.SYNOPSIS
    HTTPS 설정 스크립트 - nginx + Gabia SSL 인증서
.DESCRIPTION
    Windows Server에서 nginx 리버스 프록시 + SSL 인증서를 설정합니다.
    SSL 인증서는 Gabia에서 발급받아 수동 설치합니다.
    (fullchain.pem = cert + chain + root 합침, privkey.pem = 개인키)

    구조: 클라이언트 → nginx (:443 HTTPS, :80 HTTP) → NestJS (:5140 내부)

    사전 조건:
    1. DNS A 레코드 설정 완료 (wowgift.co.kr → 103.97.209.205)
    2. Windows 방화벽에서 80/443 포트 오픈
    3. NestJS 서버가 localhost:5140에서 실행 중 (PM2)

    실행 방법:
    .\scripts\setup-nginx-https.ps1

.NOTES
    도메인: wowgift.co.kr, www.wowgift.co.kr
    서버: 103.97.209.205 (Windows Server)
#>

param(
    [string]$Domain = "wowgift.co.kr",
    [string]$NginxDir = "C:\nginx",
    [string]$WinAcmeDir = "C:\win-acme",
    [int]$NginxPort = 443,
    [int]$BackendPort = 5140
)

$ErrorActionPreference = "Stop"

Write-Host "=== HTTPS Setup: nginx + Let's Encrypt ===" -ForegroundColor Cyan
Write-Host "Domain:  $Domain" -ForegroundColor Gray
Write-Host "nginx:   https://${Domain}:$NginxPort" -ForegroundColor Gray
Write-Host "Backend: http://127.0.0.1:$BackendPort (internal)" -ForegroundColor Gray
Write-Host ""

# ─── Step 1: 사전 확인 ───

Write-Host "[Step 1/7] Pre-flight checks..." -ForegroundColor Yellow

# DNS 확인
Write-Host "  Checking DNS for $Domain..."
try {
    $dns = Resolve-DnsName -Name $Domain -Type A -ErrorAction Stop
    Write-Host "  OK: $Domain -> $($dns.IPAddress)" -ForegroundColor Green
} catch {
    Write-Host "  WARNING: DNS not resolving for $Domain. Ensure A record is set." -ForegroundColor Red
    Write-Host "  Continuing anyway (DNS may take time to propagate)..." -ForegroundColor Yellow
}

# 방화벽 확인
Write-Host "  Checking firewall rules..."
$fwRule = Get-NetFirewallRule -DisplayName "WowGift HTTPS ($NginxPort)" -ErrorAction SilentlyContinue
if (-not $fwRule) {
    Write-Host "  Creating firewall rule for port $NginxPort..."
    New-NetFirewallRule -DisplayName "WowGift HTTPS ($NginxPort)" -Direction Inbound -Protocol TCP -LocalPort $NginxPort -Action Allow | Out-Null
}
Write-Host "  OK: Firewall rule for port $NginxPort configured" -ForegroundColor Green

# 포트 충돌 확인
$portInUse = Get-NetTCPConnection -LocalPort $NginxPort -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "  WARNING: Port $NginxPort is already in use." -ForegroundColor Red
}

# ─── Step 2: nginx 설치 ───

Write-Host ""
Write-Host "[Step 2/7] Installing nginx..." -ForegroundColor Yellow

if (Test-Path "$NginxDir\nginx.exe") {
    Write-Host "  nginx already installed at $NginxDir" -ForegroundColor Green
} else {
    Write-Host "  Downloading nginx stable for Windows..."
    $nginxVersion = "1.26.3"
    $nginxUrl = "https://nginx.org/download/nginx-$nginxVersion.zip"
    $nginxZip = "$env:TEMP\nginx-$nginxVersion.zip"

    Invoke-WebRequest -Uri $nginxUrl -OutFile $nginxZip
    Write-Host "  Extracting to $NginxDir..."

    $tempExtract = "$env:TEMP\nginx-extract"
    if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
    Expand-Archive -Path $nginxZip -DestinationPath $tempExtract

    $extractedDir = Get-ChildItem $tempExtract | Select-Object -First 1
    if (-not (Test-Path $NginxDir)) { New-Item -ItemType Directory -Path $NginxDir | Out-Null }
    Copy-Item "$($extractedDir.FullName)\*" -Destination $NginxDir -Recurse -Force

    Remove-Item $nginxZip -Force
    Remove-Item $tempExtract -Recurse -Force

    Write-Host "  OK: nginx installed at $NginxDir" -ForegroundColor Green
}

# SSL 디렉토리 생성
$sslDir = "$NginxDir\ssl\$Domain"
if (-not (Test-Path $sslDir)) {
    New-Item -ItemType Directory -Path $sslDir -Force | Out-Null
    Write-Host "  Created SSL directory: $sslDir" -ForegroundColor Green
}

# PKI 검증 디렉토리 생성 (GlobalSign, Sectigo 등 인증서 발급용)
$pkiDir = "$NginxDir\html\.well-known\pki-validation"
if (-not (Test-Path $pkiDir)) {
    New-Item -ItemType Directory -Path $pkiDir -Force | Out-Null
    Write-Host "  Created PKI validation directory: $pkiDir" -ForegroundColor Green
    Write-Host "  → gsdv.txt 파일을 $pkiDir 에 업로드하세요" -ForegroundColor Yellow
}

# ─── Step 3: nginx.conf 생성 ───

Write-Host ""
Write-Host "[Step 3/7] Writing nginx.conf..." -ForegroundColor Yellow

# 초기 설정 (SSL 없이, 포트 80 HTTP)
$nginxConfInitial = @"
worker_processes auto;

events {
    worker_connections 2048;
    multi_accept on;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    tcp_nopush    on;
    tcp_nodelay   on;
    keepalive_timeout 70;

    access_log logs/access.log;
    error_log  logs/error.log;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1024;
    gzip_vary on;
    gzip_comp_level 5;

    proxy_buffer_size 8k;
    proxy_buffers 8 16k;
    proxy_busy_buffers_size 32k;
    client_max_body_size 10m;

    # Rate limiting zones (전역 — PM2 클러스터 인스턴스 수 무관)
    limit_req_zone `$binary_remote_addr zone=api_auth:10m rate=5r/s;
    limit_req_zone `$binary_remote_addr zone=api_kyc:10m rate=3r/m;
    limit_req_zone `$binary_remote_addr zone=api_general:10m rate=30r/s;
    limit_req_status 429;

    upstream nestjs {
        server 127.0.0.1:$BackendPort;
        keepalive 16;
    }

    # HTTP on port 80 (until SSL cert is ready)
    server {
        listen 80;
        server_name $Domain www.$Domain;

        # SSL 인증서 PKI 도메인 검증 (GlobalSign, Sectigo 등)
        location /.well-known/pki-validation/ {
            alias $($NginxDir -replace '\\','/')/html/.well-known/pki-validation/;
            default_type text/plain;
        }

        # 민감 파일 차단 (.env, .git, .htaccess 등 - .well-known 제외)
        location ~ /\.(?!well-known) {
            deny all;
            return 404;
        }

        # KYC 엔드포인트 (3 req/min — 가장 엄격)
        location /api/kyc/bank-verify {
            limit_req zone=api_kyc burst=2 nodelay;
            proxy_pass http://nestjs;
            proxy_http_version 1.1;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
            proxy_set_header Connection "";
        }

        # 인증 엔드포인트 (5 req/s — 로그인/회원가입)
        location /api/auth {
            limit_req zone=api_auth burst=10 nodelay;
            proxy_pass http://nestjs;
            proxy_http_version 1.1;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
            proxy_set_header Connection "";
        }

        location / {
            proxy_pass http://nestjs;
            proxy_http_version 1.1;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
            proxy_set_header Connection "";
        }

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            proxy_pass http://nestjs;
            proxy_http_version 1.1;
            proxy_set_header Host `$host;
            proxy_set_header Connection "";
            expires 7d;
            add_header Cache-Control "public, immutable";
        }
    }
}
"@

# 최종 설정 (SSL 포함, 포트 443 HTTPS + 80 리다이렉트)
$nginxConfFinal = @"
worker_processes auto;

events {
    worker_connections 2048;
    multi_accept on;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    tcp_nopush    on;
    tcp_nodelay   on;
    keepalive_timeout 70;

    access_log logs/access.log;
    error_log  logs/error.log;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1024;
    gzip_vary on;
    gzip_comp_level 5;

    # Proxy buffer 설정
    proxy_buffer_size 8k;
    proxy_buffers 8 16k;
    proxy_busy_buffers_size 32k;

    # Request body 제한
    client_max_body_size 10m;

    # Rate limiting zones (전역 — PM2 클러스터 인스턴스 수 무관)
    limit_req_zone `$binary_remote_addr zone=api_auth:10m rate=5r/s;
    limit_req_zone `$binary_remote_addr zone=api_kyc:10m rate=3r/m;
    limit_req_zone `$binary_remote_addr zone=api_general:10m rate=30r/s;
    limit_req_status 429;

    # Upstream (keepalive 커넥션 풀)
    upstream nestjs {
        server 127.0.0.1:$BackendPort;
        keepalive 16;
    }

    # HTTP -> HTTPS 리다이렉트
    server {
        listen 80;
        server_name $Domain www.$Domain;

        # SSL 인증서 PKI 도메인 검증 (인증서 갱신 시 필요)
        location /.well-known/pki-validation/ {
            alias $($NginxDir -replace '\\','/')/html/.well-known/pki-validation/;
            default_type text/plain;
        }

        location / {
            return 301 https://`$host`$request_uri;
        }
    }

    # HTTPS
    server {
        listen 443 ssl http2;
        server_name $Domain www.$Domain;

        # SSL certificates
        ssl_certificate     $($sslDir -replace '\\','/')/fullchain.pem;
        ssl_certificate_key $($sslDir -replace '\\','/')/privkey.pem;

        # SSL 성능 최적화 (Context7 nginx docs 권장)
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;
        ssl_stapling on;
        ssl_stapling_verify on;

        # Security headers: Helmet(NestJS)에서 일괄 관리
        # HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy 등
        # nginx에서 중복 설정하면 충돌 발생 (특히 X-Frame-Options DENY vs SAMEORIGIN)

        # 민감 파일 차단 (.env, .git, .htaccess 등 - .well-known 제외)
        location ~ /\.(?!well-known) {
            deny all;
            return 404;
        }

        # KYC 엔드포인트 (3 req/min — 가장 엄격)
        location /api/kyc/bank-verify {
            limit_req zone=api_kyc burst=2 nodelay;
            proxy_pass http://nestjs;
            proxy_http_version 1.1;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header Connection "";
        }

        # 인증 엔드포인트 (5 req/s — 로그인/회원가입)
        location /api/auth {
            limit_req zone=api_auth burst=10 nodelay;
            proxy_pass http://nestjs;
            proxy_http_version 1.1;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header Connection "";
        }

        # Proxy to NestJS (upstream keepalive 활용)
        location / {
            proxy_pass http://nestjs;
            proxy_http_version 1.1;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header Upgrade `$http_upgrade;
            proxy_set_header Connection "";

            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Static assets caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            proxy_pass http://nestjs;
            proxy_http_version 1.1;
            proxy_set_header Host `$host;
            proxy_set_header Connection "";
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }
}
"@

# 먼저 초기 설정(HTTP only) 저장
$nginxConfInitial | Out-File -FilePath "$NginxDir\conf\nginx.conf" -Encoding ascii -Force
Write-Host "  OK: Initial nginx.conf written (HTTP on port 80)" -ForegroundColor Green

# 최종 설정은 별도 파일로 저장 (인증서 발급 후 교체)
$nginxConfFinal | Out-File -FilePath "$NginxDir\conf\nginx-ssl.conf" -Encoding ascii -Force
Write-Host "  OK: SSL nginx.conf saved as nginx-ssl.conf (apply after cert issuance)" -ForegroundColor Green

# ─── Step 4: nginx 시작 ───

Write-Host ""
Write-Host "[Step 4/7] Starting nginx..." -ForegroundColor Yellow

# nginx가 Windows 서비스(NSSM)로 등록되어 있는지 확인
$nginxService = Get-Service nginx -ErrorAction SilentlyContinue

if ($nginxService) {
    # NSSM 서비스로 관리
    Write-Host "  nginx is registered as a Windows service (NSSM)"
    if ($nginxService.Status -eq 'Running') {
        Write-Host "  Restarting nginx service..."
        Restart-Service nginx -Force
    } else {
        Write-Host "  Starting nginx service..."
        Start-Service nginx
    }
    Start-Sleep -Seconds 2
    $svc = Get-Service nginx
    if ($svc.Status -eq 'Running') {
        Write-Host "  OK: nginx service running" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: nginx service failed to start. Check logs." -ForegroundColor Red
        exit 1
    }
} else {
    # 서비스가 아닌 경우 직접 프로세스 관리
    $existingNginx = Get-Process nginx -ErrorAction SilentlyContinue
    if ($existingNginx) {
        Write-Host "  Stopping existing nginx process..."
        if (Test-Path "$NginxDir\logs\nginx.pid") {
            Push-Location $NginxDir
            & .\nginx.exe -s quit 2>$null
            Pop-Location
            Start-Sleep -Seconds 2
        }
        $stillRunning = Get-Process nginx -ErrorAction SilentlyContinue
        if ($stillRunning) {
            Stop-Process -Name nginx -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }
        Write-Host "  OK: nginx stopped" -ForegroundColor Green
    }

    Push-Location $NginxDir
    & .\nginx.exe
    Pop-Location

    Start-Sleep -Seconds 2
    $nginxProcess = Get-Process nginx -ErrorAction SilentlyContinue
    if ($nginxProcess) {
        Write-Host "  OK: nginx started on port $NginxPort (PID: $($nginxProcess.Id))" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: nginx failed to start. Check $NginxDir\logs\error.log" -ForegroundColor Red
        exit 1
    }
}

# ─── Step 5: win-acme 설치 ───

Write-Host ""
Write-Host "[Step 5/7] Installing win-acme..." -ForegroundColor Yellow

if (Test-Path "$WinAcmeDir\wacs.exe") {
    Write-Host "  win-acme already installed at $WinAcmeDir" -ForegroundColor Green
} else {
    Write-Host "  Downloading win-acme..."
    $acmeVersion = "2.2.9.1701"
    $acmeUrl = "https://github.com/win-acme/win-acme/releases/download/v$acmeVersion/win-acme.v$acmeVersion.x64.pluggable.zip"
    $acmeZip = "$env:TEMP\win-acme.zip"

    try {
        Invoke-WebRequest -Uri $acmeUrl -OutFile $acmeZip
        if (-not (Test-Path $WinAcmeDir)) { New-Item -ItemType Directory -Path $WinAcmeDir | Out-Null }
        Expand-Archive -Path $acmeZip -DestinationPath $WinAcmeDir -Force
        Remove-Item $acmeZip -Force
        Write-Host "  OK: win-acme installed at $WinAcmeDir" -ForegroundColor Green
    } catch {
        Write-Host "  WARNING: Failed to download win-acme automatically." -ForegroundColor Red
        Write-Host "  Please download manually from: https://github.com/win-acme/win-acme/releases" -ForegroundColor Yellow
        Write-Host "  Extract to $WinAcmeDir and re-run this script." -ForegroundColor Yellow
    }
}

# ─── Step 6: SSL 인증서 발급 (DNS-01 검증) ───

Write-Host ""
Write-Host "[Step 6/7] SSL Certificate Issuance (DNS-01 validation)..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Port 80/443 are not used. Using DNS-01 validation (manual TXT record)." -ForegroundColor Gray
Write-Host ""

if (Test-Path "$sslDir\fullchain.pem") {
    Write-Host "  SSL certificate already exists at $sslDir" -ForegroundColor Green
    Write-Host "  To renew, delete the files and re-run this script." -ForegroundColor Gray
} elseif (Test-Path "$WinAcmeDir\wacs.exe") {
    Write-Host "  Running win-acme with DNS-01 manual validation..." -ForegroundColor Gray
    Write-Host "  You will be asked to create a TXT record in Gabia DNS." -ForegroundColor Yellow
    Write-Host ""

    & "$WinAcmeDir\wacs.exe" `
        --target manual `
        --host "$Domain,www.$Domain" `
        --validation dns-01 `
        --validationmode dns-01 `
        --store pemfiles `
        --pemfilespath $sslDir `
        --accepttos `
        --emailaddress "admin@$Domain"

    if ($LASTEXITCODE -eq 0 -and (Test-Path "$sslDir\fullchain.pem")) {
        Write-Host "  OK: SSL certificate issued!" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: Certificate issuance may have failed." -ForegroundColor Red
        Write-Host ""
        Write-Host "  Manual alternative:" -ForegroundColor Yellow
        Write-Host "    cd $WinAcmeDir" -ForegroundColor Gray
        Write-Host "    .\wacs.exe" -ForegroundColor Gray
        Write-Host "  Select: Manual input -> DNS validation -> PEM files" -ForegroundColor Gray
    }
} else {
    Write-Host "  SKIP: win-acme not found at $WinAcmeDir" -ForegroundColor Yellow
}

# ─── Step 7: SSL nginx.conf 적용 ───

Write-Host ""
Write-Host "[Step 7/7] Applying SSL configuration..." -ForegroundColor Yellow

if (Test-Path "$sslDir\fullchain.pem") {
    # 최종 SSL 설정으로 교체
    Copy-Item "$NginxDir\conf\nginx-ssl.conf" "$NginxDir\conf\nginx.conf" -Force

    # nginx 설정 테스트
    Push-Location $NginxDir
    $testResult = & .\nginx.exe -t 2>&1
    Pop-Location

    if ($testResult -match "successful") {
        # nginx 리로드 (서비스 vs 직접 프로세스)
        $nginxSvc = Get-Service nginx -ErrorAction SilentlyContinue
        if ($nginxSvc -and $nginxSvc.Status -eq 'Running') {
            Restart-Service nginx -Force
        } else {
            Push-Location $NginxDir
            & .\nginx.exe -s reload
            Pop-Location
        }
        Write-Host "  OK: SSL configuration applied and nginx reloaded!" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: nginx config test failed:" -ForegroundColor Red
        Write-Host "  $testResult" -ForegroundColor Red
        $nginxConfInitial | Out-File -FilePath "$NginxDir\conf\nginx.conf" -Encoding ascii -Force
        $nginxSvc = Get-Service nginx -ErrorAction SilentlyContinue
        if ($nginxSvc -and $nginxSvc.Status -eq 'Running') {
            Restart-Service nginx -Force
        } else {
            Push-Location $NginxDir
            & .\nginx.exe -s reload
            Pop-Location
        }
        Write-Host "  Reverted to HTTP-only configuration." -ForegroundColor Yellow
    }
} else {
    Write-Host "  SKIP: No SSL certificate found. nginx running HTTP on port $NginxPort." -ForegroundColor Yellow
    Write-Host "  After obtaining certificate, run:" -ForegroundColor Gray
    Write-Host "    Copy-Item '$NginxDir\conf\nginx-ssl.conf' '$NginxDir\conf\nginx.conf' -Force" -ForegroundColor Gray
    Write-Host "    cd $NginxDir; .\nginx.exe -s reload" -ForegroundColor Gray
}

# ─── 완료 ───

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Architecture:" -ForegroundColor Yellow
Write-Host "  Client -> nginx (:$NginxPort HTTPS) -> NestJS (:$BackendPort internal)" -ForegroundColor Gray
Write-Host ""
Write-Host "Test:" -ForegroundColor Yellow
Write-Host "  curl http://${Domain}:$NginxPort   (before SSL)" -ForegroundColor Gray
Write-Host "  curl https://${Domain}:$NginxPort  (after SSL)" -ForegroundColor Gray
Write-Host ""
Write-Host "Production .env updates:" -ForegroundColor Yellow
Write-Host "  FRONTEND_URL=https://${Domain}:$NginxPort" -ForegroundColor Gray
Write-Host "  COOKIE_SECURE=true" -ForegroundColor Gray
Write-Host ""
Write-Host "nginx management:" -ForegroundColor Yellow
Write-Host "  Start:   cd $NginxDir; .\nginx.exe" -ForegroundColor Gray
Write-Host "  Stop:    cd $NginxDir; .\nginx.exe -s quit" -ForegroundColor Gray
Write-Host "  Reload:  cd $NginxDir; .\nginx.exe -s reload" -ForegroundColor Gray
Write-Host "  Test:    cd $NginxDir; .\nginx.exe -t" -ForegroundColor Gray
Write-Host "  Logs:    Get-Content $NginxDir\logs\error.log -Tail 50" -ForegroundColor Gray
Write-Host ""
