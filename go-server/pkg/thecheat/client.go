package thecheat

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
	"time"

	"github.com/sony/gobreaker/v2"
	"go.uber.org/zap"
	"w-gift-server/pkg/logger"
)

const (
	defaultBaseURL = "https://api.thecheat.co.kr/api/v2/fraud/search/encrypted"
	apiKeyHeader   = "X-TheCheat-ApiKey"
)

type Response struct {
	ResultCode int    `json:"result_code"`
	ResultMsg  string `json:"result_msg"`
	Content    string `json:"content"`
}

type FraudResult struct {
	Keyword     string `json:"keyword"`
	KeywordType string `json:"keyword_type"`
	BankCode    string `json:"bank_code"`
	Caution     string `json:"caution"`
	DateStart   string `json:"date_start"`
	DateEnd     string `json:"date_end"`
	KeywordURL  string `json:"keyword_url"`
}

type searchRequest struct {
	Keyword     string `json:"keyword"`
	KeywordType string `json:"keyword_type"`
	BankCode    string `json:"bank_code,omitempty"`
}

type Client struct {
	apiKey  string
	encKey  string
	baseURL string
	http    *http.Client
	cb      *gobreaker.CircuitBreaker[[]byte]
}

// NewClient는 새로운 TheCheat Client를 생성합니다.
// cb는 외부에서 주입되는 Circuit Breaker입니다. nil이면 CB 없이 동작합니다.
// encKey는 AES-256-CBC 암호화에 사용되며 정확히 32바이트여야 합니다.
func NewClient(apiKey, encKey string, cb *gobreaker.CircuitBreaker[[]byte]) *Client {
	if len(encKey) != 32 {
		logger.Log.Warn("TheCheat 암호화 키 길이가 32바이트가 아님",
			zap.Int("actual", len(encKey)),
		)
	}
	return &Client{
		apiKey:  apiKey,
		encKey:  encKey,
		baseURL: defaultBaseURL,
		http:    &http.Client{Timeout: 10 * time.Second},
		cb:      cb,
	}
}

// Search는 키워드로 더치트 사기 정보를 조회합니다.
// Circuit Breaker가 등록된 경우 500대 서버 에러와 네트워크 에러만 CB 실패로 카운트합니다.
func (c *Client) Search(keyword, keywordType, bankCode string) (*FraudResult, error) {
	encrypted, err := encryptAES256CBC(keyword, c.encKey)
	if err != nil {
		return nil, fmt.Errorf("키워드 암호화 실패: %w", err)
	}

	reqData := searchRequest{Keyword: encrypted, KeywordType: keywordType, BankCode: bankCode}
	reqBody, err := json.Marshal(reqData)
	if err != nil {
		return nil, fmt.Errorf("JSON 직렬화 실패: %w", err)
	}

	execute := func() ([]byte, error) {
		start := time.Now()

		httpReq, err := http.NewRequest(http.MethodPost, c.baseURL, bytes.NewReader(reqBody))
		if err != nil {
			return nil, fmt.Errorf("HTTP 요청 생성 실패: %w", err)
		}
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set(apiKeyHeader, c.apiKey)

		resp, err := c.http.Do(httpReq)
		elapsed := time.Since(start)
		if err != nil {
			// 네트워크 에러 → CB 실패 카운트
			return nil, fmt.Errorf("더치트 HTTP 요청 실패 (%v): %w", elapsed, err)
		}
		defer resp.Body.Close()

		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("응답 읽기 실패: %w", err)
		}

		// 500대 서버 에러 → CB 실패 카운트
		if resp.StatusCode >= 500 {
			return nil, fmt.Errorf("더치트 API 서버 에러 HTTP %d (%v): %s",
				resp.StatusCode, elapsed, truncateBody(respBody, 200))
		}

		// 400대 에러는 CB 성공으로 처리 (비즈니스 에러)
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("더치트 API HTTP %d 오류 (%v): %s",
				resp.StatusCode, elapsed, truncateBody(respBody, 200))
		}

		return respBody, nil
	}

	var respBody []byte
	if c.cb != nil {
		respBody, err = c.cb.Execute(execute)
	} else {
		respBody, err = execute()
	}
	if err != nil {
		return nil, err
	}

	var apiResp Response
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("응답 파싱 실패: %w", err)
	}

	if apiResp.ResultCode != 1 {
		return nil, fmt.Errorf("더치트 API 오류 (code=%d): %s",
			apiResp.ResultCode, apiResp.ResultMsg)
	}

	decrypted, err := decryptAES256CBC(apiResp.Content, c.encKey)
	if err != nil {
		return nil, fmt.Errorf("응답 복호화 실패: %w", err)
	}

	var result FraudResult
	if err := json.Unmarshal([]byte(decrypted), &result); err != nil {
		return nil, fmt.Errorf("복호화 결과 파싱 실패: %w", err)
	}

	return &result, nil
}

// truncateBody는 에러 로깅 시 응답 바디를 maxLen 이하로 자릅니다.
func truncateBody(body []byte, maxLen int) string {
	if len(body) <= maxLen {
		return string(body)
	}
	return string(body[:maxLen]) + "..."
}

func encryptAES256CBC(plaintext, key string) (string, error) {
	block, err := aes.NewCipher([]byte(key))
	if err != nil {
		return "", err
	}
	blockSize := block.BlockSize()
	plaintextBytes := pkcs7Pad([]byte(plaintext), blockSize)

	iv := make([]byte, blockSize)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}

	ciphertext := make([]byte, len(plaintextBytes))
	cipher.NewCBCEncrypter(block, iv).CryptBlocks(ciphertext, plaintextBytes)
	return base64.StdEncoding.EncodeToString(append(iv, ciphertext...)), nil
}

func decryptAES256CBC(encoded, key string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher([]byte(key))
	if err != nil {
		return "", err
	}
	blockSize := block.BlockSize()
	if len(data) < blockSize*2 {
		return "", fmt.Errorf("데이터가 너무 짧음 (len=%d)", len(data))
	}

	iv := data[:blockSize]
	ciphertext := data[blockSize:]
	cipher.NewCBCDecrypter(block, iv).CryptBlocks(ciphertext, ciphertext)

	unpadded, err := pkcs7Unpad(ciphertext, blockSize)
	if err != nil {
		return "", err
	}
	return string(unpadded), nil
}

func pkcs7Pad(data []byte, blockSize int) []byte {
	padding := blockSize - len(data)%blockSize
	return append(data, bytes.Repeat([]byte{byte(padding)}, padding)...)
}

func pkcs7Unpad(data []byte, blockSize int) ([]byte, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("빈 데이터")
	}
	padding := int(data[len(data)-1])
	if padding > blockSize || padding == 0 {
		return nil, fmt.Errorf("잘못된 패딩 값: %d", padding)
	}
	return data[:len(data)-padding], nil
}
