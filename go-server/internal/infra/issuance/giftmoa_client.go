package issuance

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/sony/gobreaker/v2"
	"seedream-gift-server/pkg/logger"

	"go.uber.org/zap"
)

// GiftMoaClient는 Gift MOA 외부 API를 호출하는 HTTP 클라이언트입니다.
type GiftMoaClient struct {
	baseURL    string // 예: http://103.97.209.176:8010/api
	apiKey     string
	httpClient *http.Client
	cb         *gobreaker.CircuitBreaker[[]byte]
}

// NewGiftMoaClient는 새로운 Gift MOA 클라이언트를 생성합니다.
// httpClient와 cb는 외부에서 주입됩니다 (Bulkhead + Circuit Breaker 패턴).
// nil을 전달하면 기본값으로 초기화됩니다.
func NewGiftMoaClient(baseURL, apiKey string, httpClient *http.Client, cb *gobreaker.CircuitBreaker[[]byte]) *GiftMoaClient {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 15 * time.Second}
	}
	return &GiftMoaClient{
		baseURL:    strings.TrimRight(baseURL, "/"),
		apiKey:     apiKey,
		httpClient: httpClient,
		cb:         cb,
	}
}

// ──────────────────────────────────────────────
// 3-1. 상품권 발행
// ──────────────────────────────────────────────

// Issuance는 상품권을 발행하고 발행 회차 번호(publishCnt)를 반환합니다.
func (c *GiftMoaClient) Issuance(ctx context.Context, publishTypeInt, count int) (*MoaIssuanceResponse, error) {
	body, err := c.doPost(ctx, "/gift-moa/issuance", moaIssuanceRequest{
		PublishTypeInt: publishTypeInt,
		Count:          count,
	})
	if err != nil {
		return nil, err
	}

	var base struct {
		Result     string            `json:"result"`
		PublishCnt json.Number       `json:"publishCnt"`
		Results    moaIssuanceResult `json:"results"`
	}
	if err := json.Unmarshal(body, &base); err != nil {
		return nil, fmt.Errorf("MOA issuance 응답 파싱 실패: %w", err)
	}

	return &MoaIssuanceResponse{
		PublishCnt: base.PublishCnt.String(),
		Result:     base.Results,
	}, nil
}

// ──────────────────────────────────────────────
// 3-2. 발행 이력 조회
// ──────────────────────────────────────────────

// IssuanceList는 날짜 범위로 발행 이력을 조회합니다.
func (c *GiftMoaClient) IssuanceList(ctx context.Context, sDate, eDate string) ([]MoaIssuanceRecord, error) {
	body, err := c.doPost(ctx, "/gift-moa/issuance/list", moaIssuanceListRequest{
		SDate: sDate,
		EDate: eDate,
	})
	if err != nil {
		return nil, err
	}

	var base giftMoaBaseResponse
	if err := json.Unmarshal(body, &base); err != nil {
		return nil, fmt.Errorf("MOA issuance/list 응답 파싱 실패: %w", err)
	}

	var records []MoaIssuanceRecord
	if err := json.Unmarshal(base.Results, &records); err != nil {
		return nil, fmt.Errorf("MOA issuance/list results 파싱 실패: %w", err)
	}
	return records, nil
}

// ──────────────────────────────────────────────
// 3-3. 발행 상세내역 (개별 PIN 목록)
// ──────────────────────────────────────────────

// IssuanceDetail은 발행 회차 번호로 개별 상품권 PIN 목록을 조회합니다.
func (c *GiftMoaClient) IssuanceDetail(ctx context.Context, publishCnt string) ([]MoaVoucher, error) {
	cnt, err := strconv.Atoi(publishCnt)
	if err != nil {
		return nil, fmt.Errorf("publishCnt 정수 변환 실패: %q: %w", publishCnt, err)
	}
	body, err := c.doPost(ctx, "/gift-moa/issuance/detail", moaIssuanceDetailRequest{
		PublishCnt: cnt,
	})
	if err != nil {
		return nil, err
	}

	var base giftMoaBaseResponse
	if err := json.Unmarshal(body, &base); err != nil {
		return nil, fmt.Errorf("MOA issuance/detail 응답 파싱 실패: %w", err)
	}

	var vouchers []MoaVoucher
	if err := json.Unmarshal(base.Results, &vouchers); err != nil {
		return nil, fmt.Errorf("MOA issuance/detail results 파싱 실패: %w", err)
	}
	return vouchers, nil
}

// ──────────────────────────────────────────────
// 3-4. 상품권 정보 조회 (암호화 URL)
// ──────────────────────────────────────────────

// GiftInfoByURLParam은 암호화된 URL 파라미터로 상품권 정보를 조회합니다.
func (c *GiftMoaClient) GiftInfoByURLParam(ctx context.Context, urlParam string) (*MoaGiftInfo, error) {
	body, err := c.doPost(ctx, "/gift-moa/gift/info-enc", moaGiftInfoEncRequest{
		URLParam: urlParam,
	})
	if err != nil {
		return nil, err
	}
	return c.parseGiftInfo(body)
}

// ──────────────────────────────────────────────
// 3-5. 상품권 정보 조회 (코드+비밀번호)
// ──────────────────────────────────────────────

// GiftInfoByCode는 상품권 코드와 비밀번호로 정보를 조회합니다.
func (c *GiftMoaClient) GiftInfoByCode(ctx context.Context, giftCode, giftPw string) (*MoaGiftInfo, error) {
	body, err := c.doPost(ctx, "/gift-moa/gift/info", moaGiftInfoRequest{
		GiftCode: giftCode,
		GiftPw:   giftPw,
	})
	if err != nil {
		return nil, err
	}
	return c.parseGiftInfo(body)
}

// ──────────────────────────────────────────────
// 3-6. 상품권 환불
// ──────────────────────────────────────────────

// GiftRefund는 상품권을 환불 처리합니다.
func (c *GiftMoaClient) GiftRefund(ctx context.Context, giftCode, giftPw, refundName, refundTel string) error {
	_, err := c.doPost(ctx, "/gift-moa/gift/refund", moaGiftRefundRequest{
		GiftCode:   giftCode,
		GiftPw:     giftPw,
		RefundName: refundName,
		RefundTel:  refundTel,
	})
	return err
}

// ──────────────────────────────────────────────
// 3-7. 상품권 사용 처리
// ──────────────────────────────────────────────

// GiftUse는 상품권을 사용 처리합니다.
func (c *GiftMoaClient) GiftUse(ctx context.Context, giftCode, giftPw string) error {
	_, err := c.doPost(ctx, "/gift-moa/gift/use", moaGiftUseRequest{
		GiftCode: giftCode,
		GiftPw:   giftPw,
	})
	return err
}

// ──────────────────────────────────────────────
// 내부 헬퍼
// ──────────────────────────────────────────────

// doPost는 Gift MOA API에 POST 요청을 보내고 응답 바디를 반환합니다.
// Circuit Breaker가 등록된 경우 500대 서버 에러와 네트워크 에러만 CB 실패로 카운트합니다.
// 400대 비즈니스 에러(MOA 응답 코드 에러 포함)는 CB 실패로 카운트하지 않습니다.
// 모든 요청/응답을 구조화 로깅하며, PIN 민감 정보는 마스킹합니다.
func (c *GiftMoaClient) doPost(ctx context.Context, path string, reqBody any) ([]byte, error) {
	jsonPayload, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("MOA 요청 직렬화 실패: %w", err)
	}

	// 요청 로깅 (PIN 마스킹)
	logger.Log.Info("MOA API 요청",
		zap.String("path", path),
		zap.String("body", maskSensitiveFields(string(jsonPayload))),
	)

	// CB가 등록된 경우 Execute로 래핑, 없으면 직접 호출
	if c.cb != nil {
		body, cbErr := c.cb.Execute(func() ([]byte, error) {
			return c.doHTTP(ctx, path, jsonPayload)
		})
		if cbErr != nil {
			return nil, cbErr
		}
		return c.parseAndCheck(body, path)
	}

	body, err := c.doHTTP(ctx, path, jsonPayload)
	if err != nil {
		return nil, err
	}
	return c.parseAndCheck(body, path)
}

// doHTTP는 실제 HTTP POST 요청을 수행합니다.
// 500대 에러와 네트워크 에러만 error로 반환하여 CB 실패로 카운트됩니다.
// 200 OK 응답(MOA 비즈니스 에러 포함)은 성공으로 반환되어 CB 카운트에 영향을 주지 않습니다.
func (c *GiftMoaClient) doHTTP(ctx context.Context, path string, jsonPayload []byte) ([]byte, error) {
	fullURL := c.baseURL + path
	start := time.Now()

	req, err := http.NewRequestWithContext(ctx, "POST", fullURL, bytes.NewReader(jsonPayload))
	if err != nil {
		return nil, fmt.Errorf("MOA HTTP 요청 생성 실패: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("X-API-Key", c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	elapsed := time.Since(start)

	if err != nil {
		// 네트워크 에러 → CB 실패 카운트
		if ctx.Err() != nil {
			logger.Log.Error("MOA API 타임아웃",
				zap.String("path", path),
				zap.Duration("elapsed", elapsed),
				zap.Error(err),
			)
			return nil, fmt.Errorf("%w: 타임아웃 (%v): %v", ErrMoaServerError, elapsed, err)
		}
		logger.Log.Error("MOA API 네트워크 에러",
			zap.String("path", path),
			zap.Duration("elapsed", elapsed),
			zap.Error(err),
		)
		return nil, fmt.Errorf("%w: 네트워크 에러: %v", ErrMoaServerError, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		logger.Log.Error("MOA API 응답 읽기 실패",
			zap.String("path", path),
			zap.Duration("elapsed", elapsed),
			zap.Error(err),
		)
		return nil, fmt.Errorf("MOA 응답 읽기 실패: %w", err)
	}

	// 500대 서버 에러 → CB 실패 카운트
	if resp.StatusCode >= 500 {
		logger.Log.Error("MOA API 서버 에러",
			zap.String("path", path),
			zap.Int("httpStatus", resp.StatusCode),
			zap.Duration("elapsed", elapsed),
			zap.String("body", truncate(string(body), 500)),
		)
		return nil, fmt.Errorf("%w: HTTP %d (path=%s)", ErrMoaServerError, resp.StatusCode, path)
	}

	// 400대 에러는 CB 성공으로 처리 (비즈니스 에러이므로 서비스 장애 아님)
	if resp.StatusCode != http.StatusOK {
		logger.Log.Warn("MOA API 클라이언트 에러",
			zap.String("path", path),
			zap.Int("httpStatus", resp.StatusCode),
			zap.Duration("elapsed", elapsed),
			zap.String("body", truncate(string(body), 500)),
		)
		// CB 성공으로 카운트되도록 body와 함께 nil 에러 반환
		// parseAndCheck에서 비즈니스 에러로 처리됨
		return body, nil
	}

	return body, nil
}

// parseAndCheck는 MOA 응답 바디를 파싱하고 비즈니스 에러를 확인합니다.
func (c *GiftMoaClient) parseAndCheck(body []byte, path string) ([]byte, error) {
	elapsed := time.Duration(0)

	var base giftMoaBaseResponse
	if err := json.Unmarshal(body, &base); err != nil {
		logger.Log.Error("MOA API 응답 JSON 파싱 실패",
			zap.String("path", path),
			zap.String("body", truncate(string(body), 500)),
			zap.Error(err),
		)
		return nil, fmt.Errorf("MOA 응답 JSON 파싱 실패: %w", err)
	}

	if err := c.checkError(base, path, elapsed); err != nil {
		return nil, err
	}

	logger.Log.Info("MOA API 성공",
		zap.String("path", path),
		zap.String("resultCode", base.ResultCode),
		zap.String("storeSeq", base.StoreSeq),
	)

	return body, nil
}

// checkError는 Gift MOA 응답의 에러를 분류하여 적절한 센티넬 에러로 변환합니다.
func (c *GiftMoaClient) checkError(resp giftMoaBaseResponse, path string, elapsed time.Duration) error {
	if resp.Result == "SUC" {
		return nil
	}

	// 에러 카테고리 분류
	sentinel, retryable := MoaErrorCategory(resp.ResultCode)
	if sentinel == nil {
		return nil // 성공 코드
	}

	logger.Log.Error("MOA API 비즈니스 에러",
		zap.String("path", path),
		zap.String("result", resp.Result),
		zap.String("resultCode", resp.ResultCode),
		zap.String("storeSeq", resp.StoreSeq),
		zap.String("category", sentinel.Error()),
		zap.Bool("retryable", retryable),
		zap.Duration("elapsed", elapsed),
	)

	return fmt.Errorf("%w: resultCode=%s, retryable=%v (path=%s)", sentinel, resp.ResultCode, retryable, path)
}

// maskSensitiveFields는 JSON 문자열에서 giftPw, giftCode 등 민감 필드를 마스킹합니다.
func maskSensitiveFields(jsonStr string) string {
	// giftPw 마스킹: "giftPw":"xxxx" → "giftPw":"****"
	for _, field := range []string{"giftPw", "giftCode"} {
		prefix := `"` + field + `":"`
		if idx := strings.Index(jsonStr, prefix); idx >= 0 {
			start := idx + len(prefix)
			end := strings.Index(jsonStr[start:], `"`)
			if end > 0 {
				val := jsonStr[start : start+end]
				masked := "****"
				if len(val) > 4 {
					masked = strings.Repeat("*", len(val)-4) + val[len(val)-4:]
				}
				jsonStr = jsonStr[:start] + masked + jsonStr[start+end:]
			}
		}
	}
	return jsonStr
}

// truncate는 문자열을 maxLen 이하로 자릅니다.
func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "...(truncated)"
}

// parseGiftInfo는 상품권 조회 응답을 파싱합니다.
func (c *GiftMoaClient) parseGiftInfo(body []byte) (*MoaGiftInfo, error) {
	var base giftMoaBaseResponse
	if err := json.Unmarshal(body, &base); err != nil {
		return nil, fmt.Errorf("MOA gift/info 응답 파싱 실패: %w", err)
	}

	var info MoaGiftInfo
	if err := json.Unmarshal(base.Results, &info); err != nil {
		return nil, fmt.Errorf("MOA gift/info results 파싱 실패: %w", err)
	}
	return &info, nil
}
