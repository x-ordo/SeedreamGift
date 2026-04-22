package domain

import "time"

// PartnerBusinessInfo는 파트너의 사업자 정보를 저장합니다.
// User 테이블과 1:1 관계 (PartnerId = Users.Id).
type PartnerBusinessInfo struct {
	ID int `gorm:"primaryKey;column:Id" json:"id"`
	// PartnerID는 파트너 사용자의 ID입니다.
	PartnerID int `gorm:"uniqueIndex:UQ_PartnerBusinessInfo_PartnerId;column:PartnerId" json:"partnerId"`
	// Partner는 파트너 사용자 정보입니다.
	Partner User `gorm:"foreignKey:PartnerID" json:"-"`
	// BusinessName은 상호(회사명)입니다.
	BusinessName string `gorm:"column:BusinessName;size:100" json:"businessName"`
	// BusinessRegNo는 사업자등록번호입니다. (10자리, 하이픈 없이)
	BusinessRegNo string `gorm:"column:BusinessRegNo;size:10" json:"businessRegNo"`
	// RepresentativeName은 대표자명입니다.
	RepresentativeName string `gorm:"column:RepresentativeName;size:30" json:"representativeName"`
	// TelecomSalesNo는 통신판매업신고번호입니다. (예: 2024-서울강남-01234)
	TelecomSalesNo *string `gorm:"column:TelecomSalesNo;size:30" json:"telecomSalesNo"`
	// BusinessAddress는 사업장 주소입니다.
	BusinessAddress *string `gorm:"column:BusinessAddress;size:200" json:"businessAddress"`
	// BusinessType은 업태입니다. (예: 도소매)
	BusinessType *string `gorm:"column:BusinessType;size:50" json:"businessType"`
	// BusinessCategory는 종목입니다. (예: 상품권)
	BusinessCategory *string `gorm:"column:BusinessCategory;size:50" json:"businessCategory"`
	// VerificationStatus는 사업자등록 검증 상태입니다. (PENDING, VERIFIED, REJECTED)
	VerificationStatus string `gorm:"column:VerificationStatus;size:10;default:'PENDING'" json:"verificationStatus"`
	// VerifiedAt은 검증 완료 일시입니다.
	VerifiedAt *time.Time `gorm:"column:VerifiedAt" json:"verifiedAt,omitempty"`
	// VerifiedBy는 검증한 관리자 ID입니다.
	VerifiedBy *int `gorm:"column:VerifiedBy" json:"verifiedBy,omitempty"`
	// AdminNote는 관리자 메모입니다.
	AdminNote *string `gorm:"column:AdminNote;size:500" json:"adminNote,omitempty"`
	CreatedAt time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"column:UpdatedAt;autoUpdateTime" json:"updatedAt"`
}

func (PartnerBusinessInfo) TableName() string { return "PartnerBusinessInfos" }
