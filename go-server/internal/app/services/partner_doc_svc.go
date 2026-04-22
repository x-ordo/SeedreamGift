// Package services는 애플리케이션의 핵심 비즈니스 로직을 포함합니다.
// PartnerDocService는 관리자가 파트너에게 등록하는 문서(사업자등록증, 신분증 등)의
// 업로드, 조회, 다운로드, 삭제를 담당합니다.
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
	"w-gift-server/pkg/pagination"

	"gorm.io/gorm"
)

const (
	// maxPartnerDocSize는 업로드 허용 최대 파일 크기입니다 (10MB).
	maxPartnerDocSize = 10 * 1024 * 1024
)

// allowedPartnerDocExts는 업로드를 허용하는 파일 확장자 집합입니다.
var allowedPartnerDocExts = map[string]struct{}{
	".png":  {},
	".jpg":  {},
	".jpeg": {},
	".pdf":  {},
}

// PartnerDocService는 파트너 문서 관련 비즈니스 로직을 처리하는 서비스입니다.
type PartnerDocService struct {
	db             *gorm.DB
	uploadBasePath string
}

// NewPartnerDocService는 새로운 PartnerDocService 인스턴스를 생성합니다.
func NewPartnerDocService(db *gorm.DB, uploadBasePath string) *PartnerDocService {
	return &PartnerDocService{
		db:             db,
		uploadBasePath: uploadBasePath,
	}
}

// GetDocumentsByPartner는 특정 파트너의 문서 목록을 페이지네이션하여 반환합니다.
func (s *PartnerDocService) GetDocumentsByPartner(partnerID int, params pagination.QueryParams) (*pagination.PaginatedResponse[domain.PartnerDocument], error) {
	var docs []domain.PartnerDocument
	var total int64

	query := s.db.Model(&domain.PartnerDocument{}).Where("PartnerId = ?", partnerID)

	if err := query.Count(&total).Error; err != nil {
		return nil, apperror.Internal("문서 목록 조회 실패", err)
	}

	offset := (params.Page - 1) * params.Limit
	if err := query.Order("CreatedAt DESC").Offset(offset).Limit(params.Limit).Find(&docs).Error; err != nil {
		return nil, apperror.Internal("문서 목록 조회 실패", err)
	}

	result := pagination.CreatePaginatedResponse(docs, total, params.Page, params.Limit)
	return &result, nil
}

// UploadDocument는 파트너 문서 파일을 디스크에 저장하고 DB에 레코드를 생성합니다.
// 파일 확장자는 png/jpg/jpeg/pdf 만 허용되며 최대 크기는 10MB입니다.
func (s *PartnerDocService) UploadDocument(
	partnerID, adminID int,
	file multipart.File,
	header *multipart.FileHeader,
	category string,
	note *string,
) (*domain.PartnerDocument, error) {
	// 파일 크기 검증
	if header.Size > maxPartnerDocSize {
		return nil, apperror.Validation("파일 크기는 10MB를 초과할 수 없습니다")
	}

	// 파일 확장자 검증
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if _, ok := allowedPartnerDocExts[ext]; !ok {
		return nil, apperror.Validation("허용되지 않는 파일 형식입니다. png, jpg, jpeg, pdf 만 업로드 가능합니다")
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
	}
	if !validMimes[mimeType] {
		return nil, apperror.Validation("파일 내용이 허용된 형식(PNG, JPG, PDF)과 일치하지 않습니다")
	}

	// 카테고리 필수 검증
	if strings.TrimSpace(category) == "" {
		return nil, apperror.Validation("카테고리를 입력해주세요")
	}

	// 저장 디렉터리 생성
	dirPath := filepath.Join(s.uploadBasePath, "partner-docs", fmt.Sprintf("%d", partnerID))
	if err := os.MkdirAll(dirPath, 0755); err != nil {
		return nil, apperror.Internal("디렉터리 생성 실패", err)
	}

	// 파일명 생성: {timestamp}_{sanitizedOriginalName}
	sanitized := sanitizeFileName(header.Filename)
	storedName := fmt.Sprintf("%d_%s", time.Now().UnixMilli(), sanitized)
	destPath := filepath.Join(dirPath, storedName)

	// 경로 탈출 방지: 저장 경로가 기본 경로 내에 있는지 확인
	cleanBase := filepath.Clean(s.uploadBasePath)
	cleanDest := filepath.Clean(destPath)
	if !strings.HasPrefix(cleanDest, cleanBase) {
		return nil, apperror.Validation("유효하지 않은 파일 경로입니다")
	}

	// 파일 저장
	dst, err := os.Create(destPath)
	if err != nil {
		return nil, apperror.Internal("파일 저장 실패", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		// 부분 저장된 파일 정리
		_ = os.Remove(destPath)
		return nil, apperror.Internal("파일 쓰기 실패", err)
	}

	// DB 레코드 생성
	doc := &domain.PartnerDocument{
		PartnerID:  partnerID,
		FileName:   header.Filename,
		FileType:   ext,
		FilePath:   destPath,
		FileSize:   header.Size,
		Category:   category,
		UploadedBy: adminID,
		Note:       note,
	}
	if err := s.db.Create(doc).Error; err != nil {
		// DB 저장 실패 시 업로드된 파일 정리
		_ = os.Remove(destPath)
		return nil, apperror.Internal("문서 등록 실패", err)
	}

	return doc, nil
}

// GetDocumentFilePath는 문서 ID로 파일 경로와 원본 파일명을 반환합니다 (관리자용).
func (s *PartnerDocService) GetDocumentFilePath(id int) (filePath, fileName string, err error) {
	var doc domain.PartnerDocument
	if err := s.db.First(&doc, id).Error; err != nil {
		return "", "", apperror.NotFound("문서를 찾을 수 없습니다")
	}
	return doc.FilePath, doc.FileName, nil
}

// GetDocumentForPartner는 문서 소유권을 확인한 후 파일 경로와 원본 파일명을 반환합니다 (파트너용).
func (s *PartnerDocService) GetDocumentForPartner(id, partnerID int) (filePath, fileName string, err error) {
	var doc domain.PartnerDocument
	if err := s.db.Where("Id = ? AND PartnerId = ?", id, partnerID).First(&doc).Error; err != nil {
		return "", "", apperror.NotFound("문서를 찾을 수 없습니다")
	}
	return doc.FilePath, doc.FileName, nil
}

// DeleteDocument는 디스크에서 파일을 삭제하고 DB 레코드도 제거합니다.
func (s *PartnerDocService) DeleteDocument(id int) error {
	var doc domain.PartnerDocument
	if err := s.db.First(&doc, id).Error; err != nil {
		return apperror.NotFound("문서를 찾을 수 없습니다")
	}

	// 디스크 파일 삭제 (파일이 없어도 DB 삭제는 진행)
	_ = os.Remove(doc.FilePath)

	if err := s.db.Delete(&doc).Error; err != nil {
		return apperror.Internal("문서 삭제 실패", err)
	}
	return nil
}

// sanitizeFileName은 파일명에서 경로 구분자와 위험 문자를 제거합니다.
func sanitizeFileName(name string) string {
	// 경로 구성 요소만 추출 (디렉터리 트래버설 방지)
	name = filepath.Base(name)
	// 공백을 언더스코어로 치환하여 OS 호환성 확보
	name = strings.ReplaceAll(name, " ", "_")
	return name
}
