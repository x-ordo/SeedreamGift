package handlers

import (
	"strconv"
	"time"
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/internal/domain"
	"seedream-gift-server/pkg/pagination"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// AdminUpdateUserRequest는 관리자가 회원 정보를 수정할 때 허용된 필드만 바인딩합니다.
// Role, Password, MFA 등 민감한 필드는 의도적으로 포함하지 않습니다.
type AdminUpdateUserRequest struct {
	Name              *string `json:"name"`
	Email             *string `json:"email"`
	Phone             *string `json:"phone"`
	ZipCode           *string `json:"zipCode"`
	Address           *string `json:"address"`
	AddressDetail     *string `json:"addressDetail"`
	EmailNotification *bool   `json:"emailNotification"`
	PushNotification  *bool   `json:"pushNotification"`
}

// AdminUserHandler는 관리자의 회원 관리 HTTP 핸들러입니다.
type AdminUserHandler struct {
	service *services.AdminUserService
}

func NewAdminUserHandler(service *services.AdminUserService) *AdminUserHandler {
	return &AdminUserHandler{service: service}
}

// GetUsers godoc
// @Summary 회원 목록 조회
// @Tags Admin - Users
// @Security BearerAuth
// @Param page query int false "페이지 번호" default(1)
// @Param limit query int false "페이지 크기" default(20)
// @Param kycStatus query string false "KYC 상태 필터"
// @Param role query string false "역할 필터"
// @Param search query string false "이름/이메일/전화번호 검색"
// @Success 200 {object} APIResponse
// @Router /admin/users [get]
func (h *AdminUserHandler) GetUsers(c *gin.Context) {
	var params pagination.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.BadRequest(c, "잘못된 조회 요청입니다")
		return
	}
	kycStatus := c.Query("kycStatus")
	role := c.Query("role")
	search := c.Query("search")

	users, err := h.service.GetUsers(params, kycStatus, role, search)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, users)
}

// GetUserDetail godoc
// @Summary 회원 상세 조회
// @Tags Admin - Users
// @Security BearerAuth
// @Param id path int true "회원 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id} [get]
func (h *AdminUserHandler) GetUserDetail(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	user, err := h.service.GetUserDetail(id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, user)
}

// UpdateUser godoc
// @Summary 회원 정보 수정
// @Tags Admin - Users
// @Security BearerAuth
// @Param id path int true "회원 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id} [patch]
func (h *AdminUserHandler) UpdateUser(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	// Role, Password, MFA 등 민감 필드 덮어쓰기를 방지하기 위해
	// 허용된 필드만 포함된 전용 요청 구조체를 사용합니다.
	var req AdminUpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	// 비어있지 않은 필드만 업데이트 맵에 포함합니다.
	updates := make(map[string]any)
	if req.Name != nil {
		updates["Name"] = *req.Name
	}
	if req.Email != nil {
		updates["Email"] = *req.Email
	}
	if req.Phone != nil {
		updates["Phone"] = *req.Phone
	}
	if req.ZipCode != nil {
		updates["ZipCode"] = *req.ZipCode
	}
	if req.Address != nil {
		updates["Address"] = *req.Address
	}
	if req.AddressDetail != nil {
		updates["AddressDetail"] = *req.AddressDetail
	}
	if req.EmailNotification != nil {
		updates["EmailNotification"] = *req.EmailNotification
	}
	if req.PushNotification != nil {
		updates["PushNotification"] = *req.PushNotification
	}
	if err := h.service.UpdateUser(id, updates); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "회원 정보가 수정되었습니다"})
}

// UpdateUserRole godoc
// @Summary 회원 역할 변경
// @Tags Admin - Users
// @Security BearerAuth
// @Param id path int true "회원 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id}/role [patch]
func (h *AdminUserHandler) UpdateUserRole(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var body struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := domain.ValidateRole(body.Role); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	// 자기 자신 강등 방지
	adminID := c.GetInt("userId")
	if adminID == id && body.Role != "ADMIN" {
		response.BadRequest(c, "자기 자신의 관리자 권한을 해제할 수 없습니다")
		return
	}
	if err := h.service.UpdateUserRole(id, body.Role, adminID); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "회원 권한이 변경되었습니다"})
}

// DeleteUser godoc
// @Summary 회원 삭제
// @Tags Admin - Users
// @Security BearerAuth
// @Param id path int true "회원 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id} [delete]
func (h *AdminUserHandler) DeleteUser(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	// 자기 자신의 계정 삭제를 방지합니다.
	adminID := c.GetInt("userId")
	if adminID == id {
		response.BadRequest(c, "자신의 계정은 삭제할 수 없습니다")
		return
	}
	if err := h.service.DeleteUser(id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "회원이 삭제되었습니다"})
}

// CreateUser godoc
// @Summary 회원 생성
// @Tags Admin - Users
// @Security BearerAuth
// @Success 201 {object} APIResponse
// @Router /admin/users [post]
func (h *AdminUserHandler) CreateUser(c *gin.Context) {
	var user domain.User
	if err := c.ShouldBindJSON(&user); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.CreateUser(&user); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Created(c, user)
}

// ResetPassword godoc
// @Summary 회원 비밀번호 초기화
// @Tags Admin - Users
// @Security BearerAuth
// @Param id path int true "회원 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id}/password [patch]
func (h *AdminUserHandler) ResetPassword(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var body struct {
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	// 도메인 비밀번호 검증(길이 + 숫자 포함)을 적용하여 강도를 일관되게 유지합니다.
	if err := domain.ValidatePassword(body.Password); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.ResetUserPassword(id, body.Password); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "비밀번호가 초기화되었습니다"})
}

// LockUser godoc
// @Summary 사용자 계정 잠금
// @Tags Admin - Users
// @Security BearerAuth
// @Param id path int true "회원 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id}/lock [patch]
func (h *AdminUserHandler) LockUser(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	// 자기 자신의 계정 잠금을 방지합니다.
	adminID := c.GetInt("userId")
	if adminID == id {
		response.BadRequest(c, "자신의 계정은 잠글 수 없습니다")
		return
	}
	var body struct {
		Until  time.Time `json:"until" binding:"required"`
		Reason string    `json:"reason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	// 잠금 해제 시간은 현재 시간 이후여야 합니다.
	if body.Until.Before(time.Now()) {
		response.BadRequest(c, "잠금 해제 시간은 현재 시간 이후여야 합니다")
		return
	}
	if err := h.service.LockUser(id, body.Until, body.Reason); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "계정이 잠금 처리되었습니다"})
}

// UnlockUser godoc
// @Summary 사용자 계정 잠금 해제
// @Tags Admin - Users
// @Security BearerAuth
// @Param id path int true "회원 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id}/unlock [patch]
func (h *AdminUserHandler) UnlockUser(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.service.UnlockUser(id); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "계정 잠금이 해제되었습니다"})
}

// UpdatePartnerTier godoc
// @Summary 파트너 등급 변경
// @Tags Admin - Users
// @Security BearerAuth
// @Param id path int true "회원 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id}/partner-tier [patch]
func (h *AdminUserHandler) UpdatePartnerTier(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var body struct {
		Tier string `json:"tier"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.UpdatePartnerTier(id, body.Tier); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "파트너 등급이 변경되었습니다"})
}

// GetUserSummary godoc
// @Summary 사용자 거래 요약 조회
// @Tags Admin - Users
// @Security BearerAuth
// @Param id path int true "회원 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id}/summary [get]
func (h *AdminUserHandler) GetUserSummary(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	summary, err := h.service.GetUserSummary(id)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, summary)
}

// SetCommissionRate godoc
// @Summary 파트너 수수료율 설정
// @Tags Admin - Users
// @Security BearerAuth
// @Param id path int true "회원 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id}/commission [patch]
func (h *AdminUserHandler) SetCommissionRate(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var body struct {
		CommissionRate *float64 `json:"commissionRate"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.SetCommissionRate(id, body.CommissionRate); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "수수료율이 변경되었습니다"})
}

// SetPayoutFrequency godoc
// @Summary 파트너 정산 주기 설정
// @Tags Admin - Users
// @Security BearerAuth
// @Param id path int true "회원 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id}/payout-frequency [patch]
func (h *AdminUserHandler) SetPayoutFrequency(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var body struct {
		PayoutFrequency *string `json:"payoutFrequency"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.SetPayoutFrequency(id, body.PayoutFrequency); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "정산 주기가 변경되었습니다"})
}

// SetPartnerLimits godoc
// @Summary 파트너 제한 설정 (일일 PIN 한도)
// @Tags Admin - Users
// @Security BearerAuth
// @Param id path int true "회원 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id}/partner-limits [patch]
func (h *AdminUserHandler) SetPartnerLimits(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var body struct {
		DailyPinLimit *int `json:"dailyPinLimit"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.SetPartnerLimits(id, body.DailyPinLimit); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "파트너 제한이 설정되었습니다"})
}

// GetUserWebAuthn godoc
// @Summary 사용자 WebAuthn 자격 증명 조회
// @Tags Admin - Users
// @Security BearerAuth
// @Param id path int true "회원 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id}/webauthn [get]
func (h *AdminUserHandler) GetUserWebAuthn(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 사용자 ID입니다")
		return
	}
	creds, err := h.service.GetUserWebAuthnCredentials(userID)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, creds)
}

// ResetUserWebAuthn godoc
// @Summary 사용자 패스키 전체 초기화
// @Tags Admin - Users
// @Security BearerAuth
// @Param id path int true "회원 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id}/webauthn [delete]
func (h *AdminUserHandler) ResetUserWebAuthn(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 사용자 ID입니다")
		return
	}
	if err := h.service.ResetUserWebAuthn(userID); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "사용자의 모든 패스키가 초기화되었습니다"})
}

// UpdateKycStatus godoc
// @Summary 회원 KYC 상태 변경
// @Tags Admin - Users
// @Security BearerAuth
// @Param id path int true "회원 ID"
// @Success 200 {object} APIResponse
// @Router /admin/users/{id}/kyc [patch]
func (h *AdminUserHandler) UpdateKycStatus(c *gin.Context) {
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	adminID := c.GetInt("userId")
	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := domain.ValidateKycStatus(body.Status); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.service.UpdateUserKycStatus(id, body.Status, adminID); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "KYC 상태가 변경되었습니다"})
}
