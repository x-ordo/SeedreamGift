// Package crypto는 Go 서버를 위한 고성능 암호화 유틸리티를 제공합니다.
// 비밀번호 해싱, 데이터 암호화 및 복호화를 위한 산업 표준 알고리즘을 처리합니다.
package crypto

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// SHA256Hash는 입력 문자열의 SHA-256 해시를 생성하고 16진수 문자열로 반환합니다.
func SHA256Hash(input string) string {
	h := sha256.Sum256([]byte(input))
	return hex.EncodeToString(h[:])
}

// HashPassword는 bcrypt를 사용하여 비밀번호를 해싱합니다.
// cost가 0이면 기본값 12를 사용합니다.
func HashPassword(password string, cost int) (string, error) {
	if cost == 0 {
		cost = 12
	}
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), cost)
	return string(hashed), err
}

// CheckPasswordHash는 평문 비밀번호를 bcrypt 해시와 비교합니다.
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// Encrypt는 AES-256-GCM을 사용하여 평문을 16진수 문자열로 암호화합니다.
func Encrypt(plainText string, keyString string) (string, error) {
	key, err := hex.DecodeString(keyString)
	if err != nil {
		return "", fmt.Errorf("invalid hex key: %w", err)
	}
	if len(key) != 32 {
		return "", errors.New("key must be 32 bytes (64 hex characters)")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	iv := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}

	cipherText := gcm.Seal(nil, iv, []byte(plainText), nil)
	return fmt.Sprintf("%x:%x", iv, cipherText), nil
}

// Decrypt는 AES-256-GCM을 사용하여 암호화된 16진수 문자열을 다시 평문으로 복호화합니다.
func Decrypt(cipherTextWithIv string, keyString string) (string, error) {
	key, err := hex.DecodeString(keyString)
	if err != nil {
		return "", fmt.Errorf("invalid hex key: %w", err)
	}
	if len(key) != 32 {
		return "", errors.New("key must be 32 bytes (64 hex characters)")
	}

	parts := strings.Split(cipherTextWithIv, ":")
	if len(parts) != 2 {
		return "", errors.New("invalid ciphertext format")
	}

	iv, err := hex.DecodeString(parts[0])
	if err != nil {
		return "", fmt.Errorf("invalid IV hex: %w", err)
	}
	cipherText, err := hex.DecodeString(parts[1])
	if err != nil {
		return "", fmt.Errorf("invalid ciphertext hex: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	plainText, err := gcm.Open(nil, iv, cipherText, nil)
	if err != nil {
		return "", err
	}

	return string(plainText), nil
}

// cbcKey는 CBC 암복호화에 사용할 32바이트 키를 파생합니다.
// 우선 hex 디코딩을 시도하고, 실패하면 레거시 방식(문자열 첫 32바이트)으로 폴백합니다.
func cbcKey(keyString string) ([]byte, error) {
	key, err := hex.DecodeString(keyString)
	if err == nil {
		if len(key) != 32 {
			return nil, fmt.Errorf("hex-decoded CBC key must be 32 bytes (64 hex chars), got %d bytes", len(key))
		}
		return key, nil
	}
	// hex 디코딩 실패 — 레거시 문자열 슬라이스 방식으로 폴백 (하위 호환)
	log.Printf("[WARN] crypto.cbcKey: hex decode failed (%v); falling back to raw string slice (legacy mode). Consider migrating ENCRYPTION_KEY to hex format.", err)
	if len(keyString) < 32 {
		return nil, errors.New("key must be at least 32 characters (legacy mode)")
	}
	return []byte(keyString[:32]), nil
}

// EncryptCBC는 AES-256-CBC와 PKCS7 패딩을 사용하여 평문을 암호화합니다. (레거시 CBC 데이터 호환)
func EncryptCBC(plainText, keyString string) (string, error) {
	key, err := cbcKey(keyString)
	if err != nil {
		return "", fmt.Errorf("EncryptCBC: invalid key: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create AES cipher: %w", err)
	}

	padded := pkcs7Pad([]byte(plainText), aes.BlockSize)

	iv := make([]byte, aes.BlockSize)
	if _, err = io.ReadFull(rand.Reader, iv); err != nil {
		return "", fmt.Errorf("failed to generate IV: %w", err)
	}

	cipherText := make([]byte, len(padded))
	mode := cipher.NewCBCEncrypter(block, iv)
	mode.CryptBlocks(cipherText, padded)

	return fmt.Sprintf("%x:%x", iv, cipherText), nil
}

// DecryptCBC는 레거시 AES-256-CBC 암호화 데이터를 복호화합니다.
func DecryptCBC(cipherTextWithIv, keyString string) (string, error) {
	key, err := cbcKey(keyString)
	if err != nil {
		return "", fmt.Errorf("DecryptCBC: invalid key: %w", err)
	}

	parts := strings.SplitN(cipherTextWithIv, ":", 2)
	if len(parts) != 2 {
		return "", errors.New("invalid ciphertext format: missing ':' separator")
	}

	ivHex := parts[0]
	if len(ivHex) != 32 {
		return "", fmt.Errorf("invalid IV length: expected 32 hex chars, got %d", len(ivHex))
	}

	iv, err := hex.DecodeString(ivHex)
	if err != nil {
		return "", fmt.Errorf("invalid IV hex: %w", err)
	}

	cipherText, err := hex.DecodeString(parts[1])
	if err != nil {
		return "", fmt.Errorf("invalid ciphertext hex: %w", err)
	}

	if len(cipherText) == 0 {
		return "", errors.New("ciphertext is empty")
	}
	if len(cipherText)%aes.BlockSize != 0 {
		return "", fmt.Errorf("ciphertext length %d is not a multiple of AES block size", len(cipherText))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create AES cipher: %w", err)
	}

	plainText := make([]byte, len(cipherText))
	mode := cipher.NewCBCDecrypter(block, iv)
	mode.CryptBlocks(plainText, cipherText)

	unpadded, err := pkcs7Unpad(plainText, aes.BlockSize)
	if err != nil {
		return "", fmt.Errorf("invalid padding: %w", err)
	}

	return string(unpadded), nil
}

// DecryptAuto는 AES-256-CBC(레거시) 또는 AES-256-GCM 중 자동 감지하여 복호화합니다.
func DecryptAuto(cipherTextWithIv, keyString string) (string, error) {
	ivHex, _, found := strings.Cut(cipherTextWithIv, ":")
	if !found {
		return cipherTextWithIv, nil
	}

	switch len(ivHex) {
	case 32: // 16 bytes → AES-256-CBC (레거시)
		return DecryptCBC(cipherTextWithIv, keyString)
	case 24: // 12 bytes → AES-256-GCM (Go internal)
		return Decrypt(cipherTextWithIv, keyString)
	default:
		return "", fmt.Errorf("unrecognized IV length %d: cannot determine encryption mode", len(ivHex))
	}
}

// pkcs7Pad는 데이터의 길이가 blockSize의 배수가 되도록 PKCS7 패딩을 추가합니다.
// blockSize는 1에서 255 사이여야 합니다.
func pkcs7Pad(src []byte, blockSize int) []byte {
	padding := blockSize - len(src)%blockSize
	padText := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(src, padText...)
}

// pkcs7Unpad는 데이터에서 PKCS7 패딩을 제거합니다.
// 패딩이 잘못되었거나 일치하지 않으면 에러를 반환합니다.
func pkcs7Unpad(src []byte, blockSize int) ([]byte, error) {
	length := len(src)
	if length == 0 {
		return nil, errors.New("input is empty")
	}
	if length%blockSize != 0 {
		return nil, fmt.Errorf("input length %d is not a multiple of block size %d", length, blockSize)
	}

	padding := int(src[length-1])
	if padding == 0 || padding > blockSize {
		return nil, fmt.Errorf("invalid padding byte: %d", padding)
	}

	// Verify all padding bytes are consistent.
	for i := length - padding; i < length; i++ {
		if src[i] != byte(padding) {
			return nil, errors.New("inconsistent padding bytes")
		}
	}

	return src[:length-padding], nil
}
