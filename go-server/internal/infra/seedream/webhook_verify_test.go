package seedream

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func signedHeader(t *testing.T, secret string, ts int64, body []byte) (tsHeader, sigHeader string) {
	t.Helper()
	tsHeader = fmt.Sprintf("%d", ts)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(tsHeader))
	mac.Write([]byte{'.'})
	mac.Write(body)
	sigHeader = "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return
}

func TestVerifyWebhook_Success(t *testing.T) {
	secret := "whsec_test_abc"
	body := []byte(`{"eventId":"evt-1","orderNo":"ORD-1"}`)
	ts, sig := signedHeader(t, secret, time.Now().Unix(), body)

	err := VerifyWebhook(secret, body, ts, sig, DefaultMaxSkew)
	assert.NoError(t, err)
}

func TestVerifyWebhook_TimestampSkew(t *testing.T) {
	secret := "whsec_test_abc"
	body := []byte(`{}`)
	// 20분 전 timestamp — 허용 범위(10분) 초과
	old := time.Now().Add(-20 * time.Minute).Unix()
	ts, sig := signedHeader(t, secret, old, body)

	err := VerifyWebhook(secret, body, ts, sig, DefaultMaxSkew)
	assert.Error(t, err)
	assert.True(t, errors.Is(err, ErrTimestampSkew))
}

func TestVerifyWebhook_SignatureMismatch(t *testing.T) {
	secret := "whsec_test_abc"
	body := []byte(`{"eventId":"evt-1"}`)
	ts, sig := signedHeader(t, secret, time.Now().Unix(), body)

	// body 를 변조
	tamperedBody := []byte(`{"eventId":"evt-tampered"}`)
	err := VerifyWebhook(secret, tamperedBody, ts, sig, DefaultMaxSkew)
	assert.Error(t, err)
	assert.True(t, errors.Is(err, ErrSignatureMismatch))
}

func TestVerifyWebhook_InvalidTimestamp(t *testing.T) {
	err := VerifyWebhook("secret", []byte("{}"), "not-a-number", "sha256=abc", DefaultMaxSkew)
	assert.Error(t, err)
	assert.True(t, errors.Is(err, ErrInvalidTimestamp))
}

func TestVerifyWebhook_MissingPrefix(t *testing.T) {
	secret := "s"
	ts, sig := signedHeader(t, secret, time.Now().Unix(), []byte("{}"))
	// sha256= 제거
	err := VerifyWebhook(secret, []byte("{}"), ts, sig[len("sha256="):], DefaultMaxSkew)
	assert.Error(t, err)
	assert.True(t, errors.Is(err, ErrSignaturePrefix))
}

func TestVerifyWebhook_FutureSkew(t *testing.T) {
	secret := "s"
	body := []byte("{}")
	// 20분 미래 (허용 초과)
	future := time.Now().Add(20 * time.Minute).Unix()
	ts, sig := signedHeader(t, secret, future, body)
	err := VerifyWebhook(secret, body, ts, sig, DefaultMaxSkew)
	assert.Error(t, err)
	assert.True(t, errors.Is(err, ErrTimestampSkew))
}
