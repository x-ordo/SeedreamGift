package domain

import "time"

// KycVerifySession은 1원 계좌 인증을 위한 세션 정보를 저장합니다.
// 사용자가 본인 확인을 위해 계좌 번호를 입력하면 생성되며, 짧은 만료 시간을 가집니다.
type KycVerifySession struct {
	ID            int       `gorm:"primaryKey;column:Id" json:"id"`
	VerifyTrNo    string    `gorm:"unique;column:VerifyTrNo;size:30" json:"verifyTrNo"` // 인증 거래 번호 (금융사 제공)
	VerifyTrDt    string    `gorm:"column:VerifyTrDt;size:10" json:"verifyTrDt"`        // 인증 거래 일자
	BankCode      string    `gorm:"column:BankCode;size:4" json:"bankCode"`             // 은행 코드
	BankName      string    `gorm:"column:BankName;size:15" json:"bankName"`            // 은행 이름
	AccountNumber string    `gorm:"column:AccountNumber;size:200" json:"-"` // 암호화된 계좌번호 (API 응답에서 제외)
	AccountHolder string    `gorm:"column:AccountHolder;size:10" json:"accountHolder"`  // 예금주 성명
	IsVerified    bool      `gorm:"column:IsVerified;default:false" json:"isVerified"`  // 인증 성공 여부
	ExpiresAt     time.Time `gorm:"index;column:ExpiresAt" json:"expiresAt"`            // 세션 만료 시간
	CreatedAt     time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`   // 세션 생성 시간
}

// TableName은 GORM에서 사용할 테이블 이름을 반환합니다.
func (KycVerifySession) TableName() string { return "KycVerifySessions" }

// SmsVerification은 휴대폰 본인 확인(KCB 등) 기록을 나타냅니다.
// 방송통신위원회 가이드라인에 따른 본인 확인 절차의 이력을 관리합니다.
type SmsVerification struct {
	UniqueID    int64      `gorm:"primaryKey;column:_UNIQUEID;autoIncrement" json:"uniqueId"`
	AffiliateID *string    `gorm:"column:_AFFILIATE_ID;size:20;default:''" json:"affiliateId"` // 제휴사 ID
	DateTime    *time.Time `gorm:"column:_DATETIME;default:CURRENT_TIMESTAMP" json:"datetime"` // 인증 일시
	BankCode    *string    `gorm:"column:_BANKCODE;size:5;default:''" json:"bankCode"`         // 은행 코드 (필요 시)
	BankNumber  *string    `gorm:"column:_BANKNUMBER;size:17;default:''" json:"bankNumber"`    // 계좌 번호 (필요 시)
	BankUser    *string    `gorm:"column:_BANKUSER;size:20;default:''" json:"bankUser"`        // 사용자명
	Birth       *string    `gorm:"column:_BIRTH;size:9;default:''" json:"birth"`               // 생년월일 (YYYYMMDD)
	Gender      *string    `gorm:"column:_GENDER;size:2;default:''" json:"gender"`             // 성별 (M/F)
	Nationality *string    `gorm:"column:_NATIONALITY;size:2;default:''" json:"nationality"`   // 내국인(L)/외국인(F) 구분
	Telco       *string    `gorm:"column:_TELCO;size:3;default:''" json:"telco"`               // 통신사 (SKT, KT, LGU 등)
	Phone       *string    `gorm:"index;column:_PHONE;size:12;default:''" json:"phone"`        // 휴대폰 번호
	CI          *string    `gorm:"index;column:_CI;size:150;default:''" json:"ci"`             // 연계정보(CI): 개인 식별 고유값
}

// TableName은 GORM에서 사용할 테이블 이름을 반환합니다.
func (SmsVerification) TableName() string { return "SMS_VERIFICATION" }
