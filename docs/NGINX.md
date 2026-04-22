# Nginx Security Configuration

## 프로덕션 서버에서 적용 방법

### 1. 보안 설정 파일 복사

```powershell
# 서버(103.97.209.205)에서 실행
Copy-Item "C:\deploy-server\seedream-gift\server\nginx-security.conf" "C:\nginx\conf\nginx-security.conf"
```

### 2. nginx.conf에 include 추가

`C:\nginx\conf\nginx.conf`의 HTTPS server 블록 안에 추가:

```nginx
server {
    listen 443 ssl http2;
    server_name seedreamgift.com www.seedreamgift.com;

    # Security rules (봇/스캐너 차단)
    include nginx-security.conf;

    # ... 기존 설정 ...
}
```

**중요:** `include` 문은 `location /` 블록보다 **위에** 위치해야 합니다.

### 3. 봇 User-Agent 차단 추가

`http {}` 블록 안에 추가 (server 블록 바깥):

```nginx
http {
    # ... 기존 설정 ...

    # Scanner bot blocking
    map $http_user_agent $is_scanner {
        default 0;
        ~*PetalBot 1;
        ~*python-urllib 1;
        ~*libredtail 1;
        ~*PAN.GlobalProtect 1;
        ~*Nmap 1;
        ~*masscan 1;
        ~*zgrab 1;
    }

    server {
        # ...
        if ($is_scanner) { return 444; }
        # ...
    }
}
```

### 4. 설정 테스트 및 적용

```powershell
cd C:\nginx
.\nginx.exe -t        # 설정 문법 테스트
.\nginx.exe -s reload # 무중단 적용
```

### 5. 확인

```powershell
# 차단 확인 (200이 아닌 444/연결끊김이 나와야 함)
curl -I https://seedreamgift.com/.env
curl -I https://seedreamgift.com/.git/credentials
curl -I https://seedreamgift.com/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php
```

## 차단 대상 요약

| 카테고리 | 경로 패턴 | 응답 |
|---------|---------|------|
| dotfiles | `/.env`, `/.git/*` | 444 (연결 끊김) |
| PHP/CGI | `*.php`, `*.cgi`, `*.asp` | 444 |
| 프레임워크 | `/vendor/*`, `/phpunit/*`, `/laravel/*` | 444 |
| VPN/RDP | `/owa/*`, `/RDWeb/*`, `/sslvpn*` | 444 |
| 인프라 | `/api/v1/pods`, `/containers/json` | 444 |
| 봇 UA | PetalBot, python-urllib, libredtail | 444 |

### 444 응답코드란?
nginx 전용 응답 코드. 응답 없이 TCP 연결을 즉시 끊습니다. 봇에게 아무런 정보를 제공하지 않아 서버 존재 여부 자체를 숨깁니다.
