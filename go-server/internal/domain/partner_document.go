package domain

import "time"

// PartnerDocument는 관리자가 파트너 계정에 등록한 문서(사업자등록증, 신분증 등)입니다.
type PartnerDocument struct {
	ID         int       `gorm:"primaryKey;column:Id" json:"id"`
	PartnerID  int       `gorm:"index;column:PartnerId;not null" json:"partnerId"`
	Partner    *User     `gorm:"foreignKey:PartnerID" json:"partner,omitempty"`
	FileName   string    `gorm:"column:FileName;size:200;not null" json:"fileName"`
	FileType   string    `gorm:"column:FileType;size:10;not null" json:"fileType"`
	FilePath   string    `gorm:"column:FilePath;size:500;not null" json:"-"`
	FileSize   int64     `gorm:"column:FileSize;not null" json:"fileSize"`
	Category   string    `gorm:"column:Category;size:50;not null" json:"category"`
	UploadedBy int       `gorm:"column:UploadedBy;not null" json:"uploadedBy"`
	Note       *string   `gorm:"column:Note;size:500" json:"note"`
	CreatedAt  time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
}

func (PartnerDocument) TableName() string { return "PartnerDocuments" }
