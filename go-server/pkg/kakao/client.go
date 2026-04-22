// Package kakao provides a client for the Kakao Business Message (알림톡) API.
package kakao

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"w-gift-server/pkg/logger"

	"go.uber.org/zap"
)

// Client handles communication with the Kakao Alimtalk API.
type Client struct {
	senderKey string
	apiKey    string
	baseURL   string
	http      *http.Client
	enabled   bool
}

// NewClient creates a Kakao Alimtalk client.
// If senderKey or apiKey is empty, the client is disabled (sends are no-ops).
func NewClient(senderKey, apiKey string) *Client {
	return &Client{
		senderKey: senderKey,
		apiKey:    apiKey,
		baseURL:   "https://bizapi.kakao.com/v2/alimtalk",
		http:      &http.Client{Timeout: 10 * time.Second},
		enabled:   senderKey != "" && apiKey != "",
	}
}

// IsEnabled returns whether the client is configured.
func (c *Client) IsEnabled() bool {
	return c.enabled
}

// alimtalkRequest is the Kakao Alimtalk API request body.
type alimtalkRequest struct {
	SenderKey    string              `json:"senderKey"`
	TemplateCode string              `json:"templateCode"`
	RecipientList []alimtalkRecipient `json:"recipientList"`
}

type alimtalkRecipient struct {
	RecipientNo  string            `json:"recipientNo"`
	TemplateVars map[string]string `json:"templateParameter,omitempty"`
	Buttons      []Button  `json:"buttons,omitempty"`
}

// Button represents a CTA button in an alimtalk message.
type Button struct {
	Type   string `json:"type"`
	Name   string `json:"name"`
	LinkMo string `json:"linkMo,omitempty"`
	LinkPc string `json:"linkPc,omitempty"`
}

// SendAlimtalk sends an alimtalk message to a single recipient.
// phone: Korean phone number (01012345678)
// templateCode: pre-approved template code registered in Kakao
// vars: template variable substitutions
// buttons: optional CTA buttons
func (c *Client) SendAlimtalk(phone, templateCode string, vars map[string]string, buttons []Button) error {
	if !c.enabled {
		logger.Log.Debug("kakao alimtalk skipped: not configured",
			zap.String("phone", phone), zap.String("template", templateCode))
		return nil
	}

	body := alimtalkRequest{
		SenderKey:    c.senderKey,
		TemplateCode: templateCode,
		RecipientList: []alimtalkRecipient{
			{
				RecipientNo:  phone,
				TemplateVars: vars,
				Buttons:      buttons,
			},
		},
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("kakao: marshal failed: %w", err)
	}

	req, err := http.NewRequest("POST", c.baseURL+"/send", bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("kakao: request failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "KakaoAK "+c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		logger.Log.Error("kakao alimtalk send failed", zap.Error(err), zap.String("phone", phone))
		return fmt.Errorf("kakao: send failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		logger.Log.Error("kakao alimtalk API error",
			zap.Int("status", resp.StatusCode),
			zap.String("body", string(respBody)),
			zap.String("template", templateCode),
		)
		return fmt.Errorf("kakao: API error %d: %s", resp.StatusCode, string(respBody))
	}

	logger.Log.Info("kakao alimtalk sent",
		zap.String("phone", phone), zap.String("template", templateCode))
	return nil
}

// WebLinkButton creates a web link button for alimtalk.
func WebLinkButton(name, url string) Button {
	return Button{Type: "WL", Name: name, LinkMo: url, LinkPc: url}
}
