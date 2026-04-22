package services

import (
	"seedream-gift-server/internal/domain"

	"gorm.io/gorm"
)

// PatternRuleService는 보안 패턴 룰 관리를 처리합니다.
type PatternRuleService struct {
	db *gorm.DB
}

// NewPatternRuleService는 새로운 PatternRuleService 인스턴스를 생성합니다.
func NewPatternRuleService(db *gorm.DB) *PatternRuleService {
	return &PatternRuleService{db: db}
}

// GetPatternRules는 전체 패턴 룰 목록을 조회합니다.
func (s *PatternRuleService) GetPatternRules() ([]domain.PatternRule, error) {
	var rules []domain.PatternRule
	err := s.db.Order("Category ASC, Id ASC").Find(&rules).Error
	return rules, err
}

// TogglePatternRule은 특정 패턴 룰의 활성화 상태를 변경합니다.
func (s *PatternRuleService) TogglePatternRule(ruleID string, enabled bool) error {
	result := s.db.Model(&domain.PatternRule{}).Where("RuleId = ?", ruleID).Update("Enabled", enabled)
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return result.Error
}

// SeedDefaultPatternRules는 기본 보안 패턴 룰을 시드합니다.
func (s *PatternRuleService) SeedDefaultPatternRules() {
	defaults := []domain.PatternRule{
		{RuleID: "LOGIN_BRUTE_FORCE", Name: "로그인 무차별 대입", Description: "연속 로그인 실패 시 계정을 일시 차단합니다", Category: "SECURITY", Enabled: true, BlockDurationMinutes: 15, MaxAttempts: 10, WindowMinutes: 5},
		{RuleID: "TRANSACTION_FLOOD", Name: "트랜잭션 폭주", Description: "1분 내 과도한 주문/매입 생성을 제한합니다", Category: "RATE_LIMIT", Enabled: true, BlockDurationMinutes: 5, MaxAttempts: 5, WindowMinutes: 1},
		{RuleID: "KYC_ABUSE", Name: "KYC 인증 남용", Description: "KYC 인증 요청을 분당 5회로 제한합니다", Category: "RATE_LIMIT", Enabled: true, BlockDurationMinutes: 10, MaxAttempts: 5, WindowMinutes: 1},
		{RuleID: "SQL_INJECTION", Name: "SQL 인젝션 탐지", Description: "SQL 인젝션 패턴이 감지된 요청을 차단합니다", Category: "SECURITY", Enabled: true, BlockDurationMinutes: 60, MaxAttempts: 1, WindowMinutes: 1},
		{RuleID: "BOT_SCANNER", Name: "봇/스캐너 차단", Description: "알려진 취약점 스캔 경로 요청을 차단합니다", Category: "SECURITY", Enabled: true, BlockDurationMinutes: 60, MaxAttempts: 1, WindowMinutes: 1},
		{RuleID: "LARGE_ORDER", Name: "대량 주문 감시", Description: "단일 주문에서 비정상적으로 큰 수량을 감시합니다", Category: "PATTERN", Enabled: false, BlockDurationMinutes: 0, MaxAttempts: 10, WindowMinutes: 60},
		{RuleID: "RAPID_CART", Name: "장바구니 폭탄", Description: "짧은 시간 내 과도한 장바구니 조작을 제한합니다", Category: "PATTERN", Enabled: false, BlockDurationMinutes: 5, MaxAttempts: 50, WindowMinutes: 1},
	}
	for _, rule := range defaults {
		s.db.Where("RuleId = ?", rule.RuleID).FirstOrCreate(&rule)
	}
}
