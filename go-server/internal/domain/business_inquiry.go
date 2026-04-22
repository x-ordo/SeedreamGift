package domain

import "time"

// BusinessInquiry는 파트너 제휴/입점 등 비즈니스 문의 정보입니다.
// 비로그인 공개 폼으로 접수되며, 관리자가 확인 후 응대합니다.
type BusinessInquiry struct {
	ID              int       `gorm:"primaryKey;column:Id" json:"id"`
	CompanyName      string    `gorm:"column:CompanyName;size:100;not null" json:"companyName"`
	BusinessRegNo    string    `gorm:"column:BusinessRegNo;size:10;not null" json:"businessRegNo"`     // 사업자등록번호 (숫자 10자리, 하이픈 없음)
	BusinessOpenDate string    `gorm:"column:BusinessOpenDate;size:8;not null" json:"businessOpenDate"` // 개업일자 (YYYYMMDD, 하이픈 없음)
	RepName          string    `gorm:"column:RepName;size:50;not null" json:"repName"`                  // 대표자성명 (외국인은 영문명)
	ContactName      string    `gorm:"column:ContactName;size:50;not null" json:"contactName"`
	Email           string    `gorm:"column:Email;size:100;not null" json:"email"`
	Phone           string    `gorm:"column:Phone;size:20;not null" json:"phone"`
	Category        string    `gorm:"column:Category;size:30;not null" json:"category"`
	Message         string    `gorm:"column:Message;type:nvarchar(200);not null" json:"message"`
	Status          string    `gorm:"column:Status;default:'NEW';size:10;not null" json:"status"`
	IPAddress       string    `gorm:"column:IpAddress;size:45;not null" json:"ipAddress"` // 제출자 IP (보안/감사 추적)
	CreatedAt       time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
}

// TableName은 GORM에서 사용할 테이블 이름을 반환합니다.
func (BusinessInquiry) TableName() string { return "BusinessInquiries" }
