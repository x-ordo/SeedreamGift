// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
// external_service_config_svc.go는 외부 서비스(이메일/카카오/텔레그램/팝빌) 설정을
// DB에서 관리하는 서비스입니다. 30초 TTL 인메모리 캐시와 AES-256 암호화를 제공합니다.
package services

import (
	"fmt"
	"strconv"
	"sync"
	"time"
	"w-gift-server/internal/config"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/crypto"
	"w-gift-server/pkg/logger"

	"go.uber.org/zap"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ── 채널 & 필드 상수 ──

// 채널 이름 상수
const (
	ChannelEmail    = "EMAIL"
	ChannelKakao    = "KAKAO"
	ChannelTelegram = "TELEGRAM"
	ChannelPopbill  = "POPBILL"
)

// fieldEnabled는 채널 활성화 토글 필드명입니다.
const fieldEnabled = "__enabled__"

// cacheTTL은 채널 설정 캐시 유효 기간입니다.
const cacheTTL = 30 * time.Second

// ── 필드 스펙 ──

// fieldSpec은 채널 필드의 메타데이터를 정의합니다.
type fieldSpec struct {
	Name     string
	IsSecret bool
	Label    string
}

// channelFields는 각 채널별 지원 필드 목록입니다.
// 순서가 UI 렌더링 순서에 해당합니다.
var channelFields = map[string][]fieldSpec{
	ChannelEmail: {
		{fieldEnabled, false, "활성화"},
		{"smtp_host", false, "SMTP 호스트"},
		{"smtp_port", false, "SMTP 포트"},
		{"smtp_user", false, "SMTP 사용자"},
		{"smtp_password", true, "SMTP 비밀번호"},
		{"smtp_from", false, "발신 이메일"},
		{"smtp_from_name", false, "발신자 이름"},
	},
	ChannelKakao: {
		{fieldEnabled, false, "활성화"},
		{"sender_key", true, "발신 프로필 키"},
		{"api_key", true, "API 키"},
	},
	ChannelTelegram: {
		{fieldEnabled, false, "활성화"},
		{"bot_token", true, "봇 토큰"},
		{"chat_id", false, "채팅 ID"},
	},
	ChannelPopbill: {
		{fieldEnabled, false, "활성화"},
		{"link_id", false, "연동 아이디"},
		{"secret_key", true, "비밀키"},
		{"corp_num", false, "사업자등록번호"},
		{"is_test", false, "테스트 모드"},
	},
}

// allChannels는 지원 채널 목록 (UI 렌더링 순서).
var allChannels = []string{ChannelEmail, ChannelKakao, ChannelTelegram, ChannelPopbill}

// ── 응답 타입 ──

// ChannelConfigResponse는 채널 설정 응답 구조체입니다.
type ChannelConfigResponse struct {
	Channel   string                `json:"channel"`
	Enabled   bool                  `json:"enabled"`
	Fields    []ConfigFieldResponse `json:"fields"`
	UpdatedAt time.Time             `json:"updatedAt"`
}

// ConfigFieldResponse는 개별 필드 응답입니다.
// 시크릿 필드는 Value가 마스킹됩니다.
type ConfigFieldResponse struct {
	Name     string `json:"name"`
	Value    string `json:"value"` // 시크릿이면 마스킹된 값
	IsSecret bool   `json:"isSecret"`
	Label    string `json:"label"`
}

// ── 캐시 내부 타입 ──

// channelCacheEntry는 채널별 복호화된 필드 맵과 적재 시각을 담습니다.
type channelCacheEntry struct {
	fields   map[string]string // fieldName → 복호화된 평문값
	loadedAt time.Time
}

// ── 서비스 ──

// ExternalServiceConfigService는 외부 서비스 설정 CRUD, 캐싱, 암호화, env 시딩을 담당합니다.
type ExternalServiceConfigService struct {
	db            *gorm.DB
	encryptionKey string
	envCfg        *config.Config

	mu    sync.RWMutex
	cache map[string]*channelCacheEntry
}

// NewExternalServiceConfigService는 ExternalServiceConfigService를 초기화합니다.
func NewExternalServiceConfigService(db *gorm.DB, encKey string, cfg *config.Config) *ExternalServiceConfigService {
	return &ExternalServiceConfigService{
		db:            db,
		encryptionKey: encKey,
		envCfg:        cfg,
		cache:         make(map[string]*channelCacheEntry),
	}
}

// ── env 시딩 ──

// SeedFromEnv는 각 채널에 DB 행이 하나도 없을 때 .env 값을 초기 데이터로 삽입합니다.
// 기존 행이 있으면 건너뜁니다(idempotent).
func (s *ExternalServiceConfigService) SeedFromEnv(cfg *config.Config) {
	seeds := s.buildEnvSeeds(cfg)
	for channel, fields := range seeds {
		var count int64
		s.db.Model(&domain.ExternalServiceConfig{}).
			Where("Channel = ?", channel).
			Count(&count)
		if count > 0 {
			continue
		}
		for _, row := range fields {
			val := row.value
			if row.isSecret && val != "" {
				encrypted, err := crypto.Encrypt(val, s.encryptionKey)
				if err != nil {
					logger.Log.Error("SeedFromEnv: 암호화 실패",
						zap.String("channel", channel),
						zap.String("field", row.name),
						zap.Error(err))
					encrypted = ""
				}
				val = encrypted
			}
			rec := &domain.ExternalServiceConfig{
				Channel:    channel,
				FieldName:  row.name,
				FieldValue: val,
				IsSecret:   row.isSecret,
			}
			if err := s.db.Create(rec).Error; err != nil {
				logger.Log.Error("SeedFromEnv: 행 삽입 실패",
					zap.String("channel", channel),
					zap.String("field", row.name),
					zap.Error(err))
			}
		}
		logger.Log.Info("SeedFromEnv: 채널 초기화 완료", zap.String("channel", channel))
	}
}

// seedRow는 시딩용 내부 타입입니다.
type seedRow struct {
	name     string
	value    string
	isSecret bool
}

// buildEnvSeeds는 config에서 채널별 시드 데이터를 만들어 반환합니다.
func (s *ExternalServiceConfigService) buildEnvSeeds(cfg *config.Config) map[string][]seedRow {
	boolStr := func(b bool) string {
		if b {
			return "true"
		}
		return "false"
	}

	return map[string][]seedRow{
		ChannelEmail: {
			{fieldEnabled, boolStr(cfg.SMTPEnabled), false},
			{"smtp_host", cfg.SMTPHost, false},
			{"smtp_port", strconv.Itoa(cfg.SMTPPort), false},
			{"smtp_user", cfg.SMTPUser, false},
			{"smtp_password", cfg.SMTPPassword, true},
			{"smtp_from", cfg.SMTPFrom, false},
			{"smtp_from_name", cfg.SMTPFromName, false},
		},
		ChannelKakao: {
			{fieldEnabled, boolStr(cfg.KakaoSenderKey != ""), false},
			{"sender_key", cfg.KakaoSenderKey, true},
			{"api_key", cfg.KakaoAPIKey, true},
		},
		ChannelTelegram: {
			{fieldEnabled, boolStr(cfg.TelegramToken != ""), false},
			{"bot_token", cfg.TelegramToken, true},
			{"chat_id", cfg.TelegramChatID, false},
		},
		ChannelPopbill: {
			{fieldEnabled, boolStr(cfg.PopbillLinkID != ""), false},
			{"link_id", cfg.PopbillLinkID, false},
			{"secret_key", cfg.PopbillSecretKey, true},
			{"corp_num", cfg.PopbillCorpNum, false},
			{"is_test", boolStr(cfg.PopbillIsTest), false},
		},
	}
}

// ── 조회 메서드 ──

// GetAllChannels는 4개 채널 전체 설정을 마스킹된 값으로 반환합니다.
func (s *ExternalServiceConfigService) GetAllChannels() []ChannelConfigResponse {
	result := make([]ChannelConfigResponse, 0, len(allChannels))
	for _, ch := range allChannels {
		resp, err := s.GetChannelConfig(ch)
		if err != nil {
			logger.Log.Warn("GetAllChannels: 채널 조회 실패",
				zap.String("channel", ch), zap.Error(err))
			result = append(result, s.emptyChannelResponse(ch))
			continue
		}
		result = append(result, *resp)
	}
	return result
}

// GetChannelConfig는 단일 채널 설정을 마스킹된 값으로 반환합니다.
func (s *ExternalServiceConfigService) GetChannelConfig(channel string) (*ChannelConfigResponse, error) {
	specs, ok := channelFields[channel]
	if !ok {
		return nil, fmt.Errorf("알 수 없는 채널: %s", channel)
	}

	// DB에서 해당 채널 행 조회
	var rows []domain.ExternalServiceConfig
	if err := s.db.Where("Channel = ?", channel).Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("채널 설정 조회 실패: %w", err)
	}

	// fieldName → row 맵 구성
	rowMap := make(map[string]domain.ExternalServiceConfig, len(rows))
	var latestUpdatedAt time.Time
	for _, r := range rows {
		rowMap[r.FieldName] = r
		if r.UpdatedAt.After(latestUpdatedAt) {
			latestUpdatedAt = r.UpdatedAt
		}
	}

	// 활성화 여부
	enabled := false
	if r, ok := rowMap[fieldEnabled]; ok {
		enabled = r.FieldValue == "true"
	}

	// 필드 응답 구성 (fieldEnabled는 포함하지 않음, enabled 필드로 분리)
	fields := make([]ConfigFieldResponse, 0, len(specs)-1)
	for _, spec := range specs {
		if spec.Name == fieldEnabled {
			continue
		}
		r, exists := rowMap[spec.Name]
		displayVal := ""
		if exists {
			if spec.IsSecret {
				plain, err := s.decryptField(r.FieldValue)
				if err == nil {
					displayVal = maskSecret(plain)
				} else {
					displayVal = "****"
				}
			} else {
				displayVal = r.FieldValue
			}
		}
		fields = append(fields, ConfigFieldResponse{
			Name:     spec.Name,
			Value:    displayVal,
			IsSecret: spec.IsSecret,
			Label:    spec.Label,
		})
	}

	return &ChannelConfigResponse{
		Channel:   channel,
		Enabled:   enabled,
		Fields:    fields,
		UpdatedAt: latestUpdatedAt,
	}, nil
}

// ── 수정 메서드 ──

// UpdateChannelFields는 채널 필드를 일괄 upsert합니다.
// 시크릿 필드는 암호화 후 저장하며, 완료 시 캐시를 무효화합니다.
func (s *ExternalServiceConfigService) UpdateChannelFields(channel string, fields map[string]string, adminEmail string) error {
	specs, ok := channelFields[channel]
	if !ok {
		return fmt.Errorf("알 수 없는 채널: %s", channel)
	}

	// fieldName → IsSecret 조회 맵
	secretMap := make(map[string]bool, len(specs))
	for _, sp := range specs {
		secretMap[sp.Name] = sp.IsSecret
	}

	for name, val := range fields {
		// fieldEnabled는 UpdateChannelFields로 변경 불가 (ToggleChannel 전용)
		if name == fieldEnabled {
			continue
		}

		isSecret, known := secretMap[name]
		if !known {
			return fmt.Errorf("채널 %s에 알 수 없는 필드: %s", channel, name)
		}

		storedVal := val
		if isSecret && val != "" {
			encrypted, err := crypto.Encrypt(val, s.encryptionKey)
			if err != nil {
				return fmt.Errorf("필드 암호화 실패 (channel=%s field=%s): %w", channel, name, err)
			}
			storedVal = encrypted
		}

		rec := domain.ExternalServiceConfig{
			Channel:    channel,
			FieldName:  name,
			FieldValue: storedVal,
			IsSecret:   isSecret,
			UpdatedBy:  &adminEmail,
		}

		// MSSQL MERGE (upsert): (Channel, FieldName) 복합 유니크 기준
		if err := s.db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "Channel"}, {Name: "FieldName"}},
			DoUpdates: clause.AssignmentColumns([]string{"FieldValue", "IsSecret", "UpdatedAt", "UpdatedBy"}),
		}).Create(&rec).Error; err != nil {
			return fmt.Errorf("필드 upsert 실패 (channel=%s field=%s): %w", channel, name, err)
		}
	}

	s.invalidateCache(channel)
	logger.Log.Info("UpdateChannelFields: 필드 업데이트 완료",
		zap.String("channel", channel),
		zap.String("admin", adminEmail))
	return nil
}

// ToggleChannel은 채널 활성화 상태(__enabled__ 필드)를 변경합니다.
func (s *ExternalServiceConfigService) ToggleChannel(channel string, enabled bool, adminEmail string) error {
	if _, ok := channelFields[channel]; !ok {
		return fmt.Errorf("알 수 없는 채널: %s", channel)
	}

	val := "false"
	if enabled {
		val = "true"
	}

	rec := domain.ExternalServiceConfig{
		Channel:    channel,
		FieldName:  fieldEnabled,
		FieldValue: val,
		IsSecret:   false,
		UpdatedBy:  &adminEmail,
	}

	if err := s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "Channel"}, {Name: "FieldName"}},
		DoUpdates: clause.AssignmentColumns([]string{"FieldValue", "UpdatedAt", "UpdatedBy"}),
	}).Create(&rec).Error; err != nil {
		return fmt.Errorf("채널 토글 실패 (channel=%s): %w", channel, err)
	}

	s.invalidateCache(channel)
	logger.Log.Info("ToggleChannel: 채널 상태 변경",
		zap.String("channel", channel),
		zap.Bool("enabled", enabled),
		zap.String("admin", adminEmail))
	return nil
}

// ── 내부 사용 메서드 ──

// IsChannelEnabled는 채널 활성화 여부를 빠르게 확인합니다.
// 캐시 → DB → env 폴백 순으로 조회합니다.
func (s *ExternalServiceConfigService) IsChannelEnabled(channel string) bool {
	fields := s.GetDecryptedConfig(channel)
	val, ok := fields[fieldEnabled]
	if !ok {
		return false
	}
	return val == "true"
}

// GetDecryptedConfig는 채널의 모든 필드를 복호화된 평문 맵으로 반환합니다.
// 캐시 HIT이면 캐시 값을 반환하고, MISS이면 DB에서 로드합니다.
// DB에 행이 없으면 env 폴백 값을 반환합니다.
func (s *ExternalServiceConfigService) GetDecryptedConfig(channel string) map[string]string {
	// 1. 캐시 확인 (Read lock)
	s.mu.RLock()
	if entry, ok := s.cache[channel]; ok && time.Since(entry.loadedAt) < cacheTTL {
		// 복사본 반환 (map은 참조 타입이므로 caller 변경 방지)
		cp := make(map[string]string, len(entry.fields))
		for k, v := range entry.fields {
			cp[k] = v
		}
		s.mu.RUnlock()
		return cp
	}
	s.mu.RUnlock()

	// 2. DB 로드
	var rows []domain.ExternalServiceConfig
	if err := s.db.Where("Channel = ?", channel).Find(&rows).Error; err != nil {
		logger.Log.Warn("GetDecryptedConfig: DB 조회 실패, env 폴백",
			zap.String("channel", channel), zap.Error(err))
		return s.envFallback(channel)
	}

	if len(rows) == 0 {
		return s.envFallback(channel)
	}

	// 3. 복호화
	fields := make(map[string]string, len(rows))
	for _, r := range rows {
		if r.IsSecret && r.FieldValue != "" {
			plain, err := s.decryptField(r.FieldValue)
			if err != nil {
				logger.Log.Warn("GetDecryptedConfig: 복호화 실패",
					zap.String("channel", channel),
					zap.String("field", r.FieldName),
					zap.Error(err))
				fields[r.FieldName] = ""
				continue
			}
			fields[r.FieldName] = plain
		} else {
			fields[r.FieldName] = r.FieldValue
		}
	}

	// 4. 캐시 저장 (Write lock)
	s.mu.Lock()
	s.cache[channel] = &channelCacheEntry{
		fields:   fields,
		loadedAt: time.Now(),
	}
	s.mu.Unlock()

	// 복사본 반환
	cp := make(map[string]string, len(fields))
	for k, v := range fields {
		cp[k] = v
	}
	return cp
}

// invalidateCache는 특정 채널의 캐시를 무효화합니다.
func (s *ExternalServiceConfigService) invalidateCache(channel string) {
	s.mu.Lock()
	delete(s.cache, channel)
	s.mu.Unlock()
}

// ── 헬퍼 함수 ──

// decryptField는 AES-256 암호화된 필드 값을 복호화합니다.
// CBC(레거시)와 GCM 모두 자동 감지합니다.
func (s *ExternalServiceConfigService) decryptField(cipherText string) (string, error) {
	return crypto.DecryptAuto(cipherText, s.encryptionKey)
}

// maskSecret은 시크릿 값을 마스킹합니다.
// 마지막 4자리를 남기고 나머지를 **** 로 대체합니다.
func maskSecret(value string) string {
	if len(value) <= 4 {
		return "****"
	}
	return "****" + value[len(value)-4:]
}

// envFallback은 DB에 행이 없을 때 .env 기반 기본값 맵을 반환합니다.
func (s *ExternalServiceConfigService) envFallback(channel string) map[string]string {
	if s.envCfg == nil {
		return map[string]string{}
	}
	cfg := s.envCfg
	boolStr := func(b bool) string {
		if b {
			return "true"
		}
		return "false"
	}

	switch channel {
	case ChannelEmail:
		return map[string]string{
			fieldEnabled:     boolStr(cfg.SMTPEnabled),
			"smtp_host":      cfg.SMTPHost,
			"smtp_port":      strconv.Itoa(cfg.SMTPPort),
			"smtp_user":      cfg.SMTPUser,
			"smtp_password":  cfg.SMTPPassword,
			"smtp_from":      cfg.SMTPFrom,
			"smtp_from_name": cfg.SMTPFromName,
		}
	case ChannelKakao:
		return map[string]string{
			fieldEnabled: boolStr(cfg.KakaoSenderKey != ""),
			"sender_key": cfg.KakaoSenderKey,
			"api_key":    cfg.KakaoAPIKey,
		}
	case ChannelTelegram:
		return map[string]string{
			fieldEnabled: boolStr(cfg.TelegramToken != ""),
			"bot_token":  cfg.TelegramToken,
			"chat_id":    cfg.TelegramChatID,
		}
	case ChannelPopbill:
		return map[string]string{
			fieldEnabled: boolStr(cfg.PopbillLinkID != ""),
			"link_id":    cfg.PopbillLinkID,
			"secret_key": cfg.PopbillSecretKey,
			"corp_num":   cfg.PopbillCorpNum,
			"is_test":    boolStr(cfg.PopbillIsTest),
		}
	default:
		return map[string]string{}
	}
}

// emptyChannelResponse는 조회 실패 시 빈 채널 응답을 생성합니다.
func (s *ExternalServiceConfigService) emptyChannelResponse(channel string) ChannelConfigResponse {
	specs := channelFields[channel]
	fields := make([]ConfigFieldResponse, 0, len(specs))
	for _, sp := range specs {
		if sp.Name == fieldEnabled {
			continue
		}
		fields = append(fields, ConfigFieldResponse{
			Name:     sp.Name,
			Value:    "",
			IsSecret: sp.IsSecret,
			Label:    sp.Label,
		})
	}
	return ChannelConfigResponse{
		Channel: channel,
		Enabled: false,
		Fields:  fields,
	}
}
