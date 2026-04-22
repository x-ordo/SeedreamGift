package popbill

// PopbillError는 팝빌 API 에러 응답입니다.
type PopbillError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (e *PopbillError) Error() string {
	return e.Message
}

// TokenResponse는 팝빌 인증 토큰 응답입니다.
type TokenResponse struct {
	SessionToken string `json:"session_token"`
	ServiceID    string `json:"serviceID"`
	LinkID       string `json:"linkID"`
	Expires      int64  `json:"expires"`
}

// RegistIssueResponse는 팝빌 RegistIssue API 응답입니다.
type RegistIssueResponse struct {
	Code       int    `json:"code"`
	Message    string `json:"message"`
	ConfirmNum string `json:"confirmNum"`
	TradeDate  string `json:"tradeDate"`
}
