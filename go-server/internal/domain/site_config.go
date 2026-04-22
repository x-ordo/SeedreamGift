package domain

import "time"

// SiteConfig는 시스템 전역 설정을 나타냅니다.
type SiteConfig struct {
	ID          int       `gorm:"primaryKey;column:Id" json:"id"`
	Key         string    `gorm:"unique;column:Key;size:30" json:"key"`
	Value       string    `gorm:"column:Value;type:nvarchar(max)" json:"value"`
	Type        string    `gorm:"column:Type;size:10" json:"type"`
	Description *string   `gorm:"column:Description;size:100" json:"description"`
	UpdatedAt   time.Time `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`
}

func (SiteConfig) TableName() string { return "SiteConfigs" }

// AuditLog은 시스템에서 발생한 주요 작업에 대한 감사 로그를 나타냅니다.
type AuditLog struct {
	ID         int       `gorm:"primaryKey;column:Id" json:"id"`
	CreatedAt  time.Time `gorm:"index;column:CreatedAt;autoCreateTime" json:"createdAt"`
	UserID     *int      `gorm:"index;column:UserId" json:"userId"`
	User       *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Action     string    `gorm:"index;column:Action;size:50" json:"action"`
	Resource   string    `gorm:"index;column:Resource;size:30" json:"resource"`
	ResourceID *string   `gorm:"index;column:ResourceId;size:20" json:"resourceId"`
	Method     *string   `gorm:"column:Method;size:7" json:"method"`
	StatusCode *int      `gorm:"column:StatusCode" json:"statusCode"`
	OldValue   *string   `gorm:"column:OldValue;type:nvarchar(max)" json:"oldValue"`
	NewValue   *string   `gorm:"column:NewValue;type:nvarchar(max)" json:"newValue"`
	IP         *string   `gorm:"column:Ip;size:45" json:"ip"`
	UserAgent  *string   `gorm:"column:UserAgent;size:256" json:"userAgent"`
	IsArchived bool      `gorm:"index;column:IsArchived;default:false" json:"isArchived"`
}

func (AuditLog) TableName() string { return "AuditLogs" }

// PatternRule은 비정상 패턴 탐지 규칙을 나타냅니다.
type PatternRule struct {
	ID                   int       `gorm:"primaryKey;column:Id" json:"id"`
	RuleID               string    `gorm:"uniqueIndex;column:RuleId;size:50" json:"ruleId"`
	Name                 string    `gorm:"column:Name;size:50" json:"name"`
	Description          string    `gorm:"column:Description;size:200" json:"description"`
	Category             string    `gorm:"column:Category;size:20" json:"category"` // SECURITY, PATTERN, RATE_LIMIT
	Enabled              bool      `gorm:"column:Enabled;default:true" json:"enabled"`
	BlockDurationMinutes int       `gorm:"column:BlockDurationMinutes;default:15" json:"blockDurationMinutes"`
	MaxAttempts          int       `gorm:"column:MaxAttempts;default:10" json:"maxAttempts"`
	WindowMinutes        int       `gorm:"column:WindowMinutes;default:1" json:"windowMinutes"`
	CreatedAt            time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
	UpdatedAt            time.Time `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`
}

func (PatternRule) TableName() string { return "PatternRules" }
