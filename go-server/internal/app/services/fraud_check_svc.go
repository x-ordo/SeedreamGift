// Package services — FraudCheckService는 더치트 API + Blacklist-DB 스크리닝을 통한
// 이중 사기 조회 서비스입니다.
package services

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"w-gift-server/internal/app/interfaces"
	"w-gift-server/internal/config"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/blacklistdb"
	"w-gift-server/pkg/crypto"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/thecheat"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// TheCheatSearcher는 더치트 API 호출을 추상화한 인터페이스입니다.
// 실제 thecheat.Client와 테스트 스텁 모두 이 인터페이스를 만족합니다.
type TheCheatSearcher interface {
	Search(keyword, keywordType, bankCode string) (*thecheat.FraudResult, error)
}

// BlacklistScreener는 Blacklist-DB 스크리닝 API 호출을 추상화한 인터페이스입니다.
type BlacklistScreener interface {
	Screen(refID, candidateName, phone, account string) (*blacklistdb.ScreeningResult, error)
}

// FraudCheckService는 사용자의 전화번호와 계좌번호를 더치트 API로 조회하고,
// 이름+전화+계좌를 Blacklist-DB로 스크리닝하여 사기 위험을 판별합니다.
type FraudCheckService struct {
	db              *gorm.DB
	cfg             *config.Config
	client          TheCheatSearcher
	blacklistClient BlacklistScreener
}

// NewFraudCheckService는 새로운 FraudCheckService를 생성합니다.
func NewFraudCheckService(db *gorm.DB, cfg *config.Config, client TheCheatSearcher) *FraudCheckService {
	return &FraudCheckService{
		db:     db,
		cfg:    cfg,
		client: client,
	}
}

// SetBlacklistClient는 Blacklist-DB 스크리닝 클라이언트를 주입합니다.
func (s *FraudCheckService) SetBlacklistClient(bl BlacklistScreener) {
	s.blacklistClient = bl
}

// Check는 캐시를 활용하여 사기 조회를 수행합니다.
func (s *FraudCheckService) Check(userID int, source string) (*interfaces.FraudCheckResult, error) {
	return s.check(userID, source, true)
}

// CheckRealtime는 캐시를 무시하고 실시간으로 사기 조회를 수행합니다.
func (s *FraudCheckService) CheckRealtime(userID int) (*interfaces.FraudCheckResult, error) {
	return s.check(userID, "realtime", false)
}

// check는 사기 조회의 핵심 로직입니다.
func (s *FraudCheckService) check(userID int, source string, useCache bool) (*interfaces.FraudCheckResult, error) {
	result := &interfaces.FraudCheckResult{}

	// 기능 비활성화 시 즉시 반환
	if !s.cfg.TheCheatEnabled {
		return result, nil
	}

	// 사용자 정보 로드 (필요 필드만)
	var user domain.User
	if err := s.db.Select("Id", "Name", "Phone", "AccountNumber", "BankCode").First(&user, userID).Error; err != nil {
		return nil, fmt.Errorf("사용자 조회 실패 (ID=%d): %w", userID, err)
	}

	start := time.Now()

	// ── 더치트 전화번호 + 계좌번호 병렬 조회 ──
	var plainAccount string
	var wg sync.WaitGroup
	var mu sync.Mutex

	// 계좌번호 미리 복호화 (goroutine 밖에서 수행)
	if user.AccountNumber != nil && *user.AccountNumber != "" {
		var err error
		plainAccount, err = crypto.DecryptCBC(*user.AccountNumber, s.cfg.EncryptionKey)
		if err != nil {
			logger.Log.Error("계좌번호 복호화 실패",
				zap.Int("userID", userID),
				zap.Error(err),
			)
			plainAccount = "" // 복호화 실패 시 계좌 조회 스킵
		}
	}

	// 전화번호 조회 (goroutine)
	if user.Phone != nil && *user.Phone != "" {
		wg.Add(1)
		go func(phone string) {
			defer wg.Done()
			caution, url, err := s.checkKeyword(userID, phone, "phone", "", source, useCache)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				logger.Log.Warn("더치트 전화번호 조회 실패 (fail-closed) → 주의 플래그",
					zap.Int("userID", userID),
					zap.String("phone", maskPhone(phone)),
					zap.Error(err),
				)
				result.IsFlagged = true
			} else {
				result.PhoneCaution = caution
				result.PhoneURL = url
				if caution == "Y" {
					result.IsFlagged = true
				}
			}
		}(*user.Phone)
	}

	// 계좌번호 조회 (goroutine)
	if plainAccount != "" {
		wg.Add(1)
		go func(account string) {
			defer wg.Done()
			bankCode := ""
			if user.BankCode != nil {
				bankCode = *user.BankCode
			}
			caution, url, err := s.checkKeyword(userID, account, "account", bankCode, source, useCache)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				logger.Log.Warn("더치트 계좌번호 조회 실패 (fail-closed) → 주의 플래그",
					zap.Int("userID", userID),
					zap.String("account", maskAccount(account)),
					zap.Error(err),
				)
				result.IsFlagged = true
			} else {
				result.AccountCaution = caution
				result.AccountURL = url
				if caution == "Y" {
					result.IsFlagged = true
				}
			}
		}(plainAccount)
	}

	// ── 블랙리스트 스크리닝 ── (더치트와 병렬로 동시 실행)
	// checkBlacklist는 result 포인터를 직접 쓰므로 mu로 보호합니다.
	if s.blacklistClient != nil && s.cfg.BlacklistEnabled {
		wg.Add(1)
		go func() {
			defer wg.Done()
			// 임시 결과 구조체에 기록한 뒤 mu로 보호하여 병합
			partial := &interfaces.FraudCheckResult{}
			s.checkBlacklist(userID, &user, plainAccount, source, useCache, partial)
			mu.Lock()
			result.BlacklistStatus = partial.BlacklistStatus
			result.BlacklistMatchCode = partial.BlacklistMatchCode
			result.BlacklistIncidentCount = partial.BlacklistIncidentCount
			if partial.IsFlagged {
				result.IsFlagged = true
			}
			mu.Unlock()
		}()
	}

	wg.Wait()

	// ── 종합 사유 생성 ──
	buildFraudReason(result)

	elapsed := time.Since(start)
	logger.Log.Info("사기 조회 완료",
		zap.Int("userID", userID),
		zap.String("source", source),
		zap.Bool("flagged", result.IsFlagged),
		zap.Strings("flagSources", result.FlagSources),
		zap.String("reason", result.Reason),
		zap.Duration("elapsed", elapsed),
	)

	return result, nil
}

// buildFraudReason은 조회 결과를 기반으로 FlagSources와 Reason을 조립합니다.
func buildFraudReason(r *interfaces.FraudCheckResult) {
	var sources []string
	var reasons []string

	// 더치트 전화번호
	if r.PhoneCaution == "Y" {
		sources = append(sources, "THECHEAT_PHONE")
		reasons = append(reasons, "더치트: 전화번호 피해사례 등록")
	}
	// 더치트 계좌번호
	if r.AccountCaution == "Y" {
		sources = append(sources, "THECHEAT_ACCOUNT")
		reasons = append(reasons, "더치트: 계좌번호 피해사례 등록")
	}

	// 블랙리스트 스크리닝
	if r.BlacklistStatus == "BLOCKED" {
		detail := formatBlacklistMatch(r.BlacklistMatchCode)
		sources = append(sources, "BLACKLIST")
		reasons = append(reasons, fmt.Sprintf("블랙리스트: %s (사고 %d건)", detail, r.BlacklistIncidentCount))
	}

	// API 실패로 인한 안전 플래그 (소스가 없는데 IsFlagged인 경우)
	if r.IsFlagged && len(sources) == 0 {
		sources = append(sources, "API_FAILURE")
		reasons = append(reasons, "사기조회 서비스 오류로 보류 (fail-closed)")
	}

	r.FlagSources = sources
	if len(reasons) > 0 {
		r.Reason = strings.Join(reasons, " / ")
	}
}

// formatBlacklistMatch는 matchCode 비트맵을 한국어 설명으로 변환합니다.
func formatBlacklistMatch(matchCode string) string {
	if len(matchCode) < 3 {
		return "매칭 정보 없음"
	}
	var parts []string
	if matchCode[0] == '1' {
		parts = append(parts, "이름")
	}
	if matchCode[1] == '1' {
		parts = append(parts, "전화번호")
	}
	if matchCode[2] == '1' {
		parts = append(parts, "계좌번호")
	}
	if len(parts) == 0 {
		return "매칭 없음"
	}
	return strings.Join(parts, "+") + " 일치"
}

// checkBlacklist는 Blacklist-DB 스크리닝을 수행합니다.
// 이름이 없거나, 전화번호·계좌번호 모두 없으면 스킵합니다.
func (s *FraudCheckService) checkBlacklist(userID int, user *domain.User, plainAccount, source string, useCache bool, result *interfaces.FraudCheckResult) {
	if s.blacklistClient == nil || !s.cfg.BlacklistEnabled {
		return
	}

	// 이름 필수
	if user.Name == nil || *user.Name == "" {
		return
	}
	name := *user.Name

	// 전화번호 또는 계좌번호 중 하나는 있어야 함
	phone := ""
	if user.Phone != nil {
		phone = *user.Phone
	}
	if phone == "" && plainAccount == "" {
		return
	}

	// 캐시 확인
	if useCache {
		var cached domain.BlacklistCheckLog
		err := s.db.Where("UserId = ? AND ExpiresAt > ?", userID, time.Now()).
			Order("CreatedAt DESC").First(&cached).Error
		if err == nil {
			result.BlacklistStatus = cached.Status
			result.BlacklistMatchCode = cached.MatchCode
			result.BlacklistIncidentCount = cached.IncidentCount
			if cached.Status == "BLOCKED" && blacklistdb.IsNameBasedBlock(cached.MatchCode) {
				result.IsFlagged = true
			}
			return
		}
	}

	// API 호출
	refID := fmt.Sprintf("user-%d", userID)
	screening, err := s.blacklistClient.Screen(refID, name, phone, plainAccount)
	if err != nil {
		logger.Log.Warn("블랙리스트 스크리닝 실패 (fail-closed) → 주의 플래그",
			zap.Int("userID", userID),
			zap.String("name", maskName(name)),
			zap.Error(err),
		)
		result.IsFlagged = true
		return
	}

	// 결과 저장
	log := domain.BlacklistCheckLog{
		UserID:        userID,
		CandidateName: maskName(name),
		Status:        screening.Status,
		MatchCode:     screening.MatchCode,
		IncidentCount: screening.IncidentCount,
		Source:        source,
		ExpiresAt:     time.Now().Add(s.cfg.BlacklistCacheTTL),
	}
	if dbErr := s.db.Create(&log).Error; dbErr != nil {
		logger.Log.Error("블랙리스트 스크리닝 로그 저장 실패",
			zap.Int("userID", userID),
			zap.Error(dbErr),
		)
	}

	result.BlacklistStatus = screening.Status
	result.BlacklistMatchCode = screening.MatchCode
	result.BlacklistIncidentCount = screening.IncidentCount

	// 이름 기반 매칭인 경우에만 차단 (이름+전번, 이름+계좌, 이름+전번+계좌)
	if screening.Status == "BLOCKED" && blacklistdb.IsNameBasedBlock(screening.MatchCode) {
		result.IsFlagged = true
	}
}

// checkKeyword는 개별 키워드(전화번호 또는 계좌번호)에 대한 조회를 수행합니다.
// 캐시가 활성화된 경우 FraudCheckLog에서 캐시된 결과를 먼저 확인합니다.
func (s *FraudCheckService) checkKeyword(userID int, keyword, keywordType, bankCode, source string, useCache bool) (caution string, url string, err error) {
	// 캐시 확인 (마스킹된 키워드이므로 UserID+KeywordType으로 조회)
	if useCache {
		var cached domain.FraudCheckLog
		query := s.db.Where("UserId = ? AND KeywordType = ? AND ExpiresAt > ?",
			userID, keywordType, time.Now())

		if err := query.Order("CreatedAt DESC").First(&cached).Error; err == nil {
			// 캐시 히트
			caution = cached.Caution
			if cached.KeywordURL != nil {
				url = *cached.KeywordURL
			}
			return caution, url, nil
		}
	}

	// API 호출
	apiResult, err := s.client.Search(keyword, keywordType, bankCode)
	if err != nil {
		return "", "", fmt.Errorf("더치트 API 호출 실패: %w", err)
	}

	// 마스킹된 키워드 저장 (원문 저장 금지)
	maskedKW := keyword
	if keywordType == "phone" {
		maskedKW = maskPhone(keyword)
	} else if keywordType == "account" {
		maskedKW = maskAccount(keyword)
	}

	// 결과를 캐시에 저장
	var keywordURL *string
	if apiResult.KeywordURL != "" {
		keywordURL = &apiResult.KeywordURL
	}
	var bankCodePtr *string
	if bankCode != "" {
		bankCodePtr = &bankCode
	}

	log := domain.FraudCheckLog{
		UserID:      userID,
		Keyword:     maskedKW, // masked, not plain
		KeywordType: keywordType,
		BankCode:    bankCodePtr,
		Caution:     apiResult.Caution,
		KeywordURL:  keywordURL,
		Source:      source,
		ExpiresAt:   time.Now().Add(s.cfg.TheCheatCacheTTL),
	}
	if dbErr := s.db.Create(&log).Error; dbErr != nil {
		logger.Log.Error("사기 조회 로그 저장 실패",
			zap.Int("userID", userID),
			zap.String("keywordType", keywordType),
			zap.Error(dbErr),
		)
	}

	return apiResult.Caution, apiResult.KeywordURL, nil
}

// maskName은 이름을 마스킹합니다. "홍길동" → "홍*동", "김철수" → "김*수"
func maskName(name string) string {
	runes := []rune(name)
	if len(runes) <= 1 {
		return name
	}
	if len(runes) == 2 {
		return string(runes[0]) + "*"
	}
	// 첫 글자 + *반복 + 마지막 글자
	masked := make([]rune, len(runes))
	masked[0] = runes[0]
	for i := 1; i < len(runes)-1; i++ {
		masked[i] = '*'
	}
	masked[len(runes)-1] = runes[len(runes)-1]
	return string(masked)
}

// maskPhone는 전화번호를 마스킹합니다. "01012345678" → "010****5678"
func maskPhone(phone string) string {
	if len(phone) < 7 {
		return phone
	}
	return phone[:3] + "****" + phone[len(phone)-4:]
}

// maskAccount는 계좌번호를 마스킹합니다. "1234567890" → "1234****90"
func maskAccount(account string) string {
	if len(account) < 6 {
		return account
	}
	return account[:4] + "****" + account[len(account)-2:]
}
