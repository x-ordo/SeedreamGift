# 서버 보안 방화벽 설정

## Server B (103.97.209.194) — Go API + MSSQL

### 필수 방화벽 규칙

1. MSSQL 포트 (7335) — Server A에서만 허용 (실제로는 localhost만)
   - 인바운드 허용: 127.0.0.1:7335
   - 인바운드 차단: 0.0.0.0/0:7335

2. Go API 포트 (52201) — Server A (nginx)에서만 허용
   - 인바운드 허용: 103.97.209.205:52201
   - 인바운드 차단: 0.0.0.0/0:52201

3. SSH (22) — 관리자 IP만 허용

### Windows Firewall 명령어
```powershell
# MSSQL — 외부 차단
netsh advfirewall firewall add rule name="Block MSSQL External" dir=in action=block protocol=tcp localport=7335

# Go API — nginx만 허용
netsh advfirewall firewall add rule name="Allow GoAPI from Nginx" dir=in action=allow protocol=tcp localport=52201 remoteip=103.97.209.205
netsh advfirewall firewall add rule name="Block GoAPI External" dir=in action=block protocol=tcp localport=52201
```
