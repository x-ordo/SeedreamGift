/*
Package handlers는 KYC(Know Your Customer) 인증 처리를 위한 HTTP 요청/응답 핸들링 로직을 제공합니다.
본인 확인, 계좌 인증 및 관련 정보 수정을 담당합니다.
*/
package handlers

import (
	"w-gift-server/internal/app/services"
	"w-gift-server/pkg/logger"
	"w-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// KycHandler는 KYC 관련 HTTP 요청을 처리하는 핸들러입니다.
type KycHandler struct {
	service *services.KycService
}

// NewKycHandler는 새로운 KycHandler 인스턴스를 생성합니다.
func NewKycHandler(service *services.KycService) *KycHandler {
	return &KycHandler{service: service}
}

// RequestBankVerify godoc
// @Summary 1원 인증 요청
// @Tags KYC
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body services.BankVerifyRequest true "은행 계좌 정보"
// @Success 201 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /kyc/bank-verify/request [post]
// RequestBankVerify는 계좌 소유주 확인을 위해 1원 송금을 요청합니다.
func (h *KycHandler) RequestBankVerify(c *gin.Context) {
	var req services.BankVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	session, err := h.service.RequestBankVerify(req)
	if err != nil {
		logger.Log.Error("request bank verify failed", zap.Error(err), zap.String("handler", "RequestBankVerify"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}

	response.Created(c, gin.H{
		"verifyTrDt": session.VerifyTrDt,
		"verifyTrNo": session.VerifyTrNo,
	})
}

// ConfirmBankVerify godoc
// @Summary 1원 인증 확인
// @Tags KYC
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body services.BankVerifyConfirmRequest true "인증 확인 정보"
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Router /kyc/bank-verify/confirm [post]
// ConfirmBankVerify는 송금된 1원의 적요 정보를 확인하여 계좌 인증을 완료합니다.
func (h *KycHandler) ConfirmBankVerify(c *gin.Context) {
	// userId is optional — 0 means registration flow (not logged in)
	userId := c.GetInt("userId")
	var req services.BankVerifyConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	result, err := h.service.ConfirmBankVerify(userId, req)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, gin.H{
		"success":       true,
		"bankName":      result.BankName,
		"bankCode":      result.BankCode,
		"accountNumber": result.AccountNumber,
		"accountHolder": result.AccountHolder,
	})
}

// GetBankAccount godoc
// @Summary 등록된 계좌 조회
// @Tags KYC
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse
// @Failure 500 {object} APIResponse
// @Router /kyc/bank-account [get]
// GetBankAccount는 현재 사용자의 등록된 은행 계좌 정보를 조회합니다.
func (h *KycHandler) GetBankAccount(c *gin.Context) {
	userId := c.GetInt("userId")
	account, err := h.service.GetBankAccount(userId)
	if err != nil {
		logger.Log.Error("get bank account failed", zap.Error(err), zap.String("handler", "GetBankAccount"))
		response.InternalServerError(c, "서버 오류가 발생했습니다")
		return
	}
	response.Success(c, account)
}

// VerifySms godoc
// @Summary SMS 본인인증 처리
// @Tags KYC
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body object true "휴대폰 번호" SchemaExample({"phone":"01012345678"})
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Router /kyc/verify-sms [post]
// VerifySms는 SMS를 통한 본인인증 결과를 처리합니다.
func (h *KycHandler) VerifySms(c *gin.Context) {
	userId := c.GetInt("userId")
	var body struct {
		Phone string `json:"phone" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "phone is required")
		return
	}
	if err := h.service.UpdateUserKycFromSms(userId, body.Phone); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "본인인증이 완료되었습니다"})
}

// ChangePhone godoc
// @Summary 전화번호 변경 (KCB 본인인증 필수)
// @Tags KYC
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body object true "새 전화번호" SchemaExample({"phone":"01012345678"})
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Router /kyc/change-phone [post]
// ChangePhone은 KCB 본인인증 완료 후 전화번호를 변경합니다.
func (h *KycHandler) ChangePhone(c *gin.Context) {
	userID := c.GetInt("userId")
	var body struct {
		Phone string `json:"phone" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "phone is required")
		return
	}
	if err := h.service.ChangePhone(userID, body.Phone); err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, gin.H{"message": "전화번호가 변경되었습니다", "phone": body.Phone})
}

// ChangeBankAccount godoc
// @Summary 계좌 변경
// @Tags KYC
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body object true "인증 거래번호 및 인증어" SchemaExample({"verifyTrNo":"string","verifyWord":"string"})
// @Success 200 {object} APIResponse
// @Failure 400 {object} APIResponse
// @Router /kyc/bank-account [post]
// ChangeBankAccount는 기존 인증 세션을 기반으로 사용자의 은행 계좌 정보를 변경합니다.
func (h *KycHandler) ChangeBankAccount(c *gin.Context) {
	var req struct {
		VerifyTrNo string `json:"verifyTrNo" binding:"required"`
		VerifyWord string `json:"verifyWord" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "verifyTrNo and verifyWord are required")
		return
	}
	userID := c.GetInt("userId")
	result, err := h.service.ChangeBankAccount(userID, req.VerifyTrNo, req.VerifyWord)
	if err != nil {
		response.HandleError(c, err)
		return
	}
	response.Success(c, result)
}
