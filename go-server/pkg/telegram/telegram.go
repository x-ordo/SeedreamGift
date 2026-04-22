// Package telegram은 텔레그램 봇 API를 사용하여 알림 메시지를 보내기 위한 클라이언트를 제공합니다.
// 서버 측 에러 알림 및 주요 비즈니스 이벤트 알림을 위해 사용됩니다.
package telegram

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// client는 연결 풀 재사용을 위한 패키지 레벨 싱글톤 HTTP 클라이언트입니다.
var client = &http.Client{Timeout: 5 * time.Second}

// globalToken과 globalChatID는 패키지 레벨에서 사용할 텔레그램 설정입니다.
var (
	globalToken  string
	globalChatID string
)

// SetConfig는 패키지 레벨 텔레그램 설정을 저장합니다.
// 핸들러에서 cfg 접근 없이 알림을 보낼 수 있도록 합니다.
func SetConfig(token, chatID string) {
	globalToken = token
	globalChatID = chatID
}

// GetGlobalToken은 패키지 레벨 텔레그램 봇 토큰을 반환합니다.
func GetGlobalToken() string { return globalToken }

// GetGlobalChatID는 패키지 레벨 텔레그램 채팅 ID를 반환합니다.
func GetGlobalChatID() string { return globalChatID }

// SendAlert은 텔레그램 봇 API를 통해 지정된 채팅방으로 메시지를 전송합니다.
// 모든 메시지에 [WowGift] 태그를 자동으로 추가하고 HTML parse_mode를 사용합니다.
// 토큰이나 채팅 ID가 비어있으면 아무 작업도 수행하지 않고 nil을 반환합니다.
func SendAlert(token, chatID, message string) error {
	if token == "" || chatID == "" {
		return nil // silently skip if not configured
	}

	taggedMessage := "🔔 <b>[WowGift]</b>\n" + message

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
	payload := map[string]string{
		"chat_id":    chatID,
		"text":       taggedMessage,
		"parse_mode": "HTML",
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// NotifyRegistration은 신규 회원가입 알림을 전송합니다.
func NotifyRegistration(email, name string) {
	if globalToken == "" || globalChatID == "" {
		return
	}
	msg := fmt.Sprintf(
		"👤 <b>신규 회원가입</b>\n"+
			"<b>Email:</b> %s\n"+
			"<b>Name:</b> %s\n"+
			"<b>Time:</b> %s",
		email, name, time.Now().Format("2006-01-02 15:04:05"),
	)
	go SendAlert(globalToken, globalChatID, msg)
}

// NotifyOrder는 신규 주문 알림을 전송합니다.
func NotifyOrder(orderCode string, amount float64, userName string) {
	if globalToken == "" || globalChatID == "" {
		return
	}
	msg := fmt.Sprintf(
		"💰 <b>신규 주문</b>\n"+
			"<b>주문번호:</b> <code>%s</code>\n"+
			"<b>금액:</b> %s원\n"+
			"<b>주문자:</b> %s\n"+
			"<b>Time:</b> %s",
		orderCode, formatKRW(amount), userName, time.Now().Format("2006-01-02 15:04:05"),
	)
	go SendAlert(globalToken, globalChatID, msg)
}

// NotifyTradeIn은 신규 매입 신청 알림을 전송합니다.
func NotifyTradeIn(brand string, amount float64, userName string) {
	if globalToken == "" || globalChatID == "" {
		return
	}
	msg := fmt.Sprintf(
		"📦 <b>매입 신청</b>\n"+
			"<b>브랜드:</b> %s\n"+
			"<b>정산예정:</b> %s원\n"+
			"<b>신청자:</b> %s\n"+
			"<b>Time:</b> %s",
		brand, formatKRW(amount), userName, time.Now().Format("2006-01-02 15:04:05"),
	)
	go SendAlert(globalToken, globalChatID, msg)
}

// NotifySecurity는 보안 이벤트 알림을 전송합니다.
func NotifySecurity(event, detail, ip string) {
	if globalToken == "" || globalChatID == "" {
		return
	}
	msg := fmt.Sprintf(
		"⚠️ <b>보안 이벤트</b>\n"+
			"<b>Event:</b> %s\n"+
			"<b>Detail:</b> %s\n"+
			"<b>IP:</b> %s\n"+
			"<b>Time:</b> %s",
		event, detail, ip, time.Now().Format("2006-01-02 15:04:05"),
	)
	go SendAlert(globalToken, globalChatID, msg)
}

// NotifyClientError는 프론트엔드에서 보고된 에러를 텔레그램으로 전송합니다.
func NotifyClientError(app, url, message, errorID string) {
	if globalToken == "" || globalChatID == "" {
		return
	}
	msg := fmt.Sprintf(
		"🖥️ <b>클라이언트 에러</b>\n"+
			"<b>App:</b> %s\n"+
			"<b>URL:</b> %s\n"+
			"<b>Error:</b> %s\n"+
			"<b>ErrorID:</b> <code>%s</code>\n"+
			"<b>Time:</b> %s",
		app, url, message, errorID, time.Now().Format("2006-01-02 15:04:05"),
	)
	go SendAlert(globalToken, globalChatID, msg)
}

// NotifyIssuanceFailure는 외부 API 상품권 발급 실패 알림을 전송합니다.
func NotifyIssuanceFailure(orderCode, errMsg string, attempts int, finalStatus string) {
	if globalToken == "" || globalChatID == "" {
		return
	}
	msg := fmt.Sprintf(
		"🚨 <b>상품권 발급 실패</b>\n"+
			"<b>주문:</b> <code>%s</code>\n"+
			"<b>사유:</b> %s\n"+
			"<b>시도:</b> %d/%d\n"+
			"<b>처리:</b> %s\n"+
			"<b>Time:</b> %s",
		orderCode, errMsg, attempts, 3, finalStatus, time.Now().Format("2006-01-02 15:04:05"),
	)
	go SendAlert(globalToken, globalChatID, msg)
}

// formatKRW는 금액을 한국 원화 형식으로 포맷합니다.
func formatKRW(amount float64) string {
	return fmt.Sprintf("%.0f", amount)
}
