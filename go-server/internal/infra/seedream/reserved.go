package seedream

import (
	"errors"
	"fmt"
	"strings"
)

// ErrReservedRoundTripViolation 은 RESERVED 왕복 불변식 위반 시 반환됩니다.
// 발급/조회/웹훅 응답에서 클라이언트가 보낸 값과 달라진 경우 sentinel.
var ErrReservedRoundTripViolation = errors.New("RESERVED roundtrip violated")

// ReservedIndex2For 는 주문 소스(USER/PARTNER/ADMIN)에서 reservedIndex2 문자열을 계산합니다.
//
// 규칙 (Phase 1 설계 결정 D1):
//   - Source "USER"    → "partner-default"
//   - Source "PARTNER" → "partner-<partnerID>" (partnerID max 12자)
//   - Source "ADMIN"   → "partner-admin"
//
// 제약: 결과 max 20자. Seedream 발급 후 영구 불변.
func ReservedIndex2For(source string, partnerID *string) (string, error) {
	switch strings.ToUpper(source) {
	case "USER":
		return "partner-default", nil
	case "ADMIN":
		return "partner-admin", nil
	case "PARTNER":
		if partnerID == nil || *partnerID == "" {
			return "", fmt.Errorf("PARTNER source 는 partnerID 가 필수입니다")
		}
		if len(*partnerID) > 12 {
			return "", fmt.Errorf("partnerID 가 12자를 초과합니다 (20자 제한)")
		}
		return "partner-" + *partnerID, nil
	default:
		return "", fmt.Errorf("알 수 없는 Source: %q (USER|PARTNER|ADMIN)", source)
	}
}

// ReservedFields 는 왕복 검증에 쓰이는 3 필드의 스냅샷입니다.
type ReservedFields struct {
	ReservedIndex1 string
	ReservedIndex2 string
	ReservedString string
}

// AssertReservedInvariant 는 응답/이벤트 페이로드의 RESERVED 3필드가 요청 시
// 기대값과 일치하는지 검증합니다. 위반 시 ErrReservedRoundTripViolation 을 %w 로 감싸
// 반환하여 호출자가 errors.Is 로 식별 가능.
func AssertReservedInvariant(expectedReservedIndex2 string, got ReservedFields) error {
	if got.ReservedIndex1 != ReservedIndex1Fixed {
		return fmt.Errorf("%w: reservedIndex1=%q", ErrReservedRoundTripViolation, got.ReservedIndex1)
	}
	if got.ReservedIndex2 != expectedReservedIndex2 {
		return fmt.Errorf("%w: reservedIndex2 기대=%q 실제=%q",
			ErrReservedRoundTripViolation, expectedReservedIndex2, got.ReservedIndex2)
	}
	if got.ReservedString != ReservedStringFixed {
		return fmt.Errorf("%w: reservedString=%q", ErrReservedRoundTripViolation, got.ReservedString)
	}
	return nil
}
