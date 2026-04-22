# Windows Native App 인프라 로드맵

> **최종 업데이트**: 2026-03-27
> **현재 상태**: Wails v2 + Go + React 기반 네이티브 앱. HEADLESS 모드(NSSM 서비스)와 GUI 모드(관리 콘솔) 이중 동작.

## 현재 완료된 항목

- [x] Wails v2 윈도우 설정 (1100x780, min 800x600, 단일 인스턴스 잠금)
- [x] HEADLESS/GUI 이중 모드 분리
- [x] 28개 IPC 메서드 (대시보드, 세션, 크론, 보안 설정 등)
- [x] History collector 고루틴 라이프사이클 관리 (StopHistoryCollector)
- [x] 감사 로그 고루틴 세마포어 (50개 제한)
- [x] GetActiveSessions 페이지네이션 (100건 제한)
- [x] RunCronJob 입력 검증
- [x] Windows SIGBREAK 처리 (os.Interrupt)
- [x] filepath.Join 전체 사용 (Windows 경로 호환)
- [x] Graceful shutdown (30초 유예)

---

## 배포 시 필요 (P1)

### 1. NSSM 서비스 등록 스크립트

**목적**: Go API 서버를 Windows 서비스로 자동 시작/재시작

```powershell
# scripts/install-service.ps1 (예시)
$nssm = "C:\tools\nssm.exe"
$svcName = "SeedreamGiftAPI"
$exePath = "C:\deploy-server\seedream-api\seedream-api.exe"

& $nssm install $svcName $exePath
& $nssm set $svcName AppDirectory "C:\deploy-server\seedream-api"
& $nssm set $svcName AppEnvironmentExtra "HEADLESS=true"
& $nssm set $svcName DisplayName "Seedream Gift API Server"
& $nssm set $svcName Description "씨드림기프트 상품권 API 서버"
& $nssm set $svcName Start SERVICE_AUTO_START
& $nssm set $svcName AppStopMethodSkip 0
& $nssm set $svcName AppStopMethodConsole 5000
& $nssm set $svcName AppStopMethodWindow 5000
& $nssm set $svcName AppStopMethodThreads 5000
& $nssm set $svcName AppRestartDelay 10000
& $nssm set $svcName AppStdout "C:\deploy-server\seedream-api\logs\service-stdout.log"
& $nssm set $svcName AppStderr "C:\deploy-server\seedream-api\logs\service-stderr.log"
& $nssm set $svcName AppRotateFiles 1
& $nssm set $svcName AppRotateBytes 10485760
```

**필요 사항**:
- NSSM 바이너리 포함 (또는 다운로드 스크립트)
- 서비스 시작/중지/재시작 PowerShell 헬퍼
- 서비스 상태 확인 스크립트

---

### 2. Windows 인스톨러

**옵션 비교**:

| 도구 | 장점 | 단점 |
|------|------|------|
| **WiX Toolset** | MSI 표준, 기업 배포 적합, GPO 호환 | XML 설정 복잡 |
| **NSIS** | 가벼움, EXE 인스톨러, 커뮤니티 넓음 | MSI 미지원 |
| **InnoSetup** | 가장 간단, Pascal 스크립팅 | 64-bit Unicode 필요 |

**추천**: InnoSetup (소규모 배포) 또는 WiX (기업 환경)

**인스톨러가 해야 할 것**:
- seedream-api.exe + frontend 임베딩 바이너리 복사
- .env.production 템플릿 복사 (시크릿은 빈값)
- logs/ 디렉토리 생성
- uploads/ 디렉토리 생성
- NSSM 서비스 등록 (선택적)
- 방화벽 인바운드 규칙 추가 (포트 52201)
- 바탕화면/시작메뉴 바로가기 (GUI 모드)

---

### 3. 코드 서명 (Windows SmartScreen)

**목적**: "Windows가 PC를 보호했습니다" 경고 방지

**필요 사항**:
- EV 코드 서명 인증서 (Sectigo, DigiCert 등)
- `wails build` 후 `signtool.exe`로 서명
- 타임스탬프 서버 지정 (인증서 만료 후에도 유효)

```powershell
# 빌드 후 서명
signtool sign /f cert.pfx /p password /tr http://timestamp.digicert.com /td sha256 /fd sha256 seedream-api.exe
```

**비용**: EV 인증서 연 $300-500

---

## 장기 과제 (P2)

### 4. 자동 업데이트

**옵션**:
- **Squirrel.Windows**: Electron 생태계에서 검증됨, Go에서도 사용 가능
- **go-update**: Go 네이티브 라이브러리
- **수동 방식**: API 서버가 최신 버전 체크 → GUI에서 다운로드 안내

**추천 흐름**:
```
앱 시작 → GET /api/v1/version/latest (자체 서버)
  → 현재 버전과 비교
  → 새 버전 있으면 GUI에 배너 표시: "새 버전 (v2.1.0) 사용 가능"
  → 사용자 클릭 → 다운로드 + 교체 + 재시작
```

**주의**: HEADLESS(서비스) 모드에서는 자동 업데이트 비활성화. 서비스 업데이트는 배포 스크립트로.

---

### 5. Windows Event Log 연동

**목적**: Windows 이벤트 뷰어에서 에러/경고 확인 가능

**구현**:
```go
// pkg/logger/eventlog_windows.go (build tag: windows)
import "golang.org/x/sys/windows/svc/eventlog"

func NewEventLogSink(source string) (*eventlog.Log, error) {
    return eventlog.Open(source)
}
```

**Zap과 연동**: `zapcore.NewCore`에 Event Log WriteSyncer 추가

**로그 레벨 매핑**:
| Zap Level | Windows Event Type |
|-----------|-------------------|
| Error/Fatal | Error |
| Warn | Warning |
| Info | Information |

---

### 6. 시스템 트레이

**목적**: 최소화 시 트레이에 아이콘 표시, 서버 상태 모니터링

**Wails v2에서**: 네이티브 시스템 트레이 미지원. 선택지:
- `github.com/getlantern/systray` — Go 네이티브 시스템 트레이
- Wails v3 대기 (시스템 트레이 지원 예정)

**트레이 메뉴 구성**:
- 씨드림기프트 서버 (상태: 실행 중)
- 관리 콘솔 열기
- 서버 로그 보기
- ---
- 서비스 재시작
- 종료

---

### 7. 로그 경로 표준화

**현재**: `{exe_dir}/logs/api.log` (상대 경로)

**표준 Windows 경로**:
```
서비스 모드: C:\ProgramData\WowGift\logs\
GUI 모드:    %LOCALAPPDATA%\WowGift\logs\
```

**구현**:
```go
func getLogDir() string {
    if os.Getenv("HEADLESS") == "true" {
        return filepath.Join(os.Getenv("ProgramData"), "WowGift", "logs")
    }
    return filepath.Join(os.Getenv("LOCALAPPDATA"), "WowGift", "logs")
}
```

---

### 8. 윈도우 장기 경로 지원

**문제**: 기본 Windows 경로 제한 260자. 깊은 업로드 경로에서 실패 가능.

**해결**:
```go
// 경로가 260자 초과 시 UNC 접두사 추가
func longPath(p string) string {
    if len(p) > 260 && !strings.HasPrefix(p, `\\?\`) {
        return `\\?\` + p
    }
    return p
}
```

또는 Windows 10 1607+ 레지스트리 설정:
```
HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled = 1
```

---

## 참고: 현재 배포 구조

```
Server A (103.97.209.205) — nginx
├── client/dist/           ← 프론트엔드 정적 파일
├── client/dist/seedream_admin_portal/  ← 어드민 앱
└── nginx.conf

Server B (103.97.209.194) — Go API
├── seedream-api.exe          ← Wails 빌드 바이너리
├── .env.production        ← 환경 설정
├── logs/                  ← API 로그
├── uploads/               ← 파트너 문서 + 첨부 파일
└── NSSM 서비스: SeedreamGiftAPI
```

**빌드 명령어**: `wails build -platform windows/amd64 -ldflags "-s -w"`
**서비스 관리**: `nssm start/stop/restart SeedreamGiftAPI`
