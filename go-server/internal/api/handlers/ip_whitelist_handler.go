package handlers

import (
	"strconv"
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/response"

	"github.com/gin-gonic/gin"
)

// IPWhitelistHandler handles IP whitelist CRUD for both admin and partner.
type IPWhitelistHandler struct {
	svc *services.IPWhitelistService
}

func NewIPWhitelistHandler(svc *services.IPWhitelistService) *IPWhitelistHandler {
	return &IPWhitelistHandler{svc: svc}
}

// GetMyWhitelist returns the current user's IP whitelist entries + enabled status.
func (h *IPWhitelistHandler) GetMyWhitelist(c *gin.Context) {
	userID := c.GetInt("userId")

	entries, err := h.svc.GetEntries(userID)
	if err != nil {
		response.InternalServerError(c, "IP 화이트리스트 조회 실패")
		return
	}

	enabled, _ := h.svc.GetEnabled(userID)

	response.Success(c, gin.H{
		"enabled": enabled,
		"entries": entries,
	})
}

// AddToWhitelist adds an IP to the current user's whitelist.
func (h *IPWhitelistHandler) AddToWhitelist(c *gin.Context) {
	userID := c.GetInt("userId")

	var req struct {
		IpAddress   string `json:"ipAddress" binding:"required"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "IP 주소를 입력해주세요")
		return
	}

	entry, err := h.svc.AddEntry(userID, req.IpAddress, req.Description)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, entry)
}

// DeleteFromWhitelist removes an IP entry from the current user's whitelist.
func (h *IPWhitelistHandler) DeleteFromWhitelist(c *gin.Context) {
	userID := c.GetInt("userId")
	entryID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "유효하지 않은 ID")
		return
	}

	if err := h.svc.DeleteEntry(userID, entryID); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, gin.H{"message": "삭제되었습니다"})
}

// ToggleWhitelist enables or disables IP whitelist for the current user.
func (h *IPWhitelistHandler) ToggleWhitelist(c *gin.Context) {
	userID := c.GetInt("userId")

	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "요청 형식이 올바르지 않습니다")
		return
	}

	// 활성화 시 최소 1개 IP 등록 여부 확인
	if req.Enabled {
		entries, _ := h.svc.GetEntries(userID)
		if len(entries) == 0 {
			response.BadRequest(c, "IP를 최소 1개 이상 등록한 후 활성화할 수 있습니다")
			return
		}
	}

	if err := h.svc.SetEnabled(userID, req.Enabled); err != nil {
		response.InternalServerError(c, "설정 변경 실패")
		return
	}

	response.Success(c, gin.H{"enabled": req.Enabled})
}

// GetCurrentIP returns the client's current IP address.
func (h *IPWhitelistHandler) GetCurrentIP(c *gin.Context) {
	response.Success(c, gin.H{"ip": c.ClientIP()})
}
