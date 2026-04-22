package services

import (
	"time"
	"w-gift-server/internal/domain"
	"w-gift-server/pkg/apperror"

	"gorm.io/gorm"
)

// PartnerBusinessInfoService는 파트너 사업자 정보 등록/조회/검증 기능을 처리합니다.
type PartnerBusinessInfoService struct {
	db *gorm.DB
}

// NewPartnerBusinessInfoService는 새로운 PartnerBusinessInfoService 인스턴스를 생성합니다.
func NewPartnerBusinessInfoService(db *gorm.DB) *PartnerBusinessInfoService {
	return &PartnerBusinessInfoService{db: db}
}

// UpdateBusinessInfoInput은 파트너 사업자 정보 등록/수정 시 사용하는 입력 타입입니다.
type UpdateBusinessInfoInput struct {
	// BusinessName은 상호(회사명)입니다.
	BusinessName string `json:"businessName" binding:"required"`
	// BusinessRegNo는 사업자등록번호입니다. (10자리, 하이픈 없이)
	BusinessRegNo string `json:"businessRegNo" binding:"required,len=10"`
	// RepresentativeName은 대표자명입니다.
	RepresentativeName string `json:"representativeName" binding:"required"`
	// TelecomSalesNo는 통신판매업신고번호입니다. (선택)
	TelecomSalesNo *string `json:"telecomSalesNo"`
	// BusinessAddress는 사업장 주소입니다. (선택)
	BusinessAddress *string `json:"businessAddress"`
	// BusinessType은 업태입니다. (선택)
	BusinessType *string `json:"businessType"`
	// BusinessCategory는 종목입니다. (선택)
	BusinessCategory *string `json:"businessCategory"`
}

// GetByPartnerID는 파트너 ID로 사업자 정보를 조회합니다.
// 등록된 정보가 없으면 nil을 반환합니다 (에러 아님).
func (s *PartnerBusinessInfoService) GetByPartnerID(partnerID int) (*domain.PartnerBusinessInfo, error) {
	var info domain.PartnerBusinessInfo
	err := s.db.Where("PartnerId = ?", partnerID).First(&info).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, apperror.Internal("사업자 정보 조회 중 오류가 발생했습니다", err)
	}
	return &info, nil
}

// Upsert는 파트너 사업자 정보를 등록하거나 수정합니다.
// 이미 등록된 정보가 있으면 수정하고, 없으면 새로 생성합니다.
// 변경 시 VerificationStatus는 PENDING으로 초기화됩니다.
func (s *PartnerBusinessInfoService) Upsert(partnerID int, input UpdateBusinessInfoInput) (*domain.PartnerBusinessInfo, error) {
	var info domain.PartnerBusinessInfo
	err := s.db.Where("PartnerId = ?", partnerID).First(&info).Error

	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, apperror.Internal("사업자 정보 조회 중 오류가 발생했습니다", err)
	}

	if err == gorm.ErrRecordNotFound {
		// 신규 생성
		info = domain.PartnerBusinessInfo{
			PartnerID:          partnerID,
			BusinessName:       input.BusinessName,
			BusinessRegNo:      input.BusinessRegNo,
			RepresentativeName: input.RepresentativeName,
			TelecomSalesNo:     input.TelecomSalesNo,
			BusinessAddress:    input.BusinessAddress,
			BusinessType:       input.BusinessType,
			BusinessCategory:   input.BusinessCategory,
			VerificationStatus: "PENDING",
		}
		if dbErr := s.db.Create(&info).Error; dbErr != nil {
			return nil, apperror.Internal("사업자 정보 등록 중 오류가 발생했습니다", dbErr)
		}
		return &info, nil
	}

	// 기존 정보 수정 — VerificationStatus를 PENDING으로 초기화
	updates := map[string]any{
		"BusinessName":       input.BusinessName,
		"BusinessRegNo":      input.BusinessRegNo,
		"RepresentativeName": input.RepresentativeName,
		"TelecomSalesNo":     input.TelecomSalesNo,
		"BusinessAddress":    input.BusinessAddress,
		"BusinessType":       input.BusinessType,
		"BusinessCategory":   input.BusinessCategory,
		"VerificationStatus": "PENDING",
		"VerifiedAt":         nil,
		"VerifiedBy":         nil,
	}
	if dbErr := s.db.Model(&info).Updates(updates).Error; dbErr != nil {
		return nil, apperror.Internal("사업자 정보 수정 중 오류가 발생했습니다", dbErr)
	}

	// 최신 상태 반환
	if dbErr := s.db.Where("PartnerId = ?", partnerID).First(&info).Error; dbErr != nil {
		return nil, apperror.Internal("사업자 정보 재조회 중 오류가 발생했습니다", dbErr)
	}
	return &info, nil
}

// AdminVerify는 관리자가 파트너 사업자 정보의 검증 상태를 설정합니다.
// status는 VERIFIED 또는 REJECTED 이어야 합니다.
func (s *PartnerBusinessInfoService) AdminVerify(id int, status string, adminID int, note string) error {
	if status != "VERIFIED" && status != "REJECTED" {
		return apperror.Validation("status는 VERIFIED 또는 REJECTED 이어야 합니다")
	}

	var info domain.PartnerBusinessInfo
	if err := s.db.First(&info, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return apperror.NotFound("사업자 정보를 찾을 수 없습니다")
		}
		return apperror.Internal("사업자 정보 조회 중 오류가 발생했습니다", err)
	}

	now := time.Now()
	updates := map[string]any{
		"VerificationStatus": status,
		"VerifiedBy":         adminID,
		"VerifiedAt":         now,
		"AdminNote":          note,
	}
	if status == "REJECTED" {
		updates["VerifiedAt"] = nil
	}

	if err := s.db.Model(&info).Updates(updates).Error; err != nil {
		return apperror.Internal("검증 상태 변경 중 오류가 발생했습니다", err)
	}
	return nil
}

// DeleteByPartnerID는 파트너가 자신의 사업자 정보를 삭제합니다.
func (s *PartnerBusinessInfoService) DeleteByPartnerID(partnerID int) error {
	result := s.db.Where("PartnerId = ?", partnerID).Delete(&domain.PartnerBusinessInfo{})
	if result.Error != nil {
		return apperror.Internal("사업자 정보 삭제 중 오류가 발생했습니다", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperror.NotFound("등록된 사업자 정보가 없습니다")
	}
	return nil
}

// AdminUpsert는 관리자가 특정 파트너의 사업자 정보를 대리 등록/수정합니다.
// 파트너 Upsert와 달리 VerificationStatus를 PENDING으로 초기화하지 않습니다.
func (s *PartnerBusinessInfoService) AdminUpsert(partnerID int, input UpdateBusinessInfoInput, adminEmail string) (*domain.PartnerBusinessInfo, error) {
	var info domain.PartnerBusinessInfo
	err := s.db.Where("PartnerId = ?", partnerID).First(&info).Error

	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, apperror.Internal("사업자 정보 조회 중 오류가 발생했습니다", err)
	}

	if err == gorm.ErrRecordNotFound {
		info = domain.PartnerBusinessInfo{
			PartnerID:          partnerID,
			BusinessName:       input.BusinessName,
			BusinessRegNo:      input.BusinessRegNo,
			RepresentativeName: input.RepresentativeName,
			TelecomSalesNo:     input.TelecomSalesNo,
			BusinessAddress:    input.BusinessAddress,
			BusinessType:       input.BusinessType,
			BusinessCategory:   input.BusinessCategory,
			VerificationStatus: "PENDING",
		}
		if dbErr := s.db.Create(&info).Error; dbErr != nil {
			return nil, apperror.Internal("사업자 정보 등록 중 오류가 발생했습니다", dbErr)
		}
		return &info, nil
	}

	updates := map[string]any{
		"BusinessName":       input.BusinessName,
		"BusinessRegNo":      input.BusinessRegNo,
		"RepresentativeName": input.RepresentativeName,
		"TelecomSalesNo":     input.TelecomSalesNo,
		"BusinessAddress":    input.BusinessAddress,
		"BusinessType":       input.BusinessType,
		"BusinessCategory":   input.BusinessCategory,
	}
	if dbErr := s.db.Model(&info).Updates(updates).Error; dbErr != nil {
		return nil, apperror.Internal("사업자 정보 수정 중 오류가 발생했습니다", dbErr)
	}
	s.db.Where("PartnerId = ?", partnerID).First(&info)
	return &info, nil
}

// AdminDelete는 관리자가 파트너 사업자 정보를 삭제합니다.
func (s *PartnerBusinessInfoService) AdminDelete(id int) error {
	result := s.db.Delete(&domain.PartnerBusinessInfo{}, id)
	if result.Error != nil {
		return apperror.Internal("사업자 정보 삭제 중 오류가 발생했습니다", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperror.NotFound("사업자 정보를 찾을 수 없습니다")
	}
	return nil
}

// AdminGetAll은 관리자용 파트너 사업자 정보 목록을 페이지네이션으로 조회합니다.
// status가 빈 문자열이면 전체를 조회합니다.
func (s *PartnerBusinessInfoService) AdminGetAll(page, limit int, status string) ([]domain.PartnerBusinessInfo, int64, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	offset := (page - 1) * limit

	query := s.db.Model(&domain.PartnerBusinessInfo{})
	if status != "" {
		query = query.Where("VerificationStatus = ?", status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, apperror.Internal("목록 조회 중 오류가 발생했습니다", err)
	}

	var items []domain.PartnerBusinessInfo
	err := query.
		Preload("Partner").
		Order("CreatedAt DESC").
		Offset(offset).Limit(limit).
		Find(&items).Error
	if err != nil {
		return nil, 0, apperror.Internal("목록 조회 중 오류가 발생했습니다", err)
	}
	return items, total, nil
}
