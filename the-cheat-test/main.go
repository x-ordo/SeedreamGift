package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

const (
	baseURL      = "https://api.thecheat.co.kr/api/v2/fraud/search"
	encryptedURL = "https://api.thecheat.co.kr/api/v2/fraud/search/encrypted"
	apiKeyHeader = "X-TheCheat-ApiKey"
	testPhone    = "01044440000"
	testAccount  = "12010123456"
)

// TheCheatResponse 더치트 API 응답
type TheCheatResponse struct {
	ResultCode int    `json:"result_code"`
	ResultMsg  string `json:"result_msg"`
	Content    string `json:"content"`
}

// FraudResult content 복호화 결과
type FraudResult struct {
	Keyword     string  `json:"keyword"`
	KeywordType string  `json:"keyword_type"`
	BankCode    string  `json:"bank_code"`
	Caution     string  `json:"caution"`
	DateStart   string  `json:"date_start"`
	DateEnd     string  `json:"date_end"`
	KeywordURL  string  `json:"keyword_url"`
	AddInfo     *string `json:"add_info"`
}

// SearchRequest 검색 요청
type SearchRequest struct {
	Keyword     string `json:"keyword"`
	KeywordType string `json:"keyword_type"`
	BankCode    string `json:"bank_code,omitempty"`
	AddInfo     string `json:"add_info,omitempty"`
}

func main() {
	apiKey, encKey, err := loadKeys("key.txt")
	if err != nil {
		fmt.Fprintf(os.Stderr, "키 파일 로드 실패: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("=== 더치트 API 테스트 ===")
	fmt.Printf("API Key: %s...\n", apiKey[:20])
	fmt.Printf("ENC Key: %s (len=%d)\n", encKey, len(encKey))
	fmt.Println()

	// 1. 평문 검색 - 전화번호
	fmt.Println("--- [1] 평문 검색: 전화번호 ---")
	testPlainSearch(apiKey, encKey, testPhone, "phone")

	// 2. 평문 검색 - 계좌번호
	fmt.Println("--- [2] 평문 검색: 계좌번호 ---")
	testPlainSearch(apiKey, encKey, testAccount, "account")

	// 3. 암호화 검색 - 전화번호
	fmt.Println("--- [3] 암호화 검색: 전화번호 ---")
	testEncryptedSearch(apiKey, encKey, testPhone, "phone")

	// 4. 암호화 검색 - 계좌번호
	fmt.Println("--- [4] 암호화 검색: 계좌번호 ---")
	testEncryptedSearch(apiKey, encKey, testAccount, "account")
}

// loadKeys key.txt에서 API_KEY, ENC_KEY 읽기
func loadKeys(path string) (apiKey, encKey string, err error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", "", fmt.Errorf("파일 읽기 실패: %w", err)
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if k, v, ok := strings.Cut(line, "="); ok {
			switch k {
			case "API_KEY":
				apiKey = v
			case "ENC_KEY":
				encKey = v
			}
		}
	}
	if apiKey == "" || encKey == "" {
		return "", "", fmt.Errorf("API_KEY 또는 ENC_KEY가 없습니다")
	}
	if len(encKey) != 32 {
		return "", "", fmt.Errorf("ENC_KEY는 32바이트여야 합니다 (현재 %d바이트)", len(encKey))
	}
	return apiKey, encKey, nil
}

// testPlainSearch 평문 검색 테스트
func testPlainSearch(apiKey, encKey, keyword, keywordType string) {
	req := SearchRequest{
		Keyword:     keyword,
		KeywordType: keywordType,
	}

	resp, err := callAPI(baseURL, apiKey, req)
	if err != nil {
		fmt.Printf("  요청 실패: %v\n\n", err)
		return
	}
	printResult(resp, encKey)
}

// testEncryptedSearch 암호화 검색 테스트
func testEncryptedSearch(apiKey, encKey, keyword, keywordType string) {
	encrypted, err := encrypt(keyword, encKey)
	if err != nil {
		fmt.Printf("  키워드 암호화 실패: %v\n\n", err)
		return
	}
	fmt.Printf("  암호화된 keyword: %s\n", encrypted)

	req := SearchRequest{
		Keyword:     encrypted,
		KeywordType: keywordType,
	}

	resp, err := callAPI(encryptedURL, apiKey, req)
	if err != nil {
		fmt.Printf("  요청 실패: %v\n\n", err)
		return
	}
	printResult(resp, encKey)
}

// callAPI 더치트 API 호출
func callAPI(url, apiKey string, body SearchRequest) (*TheCheatResponse, error) {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("JSON 직렬화 실패: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("요청 생성 실패: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(apiKeyHeader, apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP 요청 실패: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("응답 읽기 실패: %w", err)
	}

	fmt.Printf("  HTTP %d\n", resp.StatusCode)

	var result TheCheatResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("응답 파싱 실패 (body=%s): %w", string(respBody), err)
	}
	return &result, nil
}

// printResult 응답 결과 출력 (content 복호화 포함)
func printResult(resp *TheCheatResponse, encKey string) {
	fmt.Printf("  result_code: %d\n", resp.ResultCode)
	fmt.Printf("  result_msg:  %s\n", resp.ResultMsg)

	if resp.ResultCode != 1 {
		fmt.Printf("  (실패 응답)\n\n")
		return
	}

	decrypted, err := decrypt(resp.Content, encKey)
	if err != nil {
		fmt.Printf("  복호화 실패: %v\n\n", err)
		return
	}

	var fraud FraudResult
	if err := json.Unmarshal([]byte(decrypted), &fraud); err != nil {
		fmt.Printf("  JSON 파싱 실패: %v\n\n", err)
		return
	}

	fmt.Printf("  ┌─────────────────────────────────\n")
	fmt.Printf("  │ keyword:      %s\n", fraud.Keyword)
	fmt.Printf("  │ keyword_type: %s\n", fraud.KeywordType)
	fmt.Printf("  │ bank_code:    %s\n", fraud.BankCode)
	fmt.Printf("  │ caution:      %s\n", fraud.Caution)
	fmt.Printf("  │ date_start:   %s\n", fraud.DateStart)
	fmt.Printf("  │ date_end:     %s\n", fraud.DateEnd)
	fmt.Printf("  │ keyword_url:  %s\n", fraud.KeywordURL)
	fmt.Printf("  └─────────────────────────────────\n\n")
}

// decrypt AES-256-CBC 복호화 (첫 16바이트 = IV)
func decrypt(encoded, key string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("base64 디코딩 실패: %w", err)
	}

	block, err := aes.NewCipher([]byte(key))
	if err != nil {
		return "", fmt.Errorf("AES 키 생성 실패: %w", err)
	}

	blockSize := block.BlockSize()
	if len(data) < blockSize*2 {
		return "", fmt.Errorf("데이터가 너무 짧습니다 (len=%d)", len(data))
	}

	iv := data[:blockSize]
	ciphertext := data[blockSize:]

	mode := cipher.NewCBCDecrypter(block, iv)
	mode.CryptBlocks(ciphertext, ciphertext)

	// PKCS7 unpadding
	padding := int(ciphertext[len(ciphertext)-1])
	if padding > blockSize || padding == 0 {
		return "", fmt.Errorf("잘못된 패딩 값: %d", padding)
	}
	return string(ciphertext[:len(ciphertext)-padding]), nil
}

// encrypt AES-256-CBC 암호화 (IV를 앞에 붙여서 반환)
func encrypt(plaintext, key string) (string, error) {
	block, err := aes.NewCipher([]byte(key))
	if err != nil {
		return "", fmt.Errorf("AES 키 생성 실패: %w", err)
	}

	blockSize := block.BlockSize()
	plaintextBytes := []byte(plaintext)

	// PKCS7 padding
	padding := blockSize - len(plaintextBytes)%blockSize
	plaintextBytes = append(plaintextBytes, bytes.Repeat([]byte{byte(padding)}, padding)...)

	// 랜덤 IV 생성
	iv := make([]byte, blockSize)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", fmt.Errorf("IV 생성 실패: %w", err)
	}

	// 암호화
	ciphertext := make([]byte, len(plaintextBytes))
	cipher.NewCBCEncrypter(block, iv).CryptBlocks(ciphertext, plaintextBytes)

	// IV + ciphertext → base64
	return base64.StdEncoding.EncodeToString(append(iv, ciphertext...)), nil
}
