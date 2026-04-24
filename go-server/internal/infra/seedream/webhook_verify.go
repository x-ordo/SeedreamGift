package seedream

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"
	"time"
)

// DefaultMaxSkew 는 Seedream 상위 가이드 §8.4 권장치 (webhookverify.Verify 주석).
// ±10분 허용 — 시계 드리프트 및 네트워크 지연 수용.
const DefaultMaxSkew = 10 * time.Minute

var (
	// ErrInvalidTimestamp 는 X-Seedream-Timestamp 헤더 파싱 실패.
	ErrInvalidTimestamp = errors.New("seedream: X-Seedream-Timestamp parse 실패")
	// ErrTimestampSkew 는 timestamp 가 허용 범위(±DefaultMaxSkew) 를 초과.
	ErrTimestampSkew = errors.New("seedream: X-Seedream-Timestamp skew 초과")
	// ErrSignaturePrefix 는 서명 헤더가 "sha256=" 으로 시작하지 않음.
	ErrSignaturePrefix = errors.New("seedream: X-Seedream-Signature 는 'sha256=' 접두사 필수")
	// ErrSignatureMismatch 는 HMAC 계산 결과 불일치.
	ErrSignatureMismatch = errors.New("seedream: X-Seedream-Signature HMAC 불일치")
)

// VerifyWebhook 는 Seedream 웹훅 서명 프로토콜을 검증합니다.
//
//	signed_payload = "{timestamp}.{rawBody}"
//	signature      = hex(HMAC-SHA256(secret, signed_payload))
//	header         = "sha256=" + signature
//
// 검증 실패 시 구체적 원인 error 를 반환하되 **호출자는 무조건 500 반환**해야 합니다.
// 4xx 반환 시 Seedream 이 즉시 DLQ 로 드롭 (상위 가이드 §8.6.3) — 시크릿/시계 일시 장애를
// 영구 실패로 굳히지 않도록 주의.
//
// maxSkew 는 허용 시계 드리프트 — 일반적으로 DefaultMaxSkew(10분) 사용.
func VerifyWebhook(secret string, rawBody []byte, tsHeader, sigHeader string, maxSkew time.Duration) error {
	ts, err := strconv.ParseInt(tsHeader, 10, 64)
	if err != nil {
		return ErrInvalidTimestamp
	}
	age := time.Since(time.Unix(ts, 0))
	if age < 0 {
		age = -age
	}
	if age > maxSkew {
		return ErrTimestampSkew
	}

	got, ok := strings.CutPrefix(sigHeader, "sha256=")
	if !ok {
		return ErrSignaturePrefix
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(tsHeader))
	mac.Write([]byte{'.'})
	mac.Write(rawBody)
	want := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(got), []byte(want)) {
		return ErrSignatureMismatch
	}
	return nil
}
