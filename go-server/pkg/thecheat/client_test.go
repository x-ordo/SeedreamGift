package thecheat

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testEncKey = "n1l3uaJwVpc^*qMR2dYQT5k7CcHdVfJ9"

func TestEncryptDecrypt(t *testing.T) {
	plaintext := "01012345678"
	encrypted, err := encryptAES256CBC(plaintext, testEncKey)
	require.NoError(t, err)
	assert.NotEqual(t, plaintext, encrypted)

	decrypted, err := decryptAES256CBC(encrypted, testEncKey)
	require.NoError(t, err)
	assert.Equal(t, plaintext, decrypted)
}

func TestClient_Search_CautionY(t *testing.T) {
	fraudResult := FraudResult{
		Keyword:     "01044440000",
		KeywordType: "phone",
		Caution:     "Y",
		KeywordURL:  "https://thecheat.co.kr/report/12345",
	}
	fraudJSON, _ := json.Marshal(fraudResult)
	encryptedContent, _ := encryptAES256CBC(string(fraudJSON), testEncKey)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "test-api-key", r.Header.Get("X-TheCheat-ApiKey"))
		assert.Equal(t, http.MethodPost, r.Method)
		json.NewEncoder(w).Encode(Response{
			ResultCode: 1,
			ResultMsg:  "success (test)",
			Content:    encryptedContent,
		})
	}))
	defer server.Close()

	client := NewClient("test-api-key", testEncKey, nil)
	client.baseURL = server.URL

	result, err := client.Search("01044440000", "phone", "")
	require.NoError(t, err)
	assert.Equal(t, "Y", result.Caution)
	assert.Equal(t, "01044440000", result.Keyword)
	assert.Equal(t, "https://thecheat.co.kr/report/12345", result.KeywordURL)
}

func TestClient_Search_CautionN(t *testing.T) {
	fraudResult := FraudResult{
		Keyword:     "01000000000",
		KeywordType: "phone",
		Caution:     "N",
	}
	fraudJSON, _ := json.Marshal(fraudResult)
	encryptedContent, _ := encryptAES256CBC(string(fraudJSON), testEncKey)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(Response{
			ResultCode: 1,
			ResultMsg:  "success (test)",
			Content:    encryptedContent,
		})
	}))
	defer server.Close()

	client := NewClient("test-api-key", testEncKey, nil)
	client.baseURL = server.URL

	result, err := client.Search("01000000000", "phone", "")
	require.NoError(t, err)
	assert.Equal(t, "N", result.Caution)
}

func TestClient_Search_APIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(Response{
			ResultCode: -2,
			ResultMsg:  "Invalid API Key",
		})
	}))
	defer server.Close()

	client := NewClient("bad-key", testEncKey, nil)
	client.baseURL = server.URL

	_, err := client.Search("01044440000", "phone", "")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Invalid API Key")
}

func TestClient_Search_HTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Internal Server Error"))
	}))
	defer server.Close()

	client := NewClient("key", testEncKey, nil)
	client.baseURL = server.URL

	_, err := client.Search("01012345678", "phone", "")
	assert.Error(t, err)
}

func TestClient_Search_NetworkError(t *testing.T) {
	client := NewClient("key", testEncKey, nil)
	client.baseURL = "http://localhost:1" // nothing listening here

	_, err := client.Search("01012345678", "phone", "")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "HTTP 요청 실패")
}

// ════════════════════════════════════════════
// 실제 데이터 기반 시나리오 테스트
// 제휴사 데이터: 전화 010-4444-0000, 계좌 1201012345 (은행코드 001)
// ════════════════════════════════════════════

// 더치트 mock 서버를 생성하는 헬퍼 — 등록된 키워드면 caution=Y, 아니면 N
func newTheCheatMockServer(cautionKeywords map[string]FraudResult) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var req searchRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			json.NewEncoder(w).Encode(Response{ResultCode: -1, ResultMsg: "bad request"})
			return
		}

		// 키워드 복호화
		decrypted, err := decryptAES256CBC(req.Keyword, testEncKey)
		if err != nil {
			json.NewEncoder(w).Encode(Response{ResultCode: -1, ResultMsg: "decrypt failed"})
			return
		}

		// 등록된 키워드 매칭
		result, found := cautionKeywords[decrypted]
		if !found {
			result = FraudResult{
				Keyword:     maskKeyword(decrypted, req.KeywordType),
				KeywordType: req.KeywordType,
				BankCode:    req.BankCode,
				Caution:     "N",
			}
		}

		fraudJSON, _ := json.Marshal(result)
		encContent, _ := encryptAES256CBC(string(fraudJSON), testEncKey)
		json.NewEncoder(w).Encode(Response{
			ResultCode: 1,
			ResultMsg:  "success",
			Content:    encContent,
		})
	}))
}

func maskKeyword(keyword, keywordType string) string {
	if keywordType == "phone" && len(keyword) >= 7 {
		return keyword[:3] + "****" + keyword[len(keyword)-4:]
	}
	if keywordType == "account" && len(keyword) >= 6 {
		return keyword[:4] + "****" + keyword[len(keyword)-2:]
	}
	return keyword
}

// 제휴사 데이터 기반 등록 키워드
var realCautionKeywords = map[string]FraudResult{
	// 전화번호: 010-4444-0000
	"01044440000": {
		Keyword:     "010****0000",
		KeywordType: "phone",
		Caution:     "Y",
		DateStart:   "20220307042000",
		DateEnd:     "20260330042000",
		KeywordURL:  "https://api.thecheat.co.kr/web/redirect.php?keyword=phone_01044440000",
	},
	// 계좌번호: 1201012345
	"1201012345": {
		Keyword:     "1201****45",
		KeywordType: "account",
		BankCode:    "001",
		Caution:     "Y",
		DateStart:   "20220307042000",
		DateEnd:     "20260330042000",
		KeywordURL:  "https://api.thecheat.co.kr/web/redirect.php?keyword=account_1201012345",
	},
}

// ── 시나리오 1: 전화번호 조회 — 등록된 번호 → caution=Y ──
func TestRealData_PhoneSearch_CautionY(t *testing.T) {
	srv := newTheCheatMockServer(realCautionKeywords)
	defer srv.Close()

	client := NewClient("test-key", testEncKey, nil)
	client.baseURL = srv.URL

	result, err := client.Search("01044440000", "phone", "")
	require.NoError(t, err)
	assert.Equal(t, "Y", result.Caution)
	assert.Equal(t, "010****0000", result.Keyword, "마스킹된 키워드")
	assert.NotEmpty(t, result.KeywordURL, "피해사례 URL 존재")
	t.Logf("전화 01044440000 → caution=%s, url=%s", result.Caution, result.KeywordURL)
}

// ── 시나리오 2: 계좌번호 조회 — 등록된 계좌+은행코드 → caution=Y ──
func TestRealData_AccountSearch_WithBankCode_CautionY(t *testing.T) {
	srv := newTheCheatMockServer(realCautionKeywords)
	defer srv.Close()

	client := NewClient("test-key", testEncKey, nil)
	client.baseURL = srv.URL

	result, err := client.Search("1201012345", "account", "001")
	require.NoError(t, err)
	assert.Equal(t, "Y", result.Caution)
	assert.Equal(t, "1201****45", result.Keyword, "마스킹된 계좌")
	t.Logf("계좌 1201012345 (은행 001) → caution=%s", result.Caution)
}

// ── 시나리오 3: 계좌번호 조회 — 은행코드 없이도 조회 가능 ──
func TestRealData_AccountSearch_NoBankCode_CautionY(t *testing.T) {
	srv := newTheCheatMockServer(realCautionKeywords)
	defer srv.Close()

	client := NewClient("test-key", testEncKey, nil)
	client.baseURL = srv.URL

	result, err := client.Search("1201012345", "account", "") // bankCode 생략
	require.NoError(t, err)
	assert.Equal(t, "Y", result.Caution, "은행코드 없이도 계좌번호만으로 조회 가능")
	t.Logf("계좌 1201012345 (은행코드 없음) → caution=%s", result.Caution)
}

// ── 시나리오 4: 미등록 전화번호 → caution=N ──
func TestRealData_CleanPhone_CautionN(t *testing.T) {
	srv := newTheCheatMockServer(realCautionKeywords)
	defer srv.Close()

	client := NewClient("test-key", testEncKey, nil)
	client.baseURL = srv.URL

	result, err := client.Search("01012345678", "phone", "")
	require.NoError(t, err)
	assert.Equal(t, "N", result.Caution, "미등록 번호는 N")
	t.Logf("깨끗한 전화 → caution=%s", result.Caution)
}

// ── 시나리오 5: 미등록 계좌번호 → caution=N ──
func TestRealData_CleanAccount_CautionN(t *testing.T) {
	srv := newTheCheatMockServer(realCautionKeywords)
	defer srv.Close()

	client := NewClient("test-key", testEncKey, nil)
	client.baseURL = srv.URL

	result, err := client.Search("9999888877776666", "account", "004")
	require.NoError(t, err)
	assert.Equal(t, "N", result.Caution, "미등록 계좌는 N")
	t.Logf("깨끗한 계좌 → caution=%s", result.Caution)
}

// ── 시나리오 6: API 오류 응답 (result_code != 1) ──
func TestRealData_APIError_InvalidKey(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(Response{
			ResultCode: -2,
			ResultMsg:  "Invalid API Key",
		})
	}))
	defer srv.Close()

	client := NewClient("invalid-key", testEncKey, nil)
	client.baseURL = srv.URL

	_, err := client.Search("01044440000", "phone", "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "Invalid API Key")
	t.Logf("API 키 오류 → %v", err)
}

// ── 시나리오 7: HTTP 500 서버 에러 ──
func TestRealData_HTTP500(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"error": "internal server error"}`))
	}))
	defer srv.Close()

	client := NewClient("key", testEncKey, nil)
	client.baseURL = srv.URL

	_, err := client.Search("01044440000", "phone", "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "HTTP 500")
	t.Logf("HTTP 500 → %v", err)
}

// ── 시나리오 8: HTTP 429 Rate Limit ──
func TestRealData_HTTP429_RateLimit(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		w.Write([]byte(`{"error": "rate limit exceeded"}`))
	}))
	defer srv.Close()

	client := NewClient("key", testEncKey, nil)
	client.baseURL = srv.URL

	_, err := client.Search("01044440000", "phone", "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "HTTP 429")
	t.Logf("Rate Limit → %v", err)
}

// ── 시나리오 9: 네트워크 타임아웃/연결 불가 ──
func TestRealData_NetworkTimeout(t *testing.T) {
	client := NewClient("key", testEncKey, nil)
	client.baseURL = "http://localhost:1" // 연결 불가

	_, err := client.Search("01044440000", "phone", "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "HTTP 요청 실패")
	t.Logf("네트워크 에러 → %v", err)
}

func TestPkcs7Unpad_EdgeCases(t *testing.T) {
	_, err := pkcs7Unpad([]byte{}, 16)
	assert.Error(t, err, "empty data should error")

	_, err = pkcs7Unpad([]byte{0}, 16)
	assert.Error(t, err, "zero padding should error")

	_, err = pkcs7Unpad([]byte{17}, 16)
	assert.Error(t, err, "padding larger than block size should error")
}
