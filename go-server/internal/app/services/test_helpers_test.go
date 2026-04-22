package services

import (
	"errors"

	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/logger"

	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func init() {
	logger.Log, _ = zap.NewDevelopment()
}

// testEncKey는 테스트용 AES-256 암호화 키입니다 (64 hex chars = 32 bytes).
const testEncKey = "6464646464646464646464646464646464646464646464646464646464646464"

// setupTestDB는 테스트용 인메모리 SQLite 데이터베이스를 설정하고 스키마를 마이그레이션합니다.
func setupTestDB() *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic("failed to connect database: " + err.Error())
	}
	db.AutoMigrate(&domain.User{}, &domain.RefreshToken{})
	return db
}

// ─── Mock ConfigProvider (shared) ───

// mockConfigProvider는 ConfigProvider 인터페이스의 테스트용 목 구현체입니다.
// cart_test.go 및 order_test.go에서 공통으로 사용됩니다.
type mockConfigProvider struct {
	values map[string]string
}

func newMockConfigProvider() *mockConfigProvider {
	return &mockConfigProvider{
		values: map[string]string{
			"LIMIT_PER_ORDER": "500000",
			"LIMIT_PER_DAY":   "1000000",
			"LIMIT_PER_MONTH": "50000000",
		},
	}
}

func (m *mockConfigProvider) GetConfig(key string) (*domain.SiteConfig, error) {
	v, ok := m.values[key]
	if !ok {
		return nil, errors.New("not found")
	}
	return &domain.SiteConfig{Key: key, Value: v}, nil
}

func (m *mockConfigProvider) GetConfigValue(key string, defaultVal string) string {
	if v, ok := m.values[key]; ok {
		return v
	}
	return defaultVal
}

func (m *mockConfigProvider) GetConfigFloat(key string, defaultVal float64) float64 {
	if v, ok := m.values[key]; ok {
		d, err := decimal.NewFromString(v)
		if err == nil {
			f, _ := d.Float64()
			if f > 0 {
				return f
			}
		}
	}
	return defaultVal
}

func (m *mockConfigProvider) GetConfigInt(key string, defaultVal int) int {
	if v, ok := m.values[key]; ok {
		d, err := decimal.NewFromString(v)
		if err == nil {
			return int(d.IntPart())
		}
	}
	return defaultVal
}

func (m *mockConfigProvider) Invalidate(key string) {}
func (m *mockConfigProvider) InvalidateAll()        {}
