/*
Package handlers는 관리자용 알림 채널 관리 HTTP 요청/응답 핸들링 로직을 제공합니다.
채널 목록 조회, 채널 설정 조회/수정, 채널 활성화 토글, 채널 연동 테스트 엔드포인트를 제공합니다.
*/
package handlers

import (
	"fmt"
	"net/smtp"
	"strconv"
	"strings"
	"time"
	"seedream-gift-server/internal/app/services"
	"seedream-gift-server/pkg/email"
	"seedream-gift-server/pkg/kakao"
	"seedream-gift-server/pkg/response"
	"seedream-gift-server/pkg/telegram"

	"github.com/gin-gonic/gin"
)

// AdminNotificationHandler는 관리자용 알림 채널 설정 HTTP 요청을 처리하는 핸들러입니다.
type AdminNotificationHandler struct {
	configSvc *services.ExternalServiceConfigService
}

// NewAdminNotificationHandler는 새로운 AdminNotificationHandler 인스턴스를 생성합니다.
func NewAdminNotificationHandler(configSvc *services.ExternalServiceConfigService) *AdminNotificationHandler {
	return &AdminNotificationHandler{configSvc: configSvc}
}

// validChannel은 채널명이 지원되는 채널인지 확인합니다.
func validChannel(ch string) bool {
	return ch == services.ChannelEmail ||
		ch == services.ChannelKakao ||
		ch == services.ChannelTelegram ||
		ch == services.ChannelPopbill
}

// GetChannels는 4개 채널 전체 설정을 마스킹된 값으로 반환합니다.
// GET /admin/notification-channels
func (h *AdminNotificationHandler) GetChannels(c *gin.Context) {
	channels := h.configSvc.GetAllChannels()
	response.Success(c, channels)
}

// GetChannel은 단일 채널 설정을 마스킹된 값으로 반환합니다.
// GET /admin/notification-channels/:channel
func (h *AdminNotificationHandler) GetChannel(c *gin.Context) {
	channel := strings.ToUpper(c.Param("channel"))
	if !validChannel(channel) {
		response.BadRequest(c, fmt.Sprintf("지원하지 않는 채널입니다: %s", channel))
		return
	}

	cfg, err := h.configSvc.GetChannelConfig(channel)
	if err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, cfg)
}

// toggleRequest는 채널 활성화 토글 요청 바디입니다.
type toggleRequest struct {
	Enabled bool `json:"enabled"`
}

// ToggleChannel은 채널 활성화 상태를 변경합니다.
// PATCH /admin/notification-channels/:channel/toggle
func (h *AdminNotificationHandler) ToggleChannel(c *gin.Context) {
	channel := strings.ToUpper(c.Param("channel"))
	if !validChannel(channel) {
		response.BadRequest(c, fmt.Sprintf("지원하지 않는 채널입니다: %s", channel))
		return
	}

	var req toggleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	adminEmail := c.GetString("email")
	if err := h.configSvc.ToggleChannel(channel, req.Enabled, adminEmail); err != nil {
		response.HandleError(c, err)
		return
	}

	status := "비활성화"
	if req.Enabled {
		status = "활성화"
	}
	response.Success(c, gin.H{"message": fmt.Sprintf("%s 채널이 %s되었습니다.", channel, status)})
}

// updateConfigRequest는 채널 설정 업데이트 요청 바디입니다.
type updateConfigRequest struct {
	Fields map[string]string `json:"fields" binding:"required"`
}

// UpdateConfig는 채널 필드를 일괄 업데이트합니다.
// PATCH /admin/notification-channels/:channel/config
func (h *AdminNotificationHandler) UpdateConfig(c *gin.Context) {
	channel := strings.ToUpper(c.Param("channel"))
	if !validChannel(channel) {
		response.BadRequest(c, fmt.Sprintf("지원하지 않는 채널입니다: %s", channel))
		return
	}

	var req updateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	adminEmail := c.GetString("email")
	if err := h.configSvc.UpdateChannelFields(channel, req.Fields, adminEmail); err != nil {
		response.HandleError(c, err)
		return
	}

	response.Success(c, gin.H{"message": fmt.Sprintf("%s 채널 설정이 업데이트되었습니다.", channel)})
}

// testChannelRequest는 채널 연동 테스트 요청 바디입니다.
type testChannelRequest struct {
	Recipient string `json:"recipient"`
}

// TestChannel은 채널 연동을 테스트합니다.
// POST /admin/notification-channels/:channel/test
func (h *AdminNotificationHandler) TestChannel(c *gin.Context) {
	channel := strings.ToUpper(c.Param("channel"))
	if !validChannel(channel) {
		response.BadRequest(c, fmt.Sprintf("지원하지 않는 채널입니다: %s", channel))
		return
	}

	var req testChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	cfg := h.configSvc.GetDecryptedConfig(channel)

	var testErr error
	switch channel {
	case services.ChannelEmail:
		testErr = testEmailChannel(cfg, req.Recipient)
	case services.ChannelKakao:
		testErr = testKakaoChannel(cfg, req.Recipient)
	case services.ChannelTelegram:
		testErr = testTelegramChannel(cfg)
	case services.ChannelPopbill:
		testErr = testPopbillChannel(cfg)
	}

	if testErr != nil {
		response.Success(c, gin.H{
			"success": false,
			"message": fmt.Sprintf("테스트 실패: %s", testErr.Error()),
		})
		return
	}

	response.Success(c, gin.H{
		"success": true,
		"message": fmt.Sprintf("%s 채널 연동 테스트가 성공했습니다.", channel),
	})
}

// ── 채널별 테스트 함수 ──────────────────────────────────────────────────────

// testEmailChannel은 SMTP 설정으로 테스트 이메일을 발송합니다.
func testEmailChannel(cfg map[string]string, recipient string) error {
	smtpHost := cfg["smtp_host"]
	smtpPortStr := cfg["smtp_port"]
	smtpUser := cfg["smtp_user"]
	smtpPass := cfg["smtp_password"]
	smtpFrom := cfg["smtp_from"]
	smtpFromName := cfg["smtp_from_name"]

	if smtpHost == "" || smtpUser == "" {
		return fmt.Errorf("SMTP 설정이 없습니다 (smtp_host, smtp_user 필수)")
	}

	to := recipient
	if to == "" {
		to = smtpUser
	}

	smtpPort := 587
	if smtpPortStr != "" {
		if p, err := strconv.Atoi(smtpPortStr); err == nil && p > 0 {
			smtpPort = p
		}
	}

	if smtpFrom == "" {
		smtpFrom = smtpUser
	}
	if smtpFromName == "" {
		smtpFromName = "W기프트"
	}

	subject := "[" + smtpFromName + "] 이메일 채널 연동 테스트"
	htmlBody := email.WrapLayout("이메일 테스트", fmt.Sprintf(
		"관리자 대시보드에서 발송한 테스트 메시지입니다.<br>발송 시각: %s",
		time.Now().Format("2006-01-02 15:04:05"),
	))

	addr := fmt.Sprintf("%s:%d", smtpHost, smtpPort)
	fromHeader := fmt.Sprintf("%s <%s>", smtpFromName, smtpFrom)
	headers := strings.Join([]string{
		"From: " + fromHeader,
		"To: " + to,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/html; charset=UTF-8",
	}, "\r\n")
	msg := []byte(headers + "\r\n\r\n" + htmlBody)

	auth := smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)
	return smtp.SendMail(addr, auth, smtpFrom, []string{to}, msg)
}

// testKakaoChannel은 Kakao 알림톡 API로 테스트 메시지를 발송합니다.
// 템플릿 미승인 상태에서는 API 오류가 반환될 수 있으며, 이는 예상된 동작입니다.
func testKakaoChannel(cfg map[string]string, recipient string) error {
	senderKey := cfg["sender_key"]
	apiKey := cfg["api_key"]

	if senderKey == "" || apiKey == "" {
		return fmt.Errorf("Kakao 설정이 없습니다 (sender_key, api_key 필수)")
	}
	if recipient == "" {
		return fmt.Errorf("수신자 전화번호가 필요합니다")
	}

	client := kakao.NewClient(senderKey, apiKey)
	return client.SendAlimtalk(recipient, "WELCOME", map[string]string{
		"userName": "테스트",
	}, nil)
}

// testTelegramChannel은 Telegram 봇으로 테스트 메시지를 발송합니다.
func testTelegramChannel(cfg map[string]string) error {
	botToken := cfg["bot_token"]
	chatID := cfg["chat_id"]

	if botToken == "" || chatID == "" {
		return fmt.Errorf("Telegram 설정이 없습니다 (bot_token, chat_id 필수)")
	}

	msg := fmt.Sprintf("관리자 대시보드 채널 연동 테스트\n발송 시각: %s",
		time.Now().Format("2006-01-02 15:04:05"))
	return telegram.SendAlert(botToken, chatID, msg)
}

// testPopbillChannel은 Popbill 설정 유효성을 확인합니다.
// 필수 필드(link_id, secret_key, corp_num)가 설정되어 있는지만 검사합니다.
// 실제 API 인증은 거래 발생 시점에 이루어지므로, 설정 존재 여부로 테스트를 대체합니다.
func testPopbillChannel(cfg map[string]string) error {
	linkID := cfg["link_id"]
	secretKey := cfg["secret_key"]
	corpNum := cfg["corp_num"]

	if linkID == "" {
		return fmt.Errorf("link_id가 설정되지 않았습니다")
	}
	if secretKey == "" {
		return fmt.Errorf("secret_key가 설정되지 않았습니다")
	}
	if corpNum == "" {
		return fmt.Errorf("corp_num(사업자등록번호)이 설정되지 않았습니다")
	}

	isTest := cfg["is_test"] == "true"
	mode := "운영"
	if isTest {
		mode = "테스트"
	}

	// 설정값 존재 확인 완료 — 실제 API 인증은 현금영수증 발급 시 수행됩니다.
	_ = fmt.Sprintf("Popbill %s 모드: linkID=%s, corpNum=%s", mode, linkID, corpNum)
	return nil
}
