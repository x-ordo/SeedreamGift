// Package config는 Wow Gift 백엔드의 애플리케이션 설정을 관리합니다.
// 모든 설정은 .env 파일이나 환경 변수를 통해 구성할 수 있습니다.
package config

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/spf13/viper"
)

// Config는 애플리케이션의 전체 구성을 나타냅니다.
// 모든 필드는 mapstructure 태그를 통해 환경 변수와 매핑됩니다.
type Config struct {
	// ─── 서버 핵심 ───

	// GinMode는 Gin 프레임워크의 실행 모드(debug, release, test)를 지정합니다.
	GinMode string `mapstructure:"GIN_MODE"`
	// Port는 API 서버가 리스닝할 포트 번호입니다.
	Port int `mapstructure:"PORT"`
	// DBUrl은 데이터베이스 연결을 위한 접속 문자열(DSN)입니다.
	DBUrl string `mapstructure:"DATABASE_URL"`
	// JWTSecret은 사용자 인증 토큰(JWT) 서명에 사용되는 비밀키입니다.
	JWTSecret string `mapstructure:"JWT_SECRET"`
	// JWTPrivateSecret은 시스템 내부 통신용 JWT 서명에 사용되는 비밀키입니다.
	JWTPrivateSecret string `mapstructure:"JWT_PRIVATE_SECRET"`
	// EncryptionKey는 민감 데이터 암호화에 사용되는 대칭키입니다.
	EncryptionKey string `mapstructure:"ENCRYPTION_KEY"`
	// FrontendUrl은 웹 클라이언트 서비스의 기본 URL입니다.
	FrontendUrl string `mapstructure:"FRONTEND_URL"`
	// AdminUrl은 관리자 콘솔 서비스의 기본 URL입니다.
	AdminUrl string `mapstructure:"ADMIN_URL"`
	// AdditionalCorsOrigins는 CORS 허용 목록에 추가할 오리진들을 쉼표로 구분한 문자열입니다.
	AdditionalCorsOrigins string `mapstructure:"ADDITIONAL_CORS_ORIGINS"`
	// TrustedProxyIPs는 역방향 프록시로 신뢰할 IP 주소들을 쉼표로 구분한 문자열입니다.
	TrustedProxyIPs string `mapstructure:"TRUSTED_PROXY_IPS"`
	// APIDomain은 CSP connect-src에 추가할 API 도메인 URL입니다.
	APIDomain string `mapstructure:"API_DOMAIN"`

	// ─── JWT ───

	// JWTAccessExpiry는 Access 토큰의 유효 기간입니다.
	JWTAccessExpiry time.Duration `mapstructure:"JWT_ACCESS_EXPIRY"`
	// JWTRefreshExpiry는 Refresh 토큰의 유효 기간입니다.
	JWTRefreshExpiry time.Duration `mapstructure:"JWT_REFRESH_EXPIRY"`

	// ─── 쿠키 ───

	// CookieSecure는 쿠키 전송 시 HTTPS 연결만 허용할지 여부입니다.
	CookieSecure bool `mapstructure:"COOKIE_SECURE"`
	// CookieDomain은 쿠키가 유효한 도메인 범위를 설정합니다.
	CookieDomain string `mapstructure:"COOKIE_DOMAIN"`

	// ─── 로깅 ───

	// LogLevel은 기록할 로그의 최소 레벨(debug, info, warn, error)을 설정합니다.
	LogLevel string `mapstructure:"LOG_LEVEL"`
	// LogPath는 로그 파일이 저장될 시스템 경로입니다.
	LogPath string `mapstructure:"LOG_PATH"`
	// LogMaxSizeMB는 로그 파일이 순환(rotation)되기 전 최대 크기(MB)입니다.
	LogMaxSizeMB int `mapstructure:"LOG_MAX_SIZE_MB"`
	// LogMaxBackups는 보관할 이전 로그 파일의 최대 개수입니다.
	LogMaxBackups int `mapstructure:"LOG_MAX_BACKUPS"`
	// LogMaxAgeDays는 로그 파일을 보관할 최대 기간(일)입니다.
	LogMaxAgeDays int `mapstructure:"LOG_MAX_AGE_DAYS"`

	// ─── 페이지네이션 ───

	// PaginationDefault는 페이지네이션 시 기본으로 제공할 항목 개수입니다.
	PaginationDefault int `mapstructure:"PAGINATION_DEFAULT"`
	// PaginationMax는 페이지네이션 시 요청 가능한 최대 항목 개수입니다.
	PaginationMax int `mapstructure:"PAGINATION_MAX"`

	// ─── 알림 ───

	// TelegramToken은 시스템 알림을 발송할 텔레그램 봇의 토큰입니다.
	TelegramToken string `mapstructure:"TELEGRAM_TOKEN"`
	// TelegramChatID는 시스템 알림을 수신할 텔레그램 채팅방의 ID입니다.
	TelegramChatID string `mapstructure:"TELEGRAM_CHAT_ID"`

	// ─── 외부 발급 API (EXPay) ───

	// EXPayBaseURL은 이엑스페이 API 기본 URL입니다.
	EXPayBaseURL string `mapstructure:"EXPAY_BASE_URL"`
	// EXPayAPIKey는 이엑스페이 API 인증 키입니다.
	EXPayAPIKey string `mapstructure:"EXPAY_API_KEY"`

	// ─── 카카오 알림톡 ───

	// KakaoSenderKey는 카카오 비즈니스 채널 발신 프로필 키입니다.
	KakaoSenderKey string `mapstructure:"KAKAO_SENDER_KEY"`
	// KakaoAPIKey는 카카오 비즈메시지 API 키입니다.
	KakaoAPIKey string `mapstructure:"KAKAO_API_KEY"`

	// ─── 인증 & 보안 ───

	// BcryptCost는 비밀번호 해싱 시 사용되는 작업 계수(Cost)입니다.
	BcryptCost int `mapstructure:"BCRYPT_COST"`
	// AccountLockThreshold는 계정 잠금 전 허용되는 최대 로그인 실패 횟수입니다.
	AccountLockThreshold int `mapstructure:"ACCOUNT_LOCK_THRESHOLD"`
	// AccountLockDuration은 계정 잠금 시 해제될 때까지의 대기 시간입니다.
	AccountLockDuration time.Duration `mapstructure:"ACCOUNT_LOCK_DURATION"`
	// MFATokenExpiry는 2단계 인증(MFA) 토큰의 유효 기간입니다.
	MFATokenExpiry time.Duration `mapstructure:"MFA_TOKEN_EXPIRY"`
	// PasswordResetExpiry는 비밀번호 재설정 링크의 유효 기간입니다.
	PasswordResetExpiry time.Duration `mapstructure:"PASSWORD_RESET_EXPIRY"`

	// ─── 거래 규칙 ───

	// OrderCancelWindow는 주문 후 사용자가 직접 취소 가능한 시간 범위입니다.
	OrderCancelWindow time.Duration `mapstructure:"ORDER_CANCEL_WINDOW"`
	// KYCSessionExpiry는 본인 인증(KYC) 프로세스의 세션 만료 시간입니다.
	KYCSessionExpiry time.Duration `mapstructure:"KYC_SESSION_EXPIRY"`
	// CooconKycUrl은 Coocon 본인인증 팝업 메인 URL입니다.
	CooconKycUrl string `mapstructure:"COOCON_KYC_URL"`
	// CooconKycUrlSub는 메인 서버 장애 시 사용할 서브 URL입니다.
	CooconKycUrlSub string `mapstructure:"COOCON_KYC_URL_SUB"`
	// GiftSearchLimit는 선물하기 대상 사용자 검색 시 반환되는 최대 인원수입니다.
	GiftSearchLimit int `mapstructure:"GIFT_SEARCH_LIMIT"`
	// GiftSearchMinQuery는 선물하기 대상 검색을 위한 최소 검색어 길이입니다.
	GiftSearchMinQuery int `mapstructure:"GIFT_SEARCH_MIN_QUERY"`

	// ─── Rate Limiting ───

	// GlobalRateLimit은 API 서버 전역에 적용되는 요청 제한 설정입니다.
	GlobalRateLimit string `mapstructure:"GLOBAL_RATE_LIMIT"`
	// LoginMaxFailures는 로그인 차단 전 허용되는 최대 연속 실패 횟수입니다.
	LoginMaxFailures int `mapstructure:"LOGIN_MAX_FAILURES"`
	// LoginBlockDuration은 로그인 시도 과다로 인한 일시 차단 기간입니다.
	LoginBlockDuration time.Duration `mapstructure:"LOGIN_BLOCK_DURATION"`
	// TransactionMaxPerMin은 사용자별 분당 최대 거래 요청 횟수입니다.
	TransactionMaxPerMin int `mapstructure:"TRANSACTION_MAX_PER_MIN"`

	// ─── HTTP 서버 ───

	// ServerReadTimeout은 요청 바디를 읽는 최대 시간입니다.
	ServerReadTimeout time.Duration `mapstructure:"SERVER_READ_TIMEOUT"`
	// ServerWriteTimeout은 응답을 쓰는 최대 시간입니다.
	ServerWriteTimeout time.Duration `mapstructure:"SERVER_WRITE_TIMEOUT"`
	// ServerIdleTimeout은 유휴 연결이 유지되는 최대 시간입니다.
	ServerIdleTimeout time.Duration `mapstructure:"SERVER_IDLE_TIMEOUT"`
	// ServerReadHeaderTimeout은 요청 헤더를 읽는 최대 시간입니다.
	ServerReadHeaderTimeout time.Duration `mapstructure:"SERVER_READ_HEADER_TIMEOUT"`
	// ServerMaxHeaderBytes는 허용되는 최대 요청 헤더 크기입니다.
	ServerMaxHeaderBytes int `mapstructure:"SERVER_MAX_HEADER_BYTES"`
	// ShutdownGracePeriod는 서버 종료 시 대기 중인 요청을 처리하기 위한 유예 기간입니다.
	ShutdownGracePeriod time.Duration `mapstructure:"SHUTDOWN_GRACE_PERIOD"`
	// MaxRequestBodyBytes는 허용되는 최대 요청 본문 크기(Byte)입니다.
	MaxRequestBodyBytes int64 `mapstructure:"MAX_REQUEST_BODY_BYTES"`

	// ─── DB 커넥션 풀 ───

	// DBMaxIdleConns는 DB 커넥션 풀에서 유지할 유휴 연결의 최대 개수입니다.
	DBMaxIdleConns int `mapstructure:"DB_MAX_IDLE_CONNS"`
	// DBMaxOpenConns는 데이터베이스로의 최대 오픈 연결 개수입니다.
	DBMaxOpenConns int `mapstructure:"DB_MAX_OPEN_CONNS"`
	// DBConnMaxLifetime은 개별 연결이 재사용될 수 있는 최대 수명입니다.
	DBConnMaxLifetime time.Duration `mapstructure:"DB_CONN_MAX_LIFETIME"`
	// DBConnMaxIdleTime은 유휴 연결이 닫히기 전까지 풀에 머물 수 있는 최대 시간입니다.
	// 장시간 미사용 연결을 정리하여 DB 서버 자원 낭비를 방지합니다.
	DBConnMaxIdleTime time.Duration `mapstructure:"DB_CONN_MAX_IDLE_TIME"`

	// ─── 크론잡 ───

	// AuditArchiveDays는 감사 로그를 아카이브하기 전 보관 기간입니다.
	AuditArchiveDays int `mapstructure:"AUDIT_ARCHIVE_DAYS"`
	// AuditDeleteDays는 감사 로그를 영구 삭제하기 전 보관 기간입니다.
	AuditDeleteDays int `mapstructure:"AUDIT_DELETE_DAYS"`

	// ─── 이메일 (SMTP) ───

	// SMTPHost는 SMTP 서버 호스트 주소입니다.
	SMTPHost string `mapstructure:"SMTP_HOST"`
	// SMTPPort는 SMTP 서버 포트 번호입니다.
	SMTPPort int `mapstructure:"SMTP_PORT"`
	// SMTPUser는 SMTP 인증 사용자 계정입니다.
	SMTPUser string `mapstructure:"SMTP_USER"`
	// SMTPPassword는 SMTP 인증 비밀번호입니다.
	SMTPPassword string `mapstructure:"SMTP_PASSWORD"`
	// SMTPFrom은 발신자 이메일 주소입니다.
	SMTPFrom string `mapstructure:"SMTP_FROM"`
	// SMTPFromName은 발신자 표시 이름입니다.
	SMTPFromName string `mapstructure:"SMTP_FROM_NAME"`
	// SMTPEnabled는 이메일 발송 기능의 활성화 여부입니다.
	SMTPEnabled bool `mapstructure:"SMTP_ENABLED"`

	// ─── 모니터링 ───

	// HistoryCollectInterval은 시스템 지표 수집 주기입니다.
	HistoryCollectInterval time.Duration `mapstructure:"HISTORY_COLLECT_INTERVAL"`
	// HistoryMaxPoints는 대시보드 차트에 보관할 최대 데이터 지점 개수입니다.
	HistoryMaxPoints int `mapstructure:"HISTORY_MAX_POINTS"`

	// ─── 팝빌 (현금영수증/세금계산서) ───

	// PopbillLinkID는 팝빌 연동 아이디입니다.
	PopbillLinkID string `mapstructure:"POPBILL_LINK_ID"`
	// PopbillSecretKey는 팝빌 비밀키입니다.
	PopbillSecretKey string `mapstructure:"POPBILL_SECRET_KEY"`
	// PopbillCorpNum은 사업자등록번호(10자리, 하이픈 없이)입니다.
	PopbillCorpNum string `mapstructure:"POPBILL_CORP_NUM"`
	// PopbillIsTest는 팝빌 테스트 환경 사용 여부입니다.
	PopbillIsTest bool `mapstructure:"POPBILL_IS_TEST"`

	// ─── 발급 안전장치 ───

	// AllowRealFulfillment는 실제 상품권 발급 파이프라인 활성화 여부입니다.
	// false(기본값)이면 Mock/Stub 발급만 허용되어 개발/테스트 중 실수로 실물 발급이 일어나는 것을 방지합니다.
	// 운영 환경에서 실제 PG 연동이 완료된 후에만 true로 설정하세요.
	AllowRealFulfillment bool `mapstructure:"ALLOW_REAL_FULFILLMENT"`

	// ─── 파일 업로드 ───

	// UploadBasePath는 파트너 문서 등 업로드 파일이 저장되는 기본 디렉터리 경로입니다.
	UploadBasePath string `mapstructure:"UPLOAD_BASE_PATH"`

	// ─── 관리자 알림 ───

	// AdminNotifyEmail은 시스템 알림을 수신할 메인 관리자 이메일 주소입니다.
	AdminNotifyEmail string `mapstructure:"ADMIN_NOTIFY_EMAIL"`
	// CsEmail은 고객 문의 연락처 이메일이며, 이메일 Reply-To 및 Footer에 사용됩니다.
	CsEmail string `mapstructure:"CS_EMAIL"`
	// BizEmail은 사업 제휴 문의를 수신할 이메일 주소입니다.
	BizEmail string `mapstructure:"BIZ_EMAIL"`
	// ComplianceEmail은 개인정보 보호 관련 문의를 수신할 이메일 주소입니다.
	ComplianceEmail string `mapstructure:"COMPLIANCE_EMAIL"`

	// ─── 브랜드 / 사업자 정보 ───

	// SiteName은 서비스 한글 명칭입니다 (이메일 제목, 알림 등에 사용).
	SiteName string `mapstructure:"SITE_NAME"`
	// SiteBrand는 서비스 영문 브랜드명입니다 (로고 텍스트 등에 사용).
	SiteBrand string `mapstructure:"SITE_BRAND"`
	// SiteDomain은 서비스 도메인입니다.
	SiteDomain string `mapstructure:"SITE_DOMAIN"`
	// CompanyName은 법인명입니다.
	CompanyName string `mapstructure:"COMPANY_NAME"`
	// CompanyLicenseNo는 사업자등록번호입니다.
	CompanyLicenseNo string `mapstructure:"COMPANY_LICENSE_NO"`
	// CompanyOwner는 대표자명입니다.
	CompanyOwner string `mapstructure:"COMPANY_OWNER"`

	// ─── 더치트 (사기 조회) ───

	// TheCheatAPIKey는 더치트 API 인증 키입니다.
	TheCheatAPIKey string `mapstructure:"THECHEAT_API_KEY"`
	// TheCheatEncKey는 더치트 AES-256-CBC 암복호화 키 (32바이트 문자열)입니다.
	TheCheatEncKey string `mapstructure:"THECHEAT_ENC_KEY"`
	// TheCheatEnabled는 더치트 사기 조회 기능의 활성화 여부입니다.
	TheCheatEnabled bool `mapstructure:"THECHEAT_ENABLED"`
	// TheCheatCacheTTL은 사기 조회 결과 캐시 유효 기간입니다.
	TheCheatCacheTTL time.Duration `mapstructure:"THECHEAT_CACHE_TTL"`

	// ─── 블랙리스트 스크리닝 (Blacklist-DB) ───

	// BlacklistBaseURL은 Blacklist-DB Partner API의 기본 URL입니다 (예: http://host:port/v1).
	BlacklistBaseURL string `mapstructure:"BLACKLIST_BASE_URL"`
	// BlacklistAPIKey는 Blacklist-DB API 인증 키 (32자리)입니다.
	BlacklistAPIKey string `mapstructure:"BLACKLIST_API_KEY"`
	// BlacklistPartnerID는 Blacklist-DB X-Partner-Id 헤더 값 (이메일 @ 앞부분)입니다.
	BlacklistPartnerID string `mapstructure:"BLACKLIST_PARTNER_ID"`
	// BlacklistEnabled는 블랙리스트 스크리닝 기능의 활성화 여부입니다.
	BlacklistEnabled bool `mapstructure:"BLACKLIST_ENABLED"`
	// BlacklistCacheTTL은 블랙리스트 스크리닝 결과 캐시 유효 기간입니다.
	BlacklistCacheTTL time.Duration `mapstructure:"BLACKLIST_CACHE_TTL"`
}

// LoadConfig는 .env 파일과 환경 변수로부터 설정을 로드합니다.
// 1. 우선적으로 지정된 경로의 .env 파일을 찾아 설정을 읽어옵니다.
// 2. 이후 환경 변수(Environment Variables)를 확인하여 .env의 설정을 덮어씁니다.
// 3. 설정이 누락된 항목들에 대해서는 비즈니스 로직에 안전한 기본값을 할당합니다.
// 4. FIX H-10: 보안상 필수 항목(JWTSecret, EncryptionKey)이 비어 있으면 오류를 반환합니다.
func LoadConfig(path string) (config Config, err error) {
	// Viper 설정: .env 파일의 위치와 포맷을 정의합니다.
	viper.AddConfigPath(path)
	viper.SetConfigName(".env")
	viper.SetConfigType("env")

	// 환경 변수 자동 매핑: 대문자 및 언더바(_) 형식의 환경 변수를 구조체 필드에 매핑합니다.
	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// ─── 기본값 설정 ───
	// 별도의 설정이 없을 경우 서버가 안정적으로 동작할 수 있도록 권장되는 기본값들을 정의합니다.

	// 서버 핵심 설정
	viper.SetDefault("GIN_MODE", "debug")
	viper.SetDefault("PORT", 5140)
	viper.SetDefault("FRONTEND_URL", "")
	viper.SetDefault("ADMIN_URL", "")
	viper.SetDefault("ADDITIONAL_CORS_ORIGINS", "")
	viper.SetDefault("TRUSTED_PROXY_IPS", "")
	viper.SetDefault("API_DOMAIN", "")

	// 인증 토큰(JWT) 유효 기간
	viper.SetDefault("JWT_ACCESS_EXPIRY", "1h")
	viper.SetDefault("JWT_REFRESH_EXPIRY", "168h")

	// 쿠키 및 로그 정책
	viper.SetDefault("COOKIE_SECURE", false)
	viper.SetDefault("COOKIE_DOMAIN", "")
	viper.SetDefault("LOG_LEVEL", "info")
	viper.SetDefault("LOG_PATH", "logs/app.log")
	viper.SetDefault("LOG_MAX_SIZE_MB", 10)
	viper.SetDefault("LOG_MAX_BACKUPS", 5)
	viper.SetDefault("LOG_MAX_AGE_DAYS", 30)

	// 보안 정책: 비밀번호 해싱 강도 및 계정 잠금 기준
	viper.SetDefault("BCRYPT_COST", 12)
	viper.SetDefault("ACCOUNT_LOCK_THRESHOLD", 5)
	viper.SetDefault("ACCOUNT_LOCK_DURATION", "30m")
	viper.SetDefault("MFA_TOKEN_EXPIRY", "5m")
	viper.SetDefault("PASSWORD_RESET_EXPIRY", "15m")

	// KYC / Coocon
	viper.SetDefault("KYC_SESSION_EXPIRY", "15m")
	viper.SetDefault("COOCON_KYC_URL", "http://103.97.209.176:8091/coocon-kyc.html")
	viper.SetDefault("COOCON_KYC_URL_SUB", "http://103.97.209.186:8091/coocon-kyc.html")

	// API 속도 제한 및 서버 타임아웃
	viper.SetDefault("GLOBAL_RATE_LIMIT", "100-M")
	viper.SetDefault("LOGIN_MAX_FAILURES", 10)
	viper.SetDefault("LOGIN_BLOCK_DURATION", "15m")
	viper.SetDefault("TRANSACTION_MAX_PER_MIN", 5)
	viper.SetDefault("SERVER_READ_TIMEOUT", "10s")
	viper.SetDefault("SERVER_WRITE_TIMEOUT", "10s")
	viper.SetDefault("SERVER_IDLE_TIMEOUT", "30s")
	// SERVER_READ_HEADER_TIMEOUT: 헤더 읽기 타임아웃 (Slowloris 공격 방어)
	viper.SetDefault("SERVER_READ_HEADER_TIMEOUT", "3s")
	viper.SetDefault("SHUTDOWN_GRACE_PERIOD", "10s")
	viper.SetDefault("MAX_REQUEST_BODY_BYTES", 2*1024*1024)

	// DB 커넥션 풀 설정
	viper.SetDefault("DB_MAX_IDLE_CONNS", 10)
	viper.SetDefault("DB_MAX_OPEN_CONNS", 100)
	viper.SetDefault("DB_CONN_MAX_LIFETIME", "1h")
	// DB_CONN_MAX_IDLE_TIME: 유휴 연결 최대 보유 시간 (좀비 연결 방지)
	viper.SetDefault("DB_CONN_MAX_IDLE_TIME", "10m")

	// 로그 관리 및 모니터링 주기
	viper.SetDefault("AUDIT_ARCHIVE_DAYS", 90)
	viper.SetDefault("AUDIT_DELETE_DAYS", 180)
	viper.SetDefault("HISTORY_COLLECT_INTERVAL", "3s")
	viper.SetDefault("HISTORY_MAX_POINTS", 60)

	// 이메일(SMTP) 기본 설정
	viper.SetDefault("SMTP_HOST", "")
	viper.SetDefault("SMTP_PORT", 587)
	viper.SetDefault("SMTP_USER", "")
	viper.SetDefault("SMTP_PASSWORD", "")
	viper.SetDefault("SMTP_FROM", "noreply@wowgift.co.kr")
	viper.SetDefault("SMTP_FROM_NAME", "W기프트")
	viper.SetDefault("SMTP_ENABLED", false)

	// 팝빌 기본 설정
	viper.SetDefault("POPBILL_LINK_ID", "")
	viper.SetDefault("POPBILL_SECRET_KEY", "")
	viper.SetDefault("POPBILL_CORP_NUM", "")
	viper.SetDefault("POPBILL_IS_TEST", true)

	// 발급 안전장치: 실제 PG 연동 전까지 Mock 발급만 허용 (기본값 false)
	viper.SetDefault("ALLOW_REAL_FULFILLMENT", false)

	// 파일 업로드 및 관리자 알림
	viper.SetDefault("UPLOAD_BASE_PATH", "uploads")
	viper.SetDefault("ADMIN_NOTIFY_EMAIL", "admin@wowgift.co.kr")
	viper.SetDefault("CS_EMAIL", "wow_gift@naver.com")
	viper.SetDefault("BIZ_EMAIL", "wow_gift@naver.com")
	viper.SetDefault("COMPLIANCE_EMAIL", "wow_gift@naver.com")

	// 브랜드 기본값
	viper.SetDefault("SITE_NAME", "W기프트")
	viper.SetDefault("SITE_BRAND", "W GIFT")
	viper.SetDefault("SITE_DOMAIN", "wowgift.co.kr")
	viper.SetDefault("COMPANY_NAME", "주식회사 바우처팩토리")
	viper.SetDefault("COMPANY_LICENSE_NO", "841-88-04007")
	viper.SetDefault("COMPANY_OWNER", "고정희")

	// 더치트 (사기 조회) 기본 설정
	viper.SetDefault("THECHEAT_API_KEY", "")
	viper.SetDefault("THECHEAT_ENC_KEY", "")
	viper.SetDefault("THECHEAT_ENABLED", false)
	viper.SetDefault("THECHEAT_CACHE_TTL", "24h")

	// 블랙리스트 스크리닝 (Blacklist-DB) 기본 설정
	viper.SetDefault("BLACKLIST_BASE_URL", "")
	viper.SetDefault("BLACKLIST_API_KEY", "")
	viper.SetDefault("BLACKLIST_PARTNER_ID", "")
	viper.SetDefault("BLACKLIST_ENABLED", false)
	viper.SetDefault("BLACKLIST_CACHE_TTL", "24h")

	// 설정 파일 읽기 시도
	err = viper.ReadInConfig()
	if err != nil {
		// 설정 파일(.env)이 없는 것은 치명적 오류가 아님 (시스템 환경 변수로 대체 가능)
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return
		}
	}

	// 최종 데이터를 Config 구조체로 파싱(Unmarshal)합니다.
	err = viper.Unmarshal(&config)
	if err != nil {
		return
	}

	// FIX H-10: 보안 필수 항목 누락 시 서버 시작을 차단합니다.
	if config.JWTSecret == "" {
		return config, fmt.Errorf("JWT_SECRET is required")
	}
	if len(config.JWTSecret) < 32 {
		return config, fmt.Errorf("JWT_SECRET must be at least 32 characters (current: %d)", len(config.JWTSecret))
	}
	if config.EncryptionKey == "" {
		return config, fmt.Errorf("ENCRYPTION_KEY is required")
	}

	// COOKIE_SECURE 강제: 릴리즈 모드에서 false로 설정된 경우 강제로 true로 변경합니다.
	// HTTPS가 아닌 환경에서 세션 쿠키가 탈취될 수 있는 보안 위협을 방지합니다.
	if gin.Mode() == gin.ReleaseMode && !config.CookieSecure {
		log.Printf("[WARN] config: COOKIE_SECURE=false in release mode — 보안상 위험하므로 강제로 true로 설정합니다. 운영 환경에서는 반드시 COOKIE_SECURE=true를 명시하세요.")
		config.CookieSecure = true
	}

	return
}
