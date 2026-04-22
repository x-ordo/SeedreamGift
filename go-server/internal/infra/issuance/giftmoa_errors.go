package issuance

import (
	"errors"
	"strconv"
	"strings"
)

// ──────────────────────────────────────────────
// 센티넬 에러 (errors.Is로 매칭 가능)
// ──────────────────────────────────────────────

var (
	// Wrapper 에러
	ErrMoaParamParsing = errors.New("MOA: 파라미터 파싱 오류 (WRP0001)")
	ErrMoaServerError  = errors.New("MOA: 서버 연결 오류 (WRP0500)")

	// 발급 에러
	ErrMoaIssuanceFailed  = errors.New("MOA: 발급 실패")
	ErrMoaPartialIssuance = errors.New("MOA: 발급 성공, 상세조회 실패 — 재시도 금지")

	// 비즈니스 에러 (재시도 무의미)
	ErrMoaInsufficientPoint = errors.New("MOA: 잔여 포인트 부족")
	ErrMoaLimitExceeded     = errors.New("MOA: 한도 초과")
	ErrMoaCardError         = errors.New("MOA: 카드/상품권 오류")
	ErrMoaAuthError         = errors.New("MOA: 인증/권한 오류")
	ErrMoaRefundError       = errors.New("MOA: 환불 처리 오류")
	ErrMoaOrderError        = errors.New("MOA: 주문 처리 오류")
)

// ──────────────────────────────────────────────
// MOA resultCode → 에러 분류
// 상품권API.docx 4장 "에러코드" 기준
// ──────────────────────────────────────────────

// MoaErrorCategory는 MOA 에러 코드를 카테고리별로 분류합니다.
// sentinel: 에러 종류, retryable: 재시도 가능 여부
func MoaErrorCategory(resultCode string) (sentinel error, retryable bool) {
	// Wrapper 에러 (문자열)
	switch resultCode {
	case "WRP0001":
		return ErrMoaParamParsing, false
	case "WRP0500":
		return ErrMoaServerError, true
	}

	// 숫자 코드 파싱
	code, err := strconv.Atoi(resultCode)
	if err != nil {
		return ErrMoaIssuanceFailed, false
	}

	// 성공 코드: 0000~0004
	if code >= 0 && code <= 4 {
		return nil, false
	}

	switch {
	// ─── 9xxx: 파라미터 에러 ───
	// 9000~9250: 각종 필수값 누락, 형식 오류
	// 재시도 무의미 (요청 자체가 잘못됨)
	case code >= 9000 && code <= 9250:
		return ErrMoaParamParsing, false

	// 9900: 일반 에러 — 일시적일 수 있으므로 재시도 가능
	case code == 9900:
		return ErrMoaIssuanceFailed, true

	// 9901: 시스템 에러 — 재시도 가능
	case code == 9901:
		return ErrMoaServerError, true

	// ─── 1100~1119: 회원 관련 에러 ───
	// 1101: 회원 가입 실패, 1103~1108: 본인확인 실패, 1109~1119: 카드 발급 조건 미충족
	case code >= 1100 && code <= 1119:
		return ErrMoaAuthError, false

	// ─── 1200~1218: 카드 관련 에러 ───
	// 1200: 카드 에러, 1201~1205: 카드 검증 실패
	// 1210~1218: 카드 상태 에러 (분실, 해지, 사용불가, 환불불가, 유효기간만료 등)
	case code >= 1200 && code <= 1218:
		return ErrMoaCardError, false

	// ─── 1300~1313: 판매자/본인인증 에러 ───
	// 1300~1301: 가맹 관련, 1302~1305: 판매자 검증, 1306~1313: 본인인증
	case code >= 1300 && code <= 1313:
		return ErrMoaAuthError, false

	// ─── 1400~1403: 상품권 발급 에러 ───
	// 1400: 상품권 발급 실패
	// 1401: 입금계좌 없음
	// 1402: 발급 이력 조회 실패
	// 1403: 발급한도 초과
	case code == 1403:
		return ErrMoaLimitExceeded, false
	case code >= 1400 && code <= 1402:
		return ErrMoaIssuanceFailed, false

	// ─── 1500~1510: 충전 에러 ───
	// 1501: 최소금액 미달, 1504: 계좌 입금불가, 1506: 한도초과
	case code == 1506:
		return ErrMoaLimitExceeded, false
	case code >= 1500 && code <= 1510:
		return ErrMoaInsufficientPoint, false

	// ─── 1600~1604: 충전 취소 에러 ───
	case code >= 1600 && code <= 1604:
		return ErrMoaRefundError, false

	// ─── 1700~1709: 이체 에러 ───
	// 1701: 잔액부족, 1702: 한도초과
	case code == 1702:
		return ErrMoaLimitExceeded, false
	case code >= 1700 && code <= 1709:
		return ErrMoaInsufficientPoint, false

	// ─── 1800~1808: 이체 취소 에러 ───
	case code >= 1800 && code <= 1808:
		return ErrMoaRefundError, false

	// ─── 1900~1904: 전환 에러 ───
	case code >= 1900 && code <= 1904:
		return ErrMoaIssuanceFailed, false

	// ─── 2000~2011: 전환 이체 에러 ───
	// 2005: 1회 한도초과, 2006: 1일 한도초과
	case code == 2005 || code == 2006:
		return ErrMoaLimitExceeded, false
	case code >= 2000 && code <= 2011:
		return ErrMoaIssuanceFailed, false

	// ─── 2100~2406: 조회/주문 에러 ───
	case code >= 2100 && code <= 2200:
		return ErrMoaIssuanceFailed, false
	case code >= 2300 && code <= 2301:
		return ErrMoaCardError, false
	// 2400~2406: 주문 관련 (2404: 중복, 2405: 조회횟수초과, 2406: 환불횟수초과)
	case code >= 2400 && code <= 2406:
		return ErrMoaOrderError, false

	// ─── 3000~3001: 가맹점 에러 ───
	case code >= 3000 && code <= 3001:
		return ErrMoaAuthError, false

	// ─── 4000~4004: QR 에러 ───
	case code >= 4000 && code <= 4004:
		return ErrMoaIssuanceFailed, false

	// ─── 5000~5199: ARS/통신 에러 ───
	// 통신 관련이므로 일시적 — 재시도 가능
	case code >= 5000 && code <= 5199:
		return ErrMoaServerError, true

	// ─── 6001~6003: 한도 초과 ───
	// 6001: 1회 한도, 6002: 1일 한도, 6003: 1월 한도
	case code >= 6001 && code <= 6003:
		return ErrMoaLimitExceeded, false

	// ─── 8400~8404: 상품권 에러 ───
	// 8400: 상품권 에러, 8401: 조회결과없음, 8402: 이미사용, 8403: 처리불가, 8404: 거래정지
	case code >= 8400 && code <= 8404:
		return ErrMoaCardError, false
	}

	// 미분류 코드 — 안전하게 실패, 재시도 안 함
	return ErrMoaIssuanceFailed, false
}

// ──────────────────────────────────────────────
// 유틸리티
// ──────────────────────────────────────────────

// ExtractPublishCnt는 ErrMoaPartialIssuance 에러 메시지에서 publishCnt를 추출합니다.
func ExtractPublishCnt(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	const prefix = "publishCnt="
	idx := strings.Index(msg, prefix)
	if idx < 0 {
		return ""
	}
	rest := msg[idx+len(prefix):]
	if end := strings.IndexAny(rest, ",: "); end > 0 {
		return rest[:end]
	}
	return rest
}

// IsRetryable는 MOA 에러가 재시도 가능한지 판단합니다.
func IsRetryable(err error) bool {
	if err == nil {
		return false
	}
	// 부분 발급은 절대 재시도 불가
	if errors.Is(err, ErrMoaPartialIssuance) {
		return false
	}
	// 서버/네트워크 에러는 재시도 가능
	if errors.Is(err, ErrMoaServerError) {
		return true
	}
	// 9900(일반 에러)은 ErrMoaIssuanceFailed로 매핑되지만 retryable=true
	// checkError에서 "retryable=true"가 에러 메시지에 포함됨
	if strings.Contains(err.Error(), "retryable=true") {
		return true
	}
	// 나머지 비즈니스 에러는 재시도 무의미
	return false
}
