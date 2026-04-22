package services

import (
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"w-gift-server/internal/domain"
	"w-gift-server/pkg/apperror"

	"gorm.io/gorm"
)

const maxAttachmentSize = 10 * 1024 * 1024 // 10MB

// ContentAttachmentService는 공지사항/이벤트/문의에 첨부된 파일의 업로드, 조회, 삭제를 처리합니다.
type ContentAttachmentService struct {
	db             *gorm.DB
	uploadBasePath string
}

func NewContentAttachmentService(db *gorm.DB, uploadBasePath string) *ContentAttachmentService {
	return &ContentAttachmentService{db: db, uploadBasePath: uploadBasePath}
}

// GetAttachments는 특정 콘텐츠의 첨부 파일 목록을 반환합니다.
func (s *ContentAttachmentService) GetAttachments(targetType string, targetID int) ([]domain.ContentAttachment, error) {
	var items []domain.ContentAttachment
	err := s.db.Where("TargetType = ? AND TargetId = ?", targetType, targetID).
		Order("SortOrder ASC, CreatedAt ASC").Find(&items).Error
	return items, err
}

// Upload는 파일을 디스크에 저장하고 DB 레코드를 생성합니다.
func (s *ContentAttachmentService) Upload(targetType string, targetID, adminID int, file multipart.File, header *multipart.FileHeader) (*domain.ContentAttachment, error) {
	if header.Size > maxAttachmentSize {
		return nil, apperror.Validation("파일 크기는 10MB 이내여야 합니다")
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !domain.AllowedContentAttachmentTypes[ext] {
		return nil, apperror.Validation("허용되지 않는 파일 형식입니다 (PNG, JPG, PDF, XLSX, DOCX만 가능)")
	}

	// 파일 시그니처(magic bytes) 검증으로 확장자 위조 방지
	magicHeader := make([]byte, 512)
	n, _ := file.Read(magicHeader)
	magicHeader = magicHeader[:n]
	if _, err := file.Seek(0, 0); err != nil {
		return nil, apperror.Internal("파일 읽기 초기화 실패", err)
	}
	mimeType := http.DetectContentType(magicHeader)
	validMimes := map[string]bool{
		"image/png":       true,
		"image/jpeg":      true,
		"application/pdf": true,
		// xlsx와 docx는 ZIP 기반 포맷이므로 application/zip으로 감지됨
		"application/zip": true,
	}
	if !validMimes[mimeType] {
		return nil, apperror.Validation("파일 내용이 허용된 형식과 일치하지 않습니다")
	}

	// 저장 디렉토리 생성
	dir := filepath.Join(s.uploadBasePath, "content-attachments", targetType, fmt.Sprintf("%d", targetID))
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, apperror.Internal("업로드 디렉토리 생성 실패", err)
	}

	// 파일명 생성: {timestamp}_{sanitized}
	sanitized := strings.ReplaceAll(filepath.Base(header.Filename), " ", "_")
	diskName := fmt.Sprintf("%d_%s", time.Now().UnixMilli(), sanitized)
	fullPath := filepath.Join(dir, diskName)

	// 경로 탐색 방지
	cleanPath := filepath.Clean(fullPath)
	cleanBase := filepath.Clean(s.uploadBasePath)
	if !strings.HasPrefix(cleanPath, cleanBase) {
		return nil, apperror.Validation("잘못된 파일 경로입니다")
	}

	// 디스크에 저장
	dst, err := os.Create(fullPath)
	if err != nil {
		return nil, apperror.Internal("파일 생성 실패", err)
	}
	defer dst.Close()
	if _, err := io.Copy(dst, file); err != nil {
		os.Remove(fullPath)
		return nil, apperror.Internal("파일 저장 실패", err)
	}

	attachment := &domain.ContentAttachment{
		TargetType: targetType,
		TargetID:   targetID,
		FileName:   header.Filename,
		FileType:   strings.TrimPrefix(ext, "."),
		FilePath:   fullPath,
		FileSize:   header.Size,
		UploadedBy: adminID,
	}
	if err := s.db.Create(attachment).Error; err != nil {
		os.Remove(fullPath)
		return nil, apperror.Internal("첨부 파일 등록 실패", err)
	}
	return attachment, nil
}

// GetFilePath는 다운로드/조회를 위해 파일 경로와 이름을 반환합니다.
func (s *ContentAttachmentService) GetFilePath(id int) (filePath, fileName, fileType string, err error) {
	var att domain.ContentAttachment
	if err := s.db.First(&att, id).Error; err != nil {
		return "", "", "", apperror.NotFound("첨부 파일을 찾을 수 없습니다")
	}
	return att.FilePath, att.FileName, att.FileType, nil
}

// Delete는 첨부 파일을 디스크와 DB에서 삭제합니다.
func (s *ContentAttachmentService) Delete(id int) error {
	var att domain.ContentAttachment
	if err := s.db.First(&att, id).Error; err != nil {
		return apperror.NotFound("첨부 파일을 찾을 수 없습니다")
	}
	os.Remove(att.FilePath)
	return s.db.Delete(&att).Error
}
