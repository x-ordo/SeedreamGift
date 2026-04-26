// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
// KYC (Know Your Customer) 서비스는 사용자 본인 확인 및 계좌 인증 프로세스를 처리합니다.
package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
	"seedream-gift-server/internal/config"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/apperror"
	"seedream-gift-server/pkg/crypto"
	"seedream-gift-server/pkg/logger"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// ─── Coocon 헬스체크 캐시 ───

var (
	cooconHTTPClient = &http.Client{Timeout: 3 * time.Second}
	cooconCache      struct {
		sync.RWMutex
		url       string // 마지막으로 확인된 정상 URL
		checkedAt time.Time
	}
	cooconCacheTTL = 5 * time.Minute
)

func cooconIsReachable(baseUrl string) bool {
	resp, err := cooconHTTPClient.Head(baseUrl)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode < 500
}

// resolveCooconUrl은 메인/서브 서버 중 접속 가능한 URL을 반환합니다.
// 5분간 결과를 캐시하여 매 요청마다 헬스체크 하지 않습니다.
func resolveCooconUrl(main, sub string) string {
	cooconCache.RLock()
	if cooconCache.url != "" && time.Since(cooconCache.checkedAt) < cooconCacheTTL {
		cached := cooconCache.url
		cooconCache.RUnlock()
		return cached
	}
	cooconCache.RUnlock()

	cooconCache.Lock()
	defer cooconCache.Unlock()

	// double-check after acquiring write lock
	if cooconCache.url != "" && time.Since(cooconCache.checkedAt) < cooconCacheTTL {
		return cooconCache.url
	}

	resolved := main
	if !cooconIsReachable(main) && sub != "" {
		if cooconIsReachable(sub) {
			logger.Log.Warn("Coocon 메인 서버 접속 불가, 서브 서버로 전환",
				zap.String("main", main), zap.String("sub", sub),
			)
			resolved = sub
		} else {
			logger.Log.Error("Coocon 메인/서브 서버 모두 접속 불가",
				zap.String("main", main), zap.String("sub", sub),
			)
			// 메인 URL 반환 (클라이언트에서 에러 표시)
		}
	}

	cooconCache.url = resolved
	cooconCache.checkedAt = time.Now()
	return resolved
}

// ─── 외부 1원 인증 API (Coocon /api/coocon/{issue,confirm}/etc) ───

// cooconVerifyHTTPClient 는 외부 1원 인증 API 호출 전용 HTTP 클라이언트입니다.
// 실제 송금/검증 호출이므로 헬스체크보다 여유 있는 5초 타임아웃을 사용합니다.
var cooconVerifyHTTPClient = &http.Client{Timeout: 5 * time.Second}

// cooconIssueResponse 는 issue/etc (1원 송금 요청) 의 JSON 응답입니다.
type cooconIssueResponse struct {
	Success    bool   `json:"success"`
	RC         string `json:"rc"`
	RM         string `json:"rm"`
	VerifyTrDt string `json:"verify_tr_dt"`
	VerifyTrNo string `json:"verify_tr_no"`
}

// cooconConfirmResponse 는 confirm/etc (1원 검증) 의 JSON 응답입니다.
type cooconConfirmResponse struct {
	Success bool   `json:"success"`
	RC      string `json:"rc"`
	RM      string `json:"rm"`
}

// fetchWithFallback 은 main URL 실패 시 sub URL 로 자동 폴백합니다.
// out 은 JSON 디코딩 대상 포인터, build 는 base URL 로 최종 URL 을 만드는 함수.
func fetchCooconJSON(mainBase, subBase string, build func(base string) string, out any) error {
	tryOne := func(target string) error {
		resp, err := cooconVerifyHTTPClient.Get(target)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 500 {
			return fmt.Errorf("upstream %d", resp.StatusCode)
		}
		return json.NewDecoder(resp.Body).Decode(out)
	}
	if err := tryOne(build(mainBase)); err == nil {
		return nil
	} else if subBase == "" || subBase == mainBase {
		return err
	} else {
		logger.Log.Warn("Coocon 1원 인증 메인 서버 실패, 서브로 폴백", zap.Error(err))
		return tryOne(build(subBase))
	}
}

// callCooconIssue 는 1원 송금 요청 API 를 호출합니다.
func callCooconIssue(mainBase, subBase, bankCode, accountNumber, accountHolder string) (*cooconIssueResponse, error) {
	build := func(base string) string {
		q := url.Values{}
		q.Set("fnni_cd", bankCode)
		q.Set("acct_no", accountNumber)
		q.Set("memb_nm", accountHolder)
		return strings.TrimRight(base, "/") + "/issue/etc?" + q.Encode()
	}
	var out cooconIssueResponse
	if err := fetchCooconJSON(mainBase, subBase, build, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// callCooconConfirm 은 1원 검증 API 를 호출합니다.
// verifyVal 은 사용자가 통장 적요에서 본 3자리 숫자입니다.
func callCooconConfirm(mainBase, subBase, verifyTrDt, verifyTrNo, verifyVal string) (*cooconConfirmResponse, error) {
	build := func(base string) string {
		q := url.Values{}
		q.Set("verify_tr_dt", verifyTrDt)
		q.Set("verify_tr_no", verifyTrNo)
		q.Set("verify_val", verifyVal)
		return strings.TrimRight(base, "/") + "/confirm/etc?" + q.Encode()
	}
	var out cooconConfirmResponse
	if err := fetchCooconJSON(mainBase, subBase, build, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// mapCooconError 는 외부 API 의 실패 rc 코드를 사용자 친화 메시지로 매핑합니다.
// rc="0000" 은 정상 응답이므로 이 함수는 rc != "0000" 인 경우에만 호출되어야 합니다.
//
// TODO(사용자 작성):
//   외부 API 의 실패 rc 코드 카탈로그를 확보하면 아래 switch 에 case 를 추가하세요.
//   예시 매핑 (실제 코드는 운영팀에서 수신해 채워 넣을 것):
//     case "9001": // 계좌 미발견 / 거래정지
//         return apperror.Validation("등록되지 않은 계좌이거나 거래가 정지된 계좌입니다")
//     case "9101": // 예금주 불일치
//         return apperror.Validation("예금주명이 계좌 정보와 일치하지 않습니다")
//     case "9201": // 인증 코드 불일치
//         return apperror.Unauthorized("인증 번호가 올바르지 않습니다")
//   매핑되지 않은 rc 는 default 분기에서 외부 API 의 rm (한글 사유) 을 그대로 노출합니다.
func mapCooconError(rc, rm string) error {
	switch rc {
	// TODO 사용자 작성: 실제 외부 API rc 카탈로그에 맞게 case 추가
	default:
		if strings.TrimSpace(rm) != "" {
			return apperror.Unauthorized(fmt.Sprintf("1원 인증 실패: %s", rm))
		}
		return apperror.Unauthorized("1원 인증에 실패했습니다. 입력값을 다시 확인해주세요")
	}
}

// ─── KYC 서비스 ───

// KycService는 사용자의 실명 인증(휴대폰) 및 계좌 점유 인증(1원 송금) 로직을 관리합니다.
type KycService struct {
	db  *gorm.DB
	cfg *config.Config

	// CooconIssueFn / CooconConfirmFn 은 외부 API 호출을 추상화한 시임입니다.
	// 프로덕션에서는 NewKycService 가 실제 HTTP 호출을 수행하는 기본 구현으로 채웁니다.
	// 단위/E2E 테스트에서 외부 의존을 끊으려면 이 필드를 직접 교체하세요.
	CooconIssueFn   func(bankCode, accountNumber, accountHolder string) (*cooconIssueResponse, error)
	CooconConfirmFn func(verifyTrDt, verifyTrNo, verifyVal string) (*cooconConfirmResponse, error)
}

// NewKycService는 데이터베이스와 설정을 주입받아 서비스를 생성합니다.
// 외부 1원 인증 API 호출 시임 두 개를 기본 구현으로 초기화합니다.
func NewKycService(db *gorm.DB, cfg *config.Config) *KycService {
	s := &KycService{db: db, cfg: cfg}
	s.CooconIssueFn = func(bankCode, accountNumber, accountHolder string) (*cooconIssueResponse, error) {
		return callCooconIssue(cfg.CooconVerifyBaseUrl, cfg.CooconVerifyBaseUrlSub, bankCode, accountNumber, accountHolder)
	}
	s.CooconConfirmFn = func(verifyTrDt, verifyTrNo, verifyVal string) (*cooconConfirmResponse, error) {
		return callCooconConfirm(cfg.CooconVerifyBaseUrl, cfg.CooconVerifyBaseUrlSub, verifyTrDt, verifyTrNo, verifyVal)
	}
	return s
}

// ─── 1원 계좌 인증 ───

// BankVerifyRequest는 1원 계좌 인증을 시작하기 위해 필요한 계좌 정보입니다.
type BankVerifyRequest struct {
	BankCode      string `json:"bankCode" binding:"required"`
	BankName      string `json:"bankName" binding:"required"`
	AccountNumber string `json:"accountNumber" binding:"required"`
	AccountHolder string `json:"accountHolder" binding:"required"`
}

// validateBankVerifyRequest는 1원 인증 요청의 입력값을 검증합니다.
func validateBankVerifyRequest(req BankVerifyRequest) error {
	if len(req.BankCode) < 2 || len(req.BankCode) > 4 {
		return apperror.Validation("은행 코드 형식이 올바르지 않습니다")
	}
	acct := strings.TrimSpace(req.AccountNumber)
	if len(acct) < 8 || len(acct) > 20 {
		return apperror.Validation("계좌번호는 8~20자리여야 합니다")
	}
	if strings.TrimSpace(req.AccountHolder) == "" {
		return apperror.Validation("예금주를 입력해주세요")
	}
	if len(req.AccountHolder) > 10 {
		return apperror.Validation("예금주명은 10자 이내로 입력해주세요")
	}
	return nil
}

// RequestBankVerify는 사용자의 계좌로 1원을 전송하는 프로세스를 시작합니다.
// 외부 Coocon API (issue/etc) 가 실제 송금을 트리거하며 verify_tr_dt / verify_tr_no 를 발급합니다.
// 우리는 이를 그대로 세션에 저장 — 검증의 진실 출처는 외부 API, 메타데이터(은행/계좌)의
// 진실 출처는 우리 세션 (TOCTOU 방지).
func (s *KycService) RequestBankVerify(req BankVerifyRequest) (*domain.KycVerifySession, error) {
	if err := validateBankVerifyRequest(req); err != nil {
		return nil, err
	}

	// 외부 API 호출 — 실제 1원 송금 트리거
	cooconResp, err := s.CooconIssueFn(req.BankCode, req.AccountNumber, req.AccountHolder)
	if err != nil {
		logger.Log.Error("외부 1원 송금 호출 실패",
			zap.Error(err),
			zap.String("bankCode", req.BankCode),
		)
		return nil, apperror.Internal("1원 인증 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요", err)
	}
	if !cooconResp.Success || cooconResp.RC != "0000" {
		logger.Log.Warn("외부 1원 송금 거절",
			zap.String("rc", cooconResp.RC),
			zap.String("rm", cooconResp.RM),
			zap.String("bankCode", req.BankCode),
		)
		return nil, mapCooconError(cooconResp.RC, cooconResp.RM)
	}
	if cooconResp.VerifyTrNo == "" || cooconResp.VerifyTrDt == "" {
		return nil, apperror.Internal("외부 1원 송금 응답이 올바르지 않습니다", nil)
	}

	// 만료된 세션 정리 (누적 방지)
	s.db.Where("ExpiresAt < ?", time.Now()).Delete(&domain.KycVerifySession{})

	encryptedAcct, err := crypto.EncryptCBC(req.AccountNumber, s.cfg.EncryptionKey)
	if err != nil {
		return nil, apperror.Internal("계좌번호 암호화 실패", err)
	}

	session := &domain.KycVerifySession{
		VerifyTrNo:    cooconResp.VerifyTrNo,
		VerifyTrDt:    cooconResp.VerifyTrDt,
		BankCode:      req.BankCode,
		BankName:      req.BankName,
		AccountNumber: encryptedAcct,
		AccountHolder: req.AccountHolder,
		ExpiresAt:     time.Now().Add(s.cfg.KYCSessionExpiry),
	}

	if err := s.db.Create(session).Error; err != nil {
		return nil, err
	}

	logger.Log.Info("1원 인증 세션 생성 (외부 API 트리거)",
		zap.String("trNo", cooconResp.VerifyTrNo),
		zap.String("trDt", cooconResp.VerifyTrDt),
		zap.String("bankCode", req.BankCode),
		zap.String("holder", req.AccountHolder),
	)

	return session, nil
}

// BankVerifyConfirmRequest는 사용자가 실제 통장 내역에서 확인한 인증값을 제출하는 데이터입니다.
// 은행/계좌 정보는 RequestBankVerify 단계에서 이미 세션에 저장되어 있으므로 여기서는 받지 않습니다 (TOCTOU 방지).
type BankVerifyConfirmRequest struct {
	VerifyTrDt string `json:"verifyTrDt" binding:"required"`
	VerifyTrNo string `json:"verifyTrNo" binding:"required"`
	VerifyVal  string `json:"verifyVal" binding:"required,len=3"`
}

// BankVerifyResult는 계좌 인증 성공 후 반환되는 결과 요약입니다.
type BankVerifyResult struct {
	BankName      string `json:"bankName"`
	BankCode      string `json:"bankCode"`
	AccountNumber string `json:"accountNumber"`
	AccountHolder string `json:"accountHolder"`
}

// maxVerifyAttempts는 인증 코드 입력 실패 허용 횟수입니다.
const maxVerifyAttempts = 5

// ConfirmBankVerify는 외부 Coocon confirm/etc API 를 호출해 사용자가 입력한 3자리 인증값이
// 외부 시스템이 1원 송금 시 적요로 기록한 값과 일치하는지 검증합니다.
// 검증의 진실 출처는 외부 API 이며, 우리 세션은 은행/계좌 메타만 보존합니다.
func (s *KycService) ConfirmBankVerify(userID int, req BankVerifyConfirmRequest) (*BankVerifyResult, error) {
	var result *BankVerifyResult

	err := s.db.Transaction(func(tx *gorm.DB) error {
		var session domain.KycVerifySession
		if err := tx.Where("VerifyTrNo = ? AND VerifyTrDt = ? AND IsVerified = ?",
			req.VerifyTrNo, req.VerifyTrDt, false).First(&session).Error; err != nil {
			return apperror.NotFound("유효한 인증 세션을 찾을 수 없습니다")
		}

		if session.ExpiresAt.Before(time.Now()) {
			// 만료 세션 정리
			tx.Delete(&session)
			return apperror.Unauthorized("인증 유효 시간이 만료되었습니다")
		}

		// 외부 API 검증 — 진실 출처
		confirmResp, err := s.CooconConfirmFn(session.VerifyTrDt, session.VerifyTrNo, req.VerifyVal)
		if err != nil {
			logger.Log.Error("외부 1원 검증 호출 실패",
				zap.Error(err),
				zap.String("trNo", session.VerifyTrNo),
				zap.Int("userId", userID),
			)
			return apperror.Internal("1원 인증 서비스에 일시적인 문제가 발생했습니다", err)
		}
		if !confirmResp.Success || confirmResp.RC != "0000" {
			logger.Log.Warn("1원 인증 외부 거절",
				zap.String("rc", confirmResp.RC),
				zap.String("rm", confirmResp.RM),
				zap.String("trNo", session.VerifyTrNo),
				zap.Int("userId", userID),
			)
			return mapCooconError(confirmResp.RC, confirmResp.RM)
		}

		// 세션을 '완료' 상태로 변경
		if err := tx.Model(&session).Update("IsVerified", true).Error; err != nil {
			return apperror.Internal("세션 업데이트 실패", err)
		}

		// 응답 반환을 위해 세션의 암호화 계좌번호를 복호화
		plainAcct, err := crypto.DecryptCBC(session.AccountNumber, s.cfg.EncryptionKey)
		if err != nil {
			return apperror.Internal("저장된 계좌 정보를 해독할 수 없습니다", err)
		}

		// 로그인된 사용자: 인증된 계좌 정보를 사용자 프로필에 저장
		// 세션의 AccountNumber 는 이미 EncryptCBC 결과이므로 그대로 재사용 (이중 암호화 회피)
		if userID > 0 {
			if err := tx.Model(&domain.User{}).Where("Id = ?", userID).Updates(map[string]any{
				"BankName":       session.BankName,
				"BankCode":       session.BankCode,
				"AccountNumber":  session.AccountNumber,
				"AccountHolder":  session.AccountHolder,
				"BankVerifiedAt": time.Now(),
				"KycStatus":      "VERIFIED",
			}).Error; err != nil {
				return err
			}
		}

		logger.Log.Info("1원 인증 완료 (외부 검증 성공)",
			zap.String("trNo", session.VerifyTrNo),
			zap.Int("userId", userID),
			zap.String("bankCode", session.BankCode),
		)

		result = &BankVerifyResult{
			BankName:      session.BankName,
			BankCode:      session.BankCode,
			AccountNumber: plainAcct,
			AccountHolder: session.AccountHolder,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

// ─── 계좌 조회/변경 ───

// GetBankAccount는 사용자의 저장된(암호화된) 계좌 정보를 안전하게 조회합니다.
func (s *KycService) GetBankAccount(userID int) (*domain.User, error) {
	var user domain.User
	err := s.db.Select("BankName", "BankCode", "AccountNumber", "AccountHolder", "BankVerifiedAt").First(&user, userID).Error
	return &user, err
}

// ChangeBankAccount는 등록된 출금/정산 계좌를 변경할 때 사용합니다.
// 트랜잭션으로 원자성을 보장합니다.
func (s *KycService) ChangeBankAccount(userID int, verifyTrNo, verifyWord string) (map[string]any, error) {
	var resultMap map[string]any

	err := s.db.Transaction(func(tx *gorm.DB) error {
		var session domain.KycVerifySession
		if err := tx.Where("VerifyTrNo = ? AND IsVerified = ?", verifyTrNo, false).First(&session).Error; err != nil {
			return apperror.NotFound("인증 세션을 찾을 수 없습니다.")
		}

		if session.ExpiresAt.Before(time.Now()) {
			tx.Delete(&session)
			return apperror.Unauthorized("인증 유효 시간이 만료되었습니다.")
		}

		if verifyWord != session.VerifyTrNo {
			logger.Log.Warn("계좌 변경 인증어 불일치",
				zap.String("trNo", verifyTrNo),
				zap.Int("userId", userID),
			)
			return apperror.Unauthorized("인증 번호가 일치하지 않습니다")
		}

		plainAcct, err := crypto.DecryptCBC(session.AccountNumber, s.cfg.EncryptionKey)
		if err != nil {
			return apperror.Internal("계좌 정보 복호화 실패", err)
		}
		encryptedAcct, err := crypto.EncryptCBC(plainAcct, s.cfg.EncryptionKey)
		if err != nil {
			return apperror.Internal("계좌 정보 암호화 실패", err)
		}

		now := time.Now()
		if err := tx.Model(&domain.User{}).Where("Id = ?", userID).Updates(map[string]any{
			"BankName":       session.BankName,
			"BankCode":       session.BankCode,
			"AccountNumber":  encryptedAcct,
			"AccountHolder":  session.AccountHolder,
			"BankVerifiedAt": now,
			"KycStatus":      "VERIFIED",
		}).Error; err != nil {
			return err
		}

		// 세션 완료 처리 + 삭제 (원자적)
		tx.Model(&session).Update("IsVerified", true)
		tx.Delete(&session)

		masked := plainAcct
		if len(plainAcct) > 6 {
			masked = plainAcct[:3] + "***" + plainAcct[len(plainAcct)-3:]
		}

		logger.Log.Info("계좌 변경 완료",
			zap.Int("userId", userID),
			zap.String("bankCode", session.BankCode),
		)

		resultMap = map[string]any{
			"bankName":      session.BankName,
			"accountNumber": masked,
			"accountHolder": session.AccountHolder,
			"kycStatus":     "VERIFIED",
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return resultMap, nil
}

// ─── SMS 인증 (KCB/Coocon) ───

// GetSmsVerification은 특정 휴대폰 번호로 진행된 가장 최근의 SMS 본인 확인 내역을 조회합니다.
func (s *KycService) GetSmsVerification(phone string) (*domain.SmsVerification, error) {
	var result domain.SmsVerification
	err := s.db.Where("_PHONE = ?", phone).Order("_DATETIME DESC").First(&result).Error
	if err != nil {
		return nil, apperror.NotFound("해당 번호로 진행된 인증 내역이 없습니다")
	}
	return &result, nil
}

// UpdateUserKycFromSms는 외부 솔루션(KCB 등)을 통한 본인 확인 결과를 사용자 프로필에 반영합니다.
func (s *KycService) UpdateUserKycFromSms(userID int, phone string) error {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return apperror.Validation("전화번호를 입력해주세요")
	}

	_, err := s.GetSmsVerification(phone)
	if err != nil {
		return err
	}

	if userID > 0 {
		return s.db.Model(&domain.User{}).Where("Id = ?", userID).Updates(map[string]any{
			"KycStatus": "VERIFIED",
			"Phone":     phone,
		}).Error
	}

	return nil
}

// ChangePhone은 KCB 본인인증 완료 후 전화번호를 변경합니다.
func (s *KycService) ChangePhone(userID int, newPhone string) error {
	if userID <= 0 || newPhone == "" {
		return apperror.Validation("유효하지 않은 요청입니다")
	}

	newPhone = strings.ReplaceAll(strings.TrimSpace(newPhone), "-", "")

	_, err := s.GetSmsVerification(newPhone)
	if err != nil {
		return apperror.Validation("해당 번호로 완료된 본인인증 기록이 없습니다. KCB 본인인증을 먼저 진행해주세요")
	}

	var existingCount int64
	s.db.Model(&domain.User{}).Where("Phone = ? AND Id != ? AND DeletedAt IS NULL", newPhone, userID).Count(&existingCount)
	if existingCount > 0 {
		return apperror.Conflict("이미 다른 계정에서 사용 중인 전화번호입니다")
	}

	logger.Log.Info("전화번호 변경",
		zap.Int("userId", userID),
		zap.String("phone", newPhone[:3]+"****"+newPhone[len(newPhone)-4:]),
	)

	return s.db.Model(&domain.User{}).Where("Id = ?", userID).Updates(map[string]any{
		"Phone":     newPhone,
		"KycStatus": "VERIFIED",
	}).Error
}

// ─── Coocon KCB 연동 ───

// StartKcbAuth는 Coocon 휴대폰 본인 확인창을 띄우기 위한 인증 식별자를 생성합니다.
// 메인 서버 접속 실패 시 서브 서버로 자동 fallback (5분 캐시).
func (s *KycService) StartKcbAuth() (map[string]string, error) {
	kcbAuthId := uuid.New().String()
	baseUrl := resolveCooconUrl(s.cfg.CooconKycUrl, s.cfg.CooconKycUrlSub)

	popupUrl := fmt.Sprintf("%s?company=gift&kcbAuthId=%s", baseUrl, kcbAuthId)

	logger.Log.Info("KCB 인증 세션 시작",
		zap.String("kcbAuthId", kcbAuthId),
		zap.String("cooconUrl", baseUrl),
	)

	return map[string]string{
		"kcbAuthId": kcbAuthId,
		"popupUrl":  popupUrl,
	}, nil
}

// CheckKcbStatus는 진행 중인 외부 인증 솔루션의 진행 상태를 확인합니다.
func (s *KycService) CheckKcbStatus(kcbAuthId string) (map[string]any, error) {
	return map[string]any{"status": "pending"}, nil
}

// CompleteKcbAuth는 KCB 인증 완료 후 전달받은 실명, 휴대폰 번호, CI(연계정보) 등을 기록합니다.
// CI(연계정보) 기반으로 5분 내 중복 INSERT를 방지합니다 (멱등성).
func (s *KycService) CompleteKcbAuth(kcbAuthId, name, phone, ci, birth, gender, nationality, telco string) (map[string]any, error) {
	if name == "" || phone == "" {
		return map[string]any{"verified": false}, nil
	}

	// 멱등성: 동일 CI로 최근 5분 내 인증 기록이 있으면 중복 INSERT 방지
	if ci != "" {
		var recentCount int64
		cutoff := time.Now().Add(-5 * time.Minute)
		s.db.Model(&domain.SmsVerification{}).
			Where("_CI = ? AND _DATETIME > ?", ci, cutoff).
			Count(&recentCount)
		if recentCount > 0 {
			logger.Log.Info("KCB 인증 중복 요청 무시 (멱등성)",
				zap.String("kcbAuthId", kcbAuthId),
				zap.String("ci", ci[:8]+"..."),
			)
			return map[string]any{
				"verified": true,
				"name":     name,
				"phone":    phone,
				"ci":       ci,
			}, nil
		}
	}

	smsVerification := &domain.SmsVerification{
		BankUser:    &name,
		Birth:       &birth,
		Gender:      &gender,
		Nationality: &nationality,
		Telco:       &telco,
		Phone:       &phone,
		CI:          &ci,
	}
	if err := s.db.Create(smsVerification).Error; err != nil {
		logger.Log.Error("KCB 인증 결과 저장 실패",
			zap.String("kcbAuthId", kcbAuthId),
			zap.Error(err),
		)
		return nil, apperror.Internal("인증 결과 저장 중 오류 발생", err)
	}

	logger.Log.Info("KCB 인증 완료",
		zap.String("kcbAuthId", kcbAuthId),
		zap.String("phone", phone[:3]+"****"),
	)

	return map[string]any{
		"verified": true,
		"name":     name,
		"phone":    phone,
		"ci":       ci,
	}, nil
}
