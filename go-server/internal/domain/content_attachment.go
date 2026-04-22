package domain

import "time"

// ContentAttachment는 공지사항, 이벤트, 문의 등 콘텐츠에 첨부된 파일입니다.
// TargetType + TargetID의 다형적 관계로 여러 콘텐츠 유형에 첨부할 수 있습니다.
type ContentAttachment struct {
	ID         int       `gorm:"primaryKey;column:Id" json:"id"`
	TargetType string    `gorm:"column:TargetType;size:20;not null;index:idx_attachment_target" json:"targetType"` // NOTICE, EVENT, INQUIRY
	TargetID   int       `gorm:"column:TargetId;not null;index:idx_attachment_target" json:"targetId"`
	FileName   string    `gorm:"column:FileName;size:200;not null" json:"fileName"`
	FileType   string    `gorm:"column:FileType;size:10;not null" json:"fileType"` // PNG, JPG, JPEG, PDF, XLSX, DOCX
	FilePath   string    `gorm:"column:FilePath;size:500;not null" json:"-"`
	FileSize   int64     `gorm:"column:FileSize;not null" json:"fileSize"`
	SortOrder  int       `gorm:"column:SortOrder;default:0" json:"sortOrder"`
	UploadedBy int       `gorm:"column:UploadedBy;not null" json:"uploadedBy"`
	CreatedAt  time.Time `gorm:"column:CreatedAt;autoCreateTime" json:"createdAt"`
}

func (ContentAttachment) TableName() string { return "ContentAttachments" }

// 허용 파일 확장자
var AllowedContentAttachmentTypes = map[string]bool{
	".png":  true,
	".jpg":  true,
	".jpeg": true,
	".pdf":  true,
	".xlsx": true,
	".docx": true,
}

// 이미지 확장자 (인라인 렌더링 대상)
var ImageFileTypes = map[string]bool{
	".png":  true,
	".jpg":  true,
	".jpeg": true,
}
