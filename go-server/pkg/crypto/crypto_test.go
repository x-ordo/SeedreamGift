package crypto

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 테스트용 64-char hex 키 (32 bytes)
const testKey = "6464646464646464646464646464646464646464646464646464646464646464"

// ── SHA256Hash ──

func TestSHA256Hash(t *testing.T) {
	// "hello"의 SHA-256은 잘 알려진 해시값입니다.
	expected := "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
	actual := SHA256Hash("hello")
	assert.Equal(t, expected, actual)
}

func TestSHA256Hash_Empty(t *testing.T) {
	// 빈 문자열의 SHA-256 해시
	expected := "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
	actual := SHA256Hash("")
	assert.Equal(t, expected, actual)
}

// ── HashPassword / CheckPassword ──

func TestHashPassword_CheckPassword(t *testing.T) {
	password := "securePassword123!"

	hashed, err := HashPassword(password, 4) // 테스트에서는 낮은 cost 사용
	require.NoError(t, err)
	assert.NotEmpty(t, hashed)
	assert.NotEqual(t, password, hashed, "해시된 비밀번호는 원문과 달라야 합니다")

	// 올바른 비밀번호 검증
	assert.True(t, CheckPasswordHash(password, hashed), "올바른 비밀번호는 검증에 성공해야 합니다")

	// 잘못된 비밀번호 검증
	assert.False(t, CheckPasswordHash("wrongPassword", hashed), "잘못된 비밀번호는 검증에 실패해야 합니다")
}

func TestHashPassword_DefaultCost(t *testing.T) {
	// cost=0이면 기본값 12를 사용
	hashed, err := HashPassword("test", 0)
	require.NoError(t, err)
	assert.True(t, CheckPasswordHash("test", hashed))
}

// ── Encrypt / Decrypt (AES-256-GCM) ──

func TestEncryptDecrypt_GCM(t *testing.T) {
	plainText := "Hello, AES-256-GCM! 한글 테스트"

	encrypted, err := Encrypt(plainText, testKey)
	require.NoError(t, err)
	assert.NotEmpty(t, encrypted)
	assert.Contains(t, encrypted, ":", "암호화 결과는 iv:ciphertext 형식이어야 합니다")

	decrypted, err := Decrypt(encrypted, testKey)
	require.NoError(t, err)
	assert.Equal(t, plainText, decrypted, "복호화 결과가 원문과 일치해야 합니다")
}

func TestEncrypt_GCM_DifferentCiphertexts(t *testing.T) {
	// 동일 평문이라도 매번 다른 IV로 인해 다른 암호문이 생성되어야 합니다.
	enc1, err1 := Encrypt("same", testKey)
	enc2, err2 := Encrypt("same", testKey)
	require.NoError(t, err1)
	require.NoError(t, err2)
	assert.NotEqual(t, enc1, enc2, "동일 평문이라도 암호문은 매번 달라야 합니다")
}

func TestEncrypt_GCM_InvalidKey(t *testing.T) {
	_, err := Encrypt("test", "shortkey")
	assert.Error(t, err, "짧은 키는 에러를 반환해야 합니다")
}

// ── EncryptCBC / DecryptCBC ──

func TestEncryptCBC_DecryptCBC(t *testing.T) {
	plainText := "CBC round-trip test! 상품권 PIN: 1234-5678"

	encrypted, err := EncryptCBC(plainText, testKey)
	require.NoError(t, err)
	assert.NotEmpty(t, encrypted)
	assert.Contains(t, encrypted, ":")

	decrypted, err := DecryptCBC(encrypted, testKey)
	require.NoError(t, err)
	assert.Equal(t, plainText, decrypted, "CBC 복호화 결과가 원문과 일치해야 합니다")
}

func TestEncryptCBC_InvalidKey(t *testing.T) {
	_, err := EncryptCBC("test", "tooshort")
	assert.Error(t, err, "짧은 키(32바이트 미만)는 에러를 반환해야 합니다")
}

func TestDecryptCBC_InvalidData(t *testing.T) {
	// 콜론이 없는 경우
	_, err := DecryptCBC("notseparated", testKey)
	assert.Error(t, err, "잘못된 형식은 에러를 반환해야 합니다")

	// IV 길이가 올바르지 않은 경우
	_, err = DecryptCBC("abcd:1234", testKey)
	assert.Error(t, err, "잘못된 IV 길이는 에러를 반환해야 합니다")

	// 유효한 IV 길이(32 hex chars)이지만 ciphertext가 올바르지 않은 경우
	_, err = DecryptCBC("00112233445566778899aabbccddeeff:zzzz", testKey)
	assert.Error(t, err, "유효하지 않은 hex ciphertext는 에러를 반환해야 합니다")
}

// ── DecryptAuto ──

func TestDecryptAuto_GCM(t *testing.T) {
	plain := "auto-detect GCM"
	enc, err := Encrypt(plain, testKey)
	require.NoError(t, err)

	dec, err := DecryptAuto(enc, testKey)
	require.NoError(t, err)
	assert.Equal(t, plain, dec)
}

func TestDecryptAuto_CBC(t *testing.T) {
	plain := "auto-detect CBC"
	enc, err := EncryptCBC(plain, testKey)
	require.NoError(t, err)

	dec, err := DecryptAuto(enc, testKey)
	require.NoError(t, err)
	assert.Equal(t, plain, dec)
}

func TestDecryptAuto_NoCiphertext(t *testing.T) {
	// 콜론이 없으면 원문 그대로 반환
	result, err := DecryptAuto("plaintext", testKey)
	require.NoError(t, err)
	assert.Equal(t, "plaintext", result)
}

// ── PKCS7 Padding (pkcs7Pad / pkcs7Unpad) ──

func TestPkcs7Pad_Unpad(t *testing.T) {
	data := []byte("hello")
	padded := pkcs7Pad(data, 16)
	assert.Equal(t, 16, len(padded), "패딩 후 길이는 블록 크기의 배수여야 합니다")

	unpadded, err := pkcs7Unpad(padded, 16)
	require.NoError(t, err)
	assert.Equal(t, data, unpadded)
}

func TestPkcs7Unpad_InvalidPadding(t *testing.T) {
	// 빈 입력
	_, err := pkcs7Unpad([]byte{}, 16)
	assert.Error(t, err)

	// 패딩 바이트가 0인 경우
	bad := make([]byte, 16)
	bad[15] = 0
	_, err = pkcs7Unpad(bad, 16)
	assert.Error(t, err)
}

// ── CBC Legacy fallback mode ──

func TestEncryptCBC_LegacyStringKey(t *testing.T) {
	// 32자 이상의 일반 문자열 키 (hex 디코딩 실패 시 레거시 모드로 폴백)
	// 반드시 hex로 파싱 불가능한 문자를 포함해야 합니다 (예: 'z', 'k', 'p' 등).
	legacyKey := strings.Repeat("z", 32) // 'z'는 유효한 hex 문자가 아님

	encrypted, err := EncryptCBC("legacy mode test", legacyKey)
	require.NoError(t, err)

	decrypted, err := DecryptCBC(encrypted, legacyKey)
	require.NoError(t, err)
	assert.Equal(t, "legacy mode test", decrypted)
}
